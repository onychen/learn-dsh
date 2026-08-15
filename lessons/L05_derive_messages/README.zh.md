# L05 deriveMessages：日志是事实，消息是投影

> **Motto：模型看到的是投影，不是存储；模型可见即已记录。**

## 1. 30 秒运行

运行前先做分类：下面 8 条事件中，哪些应该进入模型请求，哪些只用于记账？尤其想一想：
`tool/call` 为什么不单独成为一条模型消息？

```powershell
python lessons/L05_derive_messages/main.py
```

预期输出（节选）：

```text
===== 原始事件日志（8 条，含记账事件与一条空消息）=====
  #0 turn/start
  #1 user/message
  #2 assistant/message
  #3 tool/call
  #4 tool/result
  #5 assistant/message      ← 空内容消息
  #6 assistant/message
  #7 turn/end

===== deriveMessages 投影出的模型历史 =====
  {'role': 'user', 'content': '看看环境'}
  {'role': 'assistant', 'content': '我调一下工具', 'tool_calls': [...]}
  {'role': 'tool', 'tool_call_id': 'c1', 'content': 'hi'}
  {'role': 'assistant', 'content': '环境正常，任务完成。'}

===== 关键：同一日志再投影一次，结果完全一致（可回放）=====
  两次投影相等: True
  投影出 4 条消息，但日志有 8 条事件

===== callId 配对校验：每条 tool 消息都回溯到了对应的 tool/call =====
  1 条 tool 结果全部配对成功（无孤儿）: True
```

## 2. 观察输出

**8 条事件，投影出 4 条消息。** 差额来自三类不进模型历史的东西：
记账事件（`turn/start`、`turn/end`、`tool/call`）、以及一条空的 `assistant/message`。
最关键的一行：**同一日志投影两次，结果完全相等**——这就是"可回放"的数学保证。

## 3. 为什么需要这一层

L04 已经把状态变成日志了，但日志里"什么该给模型看、什么只是记账"是混在一起的。
如果每个用到历史的地方（主循环、压缩、fork、遥测）都自己写一遍"从事件拼消息"，
逻辑会漂移、会出 bug。

**答案是一个纯函数 `deriveMessages`：日志进、消息出，无副作用、结果确定。**
它是唯一一处定义"模型到底看到什么"的地方。由此得到 dsh 的铁律——
**"模型可见即已记录"**：任何进入模型请求的东西，都必须能从日志重建。
所以想给模型加一种新输入，就必须先加一种新事件类型。

## 4. 心智模型

`deriveMessages` 就是数据库里的**视图（VIEW）**：

<!-- dsh:compare id=table-vs-view title="日志是表，消息历史是视图" -->
- **事件日志（底层表）** — 保存全部原始事件，是唯一可追加、可回放的真源。
- **模型历史（只读视图）** — `deriveMessages()` 像 SELECT 一样筛选并投影模型真正需要的消息。
<!-- /dsh:compare -->

### 执行透视：8 条事实怎样折叠成 4 条消息

<!-- dsh:trace id=l05-runtime-xray title="deriveMessages 的逐事件投影" -->
| 步骤 | 执行位置 | 发生什么 | 事件日志 | 模型视图 | 继续条件 |
|---|---|---|---|---|---|
| 建立配对索引 | `known_call_ids = {...}` | 先扫描全部 tool/call，得到可验证的 callId 集合。 | `8 events; known={c1}` | `[]` | 还未开始逐事件投影。 |
| 跳过 turn/start | `for ev in events` | 轮次边界用于记账，不进入模型上下文。 | `#0 turn/start` | `[]` | 继续读取下一事件。 |
| 投影用户输入 | `ev.type == "user/message"` | 生成一条 user message。 | `#0…#1` | `[user]` | 继续折叠。 |
| 投影助手决策 | `ev.type == "assistant/message"` | 文本和 tool_calls 合成同一条 assistant message。 | `#0…#2` | `[user, assistant+call(c1)]` | 继续；调用定义已在 assistant 消息里。 |
| 忽略调用记账 | `ev.type == "tool/call"` | 不额外生成消息；它只提供执行事实和配对依据。 | `#0…#3` | `[user, assistant+call(c1)]` | 继续读取结果。 |
| 投影工具结果 | `call_id in known_call_ids` | result 与 c1 配对，生成 tool message。 | `#0…#4` | `[user, assistant+call(c1), tool(c1)]` | 配对成功，继续。 |
| 过滤空消息 | `if not text and not calls: continue` | 空 assistant 事件仍保留在日志，但不污染模型视图。 | `#0…#5` | `[user, assistant+call(c1), tool(c1)]` | 继续；事实保留，视图不变。 |
| 完成投影 | `return messages` | 最终 assistant 进入视图；turn/end 被忽略。 | `8 events` | `[user, assistant+call(c1), tool(c1), assistant]` | 纯函数结束；相同输入必得相同输出。 |
<!-- /dsh:trace -->

你永远不 UPDATE 视图，你只改底层的表（追加事件），视图自动反映最新状态。

## 5. 方案与图

