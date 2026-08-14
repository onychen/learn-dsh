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

```text
每个栏目组（插件）交自己的稿件（PromptSection）
     │  按版面顺序（order）排好
     ▼
  组装成一整期杂志（system prompt）
     +  附录：本期可用工具清单（来自注册表 + scope）
```

## 5. 方案与图

```text
assemble(ctx, scope, tool_schemas):
  chosen = 全局 section + 匹配 scope 的 section
  chosen.sort(order)
  for s in chosen:
      body = s.text(ctx) if 可调用 else s.text   ← 静态或动态
      拼接 "## name\n body"
  追加 "## 可用工具\n <tool 名单>"
```

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
