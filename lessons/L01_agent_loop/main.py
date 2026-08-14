"""L01 最小 Agent Loop
====================
Motto：一个循环 + 一次模型调用 + 一个工具，就是 agent 的胚胎。

这一课不引入 Cordis、不引入 llm seam、不引入事件日志。就一个裸 while 循环：
    while 模型还想调用工具:
        调模型 -> 拿到它想调的工具 -> 执行工具 -> 把结果塞回历史 -> 再问模型

这就是所有 agent 的最小内核。后面 21 课都是往这个骨架旁边"挂东西"，
而不是改这个循环本身。

运行：  python lessons/L01_agent_loop/main.py
"""

from __future__ import annotations

import os
import sys

# 让本文件能独立运行：把 learn-dsh 根目录加进 import 路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from shared.llm import AssistantTurn, ToolCall, make_llm  # noqa: E402
from shared.shell import run_shell  # noqa: E402


# --------------------------------------------------------------------------
# 这一课只有一个工具：shell。它就是一个普通 Python 函数。
# 注意：这里工具是"硬编码"进循环的——L10 才会把它变成注册表里的一条定义。
# --------------------------------------------------------------------------
def call_tool(name: str, arguments: dict) -> str:
    if name == "shell":
        return run_shell(arguments.get("command", ""))
    return f"[未知工具] {name}"


# --------------------------------------------------------------------------
# 这就是 agent loop 的全部。约 15 行。
# --------------------------------------------------------------------------
def agent_loop(llm, user_input: str, max_steps: int = 8) -> str:
    # messages 就是"喂给模型的历史"。这一课我们直接把它当唯一状态。
    # （L04 会揭示：真实 dsh 不存 messages，只存事件，messages 是投影出来的。）
    messages: list[dict] = [{"role": "user", "content": user_input}]

    for step in range(max_steps):
        print(f"\n--- step {step + 1} ---")
        turn: AssistantTurn = llm.complete(messages)

        if turn.text:
            print(f"[assistant] {turn.text}")

        # 模型不想调工具了 -> 循环结束，这段文本就是最终答复。
        if not turn.wants_tools:
            return turn.text

        # 模型想调工具：把这次 assistant 消息记下，然后逐个执行工具。
        messages.append(
            {"role": "assistant", "content": turn.text, "tool_calls": [tc.__dict__ for tc in turn.tool_calls]}
        )
        for tc in turn.tool_calls:
            print(f"[tool_call] {tc.name}({tc.arguments})")
            result = call_tool(tc.name, tc.arguments)
            print(f"[tool_result] {result}")
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": result})

    return "[达到最大步数，停止]"


# --------------------------------------------------------------------------
# 用 Replay 脚本演示一个真实场景：让 agent 报告当前目录里有什么。
# 脚本第一步：模型决定调 shell；第二步：看到结果后给出总结。
# --------------------------------------------------------------------------
def build_script():
    def step1(_messages):
        return AssistantTurn(
            text="我先看看当前目录里有什么。",
            tool_calls=[ToolCall(id="c1", name="shell", arguments={"command": "echo hello from dsh lesson 01"})],
        )

    def step2(messages):
        last_result = messages[-1]["content"]
        return AssistantTurn(text=f"命令执行完毕，输出是：{last_result!r}。任务完成。")

    return [step1, step2]


if __name__ == "__main__":
    llm = make_llm(script=build_script())
    final = agent_loop(llm, user_input="看看当前环境，然后告诉我结果")
    print("\n==============================")
    print(f"[最终答复] {final}")
