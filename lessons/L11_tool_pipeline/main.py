"""L11 工具执行管线与策略
=========================
Motto：pre → guard → execute → post → result，策略挂在管线上而非工具里。

L10 的 dispatch 是"裸执行"。真实 dsh 里，一次工具调用要穿过一条管线，
让权限、超时、沙箱、结果改写等策略都能介入，而工具本身对这些一无所知：

  tool/call (记录)
    → tools/pre-execute  (waterfall：hooks / 权限 / 沙箱；可 allow/deny/ask)
    → 单调 guard         (deny 或弃权)
    → tools/execute      (around：超时、重试、指标；并发执行多个工具 ← parallel!)
    → tools/post-execute (waterfall：accept / block / replace / 补充上下文)
    → finalizeContent    (工具自有的最后内容约束)
    → tool/result        (冻结的权威结果)

本课实现这条管线的骨架，并演示：权限拒绝、超时策略、以及一批并发安全的工具
用 parallel 同时执行（呼应 L03 的 parallel）。

运行：  python lessons/L11_tool_pipeline/main.py
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class Tool:
    name: str
    execute: Callable[[dict], Any]
    concurrency_safe: bool = False       # 只有显式 True 才能并发（对应 isConcurrencySafe）
    timeout_s: float | None = None


@dataclass
class Pipeline:
    pre: list[Callable] = field(default_factory=list)      # (call) -> "allow"/"deny"/"ask"
    post: list[Callable] = field(default_factory=list)     # (call, result) -> result'

    async def execute_one(self, tool: Tool, call: dict) -> dict:
        # 1) tool/call 记录
        print(f"    tool/call {tool.name}({call})")

        # 2) pre-execute waterfall（权限/沙箱）
        for policy in self.pre:
            decision = policy(tool, call)
            if decision == "deny":
                print(f"      pre-execute: 拒绝 {tool.name}")
                return {"name": tool.name, "isError": True, "content": "denied by policy"}

        # 3) execute（around：超时）
        try:
            if tool.timeout_s:
                result = await asyncio.wait_for(_run(tool, call), timeout=tool.timeout_s)
            else:
                result = await _run(tool, call)
        except asyncio.TimeoutError:
            print(f"      execute: {tool.name} 超时")
            return {"name": tool.name, "isError": True, "content": f"timeout > {tool.timeout_s}s"}

        # 4) post-execute waterfall（可改写结果）
        outcome = {"name": tool.name, "isError": False, "content": result}
        for hook in self.post:
            outcome = hook(call, outcome)

        # 5) tool/result（冻结）
        print(f"    tool/result {tool.name} → {outcome['content']!r}")
        return outcome


async def _run(tool: Tool, call: dict):
    r = tool.execute(call)
    if asyncio.iscoroutine(r):
        return await r
    return r


# ---- 一批工具的执行：并发安全的走 parallel，其余顺序执行 ----
async def execute_batch(pipeline: Pipeline, tools_and_calls: list[tuple[Tool, dict]]):
    safe = [(t, c) for t, c in tools_and_calls if t.concurrency_safe]
    unsafe = [(t, c) for t, c in tools_and_calls if not t.concurrency_safe]

    results = []
    if safe:
        print(f"  [并发批] {len(safe)} 个并发安全工具用 parallel 同时执行")
        results += await asyncio.gather(*(pipeline.execute_one(t, c) for t, c in safe))
    for t, c in unsafe:
        print(f"  [顺序] {t.name} 非并发安全，单独执行")
        results.append(await pipeline.execute_one(t, c))
    return results


# ---- 策略 ----
def permission_policy(tool: Tool, call: dict):
    if tool.name == "shell" and "rm" in str(call.get("command", "")):
        return "deny"
    return "allow"


def redact_post(call: dict, outcome: dict):
    if isinstance(outcome["content"], str) and "secret" in outcome["content"]:
        outcome["content"] = outcome["content"].replace("secret", "***")
    return outcome


async def slow_fetch(call):
    await asyncio.sleep(call.get("delay", 0.03))
    return f"fetched:{call.get('url')}"


if __name__ == "__main__":
    pipeline = Pipeline(pre=[permission_policy], post=[redact_post])

    async def main():
        print("### 单个工具穿过管线")
        await pipeline.execute_one(Tool("echo", lambda c: c["text"]), {"text": "the secret is 42"})
        await pipeline.execute_one(Tool("shell", lambda c: "ok"), {"command": "rm -rf /"})  # 被拒
        await pipeline.execute_one(Tool("sleep", slow_fetch, timeout_s=0.01), {"url": "x", "delay": 0.5})  # 超时

        print("\n### 一批工具：并发安全的用 parallel 同时执行")
        batch = [
            (Tool("fetchA", slow_fetch, concurrency_safe=True), {"url": "A", "delay": 0.05}),
            (Tool("fetchB", slow_fetch, concurrency_safe=True), {"url": "B", "delay": 0.02}),
            (Tool("write", lambda c: "written", concurrency_safe=False), {"path": "f"}),
        ]
        t0 = time.perf_counter()
        await execute_batch(pipeline, batch)
        print(f"  两个并发工具总耗时 ~{time.perf_counter()-t0:.2f}s（若串行应 ~0.07s+）")

    asyncio.run(main())
