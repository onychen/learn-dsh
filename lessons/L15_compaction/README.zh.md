# L15 Compaction：上下文总会满，要腾地方

> **Motto：日志从不删除，只追加一条 replace 事件把旧范围移出 surface。**

## 1. 30 秒运行

```powershell
python lessons/L15_compaction/main.py
```

预期输出（节选）：

```text
===== 压缩前：日志 10 条事件 =====
  deriveMessages → 10 条模型消息

===== 执行压缩（保留最近 2 条 surface 事件）=====
  [compaction] 已把 seq 0..7（8 条）摘要遮蔽

===== 压缩后：日志变成 14 条事件（更多了，不是更少！）=====
  deriveMessages → 3 条模型消息（surface 变短了）
    user       用户消息 4
    assistant  助手回复 4
    user       [摘要]（此前 8 条消息的摘要：...）

===== 关键：旧事件仍在日志里，可回放 =====
  日志总事件数 14，其中被遮蔽的旧事件一条没删
```

## 2. 观察输出

请盯住这个**反直觉**的现象：压缩后日志**从 10 条变成 14 条**（更多，不是更少！），
但 `deriveMessages` 投影出的模型消息**从 10 条缩到 3 条**。旧事件一条都没删——
它们只是被一条"摘要"消息在 surface 上遮蔽了。

## 3. 为什么需要这一层

会话越长，事件越多，模型请求的 token 迟早撑爆。直觉做法是"删掉旧消息"——但这会
**违背 L04 的仅追加铁律**，也毁掉回放和审计能力。

**dsh 的做法：不删，只遮蔽。** 追加一条带 `surfaceOp=replace` 的摘要消息，
让它在 surface 上盖住旧范围。旧事件仍在日志里、仍可回放，只是不再进入当前模型请求。
这样既腾出了 token，又没破坏"唯一真源"。

## 4. 心智模型

压缩就像**在长文档上贴便利贴**，而不是**撕掉旧页**：

<!-- dsh:compare id=delete-vs-shadow title="压缩不是撕页，而是遮蔽" -->
- **撕掉旧页（错误）** — 删除 seq 0..7 后历史永久消失，无法回放也无法审计。
- **便利贴遮蔽（dsh）** — 追加摘要并用 `surfaceOp:replace` 遮住旧范围；原事件仍在，shadowedSeqs 保存关联。
<!-- /dsh:compare -->

## 5. 方案与图

<!-- dsh:stepper id=compaction-lifecycle title="一次压缩怎样安全落进日志" -->
1. **开始并加锁** — 追加 log-only 的 `compaction/start`。
2. **写入摘要** — 追加 user/message，并携带 replace 的 start/end 范围。
3. **记录遮蔽关系** — 追加 compaction/summary，保存 shadowedSeqs 与 shadowedRange。
4. **结束并解锁** — 追加 `compaction/end`，表示这次压缩完整结束。
5. **重新投影** — deriveMessages 跳过被遮蔽事件，但让摘要消息本身进入 surface。
<!-- /dsh:stepper -->

## 6. 代码拆解

- `compact()`：实现 **shadow 三件套**——① `compaction/start`（log-only 加锁）
  ② 一条带 `surfaceOp:replace` 的 `user/message`（假摘要，真正的 surface 变更）
  ③ `compaction/summary` 记 `shadowedSeqs` + `compaction/end`（log-only 解锁）。
- `derive_messages()`：先收集所有被 replace 覆盖的 seq，投影时跳过它们，但摘要消息进 surface。
- 触发条件：本课用"surface 超过 keep_last 条"，真实 dsh 用 token 压力检测。
- ★ **surfaceOp 是 `SessionEvent` 的顶层字段**（与 `data` 平级），不是塞进 `data`。
  而且它对每个 surface 事件（user/assistant/tool）**必填**：普通消息声明 `{op:'append'}`，
  压缩摘要声明 `{op:'replace', start, end}`；非 surface 事件（turn/step、compaction/*）绝不携带它。
  本课 `Session.append()` 已按此约定强制。

## 7. 相对上一课新增了什么

前面 14 课日志只增不减、surface 等于全部 surface 事件。本课引入 **compaction**：
在不删日志的前提下，用一条 replace 摘要遮蔽旧范围，让 surface 变短、token 腾出，
并讲清 **shadow 三件套** 与"日志仍仅追加"的关系。

## 8. 简化了什么 vs 真实 DeepSeek Harness

| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |
|---|---|---|
| 按条数触发 | `dsh-compaction-basic` 用 `agent/pre-step` 检测 token 压力，`agent/request-error` 处理上下文溢出 | 要在真正撑爆前压缩，溢出时还能恢复 |
| 假摘要字符串 | 真调 `ctx.llm.stream()` 生成摘要，`llmStreamCall` 标记 + `rawOutput` 可重建 | 摘要质量决定后续对话，需可重建审计 |
| shadowedSeqs 简单记录 | `shadowedRange`（surface 位置对，可 start>end）+ 按 surface 顺序的 `shadowedSeqs` | 多次压缩后位置关系复杂，需精确 |
| 无锁 | `compaction/start`..`end` 括住整个操作，崩溃留可检测的遗留锁 | 中途崩溃不能伪报"已完成" |
| compaction 是内联函数 | compaction 是**能力 seam**（Definition/Provider/Consumer） | 可换 tokenizer/模板后端（见 L12） |
| surfaceOp 在事件顶层、surface 事件必填（本课已对齐） | 同左：`SessionEvent` 顶层字段，仅三种 surface 事件携带，编译器在 `append` 处强制 | 派生历史的唯一依据，必须严格且类型安全 |

### 教学类名 → 真实 dsh 映射

| 本课 | 真实 dsh |
|---|---|
| `compact()` | `ctx.compaction`（`compaction/compaction`） |
| `surfaceOp:replace` | 摘要承载在带 `surfaceOp:{op:replace}` 的 `user/message` |
| `shadowedSeqs` | `CompactionResult.shadowedSeqs`（按 surface 顺序） |
| `compaction/start`,`summary`,`end` | 同名 log-only 事件 |

---
[← 上一课 L14](../L14_skills/README.zh.md) · [返回总览](../../README.md) · [下一课 L16 →](../L16_subagent/README.zh.md)
