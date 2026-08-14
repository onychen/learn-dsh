"""L22 显式 Trace：把事件日志查出来
====================================
Motto：一切皆事件，所以一切皆可显式回溯。

前面 21 课一路在讲"写"侧：怎么往日志追加事件（L04）、怎么投影给模型看（L05）、
怎么用压缩遮蔽旧范围（L15）。这一课补上**读**侧的对称面——dsh 最受称赞的能力：
**显式 trace 查看**。

因为一切皆事件、日志是唯一真源，所以任意一条事件都能被显式回查：
  - read   ：按 seq 范围读原始事件（附带每条的 surface 状态）。
  - search ：全文关键词搜历史事件。
  - trace  ：给定一条事件，追出它的因果关系——
             · 它引用了哪些来源事件（sourceEventSeqs，如 message 引用了哪些 chunk）
             · 它被谁位置替换（replacedBy + replacementChain，如被压缩摘要遮蔽）
             · 哪些后续事件引用它为来源（derivedEventSeqs）

每条事件都标注 surface 三态（和 L05 的投影规则同一套）：
  current   ：当前模型上下文里
  shadowed  ：被压缩替换遮蔽（旧范围，仍在日志）
  log-only  ：记账事件，从不进模型（turn/step、tool/call、compaction/* ...）

★ 与 L15 对齐：surfaceOp 和 sourceEventSeqs 都是 SessionEvent 的**顶层字段**
  （与 data 平级），且仅出现在三种 surface event（user/assistant/tool）上。

运行：  python lessons/L22_session_trace/main.py
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

# 只有这三种是 surface event，可携带 surfaceOp / sourceEventSeqs
SURFACE_TYPES = {"user/message", "assistant/message", "tool/result"}


@dataclass(frozen=True)
class SessionEvent:
    seq: int
    type: str
    data: dict[str, Any]
    # ★ 顶层字段，仅 surface 事件携带
    surface_op: dict | None = None
    source_event_seqs: tuple[int, ...] = ()


class Session:
    def __init__(self):
        self._events: list[SessionEvent] = []

    def append(self, type, data, surface_op=None, source_event_seqs=()) -> SessionEvent:
        if type in SURFACE_TYPES:
            if surface_op is None:
                surface_op = {"op": "append"}
        else:
            assert surface_op is None and not source_event_seqs, \
                f"非 surface 事件 {type} 不应带 surfaceOp/sourceEventSeqs"
        ev = SessionEvent(len(self._events), type, data, surface_op, tuple(source_event_seqs))
        self._events.append(ev)
        return ev

    def events(self):
        return list(self._events)


# ==========================================================================
# foldSurface：给每条事件算出 surface 三态（和 L05/L15 同一套概念）
# ==========================================================================
def fold_surface(events: list[SessionEvent]) -> dict[int, str]:
    """返回 {seq: 'current'|'shadowed'|'log-only'}。"""
    shadowed: set[int] = set()
    for ev in events:
        op = ev.surface_op
        if op and op["op"] == "replace":
            shadowed.update(range(op["start"], op["end"] + 1))

    state: dict[int, str] = {}
    for ev in events:
        if ev.type not in SURFACE_TYPES:
            state[ev.seq] = "log-only"
        elif ev.seq in shadowed:
            state[ev.seq] = "shadowed"
        else:
            state[ev.seq] = "current"
    return state


# ==========================================================================
# 迷你 sessionQuery：read / search / trace
# ==========================================================================
class SessionQuery:
    def __init__(self, session: Session):
        self._events = session.events()
        self._surface = fold_surface(self._events)

    # ---- read：按 seq 范围读，附 surface 状态 ----
    def read(self, start: int = 0, end: int | None = None) -> list[dict]:
        end = len(self._events) - 1 if end is None else end
        return [{"seq": ev.seq, "type": ev.type, "surface": self._surface[ev.seq]}
                for ev in self._events if start <= ev.seq <= end]

    # ---- search：全文关键词（字面量，忽略大小写）----
    def search(self, query: str) -> list[dict]:
        pat = re.compile(re.escape(query), re.IGNORECASE)
        return [{"seq": ev.seq, "type": ev.type, "surface": self._surface[ev.seq]}
                for ev in self._events if pat.search(str(ev.data))]

    # ---- trace：追一条事件的因果关系 ----
    def trace(self, seq: int) -> dict:
        target = self._events[seq]
        result: dict[str, Any] = {
            "target": {"seq": seq, "type": target.type, "surface": self._surface[seq]},
            "sourceEventSeqs": list(target.source_event_seqs),  # 目标直接引用的来源（顶层字段）
            "derivedEventSeqs": [],      # 直接引用目标为来源的后续事件
            "replacedBy": None,          # 目标被哪条事件位置替换
            "replacementChain": [],      # 从直接替换者到最终替换者
            "replacedEventSeqs": [],     # 目标自己替换掉了哪些事件
        }

        # 谁引用目标为来源（读顶层 source_event_seqs）
        for ev in self._events:
            if seq in ev.source_event_seqs:
                result["derivedEventSeqs"].append(ev.seq)

        # 目标若是替换者：它遮蔽了哪些 seq
        op = target.surface_op
        if op and op["op"] == "replace":
            result["replacedEventSeqs"] = list(range(op["start"], op["end"] + 1))

        # 目标是否被替换：追替换链
        chain = []
        cur = seq
        while True:
            replacer = None
            for ev in self._events:
                o = ev.surface_op
                if o and o["op"] == "replace" and o["start"] <= cur <= o["end"] and ev.seq != cur:
                    replacer = ev.seq
                    break
            if replacer is None:
                break
            chain.append(replacer)
            cur = replacer
        if chain:
            result["replacedBy"] = chain[0]
            result["replacementChain"] = chain

        return result


def build_session() -> Session:
    """造一段真实会话：含 chunk→message 引用，以及一次压缩遮蔽。"""
    s = Session()
    s.append("turn/start", {"turn": 0})                                   # 0 log-only
    s.append("user/message", {"content": "帮我修复失败的测试"})              # 1 append，会被遮蔽
    s.append("assistant/chunk", {"text": "我"})                            # 2 log-only
    s.append("assistant/chunk", {"text": "先看看"})                         # 3 log-only
    # assistant/message 顶层 source_event_seqs 引用它的 chunk 2,3
    s.append("assistant/message", {"text": "我先看看"}, source_event_seqs=[2, 3])  # 4
    s.append("tool/call", {"callId": "c1", "name": "shell"})               # 5 log-only
    s.append("tool/result", {"callId": "c1", "result": "3 tests failed"})  # 6 append，会被遮蔽
    s.append("assistant/message", {"text": "找到 3 个失败的测试。"})          # 7 append，会被遮蔽
    # ---- 一次压缩：把 seq 1..7 里的 surface 事件摘要遮蔽 ----
    s.append("compaction/start", {"turn": 0})                             # 8 log-only
    s.append("user/message", {"content": "（摘要：用户要求修测试，已定位 3 个失败）", "source": "compaction"},
             surface_op={"op": "replace", "start": 1, "end": 7})           # 9 摘要（替换者）
    s.append("compaction/end", {"turn": 0})                               # 10 log-only
    s.append("user/message", {"content": "继续修"})                         # 11 append，current
    return s


if __name__ == "__main__":
    s = build_session()
    q = SessionQuery(s)

    print("===== read：读全部事件 + surface 三态 =====")
    for r in q.read():
        mark = {"current": "●在模型上下文", "shadowed": "○被压缩遮蔽", "log-only": "·记账事件"}[r["surface"]]
        print(f"  #{r['seq']:<2} {r['type']:<20} [{r['surface']:<9}] {mark}")

    print("\n===== search：搜 '失败' =====")
    for r in q.search("失败"):
        print(f"  命中 #{r['seq']} {r['type']} [{r['surface']}]")

    print("\n===== trace #4（一条 assistant/message）：它引用了哪些 chunk，被谁引用 =====")
    t4 = q.trace(4)
    print(f"  目标: {t4['target']}")
    print(f"  引用的来源事件 (sourceEventSeqs): {t4['sourceEventSeqs']}  ← 就是那两条 chunk（顶层字段）")

    print("\n===== trace #6（一条被压缩遮蔽的 tool/result）：谁替换了它 =====")
    t6 = q.trace(6)
    print(f"  目标: {t6['target']}")
    print(f"  被替换 (replacedBy): {t6['replacedBy']}  ← 摘要事件 #9")
    print(f"  替换链 (replacementChain): {t6['replacementChain']}")

    print("\n===== trace #9（那条压缩摘要）：它遮蔽了哪些事件 =====")
    t9 = q.trace(9)
    print(f"  目标: {t9['target']}")
    print(f"  它替换掉的事件 (replacedEventSeqs): {t9['replacedEventSeqs']}  ← 旧的 1..7")
    print("\n  → 关键：被遮蔽的事件一条没删，trace 随时能把因果链显式追出来。")
