# L06 Turn 与 Step 的轮次生命周期

> **Motto：step = 一次请求 + 其工具；turn = 零或多个 step，跑完才关。**

## 1. 30 秒运行

运行前先猜：第一个 shell 已经成功返回时，为什么 `turn` 还不能结束？如果把
`tools_owed=True` 错写成 `False`，最终答复会缺少什么？

```powershell
python lessons/L06_turn_step/main.py
```

预期输出（节选）：

```text
╔══ turn/start turn=0 ══
║  ┌─ step/start step=0
║  │  [assistant] 第一步：调工具。
║  │  [tool] shell → 'step\none'
║  └─ step/end（工具已跑，仍欠一次请求 → 再开一 step）
║  ┌─ step/start step=1
║  │  ...
║  ┌─ step/start step=2
║  │  [assistant] 第三步：够了，收尾。
║  └─ step/end（自然停止，本 turn 不再欠账）
╚══ turn/end turn=0 ══
[统计] 这个 turn 里跑了 3 个 step
```

## 2. 观察输出

一个 turn 里嵌了**三个 step**。前两个 step 因为"调了工具、还欠模型一次请求"
而继续，第三个 step 模型不再调工具（自然停止），turn 才关闭。这就是
turn 与 step 的嵌套关系。

## 3. 为什么需要这一层

L04/L05 里我们已经在追加 `turn/start`、`step/start` 了，但那只是记账，
没人真正解释"一个 turn 什么时候该继续、什么时候该关"。

**turn/step 是 agent loop 的节奏器。** 它回答一个核心问题：模型调完工具后，
要不要再问它一次？答案是"要"（得把工具结果给它看）。所以一个 turn 会自然地
展开成多个 step，直到模型说"够了"或没有新输入。

## 4. 心智模型

<!-- dsh:structure id=turn-step-structure title="一个 turn 包含零到多个 step" -->
- **Turn：一整轮对话交锋** — 从用户开口开始，到 agent 彻底停下为止。
  - **Step 0** — 模型调用 shell，工具结果让系统还欠一次模型请求。
  - **Step 1** — 模型再次调用 shell，仍需继续。
  - **Step 2** — 模型给出收尾文本，不再欠请求，turn 才能关闭。
<!-- /dsh:structure -->

## 5. 方案与图

<!-- dsh:flow id=turn-step-loop title="Turn / Step 驱动循环" -->
| ID | 节点 | 说明 | 下一步 |
|---|---|---|---|
| turn | 开启 turn | 追加 `turn/start` 与 `user/message` | step |
| step | 开启 step | 追加 `step/start`，从日志派生 messages 并请求模型 | decide |
| decide | 检查工具调用 | assistant 有工具调用就执行；没有则自然停止 | tools[有调用], close[无调用] |
| tools | 执行工具 | 追加 tool/call、tool/result 和 step/end；仍欠一次请求 | step[进入下一 step] |
| close | 关闭 turn | 追加 step/end 与 turn/end | - |
<!-- /dsh:flow -->

### 执行透视：谁决定再开一个 step

<!-- dsh:trace id=l06-runtime-xray title="一个 turn 为什么自然展开成三个 step" -->
| 步骤 | 执行位置 | 发生什么 | 事件日志 | 模型视图 | 继续条件 |
|---|---|---|---|---|---|
| 开启 turn | `run_turn()` | 认领输入，追加 turn/start 和 user/message。 | `turn/start; user/message` | `[user]` | `tools_owed=True`，至少跑一个 step。 |
| Step 0 请求 | `llm.complete(...)` | 模型返回第一次 shell 调用。 | `… step/start(0); assistant` | `[user, assistant]` | 有 tool call，执行工具。 |
| Step 0 结束 | `session.append("step/end")` | 结果已入日志，但模型尚未读到。 | `… tool/call; tool/result; step/end(0)` | `[user, assistant, tool]` | `tools_owed=True`，结果欠一次模型请求。 |
| Step 1 请求 | `while tools_owed` | 新 step 读取包含第一次结果的完整投影，又返回一次调用。 | `… step/start(1); assistant` | `[user, assistant, tool, assistant]` | 再次有 tool call。 |
| Step 1 结束 | `tools_owed = True` | 第二个工具结果写回，仍不能直接结束 turn。 | `… tool/result; step/end(1)` | `[…, tool(c2)]` | 第二个结果也欠一次模型请求。 |
| Step 2 请求 | `if not turn.wants_tools` | 模型读到两个结果，只返回收尾文本。 | `… step/start(2); assistant` | `[…, assistant final]` | 无 tool call，设置 `tools_owed=False`。 |
| 关闭 turn | `session.append("turn/end")` | step/end 与 turn/end 记录自然停止。 | `… step/end(2); turn/end` | 完整对话投影 | 不再欠请求，本 turn 关闭。 |
| 第二个 turn | `driver.run_turn(...)` | 新 turn 继续使用同一会话，但局部 step 重新从 0 开始。 | `turn/start(1); step/start(0)` | 包含前一 turn 的历史 | 验证 step 是 turn 内局部编号。 |
<!-- /dsh:trace -->

