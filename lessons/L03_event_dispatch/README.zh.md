# L03 类型化事件与四种分发

> **Motto：能力调用走 `ctx.<service>`，观察 / 拦截 / 策略走事件。**

## 1. 30 秒运行

运行前先预测：waterfall 的第二个监听者不调用 `next()` 时，第三个监听者会不会执行？
serial 中第一个监听者返回 `False`，应当停止还是继续？先写下答案再运行。

```powershell
python lessons/L03_event_dispatch/main.py
```

预期输出（节选）：

```text
=== emit（观察，无返回）===
  [日志] 工具被调用: shell
  [遥测] 计数 +1: shell

=== waterfall（环绕中间件，next() 委派）===
-- 危险请求 --
  [A] 看到请求: {'command': 'rm -rf /'}，加个标记后委派
  [B] 危险命令，短路拒绝（不调 next）
  结果: {'denied': True}

=== parallel（并行 await，无返回）===
  [并发] 工具 B 完成（更快先完成）
  [并发] 工具 A 完成

=== serial（按序 await，第一个 bail 值胜出并停止）===
  [预算检查] 预算充足，不干预（返回 None，不 bail）
  [目标检查] 目标未完成 → bail，要求继续（后续监听者不再执行）
  第一个 bail 值（胜出）: {'action': 'continue', 'reason': 'goal-not-done'}
```

## 2. 观察输出

四段演示对应四种分发模式。注意三个关键现象：
**waterfall 里 B 不调 `next()` 就短路了**（C 根本没执行）；
**parallel 里 B 比 A 先完成**（真并发，谁快谁先）；
**serial 里 check_goal 一 bail，第三个监听者 `never_runs` 就再也没机会执行**
（第一个非空返回值胜出并停止，这是 serial 的真实语义，不是 reducer）。

## 3. 为什么需要这一层

L02 解决了"插件怎么直接用别人的能力"（调 `ctx.<service>`）。但还有一类需求：
我想**观察**工具调用、**拦截**并改写请求、**组合**多个策略——而且不想让被观察方
知道我的存在。如果都用直接调用，就得让每个工具去 import 每个策略，耦合爆炸。

**事件是解耦的拦截点。** 而"选哪种分发模式"是设计一个事件时的**第一决策**，
因为它决定了监听者是"只看"、"能改"、"并发跑"还是"投票"。

## 4. 心智模型

四种模式，四种社交场合：

<!-- dsh:compare id=dispatch-modes title="四种分发模式对应四种协作关系" -->
- **emit · 广播通知** — 我喊一声，所有监听者都能听到；调用方不收集决定。
- **waterfall · 流水线审批** — 值逐层传递，每一层都能改写、继续或短路。
- **parallel · 同时开工** — 所有监听者并发执行，彼此不等待、不争夺最终决定。
- **serial · 依次表决** — 按顺序询问，首个非空结论立即 bail，后续不再执行。
<!-- /dsh:compare -->

## 5. 方案与图

waterfall 是四者里最重要、也最烧脑的一个。它是**环绕中间件（around middleware）**：

<!-- dsh:flow id=waterfall-around title="waterfall 的委派与短路" -->
| ID | 节点 | 说明 | 下一步 |
|---|---|---|---|
| a | 监听器 A | 可先改写 req，再决定是否调用 `next()` | b[调用 next] |
| b | 监听器 B | 调用 next 就继续委派；不调用则由 B 直接拥有结果 | c[继续], short[不调用 next] |
| c | 监听器 C | 链尾产生返回值 | unwind |
| unwind | 返回值回卷 | 结果沿每一层 `next()` 的返回值逐层回到 A | - |
| short | 短路结果 | 下游不再参与，B 的结果直接回卷 | - |
<!-- /dsh:flow -->

- **调 `next()`**：把（可能改写过的）值委派给下一个监听者。
- **不调 `next()`**：短路——我拥有这个决定，下游不再参与。
- 权限、压缩触发、请求构造都靠它。真实的 `agent/pre-step`、`agent/request`、
  `llm/stream`、`tools/*` 三件套全是 waterfall。

### 执行透视：危险请求怎样在 waterfall 中被短路

<!-- dsh:trace id=l03-runtime-xray title="同一请求穿过 annotate 与 permission" -->
| 步骤 | 执行位置 | 发生什么 | 当前 value | 下一监听者 | 控制权归属 |
|---|---|---|---|---|---|
| 建立链 | `bus.on(...)` | 三个监听者按注册顺序进入数组。 | `{command: rm -rf /}` | `annotate (index 0)` | EventBus 创建第一个 next。 |
| A 改写 | `annotate(req, next_)` | A 添加 `annotated=True`，调用 `next_(new_req)`。 | `{command:…, annotated: true}` | `permission (index 1)` | A 暂时把控制权交给 B，等待返回。 |
| B 检查 | `permission(req, next_)` | B 发现危险命令。 | 改写后的 value 未丢失。 | `execute (index 2)` 尚未进入 | 控制权当前属于 B。 |
| B 短路 | `return {"denied": True}` | B 不调用 next，直接产生结果。 | `{denied: true}` | execute 永远不执行。 | B 拥有本次决定。 |
| 结果回卷 | `return listener(v, next_)` | denied 沿 B → A → 调用方返回。 | `{denied: true}` | 无。 | 下游控制权没有被重新取得。 |
<!-- /dsh:trace -->