<!-- dsh:compare id=event-projection title="不同事件怎样进入模型视图" -->
- **user/message** — 投影为 `{role: user}`。
- **assistant/message** — 投影为 `{role: assistant}`；空内容且无 tool calls 时跳过。
- **tool/result** — 按 callId 配对，投影为带 `tool_call_id` 的 tool 消息。
- **turn/start、turn/end** — 只负责记账，不进入模型历史。
- **tool/call** — 调用定义已经并入对应 assistant 消息，不单独投影。
- **assistant/chunk** — 用于 token 级回放，完整消息形成后不再进入模型历史。
<!-- /dsh:compare -->

## 6. 代码拆解

`derive_messages(events)` 就是一个 for 循环 + 分类：

- `user/message` → user 消息。
- `assistant/message` → **规则 1**：`text` 为空且无 `tool_calls` 就 `continue`（不进历史，
  但事件仍在日志里，保留 usage 与回放）。有 `tool_calls` 就带上。
- `tool/result` → **规则 2**：先收集所有 `tool/call` 的 `callId` 成集合，再校验这条 result
  的 `callId` 确实回溯得到某条 call（否则标记为孤儿），然后挂成带 `tool_call_id` 的 tool 消息。
- 其余（`turn/*`、`tool/call`）是记账事件，全部跳过。

`demo()` 手工构造一段含"空 assistant 消息"的事件序列，然后证明**两次投影相等**。

### 动手验证不变量

把示例中 `tool/result` 的 `callId` 改成 `ghost` 再运行。它会被标记为 `_orphan`，说明投影器
不是简单格式转换器，还承担一致性检查：**每个工具结果都必须能追溯到模型曾发出的调用。**

## 7. 代码解读：投影器如何保护模型视图的不变量

<!-- dsh:code-walkthrough id=l05-code-reading title="从配对索引到确定性消息列表" source=main.py -->
| 阶段 | 行号 | 读代码 | 设计原因 |
|---|---|---|---|
| 先建立工具调用索引 | 55-58 | 投影开始前扫描全部 `tool/call`，把合法 callId 收集为集合。 | tool result 可能出现在后续位置；预先建索引让每个结果都能做 O(1) 来源校验，也把跨事件约束集中起来。 |
| user 与 assistant 使用不同规则 | 60-75 | user 直接映射；assistant 则同时检查文本和 calls，空内容且无调用时跳过，有调用时保留结构化字段。 | 日志需要保存空响应的 usage 等事实，但模型视图不能被无意义空消息污染；“是否进入 surface”与“是否记录”是两回事。 |
| result 必须回指 call | 77-88 | 每个 tool/result 取出 callId，生成 `tool_call_id`；找不到来源时显式标记 `_orphan`。 | 模型协议靠 ID 将动作与观察配对。静默接受孤儿结果会让模型看到一个没有问题来源的答案。 |
| demo 构造边界而非只跑 happy path | 93-107 | 示例刻意加入 turn 记账事件、tool call、空 assistant 和正常收尾。 | 只有混合事件才能证明投影器确实在筛选，而不是简单把日志逐条改名。 |
| 两次投影验证纯函数性质 | 115-123 | 对同一事件列表调用两次并比较，同时单独检查所有 tool message 是否配对。 | 确定性是 fork、resume、compaction 和测试复现的共同基础；如果相同日志产生不同视图，整个事件源架构都会失效。 |
<!-- /dsh:code-walkthrough -->

## 8. 相对上一课新增了什么

L04 用的是临时粗糙的 `naive_derive`。本课把它升级为正规的 `deriveMessages` 纯函数，
并明确三条投影规则（空消息跳过、callId 配对、记账事件排除），把"可回放"从口号变成可验证的等式。

## 9. 简化了什么 vs 真实 DeepSeek Harness

| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |
|---|---|---|
| 一个 for 循环分类 | `deriveMessages()` 处理 surface 顺序、compaction 替换、附加上下文注入 | 压缩后的 surface 要正确遮蔽旧范围（见 L15） |
| 空消息简单跳过 | 保留 `usage`、`sourceEventSeqs`（精确列出源 chunk），空内容仍记账 | token 计费、遥测、回放保真都依赖它 |
| callId 直接配对 | surface 投影 + `surfaceOp`（replace 等）参与折叠 | 压缩摘要就是一条带 `surfaceOp:replace` 的 user/message |
| 无不变式断言 | 运行时不变式断言"模型可见必可从日志重建" | 防止有人偷偷塞未记录的输入进模型 |

### 教学类名 → 真实 dsh 映射

| 本课 | 真实 dsh |
|---|---|
| `derive_messages()` | `deriveMessages()`（`core/session`，见 session-projection.md） |
| "空消息跳过" | 空内容不进派生历史，但 `assistant/message` 事件保留 usage |
| "模型可见即已记录" | session.md 的核心不变式 |

---
[← 上一课 L04](../L04_session_log/README.zh.md) · [返回总览](../../README.md) · [下一课 L06 →](../L06_turn_step/README.zh.md)
