"""L04 仅追加的 SessionEvent 日志
=================================
Motto：不存消息历史，只存事件；一切皆可回放。

前三课我们一直用一个 messages 列表当状态。但真实 dsh 从不单独存"消息历史"——
它只存一份**仅追加（append-only）的事件日志**。为什么先在裸循环上立起这个真源，
再在它之上长出 turn/step（L06）？因为一旦"唯一真源"确立，回放、fork、持久化、
遥测就全都是"从同一组事件派生"，后面每一层都不必再各自维护状态。

这一课只做一件事：把"追加消息"改成"追加事件"。事件一旦写入，绝不修改、绝不删除。

运行：  python lessons/L04_session_log/main.py
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass, field
from typing import Any

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from shared.llm import AssistantTurn, ToolCall, make_llm  # noqa: E402
from shared.shell import run_shell  # noqa: E402


# ==========================================================================
# SessionEvent：一条不可变的事件。seq 单调递增且连续。
# ==========================================================================
@dataclass(frozen=True)
class SessionEvent:
    seq: int
    type: str          # user/message, assistant/message, tool/call, tool/result ...（turn/step 见 L06）
    data: dict[str, Any]


class Session:
    """仅追加的事件日志。这是 agent 交互历史的唯一真源。"""

    def __init__(self):
        self._events: list[SessionEvent] = []

    def append(self, type: str, data: dict[str, Any]) -> SessionEvent:
        # 关键不变式：只能往后追加，seq 连续，事件本身 frozen（不可变）。
        ev = SessionEvent(seq=len(self._events), type=type, data=data)
        self._events.append(ev)
        return ev

    def events(self) -> list[SessionEvent]:
        return list(self._events)

    def dump(self):
        print("\n===== 会话日志（仅追加，seq 连续）=====")
        for ev in self._events:
            print(f"  #{ev.seq:<2} {ev.type:<18} {ev.data}")


# ==========================================================================
# agent loop：现在往 Session 追加事件，而不是往 messages 追加消息。
# 注意：模型请求需要的历史，我们暂时"手工"从事件里拼（L05 会做成正规的 deriveMessages）。
# ==========================================================================
def naive_derive(session: Session) -> list[dict]:
    """临时的、粗糙的历史拼装——L05 会替换成正规投影。"""
    msgs = []
    for ev in session.events():
        if ev.type == "user/message":
            msgs.append({"role": "user", "content": ev.data["content"]})
        elif ev.type == "assistant/message":
            msgs.append({"role": "assistant", "content": ev.data["text"]})
        elif ev.type == "tool/result":
            msgs.append({"role": "tool", "content": ev.data["result"]})
    return msgs


def run(session: Session, llm, user_input: str, max_steps: int = 8) -> str:
    # 本课只聚焦"仅追加日志"，故意不引入 turn/step 语义——那是 L06 的主题。
    # 这里只追加最基本的四类事件：user/message、assistant/message、tool/call、tool/result。
    session.append("user/message", {"content": user_input, "source": "human"})

    for _ in range(max_steps):
        turn: AssistantTurn = llm.complete(naive_derive(session))
        session.append("assistant/message", {"text": turn.text})

        if not turn.wants_tools:
            return turn.text

        for tc in turn.tool_calls:
            session.append("tool/call", {"callId": tc.id, "name": tc.name, "arguments": tc.arguments})
            result = run_shell(tc.arguments.get("command", "")) if tc.name == "shell" else f"[未知] {tc.name}"
            session.append("tool/result", {"callId": tc.id, "result": result})

    return "[达到最大步数]"


def build_script():
    def step1(_m):
        return AssistantTurn(
            text="先执行一条命令。",
            tool_calls=[ToolCall(id="c1", name="shell", arguments={"command": "echo event sourcing"})],
        )

    def step2(m):
        return AssistantTurn(text="任务完成。")

    return [step1, step2]


if __name__ == "__main__":
    session = Session()
    llm = make_llm(script=build_script())
    final = run(session, llm, "演示事件日志")
    print(f"\n[最终答复] {final}")
    session.dump()

    # 关键演示：日志是唯一真源。同一份日志重新走一遍 naive_derive，
    # 得到的模型历史完全一致——这就是"可回放"。
    print("\n===== 回放：从日志重新派生模型历史 =====")
    for m in naive_derive(session):
        print(f"  {m['role']:<10} {m['content']!r}")
