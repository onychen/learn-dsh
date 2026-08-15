# L07 pre-step 拦截：让插件决定模型看什么

> **Motto：用 waterfall 在请求前改写或拒绝要进模型的消息。**

## 1. 30 秒运行

运行前先猜：空输入被拒绝时，日志里应该完全没有痕迹，还是应该留下一个 0-step turn？
注入器改写后的文本，应记录原文还是模型真正看到的版本？

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

<!-- dsh:stepper id=pre-step-gate title="模型门前的补妆与查验" -->
1. **认领输入** — Driver 从 inbox 取出下一条待处理消息。
2. **注入器补妆** — 为 messages 加入提醒或上下文，也可以改写已有内容。
3. **守卫查证件** — 检查输入是否为空、违规或不应继续。
4. **形成决定** — 放行就进入模型；拒绝则关闭 turn，且不消耗 step。
<!-- /dsh:stepper -->

## 5. 方案与图

<!-- dsh:flow id=pre-step-flow title="pre-step 的放行与短路" -->
| ID | 节点 | 说明 | 下一步 |
|---|---|---|---|
| claim | 认领输入 | 取得 claimed messages | inject |
| inject | 注入器 | 改写 messages 后调用 `next(d')` | guard |
| guard | 空输入守卫 | 检查是否仍有合法消息 | reject[为空或违规], step[合法] |
| reject | 拒绝且记账 | 追加 rejected-no-step 的 turn/end，不产生 step | - |
| step | 正常执行 | 把最终 decision 交给模型请求流程 | - |
<!-- /dsh:flow -->

### 执行透视：pre-step 的权威对象是 decision

<!-- dsh:trace id=l07-runtime-xray title="正常输入与空输入在 step 前分岔" -->
| 步骤 | 执行位置 | 发生什么 | decision.messages | Session 日志 | Step 预算 |
|---|---|---|---|---|---|
| 开启 turn | `run_turn()` | 无论输入是否为空，先记录尝试。 | `claimed=[user]` 或 `[]` | `turn/start` | 尚未消耗。 |
| 注入提醒 | `injector()` | 正常 user 被复制并追加 shell 提醒。 | `[user+reminder]` | 仍只有 turn/start。 | 未开 step。 |
| 守卫放行 | `empty_guard()` | 非空 decision 调用 next。 | `[user+reminder]` | 不变。 | 即将消耗 1 step。 |
| 正常落盘 | `session.append(user/message)` | 改写后的最终版本写日志并交给模型。 | 与模型请求完全相同。 | `step/start; user; assistant; step/end` | 已用 1 step。 |
| 空输入短路 | `return rejected=True` | guard 不调用 next。 | `[]` 且 rejected。 | 第二个 `turn/start`。 | 仍为 0。 |
| 关闭 0-step turn | `reason=rejected-no-step` | 尝试留痕，但从未请求模型。 | 空。 | `turn/start; turn/end` | 0 step。 |
<!-- /dsh:trace -->

## 6. 代码拆解

- `injector(decision, next_)`：给每条 user 消息 `content` 追加提醒，然后 `next_(改写后)`。
- `empty_guard(decision, next_)`：`messages` 为空就返回 `{rejected:True}` 且**不调 next_**（短路）；否则委派。
- `Driver.run_turn()`：认领输入 → 跑 pre-step waterfall → 若被拒/空，只写 `turn/start`+`turn/end`；否则正常跑 step。

关键点：**被拒的 turn 也是一个 durable turn**，日志记录了这次尝试（reason=`rejected-no-step`）。

### 动手破坏一次

把 user/message 的写入移动到 pre-step 之前。注入器改写后，模型看到的文本与日志记录会不一致，
回放无法重建当时请求。这验证：**模型可见的改写必须先完成，再写入唯一真源。**

## 7. 代码解读：拦截点如何位于日志写入与模型请求之前

<!-- dsh:code-walkthrough id=l07-code-reading title="一次 pre-step decision 的生命周期" source=main.py -->
| 阶段 | 行号 | 读代码 | 设计原因 |
|---|---|---|---|
| waterfall 只提供委派机制 | 52-57 | 递归 dispatch 把当前 decision 和 next 交给监听者；链尾原样返回最终值。 | 分发器不理解 messages 或 rejected，策略语义由插件决定，机制才能被压缩、权限和注入共同复用。 |
| 注入器复制而非原地污染 | 64-70 | injector 为 user 构造新 dict 和新列表，再把替换后的 decision 交给 next。 | 复制使每层改写边界清楚；共享对象原地修改会让短路前后的状态难以推理。 |
| 守卫用“不委派”表达拒绝 | 73-79 | 空 messages 直接返回 rejected decision，非空才调用 next。 | 拒绝发生在副作用前，才能保证不创建 step、不花模型调用，也不需要事后撤销。 |
| Driver 先形成 decision 再落日志 | 89-104 | turn/start 先记尝试，claimed 输入经过 waterfall；拒绝分支只追加 turn/end。 | 审计保留“尝试过”，同时不会把被拒内容伪装成模型已见 user/message。 |
| 正常分支记录模型实际所见 | 106-115 | step/start 后写入 decision.messages，再以同一对象调用模型。 | 日志与请求参数来自同一权威 decision，满足“模型可见即已记录”。 |
<!-- /dsh:code-walkthrough -->

## 8. 相对上一课新增了什么

L06 的 driver 无脑把输入送进模型。本课在 step 之前插入 `agent/pre-step` waterfall，
让插件能改写或拒绝输入，并明确"被拒的 turn 不花 step 但仍留痕"。

## 9. 简化了什么 vs 真实 DeepSeek Harness

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
