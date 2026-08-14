"""L07 pre-step 拦截：让插件决定模型看什么
==========================================
Motto：用 waterfall 在请求前改写或拒绝要进模型的消息。

L06 的 driver 直接把认领到的输入送进模型。但真实 dsh 在每个 step 前，
都会先跑一个 agent/pre-step 的 **waterfall**（回顾 L03）：监听者可以
  - 改写要进模型的消息（比如注入上下文、脱敏、加系统提醒），或
  - 直接拒绝这次输入（返回而不调 next），此时这个 step 不会真正发生。

这就是"插件决定模型看什么"的拦截点。压缩（L15）就是挂在这里做上下文压力检测的。

本课在 L06 的 driver 上加一个 pre-step waterfall，并挂两个监听者演示：
  1) 一个"注入器"：给每次输入追加一段上下文提醒。
  2) 一个"守卫"：遇到空输入就拒绝，让这个 turn 不花任何 step。

运行：  python lessons/L07_pre_step/main.py
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from typing import Any, Callable

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from shared.llm import AssistantTurn, ToolCall, make_llm  # noqa: E402


@dataclass(frozen=True)
class SessionEvent:
    seq: int
    type: str
    data: dict[str, Any]


class Session:
    def __init__(self):
        self._events = []

    def append(self, type, data):
        ev = SessionEvent(len(self._events), type, data)
        self._events.append(ev)
        return ev

    def events(self):
        return list(self._events)


# ---- 迷你 waterfall（同 L03）----
def waterfall(listeners: list[Callable], value: Any) -> Any:
    def dispatch(i, v):
        if i >= len(listeners):
            return v
        return listeners[i](v, lambda nv=None: dispatch(i + 1, nv if nv is not None else v))
    return dispatch(0, value)


# ==========================================================================
# pre-step 决定对象：{messages, rejected}
# 监听者要么改写 messages 后 next()，要么设 rejected 并短路（不调 next）。
# ==========================================================================
def injector(decision, next_):
    """注入器：给每条 user 消息补一段上下文提醒。"""
    msgs = decision["messages"]
    if msgs:
        print(f"  [pre-step:注入器] 给 {len(msgs)} 条输入追加上下文提醒")
        msgs = [{**m, "content": m["content"] + "（提醒：优先用 shell 工具）"} if m["role"] == "user" else m for m in msgs]
    return next_({**decision, "messages": msgs})


def empty_guard(decision, next_):
    """守卫：空输入直接拒绝，短路。"""
    if not decision["messages"]:
        print("  [pre-step:守卫] 空输入 → 拒绝（短路，不调 next），本 turn 不花 step")
        return {"messages": [], "rejected": True}
    print("  [pre-step:守卫] 输入非空 → 委派")
    return next_(decision)


class Driver:
    def __init__(self, session, llm, pre_step_listeners):
        self.session = session
        self.llm = llm
        self.pre_step = pre_step_listeners
        self.turn_no = -1

    def run_turn(self, user_input: str | None) -> str:
        self.turn_no += 1
        self.session.append("turn/start", {"turn": self.turn_no})
        print(f"\n╔══ turn/start turn={self.turn_no}（输入={user_input!r}）")

        claimed = [{"role": "user", "content": user_input}] if user_input else []

        # ---- pre-step waterfall ----
        decision = waterfall(self.pre_step, {"messages": claimed, "rejected": False})

        if decision.get("rejected") or not decision["messages"]:
            # 被拒或空：turn 关闭但没花 step，日志仍记录这次尝试
            self.session.append("turn/end", {"turn": self.turn_no, "reason": "rejected-no-step"})
            print("╚══ turn/end（无 step）")
            return "[本 turn 未产生 step]"

        # ---- 正常 step ----
        self.session.append("step/start", {"turn": self.turn_no, "step": 0})
        for m in decision["messages"]:
            self.session.append("user/message", {"content": m["content"], "source": "human"})
        turn: AssistantTurn = self.llm.complete(decision["messages"])
        self.session.append("assistant/message", {"text": turn.text})
        self.session.append("step/end", {"turn": self.turn_no, "step": 0})
        self.session.append("turn/end", {"turn": self.turn_no, "reason": "natural-stop"})
        print(f"║  [assistant] {turn.text}")
        print("╚══ turn/end")
        return turn.text


def build_script():
    def s1(messages):
        got = messages[-1]["content"]
        return AssistantTurn(text=f"我收到的输入是：{got!r}")
    return [s1]


if __name__ == "__main__":
    session = Session()
    driver = Driver(session, make_llm(script=build_script()), pre_step_listeners=[injector, empty_guard])

    print("### 场景 1：正常输入（会被注入器改写，然后跑一个 step）")
    driver.run_turn("看看环境")

    print("\n### 场景 2：空输入（被守卫拒绝，turn 关闭但不花 step）")
    driver.run_turn(None)

    print("\n===== 日志证明：场景 2 也留下了 turn/start + turn/end（记录了这次尝试）=====")
    for ev in session.events():
        print(f"  #{ev.seq} {ev.type} {ev.data.get('reason','')}")