## 6. 代码拆解

`Driver.run_turn()`：

- turn 开始：`turn/start` + `user/message`，`tools_owed=True`（至少跑一个 step）。
- `while tools_owed`：每轮就是一个 step。`step/start` → 调模型 → `assistant/message`。
- 无工具 → `tools_owed=False`，记 `step/end`，跳出。
- 有工具 → 执行、记 `tool/call`+`tool/result`，`tools_owed=True`，继续。
- 收尾：`turn/end`，reason 记 `natural-stop` 或 `max-steps`。

### 动手破坏一次

在工具执行完成后把 `tools_owed` 改成 `False`。循环会提前关闭，模型从未看到工具结果，
也就无法生成基于观察的最终答复。这验证了驱动器的核心不变量：**产生工具结果的 step，
必然还欠后续一次模型请求。**

## 7. 代码解读：Driver 如何把“欠一次请求”变成循环

<!-- dsh:code-walkthrough id=l06-code-reading title="turn/step 生命周期的控制变量" source=main.py -->
| 阶段 | 行号 | 读代码 | 设计原因 |
|---|---|---|---|
| turn 认领输入并初始化局部状态 | 75-88 | `turn_no` 跨 turn 增长，而 `step=-1` 在每次 `run_turn` 内重建；输入与 turn/start 先进入日志。 | turn 是会话级顺序，step 只在当前 turn 内有意义。把 step 放到实例字段会让编号跨 turn 泄漏。 |
| 每个 step 只包含一次模型请求 | 90-103 | while 开一轮就追加一个 step/start，随后从完整日志派生 messages，调用模型并记录 assistant。 | “一次请求 + 其工具”是可回放和计费的最小节奏单位；工具再多也不能偷偷产生第二次模型请求。 |
| 无工具才消除欠账 | 104-111 | `not turn.wants_tools` 时设置 `tools_owed=False`、保存 final_text、结束 step 并 break。 | 文本不是停止信号，结构化工具调用才是。只有没有待执行动作时，本 turn 才不欠下一次观察后的决策。 |
| 工具结果制造下一次请求 | 113-117 | 调用与结果写入后关闭当前 step，并保持 `tools_owed=True`。 | 结果虽然已产生，但模型尚未读到；继续循环不是重试，而是把新观察交给模型的正常下一步。 |
| turn/end 记录真正终止原因 | 114-117 | 循环外根据欠账状态写 `natural-stop` 或 `max-steps`。 | 同样是停止，模型自然完成与宿主强制截断语义不同；恢复、UI 和遥测需要区分二者。 |
| 第二个 turn 验证作用域 | 136-147 | 同一 Driver 再跑一次，脚本只返回文本，并检查 step 从 0 重置。 | 通过连续运行而非静态注释证明局部计数不变量，防止单 turn 测试掩盖状态泄漏。 |
<!-- /dsh:code-walkthrough -->

## 8. 相对上一课新增了什么

L04/L05 把 turn/step 当记账事件写进日志。本课把它们变成**驱动循环的正规语义**：
用 `tools_owed` 判定 turn 何时继续、何时关闭，让"一个 turn 含多个 step"真正跑起来。

## 9. 简化了什么 vs 真实 DeepSeek Harness

| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |
|---|---|---|
| 单条输入直入 | 一个 **inbox** 队列，认领 next-step 输入 + 一条排队消息 | 注入的上下文要排队等待，直到有消息唤醒 driver |
| `tools_owed` 布尔 | 完整的 turn 流：`agent/pre-step` → `step/start` → `agent/request` → `llm/stream` → tools → `agent/turn-stopping` | 每个阶段都是可拦截的扩展点 |
| 无终止检查点 | `agent/turn-stopping` 是 serial 终止检查点（见 L19） | goal 续跑、预算控制在这里决定要不要真停 |
| 无取消/错误恢复 | 取消信号、`agent/request-error` 恢复分支 | 长任务要能中断、瞬时错误要能重试（见 L08） |

### 教学类名 → 真实 dsh 映射

| 本课 | 真实 dsh |
|---|---|
| `Driver.run_turn` | `ctx.agentLoop` 的 turn 驱动（`core/agent-loop`） |
| `tools_owed` | "工具欠一次请求"的继续判定 |
| `turn/start`,`step/start`,... | 同名 SessionEvent（durable） |

---
[← 上一课 L05](../L05_derive_messages/README.zh.md) · [返回总览](../../README.md) · [下一课 L07 →](../L07_pre_step/README.zh.md)
