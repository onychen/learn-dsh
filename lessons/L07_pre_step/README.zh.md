# L07 pre-step 拦截：让插件决定模型看什么

> **Motto：用 waterfall 在请求前改写或拒绝要进模型的消息。**

## 1. 30 秒运行

```powershell
python lessons/L07_pre_step/main.py
```

预期输出（节选）：

```text
### 场景 1：正常输入（会被注入器改写，然后跑一个 step）
╔══ turn/start turn=0（输入='看看环境'）
  [pre-step:注入器] 给 1 条输入追加上下文提醒
  [pre-step:守卫] 输入非空 → 委派
║  [assistant] 我收到的输入是：'看看环境（提醒：优先用 shell 工具）'
╚══ turn/end

### 场景 2：空输入（被守卫拒绝，turn 关闭但不花 step）
  [pre-step:守卫] 空输入 → 拒绝（短路，不调 next），本 turn 不花 step

===== 日志证明：场景 2 也留下了 turn/start + turn/end =====
  #6 turn/start
  #7 turn/end rejected-no-step
```

## 2. 观察输出

场景 1 里，模型看到的输入被**注入器改写**了（多了一段提醒）。场景 2 里，空输入被
**守卫短路拒绝**，这个 turn 没花任何 step——但日志里仍留下了 `turn/start`+`turn/end`，
记录了"曾经尝试过"。

## 3. 为什么需要这一层

L06 的 driver 直接把输入喂给模型。但很多需求要在"进模型之前"动手脚：注入项目上下文、
脱敏、加系统提醒、检测上下文是否该压缩、甚至直接拒绝某些输入。

如果把这些都写进 driver，driver 会变成一个巨型 if 堆。**dsh 的做法是开一个
`agent/pre-step` waterfall（回顾 L03）**：谁想拦截就挂个监听者，driver 本身不认识它们。
压缩（L15）就是挂在这里做上下文压力检测的。

## 4. 心智模型

pre-step 是模型的**门卫 + 化妆师**：

```text
认领到的输入  ──▶ [注入器：补妆]  ──▶ [守卫：查证件]  ──▶ 进入模型
                     │                    │
                     改写 messages         空/违规 → 拒之门外（turn 不花 step）
```

## 5. 方案与图

```text
claimed = 认领的输入
decision = waterfall("agent/pre-step", {messages: claimed, rejected: False})

  injector(d, next) ── 改写 messages ──▶ next(d')
  empty_guard(d, next) ── messages 空? ── 是 ─▶ return {rejected:True}  # 短路
                                        └ 否 ─▶ next(d)

if decision.rejected or 无 messages:
    append turn/end (rejected-no-step)   # 关闭 turn，不花 step，但记录尝试
else:
    正常跑 step
```

## 6. 代码拆解

- `injector(decision, next_)`：给每条 user 消息 `content` 追加提醒，然后 `next_(改写后)`。
- `empty_guard(decision, next_)`：`messages` 为空就返回 `{rejected:True}` 且**不调 next_**（短路）；否则委派。
- `Driver.run_turn()`：认领输入 → 跑 pre-step waterfall → 若被拒/空，只写 `turn/start`+`turn/end`；否则正常跑 step。

关键点：**被拒的 turn 也是一个 durable turn**，日志记录了这次尝试（reason=`rejected-no-step`）。

## 7. 相对上一课新增了什么

L06 的 driver 无脑把输入送进模型。本课在 step 之前插入 `agent/pre-step` waterfall，
让插件能改写或拒绝输入，并明确"被拒的 turn 不花 step 但仍留痕"。

## 8. 简化了什么 vs 真实 DeepSeek Harness

| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |
|---|---|---|
| 两个内联监听者 | `agent/pre-step` 是权威 waterfall，多插件协作 | 压缩、steering、注入上下文都挂在这里 |
| 拒绝 = 返回 rejected | 返回的决定是权威的；包裹 `next()` 的监听者默认保留下游消息 | 除非有意替换，否则不能吞掉别人的改写 |
| 改写 content 字符串 | 改写的是结构化 `Message`，注入是 `agent.inject()` 落到下一次请求 | 注入内容也要成为可记录的 `user/message`（模型可见即已记录） |
| 无压缩联动 | `dsh-compaction-basic` 用 pre-step 做请求前的上下文压力检测 | 上下文快满时要先压缩再请求（见 L15） |

### 教学类名 → 真实 dsh 映射

| 本课 | 真实 dsh |
|---|---|
| `waterfall(pre_step, ...)` | `agent/pre-step` waterfall |
| `injector` | `agent.inject()` / steering 监听者 |
| `empty_guard` 短路 | pre-step 的 reject（权威决定） |
| `rejected-no-step` | "被拒的 turn 无 step，日志仍记录尝试" |

---
[← 上一课 L06](../L06_turn_step/README.zh.md) · [返回总览](../../README.md) · [下一课 L08 →](../L08_llm_seam/README.zh.md)
