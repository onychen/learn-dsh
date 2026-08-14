"""L06 Turn 与 Step 的轮次生命周期
===================================
Motto：step = 一次请求 + 其工具；turn = 零或多个 step，跑完才关。

L04/L05 已经在日志里追加 turn/start、turn/end、step 了，但那只是"记账"。
这一课把 Turn/Step 的**语义**讲清楚，并把它做成一个正规的驱动器（driver）：

  turn（一轮）  = 一次"排空输入"的过程，开始于认领输入，结束于"再没有欠账"。
  step（一步）  = 一次模型请求 + 它触发的所有工具调用。
  一个 turn 里可以有 0 个 step（比如输入被 pre-step 拒了）或多个 step
  （模型调了工具、还欠一次请求，就再开一 step）。

关键判定：一个 step 结束后，"工具还欠一次请求"或"有新输入到达" → 再开一 step；
否则这个 turn 就关闭。

运行：  python lessons/L06_turn_step/main.py
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from typing import Any

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from shared.llm import AssistantTurn, ToolCall, make_llm  # noqa: E402
from shared.shell import run_shell  # noqa: E402


@dataclass(frozen=True)
class SessionEvent:
    seq: int
    type: str
    data: dict[str, Any]


class Session:
    def __init__(self):
        self._events: list[SessionEvent] = []

    def append(self, type, data):
        ev = SessionEvent(len(self._events), type, data)
        self._events.append(ev)
        return ev

    def events(self):
        return list(self._events)


def derive_messages(events):
    msgs = []
    for ev in events:
        if ev.type == "user/message":
            msgs.append({"role": "user", "content": ev.data["content"]})
        elif ev.type == "assistant/message" and (ev.data.get("text") or ev.data.get("tool_calls")):
            msgs.append({"role": "assistant", "content": ev.data.get("text", "")})
        elif ev.type == "tool/result":
            msgs.append({"role": "tool", "content": ev.data["result"]})
    return msgs


# ==========================================================================
# Driver：正规的 turn/step 循环。
# ==========================================================================
class Driver:
    def __init__(self, session: Session, llm):
        self.session = session
        self.llm = llm
        self.turn_no = -1
        # 注意：这里没有 step_no 字段——step 是 turn 内局部计数（见 run_turn），
        # 不能跨 turn 累加，否则第二个 turn 的 step 号会接着第一个 turn 往上涨。

    def run_turn(self, user_input: str, max_steps: int = 8) -> str:
        # ---- turn 开始：认领输入 ----
        self.turn_no += 1
        self.session.append("turn/start", {"turn": self.turn_no})
        self.session.append("user/message", {"content": user_input, "source": "human"})
        print(f"\n╔══ turn/start turn={self.turn_no} ══")

        final_text = ""
        tools_owed = True  # 至少要跑一个 step
        step = -1          # ★ step 是 turn 内局部计数，每个 turn 从 0 开始

        while tools_owed and step + 1 < max_steps:
            # ---- 一个 step ----
            step += 1
            self.session.append("step/start", {"turn": self.turn_no, "step": step})
            print(f"║  ┌─ step/start step={step}")

            turn: AssistantTurn = self.llm.complete(derive_messages(self.session.events()))
            self.session.append("assistant/message", {"text": turn.text, "tool_calls": [tc.id for tc in turn.tool_calls]})
            if turn.text:
                print(f"║  │  [assistant] {turn.text}")

            if not turn.wants_tools:
                # 自然停止：这个 step 不欠请求了
                tools_owed = False
                final_text = turn.text
                self.session.append("step/end", {"turn": self.turn_no, "step": step})
                print(f"║  └─ step/end（自然停止，本 turn 不再欠账）")
                break

            # 有工具：执行它们，执行完"还欠一次请求"（要把结果给模型看）
            for tc in turn.tool_calls:
                self.session.append("tool/call", {"callId": tc.id, "name": tc.name, "arguments": tc.arguments})
                result = run_shell(tc.arguments.get("command", "")) if tc.name == "shell" else f"[未知] {tc.name}"
                self.session.append("tool/result", {"callId": tc.id, "result": result})
                print(f"║  │  [tool] {tc.name} → {result!r}")
            self.session.append("step/end", {"turn": self.turn_no, "step": step})
            print(f"║  └─ step/end（工具已跑，仍欠一次请求 → 再开一 step）")
            tools_owed = True

        self.session.append("turn/end", {"turn": self.turn_no, "reason": "natural-stop" if not tools_owed else "max-steps"})
        print(f"╚══ turn/end turn={self.turn_no}，本 turn 跑了 {step + 1} 个 step ══")
        return final_text


def build_script():
    def s1(_m):
        return AssistantTurn(text="第一步：调工具。", tool_calls=[ToolCall("c1", "shell", {"command": "echo step one"})])

    def s2(_m):
        return AssistantTurn(text="第二步：再调一次。", tool_calls=[ToolCall("c2", "shell", {"command": "echo step two"})])

    def s3(_m):
        return AssistantTurn(text="第三步：够了，收尾。")

    # 第二个 turn 的脚本：只跑一个 step 就收尾
    def t2s1(_m):
        return AssistantTurn(text="第二个 turn：一步搞定。")

    return [s1, s2, s3, t2s1]


if __name__ == "__main__":
    session = Session()
    driver = Driver(session, make_llm(script=build_script()))

    final = driver.run_turn("跑一个多 step 的 turn")
    print(f"[最终答复] {final}")

    # ★ 连续跑第二个 turn：step 编号应从 0 重新开始（验证 step 不跨 turn 累加）
    final2 = driver.run_turn("再跑一个 turn，验证 step 从 0 重置")
    print(f"[最终答复] {final2}")
    print("\n[验证] 第二个 turn 的 step/start 应是 step=0，而不是接着第一个 turn 往上涨。")
