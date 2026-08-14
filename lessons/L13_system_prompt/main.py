"""L13 System Prompt 装配
=========================
Motto：提示词不是一段字符串，是各插件贡献的段落 + 工具 schema 协作组装。

到 L12 为止，我们从没认真管过 system prompt。但真实 dsh 里，system prompt 不是
写死的一大段文本，而是**各插件各自贡献一个段落（PromptSection）**，在一次组装里
按顺序拼起来，再加上当前可见的工具 schema（来自 L10 注册表 + L09 scope）。

好处：
  - 加一段提示 = 挂一个 section（可逆注册，呼应 L02 的 effect）。
  - 段落可以是静态文本，也可以按组装上下文动态生成（如插入当前时间/cwd）。
  - scope 决定哪些 section、哪些工具进入这次组装（呼应 L09）。

本课实现一个迷你 system-prompt 服务，演示多个插件贡献段落 + 动态段落 + scope 过滤。

运行：  python lessons/L13_system_prompt/main.py
"""

from __future__ import annotations

import datetime
from dataclasses import dataclass
from typing import Any, Callable


@dataclass
class PromptSection:
    name: str
    order: int
    # text 可以是静态字符串，也可以是接收组装上下文的函数
    text: str | Callable[[dict], str]
    scope: object | None = None       # None=全局；否则只在该 scope 组装时出现


class SystemPromptService:
    def __init__(self):
        self._sections: list[PromptSection] = []

    def register(self, section: PromptSection):
        self._sections.append(section)
        return lambda: self._sections.remove(section)  # 可逆注册

    def assemble(self, ctx: dict, scope: object | None = None, tool_schemas: list[dict] | None = None) -> str:
        # 1) 选出参与本次组装的段落：全局 + 匹配 scope 的
        chosen = [s for s in self._sections if s.scope is None or s.scope is scope]
        # 2) 按 order 排序
        chosen.sort(key=lambda s: s.order)
        # 3) 渲染每个段落（静态或动态）
        parts = []
        for s in chosen:
            body = s.text(ctx) if callable(s.text) else s.text
            parts.append(f"## {s.name}\n{body}")
        # 4) 附上工具 schema（来自注册表 + scope 过滤）
        if tool_schemas:
            names = ", ".join(t["name"] for t in tool_schemas)
            parts.append(f"## 可用工具\n{names}")
        return "\n\n".join(parts)


if __name__ == "__main__":
    svc = SystemPromptService()

    # 不同插件各自贡献段落
    svc.register(PromptSection("身份", 10, "你是 DeepSeek Harness 教学助手。"))
    svc.register(PromptSection("环境", 20, lambda c: f"当前工作目录：{c['cwd']}；平台：{c['platform']}。"))
    svc.register(PromptSection("时间", 30, lambda c: f"当前时间：{c['now']}。"))

    # 一个只在 translator scope 出现的段落（呼应 L09 shadowing 思想）
    translator = object()
    svc.register(PromptSection("人格", 15, "你现在是翻译官，只做翻译。", scope=translator))

    base_ctx = {"cwd": "D:/ds harness", "platform": "Windows", "now": datetime.date(2026, 8, 14)}
    tools = [{"name": "shell"}, {"name": "read"}]

    print("===== 全局 agent 的 system prompt =====")
    print(svc.assemble(base_ctx, scope=None, tool_schemas=tools))

    print("\n\n===== translator agent 的 system prompt（多了'人格'段落）=====")
    print(svc.assemble(base_ctx, scope=translator, tool_schemas=[{"name": "translate"}]))
