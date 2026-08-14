"""L10 工具注册表：schema + handler + 分派
==========================================
Motto：加一个工具，只加一个定义，循环不用动。

L01 里工具是硬编码的 if 分支。这一课把它做成正规注册表：一个工具 = 一个
ToolDefinition（面向模型的 schema + 执行 handler + 输出规范）。加工具 = 往
注册表加一条定义，agent loop 完全不用动。

注册表还负责一件关键的事：schemas() 只把"面向模型的字段"（name/description/
parameters）暴露给模型，绝不泄漏 handler、timeout 等宿主元数据。

注意：本课只讲"注册 + 分派"。执行时的 pre/guard/execute/post 管线是 L11 的事。

运行：  python lessons/L10_tool_registry/main.py
"""

from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass
from typing import Any, Callable

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from shared.shell import run_shell  # noqa: E402


@dataclass
class ToolDefinition:
    name: str
    description: str
    parameters: dict[str, Any]          # 面向模型的 JSON schema
    execute: Callable[[dict], Any]      # handler（宿主侧，绝不给模型）
    timeout_ms: int | None = None       # 宿主元数据，绝不给模型


class ToolRegistry:
    def __init__(self):
        self._tools: dict[str, ToolDefinition] = {}

    def register(self, tool: ToolDefinition):
        self._tools[tool.name] = tool
        return lambda: self._tools.pop(tool.name, None)  # 可逆注册（呼应 L02）

    def schemas(self) -> list[dict]:
        """只暴露面向模型的字段。handler/timeout 绝不泄漏。"""
        return [
            {"name": t.name, "description": t.description, "parameters": t.parameters}
            for t in self._tools.values()
        ]

    def dispatch(self, name: str, arguments: dict) -> Any:
        tool = self._tools.get(name)
        if tool is None:
            return f"[未知工具] {name}"
        return tool.execute(arguments)


# ---- 定义三个工具（加工具只需加定义）----
def build_registry() -> ToolRegistry:
    reg = ToolRegistry()

    reg.register(ToolDefinition(
        name="shell",
        description="执行一条 shell 命令并返回输出",
        parameters={"command": {"type": "string", "required": True}},
        execute=lambda a: run_shell(a.get("command", "")),
        timeout_ms=30000,
    ))

    reg.register(ToolDefinition(
        name="add",
        description="计算两个整数之和",
        parameters={"a": {"type": "integer", "required": True}, "b": {"type": "integer", "required": True}},
        execute=lambda a: a["a"] + a["b"],
    ))

    reg.register(ToolDefinition(
        name="echo",
        description="原样返回文本",
        parameters={"text": {"type": "string", "required": True}},
        execute=lambda a: a.get("text", ""),
    ))

    return reg


if __name__ == "__main__":
    reg = build_registry()

    print("===== 发给模型的 schema（注意：没有 execute / timeout_ms）=====")
    print(json.dumps(reg.schemas(), ensure_ascii=False, indent=2))

    print("\n===== 循环通过注册表分派调用（loop 不认识具体工具）=====")
    for name, args in [("add", {"a": 2, "b": 3}), ("echo", {"text": "hello"}), ("shell", {"command": "echo via registry"}), ("nope", {})]:
        result = reg.dispatch(name, args)
        print(f"  {name}({args}) → {result!r}")
