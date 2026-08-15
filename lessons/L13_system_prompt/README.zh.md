# L13 System Prompt 装配

> **Motto：提示词不是一段字符串，是各插件贡献的段落 + 工具 schema 协作组装。**

## 1. 30 秒运行

```powershell
python lessons/L13_system_prompt/main.py
```

预期输出（节选）：

```text
===== 全局 agent 的 system prompt =====
## 身份
你是 DeepSeek Harness 教学助手。
## 环境
当前工作目录：D:/ds harness；平台：Windows。
## 时间
当前时间：2026-08-14。
## 可用工具
shell, read

===== translator agent 的 system prompt（多了'人格'段落）=====
## 身份 ...
## 人格
你现在是翻译官，只做翻译。
...
## 可用工具
translate
```

## 2. 观察输出

system prompt 是**拼**出来的：三个插件各贡献一个段落（身份/环境/时间），
按 order 排序，末尾加上当前可见的工具名。translator scope 下多出一个"人格"段落，
可用工具也换成了 `translate`——scope 决定了组装内容（呼应 L09）。

## 3. 为什么需要这一层

新手常把 system prompt 当成一个写死的大字符串。但真实 harness 里，
"身份"来自核心、"环境信息"来自 fs 插件、"可用工具"来自工具注册表、
"skill 提醒"来自 skill 插件（见 L14）……如果全塞一个字符串，谁都没法独立维护。

**dsh 让每个插件贡献自己的 `PromptSection`**，组装时按顺序拼起来。加一段提示 =
挂一个 section（可逆，呼应 L02）；段落还能动态生成（插入当前时间/cwd）。

## 4. 心智模型

system prompt 就像**杂志的拼版**：

<!-- dsh:flow id=prompt-magazine title="多个插件与运行时上下文共同组装一次 system prompt" variant=map -->
| ID | 节点 | 说明 | 下一步 | 位置 | 类型 |
|---|---|---|---|---|---|
| global | 全局插件 sections | 身份、环境、时间等段落对所有 agent 可见。 | sections | 1,1 | |
| scoped | Scope 专属 sections | 人格等段落只属于特定 agent scope。 | sections | 1,2 | |
| sections | PromptSection 注册表 | 保存 name、order、text 和可选 scope。 | filter | 2,2 | state |
| scope | 当前 agent scope | 同时约束可见段落和可见工具。 | filter[筛段落], tools[筛工具] | 3,1 | state |
| filter | Scope 过滤 | 保留全局 section 与当前 scope 专属 section。 | sort | 3,2 | |
| sort | 按 order 排序 | 多插件贡献仍得到稳定、可预测的段落顺序。 | render | 4,2 | |
| context | 运行时 ctx | cwd、platform、时间等只在本次组装时求值。 | render | 5,1 | state |
| render | 动态渲染 sections | 静态文本直接取值，函数 section 读取 ctx。 | tools | 5,2 | |
| tools | 附加可见工具 schemas | 使用当前 scope 过滤后的工具清单。 | prompt | 6,2 | |
| prompt | 最终 system prompt | 每次请求得到与当前 agent、环境和能力一致的提示词。 | - | 7,2 | terminal |
<!-- /dsh:flow -->

## 5. 方案与图

<!-- dsh:stepper id=prompt-assembly title="assemble 的五个动作" -->
1. **收集** — 取得所有已注册 PromptSection。
2. **筛选** — 选择全局段落和匹配当前 scope 的段落。
3. **排序** — 按 order 稳定排序。
4. **求值并拼接** — 调用动态 text 或读取静态 text，拼成带标题的段落。
5. **附加工具清单** — 将 tool schemas 作为“可用工具”段落追加。
<!-- /dsh:stepper -->

## 6. 代码拆解

- `PromptSection`：一个段落 = name + order + text（静态字符串或 `ctx -> str` 函数）+ 可选 scope。
- `register()`：挂一个 section，返回 disposer（可逆注册）。
- `assemble()`：选段落（全局 + 匹配 scope）→ 按 order 排序 → 渲染（静态/动态）→ 附工具名单。
- main：三个全局段落 + 一个只在 translator scope 的"人格"段落，展示两种组装结果。

## 7. 相对上一课新增了什么

前面 12 课从没管过 system prompt。本课把它从"一段死字符串"变成
**多插件贡献的 `PromptSection` + 工具 schema 的协作组装**，并让 scope 决定组装内容。

## 8. 简化了什么 vs 真实 DeepSeek Harness

| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |
|---|---|---|
| 字符串拼接 | `system-prompt/assemble` waterfall，协作式组装 | 段落间可互相感知、可拦截改写 |
| order 整数排序 | 注册顺序 + scope 链 + `complete` 段落语义 | 复杂的段落优先级与替换规则 |
| scope 简单匹配 | scope 决定 section、工具 schema、shadowing | per-agent 人格（见 L09） |
| 工具名单直接列 | `ToolProviderResult`（schemas + knownNames） | 区分"拼错名"与"被 scope 隐藏" |
| 无信号 | `AssembleContext` 带 agent 实例与取消信号 | 动态段落可能需要 async 解析 |

### 教学类名 → 真实 dsh 映射

| 本课 | 真实 dsh |
|---|---|
| `SystemPromptService` | `ctx.systemPrompt`（`core/system-prompt`） |
| `PromptSection` | `PromptSection` 注册约定 |
| `assemble()` | `system-prompt/assemble` waterfall |
| 工具名单 | `ToolProviderResult.schemas`（来自 L10 + L09） |

---
[← 上一课 L12](../L12_capability_seam/README.zh.md) · [返回总览](../../README.md) · [下一课 L14 →](../L14_skills/README.zh.md)
