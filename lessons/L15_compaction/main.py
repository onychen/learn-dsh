"""L15 Compaction：上下文总会满，要腾地方
=========================================
Motto：日志从不删除，只追加一条 replace 事件把旧范围移出 surface。

会话越长，事件越多，模型请求的 token 迟早撑爆。Compaction（压缩）的办法：
把一段旧事件"摘要"成一小段，让模型只看到摘要，而不是原始的一大堆。

但这里有个 dsh 最关键的设计（务必讲真，别讲成"删掉旧消息"）：

  ★ 压缩从不删除日志！日志永远仅追加（回顾 L04）。
  ★ 压缩做的是：追加一条 surfaceOp=replace 的 user/message（摘要），
    它在 surface 上"遮蔽"掉旧范围；旧事件仍在日志里，仍可回放，只是不再
    进入当前模型 surface。
  ★ shadow 三件套：① log-only 的 compaction/* 记账事件 ② surface 上的替换
    ③ shadowedSeqs 记录被遮蔽的事件 seq，供回放恢复。

★ 重要对齐（本次修订）：surfaceOp 是 SessionEvent 的**顶层字段**（与 data 平级），
  不是塞进 data。而且它对每个 surface 事件（user/assistant/tool）都**必填**——
  普通消息声明 surfaceOp='append'（尾部追加），压缩摘要声明 replace。
  非 surface 事件（turn/step、compaction/* 等）绝不携带 surfaceOp。

运行：  python lessons/L15_compaction/main.py
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

# 只有这三种是 surface event，必须带 surfaceOp
SURFACE_TYPES = {"user/message", "assistant/message", "tool/result"}


@dataclass
class SessionEvent:
    seq: int
    type: str
    data: dict[str, Any]
    # ★ surface_op 在事件顶层，仅 surface 事件携带（非 surface 事件为 None）
    surface_op: dict | None = None


class Session:
    def __init__(self):
        self._events: list[SessionEvent] = []

    def append(self, type, data, surface_op: dict | None = None) -> SessionEvent:
        # 对齐真实约定：surface 事件必须声明 surfaceOp；默认 append。
        if type in SURFACE_TYPES:
            if surface_op is None:
                surface_op = {"op": "append"}
        else:
            # 非 surface 事件绝不携带 surfaceOp（真实 dsh 在 append 处由编译器强制）
            assert surface_op is None, f"非 surface 事件 {type} 不应带 surfaceOp"
        ev = SessionEvent(len(self._events), type, data, surface_op)
        self._events.append(ev)
        return ev

    def events(self):
        return list(self._events)


# ==========================================================================
# deriveMessages：尊重 replace 遮蔽。
# 一条 surfaceOp={op:replace,start,end} 的事件会遮蔽 [start,end] 内的 surface 事件。
# ==========================================================================
def derive_messages(events: list[SessionEvent]) -> list[dict]:
    # 收集所有被遮蔽的 seq（读顶层 surface_op，不是 data）
    shadowed: set[int] = set()
    for ev in events:
        op = ev.surface_op
        if op and op["op"] == "replace":
            shadowed.update(range(op["start"], op["end"] + 1))

    msgs = []
    for ev in events:
        if ev.seq in shadowed:
            continue  # 被摘要遮蔽，不进 surface（但事件仍在日志里！）
        if ev.type == "user/message":
            is_summary = ev.surface_op and ev.surface_op["op"] == "replace"
            tag = "[摘要]" if is_summary else ""
            msgs.append({"role": "user", "content": tag + ev.data["content"]})
        elif ev.type == "assistant/message":
            msgs.append({"role": "assistant", "content": ev.data["content"]})
    return msgs


def compact(session: Session, keep_last: int = 2):
    """把靠前的 surface 事件摘要成一条 replace user/message。"""
    # 普通 surface 事件 = op 为 append 的那些
    surface = [ev for ev in session.events()
               if ev.type in ("user/message", "assistant/message")
               and ev.surface_op and ev.surface_op["op"] == "append"]
    if len(surface) <= keep_last:
        print("  [compaction] surface 事件不多，无需压缩")
        return

    to_shadow = surface[:-keep_last]  # 除了最近几条，其余全摘要
    start, end = to_shadow[0].seq, to_shadow[-1].seq

    # ① log-only 记账：compaction/start（非 surface，不带 surfaceOp）
    session.append("compaction/start", {"turn": 0})
    # ② surface 替换：一条 surfaceOp=replace 的 user/message（顶层字段！）
    fake_summary = f"（此前 {len(to_shadow)} 条消息的摘要：用户在调试 agent，已执行若干命令。）"
    session.append("user/message", {"content": fake_summary, "source": "compaction"},
                   surface_op={"op": "replace", "start": start, "end": end})
    # ③ log-only 记账：compaction/summary（记录被遮蔽的 seq）
    session.append("compaction/summary", {"shadowedSeqs": [ev.seq for ev in to_shadow],
                                          "shadowedRange": {"start": start, "end": end}})
    session.append("compaction/end", {"turn": 0})
    print(f"  [compaction] 已把 seq {start}..{end}（{len(to_shadow)} 条）摘要遮蔽")


if __name__ == "__main__":
    s = Session()
    # 造一段长会话（每条普通消息自动带 surfaceOp='append'）
    for i in range(5):
        s.append("user/message", {"content": f"用户消息 {i}", "source": "human"})
        s.append("assistant/message", {"content": f"助手回复 {i}"})

    print(f"===== 压缩前：日志 {len(s.events())} 条事件 =====")
    before = derive_messages(s.events())
    print(f"  deriveMessages → {len(before)} 条模型消息")
    print(f"  （注意：每条普通消息的顶层 surface_op 都是 {{'op': 'append'}}）")

    print("\n===== 执行压缩（保留最近 2 条 surface 事件）=====")
    compact(s, keep_last=2)

    print(f"\n===== 压缩后：日志变成 {len(s.events())} 条事件（更多了，不是更少！）=====")
    after = derive_messages(s.events())
    print(f"  deriveMessages → {len(after)} 条模型消息（surface 变短了）")
    for m in after:
        print(f"    {m['role']:<10} {m['content']}")

    print("\n===== 关键：旧事件仍在日志里，可回放 =====")
    print(f"  日志总事件数 {len(s.events())}，其中被遮蔽的旧事件一条没删")
    # 展示那条摘要事件的顶层 surface_op
    summary_ev = next(ev for ev in s.events() if ev.surface_op and ev.surface_op["op"] == "replace")
    print(f"  摘要事件 #{summary_ev.seq} 的顶层 surface_op = {summary_ev.surface_op}")
