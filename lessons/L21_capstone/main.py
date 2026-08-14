"""L21 Capstone：合成一个可跑的 mini-dsh
=========================================
Motto：所有机制合一，对照真实 harness 看每层如何插在一起。

这是压轴课。它把前 20 课的核心机制装进一个约 200 行的 mini-dsh：

  L02 Cordis ctx 插件      —— 一切经 ctx 组合
  L03 事件（waterfall）     —— pre-step 拦截
  L04 仅追加事件日志         —— 唯一真源
  L05 deriveMessages       —— 从日志投影历史
  L06 turn/step 生命周期     —— 驱动循环
  L08 llm seam             —— 可换 provider（这里用 Replay）
  L10/L11 工具注册表 + 管线   —— 工具经 pre/execute/post 分派
  L16 subagent             —— 委派子任务，上下文隔离

对照 deepseek-harness/examples/headless-agent：真实的 headless profile 也是把
"agent 主干 + 一个 root agent + 持久化 + checkpoint" 组合起来，接一个任务、
跑完、打印最终文本、退出。本课就是它的教学缩影。

运行：  python lessons/L21_capstone/main.py
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass, field
from typing import Any, Callable

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from shared.llm import AssistantTurn, ToolCall, make_llm  # noqa: E402
from shared.shell import run_shell  # noqa: E402


# ---------- L04：仅追加事件日志 ----------
@dataclass(frozen=True)
class SessionEvent:
    seq: int
    type: str
    data: dict


class Session:
    def __init__(self, label="root"):
        self.label = label
        self._events: list[SessionEvent] = []

    def append(self, type, data):
        self._events.append(SessionEvent(len(self._events), type, data))

    def events(self):
        return list(self._events)


# ---------- L05：deriveMessages（保留完整 tool_calls，并按 callId 配对 tool 结果）----------
def derive_messages(events) -> list[dict]:
    msgs = []
    for ev in events:
        if ev.type == "user/message":
            msgs.append({"role": "user", "content": ev.data["content"]})
        elif ev.type == "assistant/message" and (ev.data.get("text") or ev.data.get("tool_calls")):
            m = {"role": "assistant", "content": ev.data.get("text", "")}
            # 保留完整工具调用定义（换成真实模型也不会断链）
            if ev.data.get("tool_calls"):
                m["tool_calls"] = ev.data["tool_calls"]
            msgs.append(m)
        elif ev.type == "tool/result":
            # 按 callId 配对：真实 API 靠 tool_call_id 把 result 挂回对应的 call
            msgs.append({"role": "tool", "tool_call_id": ev.data["callId"], "content": ev.data["result"]})
    return msgs


# ---------- L02：迷你 ctx ----------
class Context:
    def __init__(self):
        self._svc: dict[str, Any] = {}

    def provide(self, key, svc):
        self._svc[key] = svc

    def __getattr__(self, key):
        svc = self.__dict__.get("_svc", {})
        if key in svc:
            return svc[key]
        raise AttributeError(key)


# ---------- L10/L11：工具注册表 + 管线 ----------
@dataclass
class ToolRegistry:
    tools: dict = field(default_factory=dict)
    pre: list = field(default_factory=list)

    def register(self, name, execute):
        self.tools[name] = execute

    def dispatch(self, name, args) -> str:
        for policy in self.pre:                       # L11 pre-execute
            if policy(name, args) == "deny":
                return f"[denied] {name}"
        fn = self.tools.get(name)
        return str(fn(args)) if fn else f"[未知工具] {name}"


# ---------- L03：pre-step waterfall ----------
def run_waterfall(listeners, value):
    def dispatch(i, v):
        if i >= len(listeners):
            return v
        return listeners[i](v, lambda nv=None: dispatch(i + 1, nv if nv is not None else v))
    return dispatch(0, value)


# ---------- L06：turn/step 驱动器 ----------
class AgentLoop:
    def __init__(self, ctx: Context, session: Session, pre_step=None):
        self.ctx = ctx
        self.session = session
        self.pre_step = pre_step or []

    def run(self, user_input: str, max_steps=8) -> str:
        self.session.append("turn/start", {"turn": 0})
        # L03 pre-step 拦截
        decision = run_waterfall(self.pre_step, {"content": user_input})
        self.session.append("user/message", {"content": decision["content"], "source": "human"})

        final = ""
        for step in range(max_steps):
            self.session.append("step/start", {"step": step})
            turn: AssistantTurn = self.ctx.llm.complete(derive_messages(self.session.events()))
            # 记录完整工具调用定义（id+name+arguments），以便派生历史时不断链
            tool_calls = [{"id": c.id, "name": c.name, "arguments": c.arguments} for c in turn.tool_calls]
            self.session.append("assistant/message", {"text": turn.text, "tool_calls": tool_calls})
            if turn.text:
                print(f"  [assistant] {turn.text}")
            if not turn.wants_tools:
                final = turn.text
                self.session.append("step/end", {"step": step})
                break
            for tc in turn.tool_calls:
                self.session.append("tool/call", {"callId": tc.id, "name": tc.name})
                result = self.ctx.tools.dispatch(tc.name, tc.arguments)
                self.session.append("tool/result", {"callId": tc.id, "result": result})
                print(f"  [tool] {tc.name} → {result!r}")
            self.session.append("step/end", {"step": step})
        self.session.append("turn/end", {"turn": 0, "reason": "natural-stop"})
        return final


# ---------- L16：subagent 工具 ----------
def make_subagent_tool(child_llm_factory: Callable[[], Any]):
    def spawn(args):
        child_ctx = Context()
        child_ctx.provide("llm", child_llm_factory())
        child_ctx.provide("tools", _build_tools())
        child = Session(label="child")
        loop = AgentLoop(child_ctx, child)
        result = loop.run(args["prompt"])
        return f"{result}（子会话内 {len(child.events())} 条事件，未回传）"
    return spawn


# ---------- 组装（L20 的手动缩影）----------
def _build_tools() -> ToolRegistry:
    reg = ToolRegistry()
    reg.pre.append(lambda name, args: "deny" if "rm -rf" in str(args.get("command", "")) else "allow")
    reg.register("shell", lambda a: run_shell(a.get("command", "")))
    return reg


def build_child_llm():
    def s1(_m):
        return AssistantTurn(text="子任务：探测。", tool_calls=[ToolCall("x1", "shell", {"command": "echo child probing"})])

    def s2(_m):
        return AssistantTurn(text="子任务完成：环境正常。")
    return make_llm(script=[s1, s2])


def build_root_llm():
    def s1(_m):
        return AssistantTurn(text="先本地跑一条命令。", tool_calls=[ToolCall("c1", "shell", {"command": "echo mini-dsh alive"})])

    def s2(_m):
        return AssistantTurn(text="再委派一个子任务隔离上下文。", tool_calls=[ToolCall("c2", "subagent", {"prompt": "探测环境"})])

    def s3(m):
        return AssistantTurn(text="全部完成。mini-dsh 跑通了 8 层机制。")
    return make_llm(script=[s1, s2, s3])


def context_reminder(decision, next_):
    """L03/L14 风格：pre-step 注入一条上下文提醒。"""
    return next_({**decision, "content": decision["content"] + "（提醒：可用 shell 与 subagent）"})


if __name__ == "__main__":
    # ---- 组装 mini-dsh（对照 headless profile）----
    ctx = Context()
    ctx.provide("llm", build_root_llm())
    tools = _build_tools()
    tools.register("subagent", make_subagent_tool(build_child_llm))
    ctx.provide("tools", tools)

    root = Session(label="root")
    loop = AgentLoop(ctx, root, pre_step=[context_reminder])

    print("========== mini-dsh 启动（headless 缩影）==========")
    final = loop.run("演示一下你的能力")
    print(f"\n[最终答复] {final}")

    print(f"\n========== 唯一真源：root 会话日志 ==========")
    for ev in root.events():
        print(f"  #{ev.seq:<2} {ev.type}")
    print(f"\n  共 {len(root.events())} 条事件。模型历史随时可从这份日志重新派生（可回放）。")
    print("  子 agent 的中间过程留在它自己的会话，root 日志保持干净。")
