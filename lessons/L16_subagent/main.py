"""L16 Subagent：大任务拆小，上下文隔离（仅 one-shot）
=====================================================
Motto：每个子任务一份干净的上下文，只回传结果。

主 agent 的上下文很宝贵。有些子任务（"读完这 20 个文件总结架构"）会产生大量
中间过程，如果都堆进主对话，主 agent 很快就被噪音淹没。

Subagent 的办法：把子任务委派给一个**全新会话**的子 agent。子 agent 有自己
独立的事件日志（回顾 L04），跑完后只把**最终结果**回传给父 agent——中间过程
留在子会话里，不污染父上下文。

★ 本课只实现 one-shot（一次性）子 agent：启动 → 跑完 → 回传结果 → 结束。
  真实 dsh 的 subagent seam 远比这丰富（见第 8 段），标题特意限定 one-shot。

运行：  python lessons/L16_subagent/main.py
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass, field

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from shared.llm import AssistantTurn, ToolCall, make_llm  # noqa: E402
from shared.shell import run_shell  # noqa: E402


@dataclass
class Session:
    label: str
    events: list = field(default_factory=list)

    def append(self, type, data):
        self.events.append((type, data))


def run_agent(session: Session, llm, prompt: str, max_steps=6) -> str:
    """一个最小 agent loop（就是 L06 的精简版），跑在自己独立的 session 上。"""
    session.append("user/message", {"content": prompt})
    messages = [{"role": "user", "content": prompt}]
    final = ""
    for _ in range(max_steps):
        turn: AssistantTurn = llm.complete(messages)
        session.append("assistant/message", {"text": turn.text})
        if not turn.wants_tools:
            final = turn.text
            break
        for tc in turn.tool_calls:
            result = run_shell(tc.arguments.get("command", "")) if tc.name == "shell" else f"[未知] {tc.name}"
            session.append("tool/result", {"result": result})
            messages.append({"role": "assistant", "content": turn.text})
            messages.append({"role": "tool", "content": result})
    return final


# ==========================================================================
# subagent provider：one-shot。启动一个全新 session 的子 agent，返回结果。
# ==========================================================================
def spawn_subagent(description: str, prompt: str, sub_llm) -> dict:
    print(f"  [spawn] 启动子 agent: {description!r}（全新独立会话）")
    child = Session(label=f"child:{description}")
    result = run_agent(child, sub_llm, prompt)
    print(f"  [spawn] 子 agent 完成，子会话内部有 {len(child.events)} 条事件（留在子会话，不回传）")
    return {"result": result, "child_event_count": len(child.events)}


# ---- 脚本：父 agent 决定委派一个子任务；子 agent 独立完成 ----
def parent_script():
    def s1(_m):
        return AssistantTurn(
            text="这个子任务过程会很啰嗦，我委派给子 agent。",
            tool_calls=[ToolCall("c1", "subagent", {"description": "环境探测", "prompt": "探测运行环境并总结"})],
        )

    def s2(m):
        return AssistantTurn(text=f"子 agent 回传了结果，我据此收尾：{m[-1]['content']}")

    return [s1, s2]


def child_script():
    def s1(_m):
        return AssistantTurn(text="子任务：探测环境。", tool_calls=[ToolCall("x1", "shell", {"command": "echo probing"})])

    def s2(_m):
        return AssistantTurn(text="环境探测完毕：一切正常（这是回传给父 agent 的干净结论）。")

    return [s1, s2]


if __name__ == "__main__":
    parent = Session(label="parent")
    parent_llm = make_llm(script=parent_script())
    child_llm = make_llm(script=child_script())

    parent.append("user/message", {"content": "帮我探测环境并给结论"})
    messages = [{"role": "user", "content": "帮我探测环境并给结论"}]

    print("===== 父 agent 开始 =====")
    for _ in range(4):
        turn = parent_llm.complete(messages)
        parent.append("assistant/message", {"text": turn.text})
        if turn.text:
            print(f"[父 assistant] {turn.text}")
        if not turn.wants_tools:
            break
        for tc in turn.tool_calls:
            if tc.name == "subagent":
                out = spawn_subagent(tc.arguments["description"], tc.arguments["prompt"], child_llm)
                messages.append({"role": "assistant", "content": turn.text})
                messages.append({"role": "tool", "content": out["result"]})

    print(f"\n===== 上下文隔离证明 =====")
    print(f"  父会话事件数: {len(parent.events)}（干净——子 agent 的中间过程没进来）")
    print(f"  子 agent 的啰嗦过程留在它自己的会话里，父只拿到最终结论")