## 6. 代码拆解

- `emit`：一个 for 循环挨个调，无返回。
- `waterfall`：`dispatch(index, v)` 递归——给监听者传 `(v, next_)`，
  `next_` 会带着（可能被替换的）值走到 `index+1`。链尾返回当前值。
- `parallel`：`asyncio.gather` 并发所有监听者。
- `serial`：for 循环挨个 `await`，谁先返回非 `None`/`False` 的值就 **bail**——立即返回该值并停止后续监听者（不是把 value 一路 reduce）。
- `prepend=True`：让某监听者插到最前（真实里"必须先跑"的策略用它）。

四段 demo 分别把四种模式映射到 dsh 真实事件：`tool/call`(emit)、
`agent/pre-step`(waterfall)、`tools/execute`(parallel)、`agent/turn-stopping`(serial)。

### 动手破坏一次

把 waterfall 里的 `return listener(v, next_)` 改成先调用监听者、再无条件调用下一个。危险请求会
穿过权限策略抵达 execute。这验证：**waterfall 的控制权属于监听者，是否调用 `next()`
本身就是策略结果。**

## 7. 代码解读：四种分发为什么不能合并成一个 emit

<!-- dsh:code-walkthrough id=l03-code-reading title="从监听者注册到返回值回卷" source=main.py -->
| 阶段 | 行号 | 读代码 | 设计原因 |
|---|---|---|---|
| 注册顺序是一等语义 | 35-40 | `on` 用列表保存监听者；普通注册 append，必须抢先运行的策略用 prepend 插到开头。 | waterfall 与 serial 的结果依赖先后顺序，所以顺序不能交给无序集合或偶然的 import 顺序。 |
| emit 只负责通知 | 43-45 | emit 逐个调用所有监听者，既不收集返回值，也不给监听者停止后续分发的能力。 | 遥测和日志不应改变业务决定；明确丢弃返回值能防止观察者意外成为策略。 |
| waterfall 用递归保存控制权 | 48-62 | `dispatch(index, value)` 构造只指向下一个节点的 `next_`；监听者可替换值、委派或直接返回。 | 递归调用栈同时表达下行委派和上行回卷，不需要中央分发器理解每个策略的含义。 |
| parallel 与 serial 终止规则相反 | 65-76 | parallel 用 gather 等待全部任务；serial 逐个 await，并在首个非空且非 False 的结果处返回。 | 并发副作用要求“全部完成”，策略仲裁要求“首个结论胜出”。混成同一 API 会让调用方猜测语义。 |
| 示例证明短路不是 reducer | 92-120 | annotate 通过 next 传入新值，permission 可拒绝，execute 只在被委派时运行。 | 值不是自动经过每个函数折叠；每层都显式交出控制权，这才允许权限插件真正阻止下游动作。 |
<!-- /dsh:code-walkthrough -->

## 8. 相对上一课新增了什么

L02 只有"服务调用"这一条插件间通路。本课加上第二条：**类型化事件 + 四种分发**。
至此 Cordis 五大思想里的"服务、inject、可逆 effect、事件"都齐了。

## 9. 简化了什么 vs 真实 DeepSeek Harness

| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |
|---|---|---|
| 字符串事件名，无类型 | TypeScript **声明合并**扩展 `SessionEventMap` 等，编译期检查 | 事件是公开契约，误用要在编译期挡住 |
| 分发模式靠调对方法 | 每个事件用 `@mode` 标注，生成的目录校验声明与分发点一致 | 防止"声明是 waterfall 却用 emit 分发"这类错误 |
| `next()` 简化处理 None | waterfall 是严格的 around 语义，值通过 `next()` 返回值传播 | 协作式监听可改写或替换结果，顺序敏感 |
| `serial` bail 用非 None/False | 真实 `serial` 返回第一个 non-null/non-false/non-undefined 的 bail 值并停止 | 单决策事件靠第一个拍板者短路 |
| 事件不带 scope | 事件按 agent scope 过滤分发（scope carrier） | 一个 agent 的事件不该惊动别的 agent（见 L09） |

> **parallel / serial 的承接点**（呼应审查意见）：本课先建立四种模式的直觉。
> `parallel` 会在 **L11 工具执行管线**再现（真实的 `ordered pre → concurrent execute → ordered post`）；
> `serial` 会在 **L19 Goal Round Driver** 再现。注意一个重要特例：真实的
> `agent/turn-stopping` 虽然是 serial 事件，但它的监听器**返回 `void`**——想让 turn 继续的
> 监听器通过 `agent.steer(...)` 写入 steering（副作用），loop 再重读 inbox 决定续跑，
> 而不是"返回一个 stop 决策"。L19 会专门演示这一点。

### 教学类名 → 真实 dsh 映射

| 本课 | 真实 dsh |
|---|---|
| `bus.emit` | `ctx.emit`（如 `tool/call`、`session/event`） |
| `bus.waterfall` | `ctx.waterfall`（`agent/pre-step`、`agent/request`、`tools/*`） |
| `bus.parallel` | `ctx.parallel` |
| `bus.serial` | `ctx.serial`（`agent/turn-stopping`） |
| `next()` 委派 | Cordis waterfall 的 `next()` around 语义 |

---
[← 上一课 L02](../L02_cordis_plugins/README.zh.md) · [返回总览](../../README.md) · [下一课 L04 →](../L04_session_log/README.zh.md)
