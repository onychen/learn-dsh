"""L18 持久 Goal 领域
=====================
Motto：给会话挂一个持久目标，它是状态不是调度器。

有时一个会话有一个跨多轮的大目标（"把测试全修绿"）。Goal 领域给会话挂一个
**持久的目标状态**：它记录目标是什么、现在处于哪个阶段、改过几次。

关键认知（别搞错）：Goal 只是**状态**，不是调度器、不是另一条对话线。
它的真源仍是会话日志（回顾 L04）——每次目标变更都追加一条 goal/change 事件，
当前状态由日志折叠得到。真正"驱动续跑"的是另一层（L19 的 driver）。

阶段（本课）：active → complete，或 active → blocked。
（真实 dsh 还有 paused；每次变更递增 revision，用于 compare-and-set。）

运行：  python lessons/L18_goal/main.py
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class GoalEvent:
    seq: int
    type: str          # goal/change
    data: dict[str, Any]


class GoalDomain:
    """事件溯源的目标状态。真源是事件日志，状态靠折叠得到。"""

    def __init__(self):
        self._events: list[GoalEvent] = []

    def _append(self, data: dict):
        self._events.append(GoalEvent(len(self._events), "goal/change", data))

    def set_goal(self, text: str):
        self._append({"phase": "active", "text": text, "reason": "created"})

    def block(self, code: str, message: str):
        self._append({"phase": "blocked", "block": {"code": code, "message": message}})

    def complete(self):
        self._append({"phase": "complete", "reason": "done"})

    def snapshot(self) -> dict:
        """把 goal/change 事件折叠成当前状态。revision = 变更次数。"""
        state = {"phase": "none", "text": None, "revision": 0}
        for ev in self._events:
            state.update(ev.data)
            state["revision"] = ev.seq + 1
        return state

    def events(self):
        return list(self._events)


if __name__ == "__main__":
    goal = GoalDomain()

    print("===== 挂一个目标 =====")
    goal.set_goal("把仓库里所有失败的测试修绿")
    print(f"  当前: {goal.snapshot()}")

    print("\n===== 中途遇到障碍 → blocked（带机器可路由的 code）=====")
    goal.block(code="needs-approval", message="修改依赖需要人工批准")
    print(f"  当前: {goal.snapshot()}")

    print("\n===== 障碍解除，重新激活并完成 =====")
    goal.set_goal("把仓库里所有失败的测试修绿")  # 重新 active
    goal.complete()
    print(f"  当前: {goal.snapshot()}")

    print("\n===== 目标的真源是事件日志（折叠得到状态）=====")
    for ev in goal.events():
        print(f"  #{ev.seq} goal/change {ev.data}")
    print(f"  → revision={goal.snapshot()['revision']}：每次变更 +1，用于 compare-and-set")
