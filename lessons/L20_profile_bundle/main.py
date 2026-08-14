"""L20 Profile / Bundle：把插件树叠出来
=======================================
Motto：产品 = 有序层叠的插件树，任意一行都能被 patch 替换。

前面 19 课我们手动 new 各种插件。但真实产品不是手写启动代码，而是**声明式组合**：
一个 profile 列出它要叠哪些 bundle，每个 bundle 贡献若干配置行（config rows），
按顺序层叠成最终的插件树。最后还能用 --patch 覆盖任意一行。

层叠顺序（真实 dsh）：
  dsh-base（模型/工具/持久化/...）→ profile 自己的 bundle → profile patch
  → home 级 patch → --patch 覆盖
后面的层能替换前面层的任意一行（按 id 定位）。

本课用一组 dict（config rows）模拟这个层叠 + patch 覆盖。

运行：  python lessons/L20_profile_bundle/main.py
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ConfigRow:
    id: str
    plugin: str
    config: dict = field(default_factory=dict)
    disabled: bool = False


def apply_layer(tree: dict[str, ConfigRow], layer: list[ConfigRow], layer_name: str):
    """应用一层：按 id 定位——已存在则整行替换，否则插入。"""
    for row in layer:
        action = "替换" if row.id in tree else "插入"
        tree[row.id] = row
        print(f"  [{layer_name}] {action} 行 id={row.id} → {row.plugin} {row.config or ''}")


# ==========================================================================
# 各个 bundle / profile 层
# ==========================================================================
def dsh_base() -> list[ConfigRow]:
    """每个 profile 的第一层：模型、工具、持久化。"""
    return [
        ConfigRow("llm", "dsh-llm-deepseek", {"model": "deepseek-chat"}),
        ConfigRow("tool-shell", "dsh-tool-bash", {}),
        ConfigRow("persistence", "dsh-persistence-jsonl", {}),
    ]


def headless_bundle() -> list[ConfigRow]:
    """headless profile 叠加：一次性运行器 + subagent + goal。"""
    return [
        ConfigRow("runner", "dsh-headless-runner", {}),
        ConfigRow("subagent", "dsh-subagent-spawn-in-process", {}),
        ConfigRow("goal", "dsh-goal", {}),
    ]


def web_bundle() -> list[ConfigRow]:
    """web profile 叠加：浏览器应用 + web 服务器。"""
    return [
        ConfigRow("web-app", "dsh-web-app", {}),
        ConfigRow("server", "dsh-web-server", {"port": 8080}),
    ]


def build_profile(name: str, patch: list[ConfigRow] | None = None) -> dict[str, ConfigRow]:
    print(f"\n===== 组合 profile: {name} =====")
    tree: dict[str, ConfigRow] = {}
    apply_layer(tree, dsh_base(), "dsh-base")
    if name == "headless":
        apply_layer(tree, headless_bundle(), "headless")
    elif name == "web":
        apply_layer(tree, web_bundle(), "web")
    if patch:
        apply_layer(tree, patch, "--patch")
    return tree


def dump(tree: dict[str, ConfigRow]):
    print("  ---- 最终插件树 ----")
    for row in tree.values():
        if not row.disabled:
            print(f"    {row.id:<12} {row.plugin} {row.config or ''}")


if __name__ == "__main__":
    # 同一套 base，两个 profile 叠出两个不同产品
    headless = build_profile("headless")
    dump(headless)

    web = build_profile("web")
    dump(web)

    # --patch：把 llm 那一行整行换掉（比如换成 replay 做测试），base 一行没动
    print("\n===== 用 --patch 覆盖 llm 行（换成 replay，用于测试）=====")
    patched = build_profile("headless", patch=[
        ConfigRow("llm", "dsh-llm-replay", {"script": "fixtures/demo.json"}),
    ])
    dump(patched)
    print("\n  → 同一份 base，profile 决定叠什么，--patch 覆盖任意一行。")
    print("    这就是'产品 = 有序层叠的插件树'。")
