"""L05 deriveMessages：日志是事实，消息是投影
=============================================
Motto：模型看到的是投影，不是存储；模型可见即已记录。

L04 用了一个粗糙的 naive_derive。这一课把它升级成正规的 deriveMessages：
一个**纯函数**，把事件日志"折叠"成模型请求要的消息列表。

核心洞察（dsh 最有辨识度的设计）：
  - 消息历史从不单独存储，永远从日志派生。
  - "模型可见即已记录"——任何进入模型请求的东西，都必须能从日志重建。
    因此想给模型加一种新输入，就得先加一种新事件类型（而不是塞个临时变量）。

本课演示三件事投影能优雅处理的事：
  1) 空 assistant 文本不进历史（但事件仍在日志里，保留 usage/回放）。
  2) tool/call 和 tool/result 按 callId 配对成模型要的格式。
  3) 同一份日志，投影永远确定——这就是 fork / resume / 回放的基础。

运行：  python lessons/L05_derive_messages/main.py
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from typing import Any

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))


@dataclass(frozen=True)
class SessionEvent:
    seq: int
    type: str
    data: dict[str, Any]


class Session:
    def __init__(self):
        self._events: list[SessionEvent] = []

    def append(self, type: str, data: dict[str, Any]) -> SessionEvent:
        ev = SessionEvent(len(self._events), type, data)
        self._events.append(ev)
        return ev

    def events(self):
        return list(self._events)


# ==========================================================================
# deriveMessages：纯函数，把事件日志投影成模型消息历史。
# 输入：事件列表。输出：messages。无副作用、可重复、结果确定。
# ==========================================================================
def derive_messages(events: list[SessionEvent]) -> list[dict]:
    # 先收集所有 tool/call 的 callId，供 tool/result 配对校验。
    # "配对"= 每条 tool/result 都能回溯到一条同 callId 的 tool/call；
    # 否则它是孤儿结果（真实 dsh 的不变式不允许，这里显式标出以名副其实）。
    known_call_ids = {ev.data["callId"] for ev in events if ev.type == "tool/call"}

    messages: list[dict] = []
    for ev in events:
        if ev.type == "user/message":
            messages.append({"role": "user", "content": ev.data["content"]})

        elif ev.type == "assistant/message":
            text = ev.data.get("text", "")
            calls = ev.data.get("tool_calls", [])
            # 规则 1：空内容且无工具调用 → 不进派生历史（事件仍在日志，保留 usage/回放）
            if not text and not calls:
                continue
            msg: dict = {"role": "assistant", "content": text}
            if calls:
                msg["tool_calls"] = calls
            messages.append(msg)

        elif ev.type == "tool/result":
            # 规则 2：按 callId 配对——校验它确实对应某条 tool/call，再挂成 tool 消息。
            call_id = ev.data["callId"]
            paired = call_id in known_call_ids
            messages.append({
                "role": "tool",
                "tool_call_id": call_id,
                "content": ev.data["result"],
                # 教学用标记：真实 dsh 中孤儿结果会在 append/投影处被不变式拒绝。
                **({} if paired else {"_orphan": True}),
            })

        # turn/start、turn/end、assistant/chunk 等是"记账/回放"事件，不进派生历史。
    return messages


def demo():
    s = Session()
    # 手工构造一段真实会话会产生的事件序列（含一条空 assistant 消息）
    s.append("turn/start", {"turn": 0})
    s.append("user/message", {"content": "看看环境", "source": "human"})
    s.append("assistant/message", {"text": "我调一下工具", "tool_calls": [{"id": "c1", "name": "shell"}]})
    s.append("tool/call", {"callId": "c1", "name": "shell", "arguments": {"command": "echo hi"}})
    s.append("tool/result", {"callId": "c1", "result": "hi"})
    s.append("assistant/message", {"text": "", "tool_calls": []})  # ← 空消息：max-tokens 之类
    s.append("assistant/message", {"text": "环境正常，任务完成。"})
    s.append("turn/end", {"turn": 0, "reason": "natural-stop"})

    print("===== 原始事件日志（8 条，含记账事件与一条空消息）=====")
    for ev in s.events():
        print(f"  #{ev.seq} {ev.type}")

    print("\n===== deriveMessages 投影出的模型历史 =====")
    for m in derive_messages(s.events()):
        print(f"  {m}")

    print("\n===== 关键：同一日志再投影一次，结果完全一致（可回放）=====")
    first = derive_messages(s.events())
    second = derive_messages(s.events())
    print(f"  两次投影相等: {first == second}")
    print(f"  投影出 {len(first)} 条消息，但日志有 {len(s.events())} 条事件")
    print("  → 差额来自：turn/start、turn/end、tool/call、以及被跳过的空 assistant 消息")

    print("\n===== callId 配对校验：每条 tool 消息都回溯到了对应的 tool/call =====")
    tool_msgs = [m for m in first if m["role"] == "tool"]
    all_paired = all("_orphan" not in m for m in tool_msgs)
    print(f"  {len(tool_msgs)} 条 tool 结果全部配对成功（无孤儿）: {all_paired}")


if __name__ == "__main__":
    demo()
