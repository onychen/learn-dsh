# L14 Skills：按需加载的知识（两段注入）

> **Motto：用到什么知识再加载什么。**

## 1. 30 秒运行

```powershell
python lessons/L14_skills/main.py
```

预期输出（节选）：

```text
===== 第一段：模型平时只看到目录（省 token）=====
[可用技能目录 — 需要时用 skill 工具按名加载]
  - pdf: 处理 PDF：拆分/合并/提取文本
  - code-review: 结构化代码审查清单
  - git: 常见 git 工作流

===== 模型决定：'我要做代码审查'，于是调 skill 工具 =====
  [tool_call] skill({'name': 'code-review'})
  [tool_result] [skill:code-review 正文已加载] 代码审查步骤：1) ...
```

## 2. 观察输出

模型平时只看到一个约 100 字符的**目录**（每个 skill 一句话）。当它决定要做代码审查，
才调 `skill` 工具把 `code-review` 的**完整正文**作为 tool result 拉进来。其余 skill 的
正文始终没进上下文。

## 3. 为什么需要这一层

上下文 token 很贵。把所有领域知识（PDF 操作、代码审查清单、git 工作流……）
全塞进 system prompt，既烧 token 又让模型分心。

**Skills 用"渐进披露"解决：知识分两段。** 目录（名字+摘要）always-on 但极小；
正文 on-demand，用到才加载。这样模型既"知道有哪些本事可用"，又不必一直背着全部细节。

## 4. 心智模型

Skills 就像**图书馆**：

<!-- dsh:compare id=skill-library title="目录常驻，正文按需" -->
- **书架索引卡（always-on）** — 模型一直看到 skill 名称和一句简介，占用很少上下文。
- **借书工具（on-demand）** — 确认需要某项知识后才加载完整正文，避免把整座图书馆搬进上下文。
<!-- /dsh:compare -->

你不会把整个图书馆搬回家，只借当下要看的那本。

## 5. 方案与图

<!-- dsh:flow id=skill-two-stage title="目录常驻，正文只有被选中才进入上下文" variant=map -->
| ID | 节点 | 说明 | 下一步 | 位置 | 类型 |
|---|---|---|---|---|---|
| catalog | Skill 目录 | provider 只暴露每项知识的 name 与 summary。 | reminder | 1,1 | |
| reminder | 持久 reminder | pre-step 每轮只把轻量目录注入 messages。 | messages | 2,1 | |
| messages | 当前上下文 | 始终包含目录，但默认不包含任何 skill 正文。 | model | 3,1 | state |
| model | 模型判断 | 根据当前任务判断是否真的需要某项专业知识。 | load[需要], continue[不需要] | 4,1 | decision |
| continue | 直接继续任务 | 不调用 skill，正文不会占用上下文。 | - | 5,1 | terminal |
| load | 调用 skill(name) | 只按名称读取被选中的那一份正文。 | body | 4,3 | |
| body | 正文 tool result | 完整正文作为工具结果写入当前历史。 | messages[写回上下文] | 3,3 | |
<!-- /dsh:flow -->

## 6. 代码拆解

- `Skill`：name + summary（进目录）+ body（按需加载）。
- `SkillProvider`：`list_summaries()` 给目录，`load(name)` 给正文。真实 dsh 有多种 provider（本地目录/远程）。
- `build_skill_reminder()`：**第一段**——把目录拼成一段提醒文本。
- `skill_tool()`：**第二段**——按名加载正文，作为 tool result 返回。

## 7. 相对上一课新增了什么

L13 让 system prompt 由段落组装。本课引入 **Skills 的两段注入**：
目录作为持久 reminder（第一段）、正文作为 tool result 按需加载（第二段），
实现"知道有什么"和"用到才加载"的分离。

## 8. 简化了什么 vs 真实 DeepSeek Harness

| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |
|---|---|---|
| 目录 = 拼字符串 | 目录经 `agent/pre-step` 作为持久 **user-role reminder** 注入 | 提醒要成为可记录的消息（模型可见即已记录） |
| 内存 provider | `ctx.skills` 组合本地/内嵌/远程多 provider，分层 + 缓存 | 多来源、失效通知、发现缓存 |
| load 直接返回 | 正文由 `skill` 工具加载，作为 tool result 进上下文 | 走工具管线（权限/记录/回放） |
| 无 scope | 注册落 scope 层，同名 most-specific-wins | per-agent 技能集差异化（见 L09） |
| 无失效 | `skills/change` 事件 + `snapshot()` 重取 | provider 目录变化要通知消费方 |

> **精确表述**（呼应审查意见）：**不是**"所有 skill 都只通过 tool result 注入"。
> 正确的是——**目录靠 reminder 注入（第一段），完整正文才靠 `skill` 工具作为 tool result 加载（第二段）**。

### 教学类名 → 真实 dsh 映射

| 本课 | 真实 dsh |
|---|---|
| `SkillProvider` | `ctx.skills` + `dsh-skill-filesystem` |
| `build_skill_reminder` | `agent/pre-step` 注入的 skill 目录 reminder |
| `skill_tool` | `dsh-tool-skill` 的 `skill` 工具 |
| `Skill.summary` / `.body` | `SkillCandidate` 摘要 / `SkillDefinition` 正文 |

---
[← 上一课 L13](../L13_system_prompt/README.zh.md) · [返回总览](../../README.md) · [下一课 L15 →](../L15_compaction/README.zh.md)
