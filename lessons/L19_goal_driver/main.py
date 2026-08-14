"""L19 Goal Round Driver：自动续跑
==================================
Motto：目标未完成就再开一轮，直到完成或阻塞。

L18 有了目标状态，但状态自己不会动。这一课加上**驱动器**。

★ 本次修订：对齐真实 dsh 的 agent/turn-stopping 语义（此前讲错了）。
  真实 agent/turn-stopping 是一个 **serial 事件，但监听器返回 void**——它不是
  "对 stop 布尔值投票"。它是"turn 即将关闭"的**边界通知**：
    · loop 按序 await 所有 stopping 监听器；
    · 想让 turn 继续的监听器，调用 agent.steer(...) 写入真实 steering（副作用），
      而不是返回 {stop: False}；
    · loop 随后**重新读取 inbox**：有新 steering → 再跑一个 step；没有 → 关闭 turn。
  所以"数据决定结果"（有没有 steering），监听器顺序不改变结论。

goal driver 就挂在这里：目标未完成时，它 steer 一条 goal-round 输入，loop 因此续跑。

运行：  python lessons/L19_goal_driver/main.py
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field


# ---- L18 的极简目标领域 ----
@dataclass
class Goal:
    text: str
    phase: str = "active"        # active / blocked / complete


# ==========================================================================
# Agent：持有一个 inbox。steer() 往 inbox 写入 steering（这是续跑的真实机制）。
# ==========================================================================
@dataclass
class Agent:
    goal: Goal
    inbox: list = field(default_factory=list)
    _remaining: int = 3

    def steer(self, text: str):
        """写入 steering（副作用）。真实 dsh：agent.steer(...) 让 loop 重读 inbox 续跑。"""
        self.inbox.append(text)
        print(f"    [turn-stopping:goal] 目标未完成 → agent.steer({text!r})（写 steering，不返回决策）")

    def run_one_step(self, round_no: int):
        self._remaining -= 1
        print(f"  [round {round_no}] agent 干活……剩余 {self._remaining} 步")
        if self._remaining <= 0:
            self.goal.phase = "complete"
            print(f"  [round {round_no}] 目标达成 → complete")


# ==========================================================================
# turn-stopping 监听器：返回 void（None）！想续跑就调 agent.steer(...)。
# 真实签名：'agent/turn-stopping'(payload) => Promise<void> | void
# ==========================================================================
def make_budget_listener():
    async def on_stopping(agent: Agent):
        # 只观察，不干预 → 什么都不做，也不 steer
        print(f"    [turn-stopping:budget] 预算充足，不干预（不 steer）")
        # 返回 None（void）
    return on_stopping


def make_goal_listener(activation: dict):
    async def on_stopping(agent: Agent):
        # 目标还 active 且激活 armed → steer 一条 goal-round 输入让 loop 续跑
        if agent.goal.phase == "active" and activation["armed"]:
            agent.steer(f"继续推进目标：{agent.goal.text}")
        else:
            print(f"    [turn-stopping:goal] 目标 {agent.goal.phase} → 不 steer，turn 将关闭")
        # 返回 None（void）——不返回 stop 决策
    return on_stopping


# ---- serial 通知：按序 await 所有监听器（它们返回 void）----
async def dispatch_turn_stopping(listeners, agent: Agent):
    for fn in listeners:
        await fn(agent)   # 监听器无返回值；续跑与否看它们有没有 steer


async def drive(goal: Goal, agent: Agent, max_rounds: int = 6):
    """loop：跑一个 step → 到停止边界跑 turn-stopping → 重读 inbox → 有 steering 就续跑。"""
    activation = {"armed": True}   # 进程本地激活（真实 dsh：resume/fork 需重新授权）
    listeners = [make_budget_listener(), make_goal_listener(activation)]

    round_no = 0
    while round_no < max_rounds:
        round_no += 1
        agent.run_one_step(round_no)

        # ---- 到达停止边界：跑 turn-stopping（监听器可能 steer）----
        agent.inbox.clear()  # 上一轮的 steering 已被消费
        await dispatch_turn_stopping(listeners, agent)

        # ---- loop 重读 inbox：有 steering → 续跑；没有 → 关闭 turn ----
        if agent.inbox:
            print(f"  → inbox 有 steering，loop 续跑下一 step")
        else:
            print(f"  → inbox 为空，turn 关闭")
            break
    return round_no


if __name__ == "__main__":
    print("===== 场景 A：目标需要 3 步完成，driver 通过 steer 自动续跑 =====")
    goal_a = Goal(text="修绿所有测试")
    agent_a = Agent(goal=goal_a, _remaining=3)
    rounds = asyncio.run(drive(goal_a, agent_a))
    print(f"  共跑了 {rounds} 步，最终目标: {goal_a.phase}")

    print("\n===== 场景 B：目标中途被阻塞 → 不再 steer，turn 关闭 =====")
    goal_b = Goal(text="部署到生产")
    agent_b = Agent(goal=goal_b, _remaining=99)

    async def drive_b():
        activation = {"armed": True}
        listeners = [make_goal_listener(activation)]
        for round_no in range(1, 4):
            agent_b.run_one_step(round_no)
            if round_no == 2:
                goal_b.phase = "blocked"
                print("  [round 2] 遇到需要人工批准的操作 → blocked")
            agent_b.inbox.clear()
            await dispatch_turn_stopping(listeners, agent_b)
            if not agent_b.inbox:
                print("  → inbox 为空，turn 关闭")
                break
            print("  → inbox 有 steering，续跑")

    asyncio.run(drive_b())
    print(f"  最终目标: {goal_b.phase}（阻塞后不再 steer，等人工介入）")
