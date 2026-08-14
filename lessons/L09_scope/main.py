"""L09 Scope 与 shadowing：给单个 agent 一套隔离能力
====================================================
Motto：同名最具体者胜；作用域是 per-agent 人格的根。

到目前为止，工具、提示段落都是"全局"的——所有 agent 共享一份。但真实产品里，
不同 agent 需要不同的能力集：一个只读 agent 不该有 write 工具；一个"翻译官"
agent 需要一个和全局同名但行为不同的工具。

Scope（作用域）解决这个。规则很简单，两层扁平：
  - 注册要么是 global（每个 agent 可见），要么 scoped（只属于某一个 scope key）。
  - 读取时把 global 层和当前 scope 层合并；**同名时 scope 层遮蔽（shadow）global 层**。
  - 还能 restrict：从全局工具集里过滤掉某些工具（被过滤的工具就像不存在）。

本课用一个工具注册表演示 shadowing 和 restriction。

运行：  python lessons/L09_scope/main.py
"""

from __future__ import annotations


class ScopedRegistry:
    """两层扁平作用域的工具注册表。"""

    def __init__(self):
        self._global: dict[str, str] = {}                     # name -> "行为描述"
        self._scoped: dict[object, dict[str, str]] = {}       # scope_key -> {name -> 行为}
        self._restrictions: dict[object, set[str]] = {}       # scope_key -> 允许的全局工具名集合

    def register_global(self, name: str, behavior: str):
        self._global[name] = behavior

    def register_scoped(self, scope_key: object, name: str, behavior: str):
        self._scoped.setdefault(scope_key, {})[name] = behavior

    def restrict(self, scope_key: object, allowed: set[str]):
        """限制：该 scope 只能看到 allowed 里的全局工具。"""
        self._restrictions[scope_key] = allowed

    def resolve(self, scope_key: object | None = None) -> dict[str, str]:
        """解析某个 scope 实际可见的工具集。"""
        # 1) 全局层，先按 restriction 过滤
        allowed = self._restrictions.get(scope_key)
        base = {n: b for n, b in self._global.items() if allowed is None or n in allowed}
        # 2) 合并 scope 层：同名遮蔽（most-specific-wins）
        if scope_key is not None:
            for n, b in self._scoped.get(scope_key, {}).items():
                base[n] = b  # scope 层直接覆盖同名全局
        return base


if __name__ == "__main__":
    reg = ScopedRegistry()

    # 全局工具：所有 agent 默认可见
    reg.register_global("shell", "全局 shell：执行任意命令")
    reg.register_global("write", "全局 write：写文件")
    reg.register_global("read", "全局 read：读文件")

    # 两个 agent，用对象身份当 scope key（真实 dsh：live agent 就是自己 scope 的 key）
    translator = object()
    readonly = object()

    # translator：注册一个同名 shell，但行为不同 → 会遮蔽全局 shell
    reg.register_scoped(translator, "shell", "翻译官专用 shell：只允许 echo 翻译结果")
    reg.register_scoped(translator, "translate", "翻译官私有工具：翻译文本")

    # readonly：限制掉写能力，只保留 read/shell
    reg.restrict(readonly, allowed={"read", "shell"})

    print("===== 全局 agent 看到的工具 =====")
    for n, b in reg.resolve(None).items():
        print(f"  {n:<10} {b}")

    print("\n===== translator agent 看到的工具（shell 被遮蔽 + 多了 translate）=====")
    for n, b in reg.resolve(translator).items():
        marker = "  ← 遮蔽了全局同名" if n == "shell" else ("  ← scope 私有" if n == "translate" else "")
        print(f"  {n:<10} {b}{marker}")

    print("\n===== readonly agent 看到的工具（write 被 restrict 过滤掉）=====")
    for n, b in reg.resolve(readonly).items():
        print(f"  {n:<10} {b}")
    print(f"  （注意：write 不在列表里——被过滤的工具，和不存在没有区别）")
