"""L02 Cordis：一切皆插件 + 可逆注册
=====================================
Motto：不改核心，只在旁边挂插件；每个注册都能被回退。

L01 里循环、工具、模型全写死在一个函数里。这一课我们把它们拆开——
每一块都变成一个"插件"，向共享的 ctx 贡献服务。从此：
  - 不再有"要改就改核心函数"，而是"挂一个新插件上去"。
  - 每个注册都返回一个 disposer，卸载插件时能干净回退（ctx.effect）。
  - 插件用 inject 声明依赖，ctx 保证依赖就绪后才 apply。

这就是 Cordis 的五个核心思想里最关键的三个（服务、inject、可逆 effect）。
我们手写一个约 40 行的迷你 ctx 来演示，不搬真实 Cordis。

运行：  python lessons/L02_cordis_plugins/main.py
"""

from __future__ import annotations

import os
import sys
from typing import Any, Callable

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from shared.llm import AssistantTurn, ToolCall, make_llm  # noqa: E402
from shared.shell import run_shell  # noqa: E402


# ==========================================================================
# 迷你 Cordis：一个 Context 就是"服务的仓库"
# ==========================================================================
class Context:
    """共享上下文。插件通过 ctx.<key> 认领服务，别的插件按 key 找服务。"""

    def __init__(self):
        self._services: dict[str, Any] = {}
        self._disposers: list[Callable[[], None]] = []

    # -- 服务：用属性方式访问，ctx.tools / ctx.llm / ctx.shell ...
    def provide(self, key: str, service: Any) -> Callable[[], None]:
        """认领一个服务 key。返回 disposer（可逆注册的最小形态）。"""
        if key in self._services:
            raise RuntimeError(f"服务 {key!r} 已被占用")
        self._services[key] = service
        print(f"  [ctx] 提供服务 ctx.{key}")

        def dispose():
            if self._services.get(key) is service:
                del self._services[key]
                print(f"  [ctx] 卸载服务 ctx.{key}")

        self._disposers.append(dispose)
        return dispose

    def __getattr__(self, key: str) -> Any:
        services = self.__dict__.get("_services", {})
        if key in services:
            return services[key]
        raise AttributeError(f"没有服务 ctx.{key}")

    # -- 可逆副作用：任何注册都应有 disposer
    def effect(self, setup: Callable[[], Callable[[], None]]) -> Callable[[], None]:
        """执行一个 setup，登记它返回的 disposer。这是 Cordis 的 ctx.effect() 缩影。"""
        dispose = setup()
        self._disposers.append(dispose)
        return dispose

    # -- 挂载插件：处理 inject 依赖顺序
    def plugin(self, plug: "Plugin"):
        for dep in plug.inject:
            if dep not in self._services:
                raise RuntimeError(f"插件 {plug.name!r} 依赖 ctx.{dep}，但它还没就绪")
        print(f"[boot] 挂载插件 {plug.name}")
        plug.apply(self)

    def unload_all(self):
        """按注册逆序卸载——这就是"reload 和 teardown 可预测地回退"。"""
        print("\n[boot] 卸载所有插件（逆序）")
        for dispose in reversed(self._disposers):
            dispose()


class Plugin:
    """一个插件 = 名字 + inject 依赖声明 + apply(ctx)。"""

    def __init__(self, name: str, apply: Callable[[Context], None], inject: list[str] | None = None):
        self.name = name
        self.apply = apply
        self.inject = inject or []


# ==========================================================================
# 现在把 L01 的三块拆成三个插件
# ==========================================================================
def llm_plugin(ctx: Context):
    """贡献 ctx.llm 服务。"""
    ctx.provide("llm", make_llm(script=build_script()))


def shell_plugin(ctx: Context):
    """贡献 ctx.shell 服务（一个可调用对象）。"""
    ctx.provide("shell", run_shell)


def tools_plugin(ctx: Context):
    """贡献 ctx.tools 注册表。依赖 ctx.shell（inject 声明）。

    注意 ctx.effect：注册 shell 工具是一个可逆副作用，返回 disposer。
    卸载本插件时，这个工具会被干净移除。
    """
    registry: dict[str, Callable[[dict], str]] = {}
    ctx.provide("tools", registry)

    def register_shell_tool():
        registry["shell"] = lambda args: ctx.shell(args.get("command", ""))
        print("  [tools] 注册工具 shell")

        def dispose():
            registry.pop("shell", None)
            print("  [tools] 注销工具 shell")

        return dispose

    ctx.effect(register_shell_tool)


def agent_loop_plugin(ctx: Context):
    """贡献 ctx.agent_loop。依赖 ctx.llm 和 ctx.tools。

    循环逻辑和 L01 一样，但它现在通过 ctx 找服务，而不是写死。
    """

    def run(user_input: str, max_steps: int = 8) -> str:
        messages = [{"role": "user", "content": user_input}]
        for step in range(max_steps):
            print(f"\n--- step {step + 1} ---")
            turn: AssistantTurn = ctx.llm.complete(messages)
            if turn.text:
                print(f"[assistant] {turn.text}")
            if not turn.wants_tools:
                return turn.text
            messages.append({"role": "assistant", "content": turn.text})
            for tc in turn.tool_calls:
                print(f"[tool_call] {tc.name}({tc.arguments})")
                handler = ctx.tools.get(tc.name)
                result = handler(tc.arguments) if handler else f"[未知工具] {tc.name}"
                print(f"[tool_result] {result}")
                messages.append({"role": "tool", "tool_call_id": tc.id, "content": result})
        return "[达到最大步数]"

    ctx.provide("agent_loop", run)


def build_script():
    def step1(_m):
        return AssistantTurn(
            text="我通过 ctx 找到 shell 工具并执行。",
            tool_calls=[ToolCall(id="c1", name="shell", arguments={"command": "echo plugins wired via ctx"})],
        )

    def step2(m):
        return AssistantTurn(text=f"完成，输出：{m[-1]['content']!r}")

    return [step1, step2]


if __name__ == "__main__":
    ctx = Context()
    # 挂载顺序体现 inject 依赖：先 llm/shell，再 tools（依赖 shell），最后 loop
    ctx.plugin(Plugin("llm", llm_plugin))
    ctx.plugin(Plugin("shell", shell_plugin))
    ctx.plugin(Plugin("tools", tools_plugin, inject=["shell"]))
    ctx.plugin(Plugin("agent-loop", agent_loop_plugin, inject=["llm", "tools"]))

    print("\n[boot] 插件树就绪，运行 agent")
    final = ctx.agent_loop("用 ctx 里的 shell 工具做点事")
    print("\n==============================")
    print(f"[最终答复] {final}")

    # 演示可逆：卸载所有插件，服务被逆序干净移除
    ctx.unload_all()
