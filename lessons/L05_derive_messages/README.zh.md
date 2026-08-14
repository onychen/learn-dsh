# L05 deriveMessages：日志是事实，消息是投影

> **Motto：模型看到的是投影，不是存储；模型可见即已记录。**

## 1. 30 秒运行

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

```text
  事件日志（表，全部原始行）
        │  deriveMessages() = SELECT ... WHERE 进入模型
        ▼
  模型历史（视图，只读投影）
```

你永远不 UPDATE 视图，你只改底层的表（追加事件），视图自动反映最新状态。

## 5. 方案与图

```text
events ──▶ deriveMessages ──▶ messages

  user/message        →  {role: user}
  assistant/message   →  {role: assistant}   （空内容且无 tool_calls → 跳过）
  tool/result         →  {role: tool, tool_call_id}   （按 callId 配对）
  turn/start,end      →  （记账，跳过）
  tool/call           →  （已并入对应 assistant 消息，跳过）
  assistant/chunk     →  （token 级回放，跳过）
```

## 6. 代码拆解

`derive_messages(events)` 就是一个 for 循环 + 分类：

- `user/message` → user 消息。
- `assistant/message` → **规则 1**：`text` 为空且无 `tool_calls` 就 `continue`（不进历史，
  但事件仍在日志里，保留 usage 与回放）。有 `tool_calls` 就带上。
- `tool/result` → **规则 2**：先收集所有 `tool/call` 的 `callId` 成集合，再校验这条 result
  的 `callId` 确实回溯得到某条 call（否则标记为孤儿），然后挂成带 `tool_call_id` 的 tool 消息。
- 其余（`turn/*`、`tool/call`）是记账事件，全部跳过。

`demo()` 手工构造一段含"空 assistant 消息"的事件序列，然后证明**两次投影相等**。

## 7. 相对上一课新增了什么

L04 用的是临时粗糙的 `naive_derive`。本课把它升级为正规的 `deriveMessages` 纯函数，
并明确三条投影规则（空消息跳过、callId 配对、记账事件排除），把"可回放"从口号变成可验证的等式。

## 8. 简化了什么 vs 真实 DeepSeek Harness

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
