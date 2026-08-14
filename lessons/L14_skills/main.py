"""L14 Skills：按需加载的知识（两段注入）
=========================================
Motto：用到什么知识再加载什么。

上下文很贵。如果把所有领域知识都塞进 system prompt，token 会爆，模型也会分心。
Skills 的思路：知识分两段暴露——

  第一段（目录，always-on）：只把每个 skill 的"名字 + 一句话摘要"作为一条
     持久提醒注入（真实 dsh 通过 agent/pre-step 作为 user-role reminder）。
     模型平时只看到这个"目录"，很省 token。

  第二段（正文，on-demand）：模型觉得某个 skill 有用时，调 `skill` 工具按名加载，
     完整正文才作为 tool result 返回，进入这一轮上下文。

这就是"渐进披露"。注意：不是"所有 skill 都只通过 tool result 注入"——
目录靠 reminder 注入，正文才靠 tool result 加载。这个区分很重要。

运行：  python lessons/L14_skills/main.py
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Skill:
    name: str
    summary: str      # 一句话摘要（进目录）
    body: str         # 完整正文（按需加载）


class SkillProvider:
    """一个 skill 来源（这里是内存目录；真实 dsh 有本地目录/远程等 provider）。"""

    def __init__(self, skills: list[Skill]):
        self._skills = {s.name: s for s in skills}

    def list_summaries(self) -> list[tuple[str, str]]:
        return [(s.name, s.summary) for s in self._skills.values()]

    def load(self, name: str) -> str | None:
        s = self._skills.get(name)
        return s.body if s else None


# ---- 第一段：把目录作为持久 reminder 注入（模拟 agent/pre-step 的 reminder）----
def build_skill_reminder(provider: SkillProvider) -> str:
    lines = ["[可用技能目录 — 需要时用 skill 工具按名加载]"]
    for name, summary in provider.list_summaries():
        lines.append(f"  - {name}: {summary}")
    return "\n".join(lines)


# ---- 第二段：skill 工具，按需把正文作为 tool result 返回 ----
def skill_tool(provider: SkillProvider, name: str) -> str:
    body = provider.load(name)
    if body is None:
        return f"[skill] 找不到技能: {name}"
    return f"[skill:{name} 正文已加载]\n{body}"


if __name__ == "__main__":
    provider = SkillProvider([
        Skill("pdf", "处理 PDF：拆分/合并/提取文本", "PDF 操作步骤：1) 用 pypdf 打开 2) ... （此处是很长的正文，平时不进上下文）"),
        Skill("code-review", "结构化代码审查清单", "代码审查步骤：1) 检查命名 2) 检查边界条件 3) ... （很长）"),
        Skill("git", "常见 git 工作流", "git 工作流：1) 分支命名 2) 提交规范 3) ... （很长）"),
    ])

    print("===== 第一段：模型平时只看到目录（省 token）=====")
    reminder = build_skill_reminder(provider)
    print(reminder)
    print(f"\n  目录约 {len(reminder)} 字符——远小于把所有正文塞进去")

    print("\n===== 模型决定：'我要做代码审查'，于是调 skill 工具 =====")
    print("  [tool_call] skill({'name': 'code-review'})")
    result = skill_tool(provider, "code-review")
    print(f"  [tool_result] {result}")

    print("\n===== 只有被点名的 skill 正文进了上下文，其余仍只在目录里 =====")
    print("  → 这就是渐进披露：目录 always-on，正文 on-demand")
