"""L17 Jobs：慢操作丢后台，agent 继续想
=======================================
Motto：Jobs 管生命周期，控制器负责把完成事实重新交回 Agent。

有些操作很慢（编译、跑测试、下载）。如果 agent 傻等，就浪费了它"继续想下一步"
的时间。Jobs 的办法：把慢操作丢进后台运行时，agent 立刻拿到一个 job id 继续干别的；
后台任务完成后，再把结果**注入回**会话。

★ 关键澄清（很多人搞错）：不是 jobs 注册表自己把结果写回会话！
  真实 dsh 里，是 job 工具的 **consumer/控制器** 监听 job 完成事件（onJobDone），
  再根据 owner（那个 agent）的状态，选择 inject（塞进下一次请求）或 followup（唤醒新一轮）。
  职责分离：Jobs 管生命周期与身份；控制器管"把完成事实交回哪个 agent、怎么交"。

本课用线程模拟后台任务，演示这个职责分离。

运行：  python lessons/L17_jobs/main.py
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Callable


@dataclass
class Job:
    id: str
    label: str
    status: str = "running"     # running / completed / failed
    result: str | None = None


class JobRegistry:
    """只管生命周期与身份。它绝不碰会话。"""

    def __init__(self):
        self._jobs: dict[str, Job] = {}
        self._counter = 0
        self._on_done: list[Callable[[Job], None]] = []

    def on_done(self, cb: Callable[[Job], None]):
        """控制器在这里订阅完成事件。"""
        self._on_done.append(cb)

    def start(self, kind: str, label: str, work: Callable[[], str]) -> str:
        self._counter += 1
        job = Job(id=f"{kind}-{self._counter}", label=label)
        self._jobs[job.id] = job

        def runner():
            try:
                job.result = work()
                job.status = "completed"
            except Exception as e:  # noqa: BLE001
                job.result = str(e)
                job.status = "failed"
            # 只通知订阅者——注册表自己不写会话！
            for cb in self._on_done:
                cb(job)

        threading.Thread(target=runner, daemon=True).start()
        return job.id


# ==========================================================================
# 控制器（consumer）：监听 job 完成，决定把结果交回 agent 的方式
# ==========================================================================
@dataclass
class Agent:
    inbox: list = field(default_factory=list)     # 注入的上下文，等下一次请求
    idle: bool = True

    def inject(self, text: str):
        self.inbox.append(text)
        print(f"    [控制器→inject] agent 空闲时下一轮会看到: {text!r}")

    def followup(self, text: str):
        self.idle = False
        self.inbox.append(text)
        print(f"    [控制器→followup] 唤醒 agent 新一轮处理: {text!r}")


def make_controller(agent: Agent):
    def on_job_done(job: Job):
        fact = f"[后台任务 {job.id} 完成] {job.label} → {job.result}"
        # 控制器按 owner 状态选择交付方式
        if agent.idle:
            agent.followup(fact)   # agent 已停下 → 唤醒新一轮
        else:
            agent.inject(fact)     # agent 还在忙 → 注入等下一次请求
    return on_job_done


if __name__ == "__main__":
    agent = Agent()
    registry = JobRegistry()
    registry.on_done(make_controller(agent))

    print("===== agent 把慢操作丢后台，立刻继续 =====")
    def slow_build():
        time.sleep(0.1)
        return "构建成功，0 error"

    agent.idle = False  # agent 此刻还在忙别的
    job_id = registry.start("bash", "npm run build", slow_build)
    print(f"  agent 拿到 {job_id}，不等它，继续想下一步...")
    print("  [agent] 我先去分析别的文件（后台任务并行跑着）")

    time.sleep(0.05)
    print("\n===== agent 忙完停下，变为空闲 =====")
    agent.idle = True

    time.sleep(0.15)  # 等后台任务完成，触发控制器
    print(f"\n===== agent 的 inbox（完成事实已由控制器交回）=====")
    for item in agent.inbox:
        print(f"  {item}")
