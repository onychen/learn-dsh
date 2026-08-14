"""L08 LLM 适配器与流式响应（llm seam）
=======================================
Motto：模型本身也是可替换的 provider。

回想 L01：我们直接 llm.complete(messages)。那其实是省略了一层——真实 dsh 里
模型是 ctx.llm 这个 **seam** 背后的 provider（真实有 llm-deepseek / llm-pi-ai /
llm-replay 三个实现）。这一课把这层补上，展示三件事：

  1) 一个 seam 接口（stream 方法）+ 多个可互换的 provider。
  2) 流式：模型不是一次吐完，而是一个个 chunk 流出来（text_delta / tool_call），
     driver 把 chunk 追加成 assistant/chunk 事件（token 级回放），流结束后
     再合成一条 assistant/message（派生历史用这条）。
  3) 错误恢复边界：provider 报错时，driver 决定重试还是保留原错误。

运行：  python lessons/L08_llm_seam/main.py
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass, field
from typing import Any, Iterator

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))


# ==========================================================================
# llm seam：接口约定 = 一个 stream(messages) -> Iterator[chunk]
# ==========================================================================
class LLMProvider:
    """Service Definition（接口）：所有 provider 都实现 stream。"""

    name = "abstract"

    def stream(self, messages: list[dict]) -> Iterator[dict]:
        raise NotImplementedError


class ScriptedProvider(LLMProvider):
    """provider 实现之一：按脚本流式吐 chunk（对应 dsh-llm-replay）。"""

    name = "scripted"

    def __init__(self, text: str, fail_first: bool = False):
        self._text = text
        self._fail_first = fail_first
        self._calls = 0

    def stream(self, messages):
        self._calls += 1
        # 演示错误恢复：第一次调用故意抛错
        if self._fail_first and self._calls == 1:
            raise RuntimeError("模拟的瞬时网络错误")
        for ch in self._text:
            yield {"type": "text_delta", "text": ch}


class UpperCaseProvider(LLMProvider):
    """另一个可互换 provider：把输出全大写。证明"换 provider 就换行为"。"""

    name = "uppercase"

    def stream(self, messages):
        reply = f"echo: {messages[-1]['content']}".upper()
        for ch in reply:
            yield {"type": "text_delta", "text": ch}


# ==========================================================================
# 会话事件（精简）
# ==========================================================================
@dataclass
class Session:
    events: list = field(default_factory=list)

    def append(self, type, data):
        self.events.append((len(self.events), type, data))


# ==========================================================================
# driver：消费流、追加 chunk 事件、合成 message、处理错误恢复
# ==========================================================================
def run_step(session: Session, provider: LLMProvider, messages: list[dict], max_retries: int = 1) -> str:
    attempt = 0
    while True:
        try:
            session.append("step/start", {})
            text_parts = []
            print(f"  [{provider.name}] 流式输出: ", end="")
            for chunk in provider.stream(messages):
                # 每个 chunk 都作为 assistant/chunk 事件记录（token 级回放）
                session.append("assistant/chunk", chunk)
                if chunk["type"] == "text_delta":
                    print(chunk["text"], end="", flush=True)
                    text_parts.append(chunk["text"])
            print()
            # 流结束 → 合成一条 assistant/message（派生历史用这条）
            full = "".join(text_parts)
            session.append("assistant/message", {"text": full})
            session.append("step/end", {})
            return full
        except Exception as e:  # noqa: BLE001
            session.append("step/end", {})
            # ---- 错误恢复边界 ----
            if attempt < max_retries:
                attempt += 1
                print(f"\n  [恢复] 捕获错误 {e!r}，重试第 {attempt} 次")
                continue
            print(f"\n  [恢复] 重试用尽，保留原错误：{e!r}")
            raise


if __name__ == "__main__":
    print("### 同一个 seam，三个可互换 provider")

    print("\n--- provider = scripted ---")
    s1 = Session()
    run_step(s1, ScriptedProvider("你好，我是脚本 provider。"), [{"role": "user", "content": "hi"}])
    print(f"  日志里有 {sum(1 for _,t,_ in s1.events if t=='assistant/chunk')} 个 assistant/chunk（token 级回放）")

    print("\n--- provider = uppercase（换 provider，行为立刻不同）---")
    s2 = Session()
    run_step(s2, UpperCaseProvider(), [{"role": "user", "content": "change me"}])

    print("\n--- provider = scripted，第一次故意失败（演示错误恢复）---")
    s3 = Session()
    run_step(s3, ScriptedProvider("重试后成功了。", fail_first=True), [{"role": "user", "content": "hi"}], max_retries=1)
