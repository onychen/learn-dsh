"""learn-dsh 共享基础设施：一个确定性的 Replay LLM，外加可选的真实 DeepSeek API。

为什么需要它
------------
本课要求"每课可独立运行、无需 API key、无需联网"。为此我们内置一个
**Replay LLM**：给它一段脚本（scripted turns），它就按脚本一步步吐出
助手消息或工具调用。这样每课的输出都是确定性的，讲义里的"预期输出"永远对得上。

真实 dsh 里，模型是 `ctx.llm` 这个 seam 背后的 provider（llm-deepseek /
llm-pi-ai / llm-replay 三个实现）。我们这个 ReplayLLM 就对应真实的
`dsh-llm-replay`——它存在的意义正是让测试和教学脱离真实模型。

统一的消息词汇
--------------
无论真假模型，都说同一套"话"：
- assistant 文本： {"type": "text", "text": "..."}
- assistant 工具调用： {"type": "tool_call", "id": "...", "name": "...", "arguments": {...}}
一次模型返回 = 一个 AssistantTurn（可能同时含文本和若干工具调用）。
"""

from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass, field
from typing import Any, Callable


# --------------------------------------------------------------------------
# 统一消息词汇
# --------------------------------------------------------------------------
@dataclass
class ToolCall:
    """模型请求调用一个工具。id 用于把 call 和它的 result 配对。"""

    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class AssistantTurn:
    """一次模型返回：零或一段文本 + 零或多个工具调用。"""

    text: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)

    @property
    def wants_tools(self) -> bool:
        return len(self.tool_calls) > 0


# --------------------------------------------------------------------------
# Replay LLM：确定性假模型
# --------------------------------------------------------------------------
class ReplayLLM:
    """按脚本回放的确定性模型。

    脚本是一个函数列表，每个函数接收"当前完整消息历史"，返回一个 AssistantTurn。
    之所以用函数而不是静态列表，是因为有些课（如工具循环）需要根据
    上一轮工具结果决定下一步说什么——这更贴近真实模型"看历史再决定"的行为。
    """

    name = "replay"

    def __init__(self, script: list[Callable[[list[dict[str, Any]]], AssistantTurn]]):
        self._script = script
        self._cursor = 0

    def complete(self, messages: list[dict[str, Any]]) -> AssistantTurn:
        """给定消息历史，返回下一个 AssistantTurn。脚本走完后默认停止。"""
        if self._cursor >= len(self._script):
            return AssistantTurn(text="[replay 脚本已结束]")
        step = self._script[self._cursor]
        self._cursor += 1
        return step(messages)

    def stream(self, messages: list[dict[str, Any]]):
        """把 complete 的结果切成 chunk 逐个 yield，模拟流式响应（L08 会用到）。"""
        turn = self.complete(messages)
        for ch in turn.text:
            yield {"type": "text_delta", "text": ch}
        for tc in turn.tool_calls:
            yield {"type": "tool_call", "id": tc.id, "name": tc.name, "arguments": tc.arguments}


# --------------------------------------------------------------------------
# 可选：真实 DeepSeek API（设置 DEEPSEEK_API_KEY 后自动可用）
# --------------------------------------------------------------------------
class DeepSeekLLM:
    """真实 DeepSeek API 适配器。仅在设置了 DEEPSEEK_API_KEY 时可用。

    这不是课程重点，只是证明"Replay 和真实模型是同一个 seam 的两个 provider"。
    需要 `pip install requests`。
    """

    name = "deepseek"

    def __init__(self, tools_schema: list[dict[str, Any]] | None = None):
        self.api_key = os.environ["DEEPSEEK_API_KEY"]
        self.base_url = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
        self.model = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")
        self.tools_schema = tools_schema or []

    def complete(self, messages: list[dict[str, Any]]) -> AssistantTurn:
        import requests  # 延迟导入，未安装也不影响 Replay 路径

        payload: dict[str, Any] = {"model": self.model, "messages": messages}
        if self.tools_schema:
            payload["tools"] = self.tools_schema
        resp = requests.post(
            f"{self.base_url}/chat/completions",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json=payload,
            timeout=60,
        )
        resp.raise_for_status()
        msg = resp.json()["choices"][0]["message"]
        calls = []
        for tc in msg.get("tool_calls") or []:
            calls.append(
                ToolCall(
                    id=tc["id"],
                    name=tc["function"]["name"],
                    arguments=json.loads(tc["function"]["arguments"] or "{}"),
                )
            )
        return AssistantTurn(text=msg.get("content") or "", tool_calls=calls)

    def stream(self, messages: list[dict[str, Any]]):
        # 注意：这是**模拟流式**——先做非流式 complete()，再逐字符切片 yield，
        # 不是真实的 SSE 增量流。教学够用；真实 dsh 的 ctx.llm.stream 是真正的
        # 增量 SSE，chunk 类型也更丰富（见 L08 第 8 段）。
        turn = self.complete(messages)
        for ch in turn.text:
            yield {"type": "text_delta", "text": ch}
        for tc in turn.tool_calls:
            yield {"type": "tool_call", "id": tc.id, "name": tc.name, "arguments": tc.arguments}


def make_llm(script: list[Callable] | None = None, tools_schema=None):
    """选择 LLM provider。

    默认走 Replay（确定性、离线、无需 key），保证每课可独立运行。
    仅当**显式**要求真实模型时才切换：设置环境变量 `DSH_LIVE=1`。

    三种结果（避免"假验证"——以为在跑真实模型其实在回放）：
      · 未设 DSH_LIVE           → Replay
      · DSH_LIVE=1 但缺 API key → 直接报错（不静默回落）
      · DSH_LIVE=1 且有 key     → DeepSeek

    ⚠️ 教学定位说明：真实 DeepSeek 路径只演示"provider 可切换 + 纯文本对话"。
    本课的工具调用用的是**教学格式**（{id,name,arguments}），不是 OpenAI/DeepSeek
    的 wire-format；各课也没把 tools schema 传给真实模型。所以真实模型不保证复现
    Replay 的工具调用流程——把工具链路做成 API 兼容会引入一大堆适配复杂度，
    偏离"离线教学"的初衷，故有意不做。想端到端验证工具型 agent，请用 Replay。

    这一段 if/else 就是"llm seam 的 provider 选择"的教学缩影——真实 dsh 里
    这是由 profile/bundle 组合决定挂哪个 provider（见 L08、L20）。
    """
    if os.environ.get("DSH_LIVE") != "1":
        return ReplayLLM(script or [])
    # 显式要求真实模型：缺 key 必须报错，不能静默回落成 Replay
    if not os.environ.get("DEEPSEEK_API_KEY"):
        raise RuntimeError(
            "DSH_LIVE=1 但未设置 DEEPSEEK_API_KEY。"
            "请设置 key，或取消 DSH_LIVE 以使用离线 Replay。"
        )
    base_url = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
    model = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")
    # 打印 provider 信息（绝不打印 key）
    print(f"[llm] 真实模型：provider=deepseek model={model} base_url={base_url}", file=sys.stderr)
    print("[llm] 注意：真实路径仅演示纯文本；工具调用为教学格式，非 API wire-format。", file=sys.stderr)
    return DeepSeekLLM(tools_schema=tools_schema)
