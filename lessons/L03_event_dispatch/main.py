"""L03 类型化事件与四种分发
============================
Motto：能力调用走 ctx.<service>，观察/拦截/策略走事件。

L02 建立了"服务调用"。但 dsh 里插件之间还有第二条通路：**事件**。
关键原则（务必记住）：
  - 想直接用一个能力 → 调 ctx.<service>（如 ctx.shell(cmd)）。
  - 想观察/拦截/组合策略而不侵入被观察方 → 用事件。

Cordis 有且只有四种分发模式，每种对应一类需求。本课全部实现：

  emit      —— 观察：所有监听者按注册序看到事件，无返回值，不 await。
  waterfall —— 环绕中间件：监听者拿到 (args, next)，调 next() 委派给下一个，
               不调 next() 就短路。值通过 next() 的返回值传递。★ 最重要
  parallel  —— 扇出：所有监听者并行 await，无返回值。
  serial    —— 按序 await，直到某个监听者 "bail"（返回非 null/false/undefined）：
               返回第一个 bail 值并立即停止后续监听者。不是 reducer！

运行：  python lessons/L03_event_dispatch/main.py
"""

from __future__ import annotations

import asyncio
from typing import Any, Callable


# ==========================================================================
# 迷你事件总线：四种分发模式
# ==========================================================================
class EventBus:
    def __init__(self):
        self._listeners: dict[str, list[Callable]] = {}

    def on(self, event: str, listener: Callable, prepend: bool = False):
        lst = self._listeners.setdefault(event, [])
        if prepend:
            lst.insert(0, listener)  # 必须先跑的监听者用 prepend
        else:
            lst.append(listener)

    # ---- emit：观察，无返回，按注册序 ----
    def emit(self, event: str, *args):
        for fn in self._listeners.get(event, []):
            fn(*args)

    # ---- waterfall：环绕中间件，靠 next() 委派 ----
    def waterfall(self, event: str, value: Any) -> Any:
        chain = list(self._listeners.get(event, []))

        def dispatch(index: int, v: Any) -> Any:
            if index >= len(chain):
                return v  # 链尾：返回最终值
            listener = chain[index]

            def next_(nv=None):
                # 不传参就沿用当前值；监听者也可替换值再委派
                return dispatch(index + 1, nv if nv is not None else v)

            return listener(v, next_)

        return dispatch(0, value)

    # ---- parallel：并行 await，无返回 ----
    async def parallel(self, event: str, *args):
        await asyncio.gather(*(fn(*args) for fn in self._listeners.get(event, [])))

    # ---- serial：按序 await，直到某个监听者 bail（返回非 None/False）----
    # 返回第一个 bail 值并**立即停止**后续监听者。这是 Cordis serial 的真实语义，
    # 不是把 value 一路 reduce 下去。（bail = 提前终止分发）
    async def serial(self, event: str, *args) -> Any:
        for fn in self._listeners.get(event, []):
            result = await fn(*args)
            if result is not None and result is not False:
                return result   # 第一个 bail 值胜出，后续监听者不再执行
        return None              # 无人 bail


# ==========================================================================
# 演示 1：emit —— 多个观察者记录同一个事实
# ==========================================================================
def demo_emit(bus: EventBus):
    print("\n=== emit（观察，无返回）===")
    bus.on("tool/call", lambda name: print(f"  [日志] 工具被调用: {name}"))
    bus.on("tool/call", lambda name: print(f"  [遥测] 计数 +1: {name}"))
    bus.emit("tool/call", "shell")


# ==========================================================================
# 演示 2：waterfall —— pre-step 改写 + 权限短路（★ 核心）
# ==========================================================================
def demo_waterfall(bus: EventBus):
    print("\n=== waterfall（环绕中间件，next() 委派）===")

    # 监听者 A：观察 + 改写请求，然后委派
    def annotate(req, next_):
        print(f"  [A] 看到请求: {req}，加个标记后委派")
        return next_({**req, "annotated": True})

    # 监听者 B：权限策略——若命令危险则短路（不调 next）
    def permission(req, next_):
        if "rm -rf" in req.get("command", ""):
            print("  [B] 危险命令，短路拒绝（不调 next）")
            return {"denied": True}
        print("  [B] 命令安全，委派")
        return next_(req)

    # 监听者 C：链尾，真正"执行"
    def execute(req, next_):
        print(f"  [C] 执行: {req}")
        return next_({**req, "executed": True})

    bus.on("agent/pre-step", annotate)
    bus.on("agent/pre-step", permission)
    bus.on("agent/pre-step", execute)

    print("-- 安全请求 --")
    print("  结果:", bus.waterfall("agent/pre-step", {"command": "echo hi"}))
    print("-- 危险请求 --")
    print("  结果:", bus.waterfall("agent/pre-step", {"command": "rm -rf /"}))


# ==========================================================================
# 演示 3：parallel —— 多个工具并发执行（对应真实执行管线的 concurrent execute）
# ==========================================================================
async def demo_parallel(bus: EventBus):
    print("\n=== parallel（并行 await，无返回）===")

    async def fetch_a(_):
        await asyncio.sleep(0.05)
        print("  [并发] 工具 A 完成")

    async def fetch_b(_):
        await asyncio.sleep(0.02)
        print("  [并发] 工具 B 完成（更快先完成）")

    bus.on("tools/execute", fetch_a)
    bus.on("tools/execute", fetch_b)
    await bus.parallel("tools/execute", None)


# ==========================================================================
# 演示 4：serial —— 第一个 bail 值胜出并停止（对应真实 agent/turn-stopping）
# 语义：按序 await，谁先返回非 null/false 的值，谁就胜出，后续监听者不再执行。
# ==========================================================================
async def demo_serial(bus: EventBus):
    print("\n=== serial（按序 await，第一个 bail 值胜出并停止）===")

    async def check_budget(ctx):
        # 观察但不干预 → 返回 None（不 bail），让分发继续到下一个监听者
        print(f"  [预算检查] 预算充足，不干预（返回 None，不 bail）")
        return None

    async def check_goal(ctx):
        # 目标未完成 → bail：返回一个非 None 值，分发在此停止
        print("  [目标检查] 目标未完成 → bail，要求继续（后续监听者不再执行）")
        return {"action": "continue", "reason": "goal-not-done"}

    async def never_runs(ctx):
        print("  [不该出现] 如果这行打印了，说明 serial 语义错了！")
        return {"action": "stop"}

    bus.on("agent/turn-stopping", check_budget)
    bus.on("agent/turn-stopping", check_goal)
    bus.on("agent/turn-stopping", never_runs)  # 在 check_goal bail 后，这个绝不执行
    final = await bus.serial("agent/turn-stopping", {"turn": 0})
    print(f"  第一个 bail 值（胜出）: {final}")


if __name__ == "__main__":
    bus = EventBus()
    demo_emit(bus)
    demo_waterfall(bus)
    asyncio.run(demo_parallel(bus))
    asyncio.run(demo_serial(bus))
