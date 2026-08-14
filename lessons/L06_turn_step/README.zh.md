# L06 Turn 与 Step 的轮次生命周期

> **Motto：step = 一次请求 + 其工具；turn = 零或多个 step，跑完才关。**

## 1. 30 秒运行

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

```text
turn  =  一整轮对话交锋（从你开口，到 agent 彻底停下）
step  =  这轮里的一个回合（模型说一次话 + 它引发的工具）

  一个 turn ┌─ step 0：模型调 shell   → 欠一次请求 → 继续
            ├─ step 1：模型再调 shell → 欠一次请求 → 继续
            └─ step 2：模型收尾       → 不欠了 → turn 关闭
```

## 5. 方案与图

```text
run_turn(input):
  append turn/start
  append user/message
  tools_owed = True
  while tools_owed:
      append step/start
      turn = llm.complete(derive_messages(log))
      append assistant/message
      if 没有工具调用:
          tools_owed = False        # 自然停止
      else:
          执行工具, append tool/call + tool/result
          tools_owed = True         # 还欠一次请求
      append step/end
  append turn/end
```

## 6. 代码拆解

`Driver.run_turn()`：

- turn 开始：`turn/start` + `user/message`，`tools_owed=True`（至少跑一个 step）。
- `while tools_owed`：每轮就是一个 step。`step/start` → 调模型 → `assistant/message`。
- 无工具 → `tools_owed=False`，记 `step/end`，跳出。
- 有工具 → 执行、记 `tool/call`+`tool/result`，`tools_owed=True`，继续。
- 收尾：`turn/end`，reason 记 `natural-stop` 或 `max-steps`。

## 7. 相对上一课新增了什么

L04/L05 把 turn/step 当记账事件写进日志。本课把它们变成**驱动循环的正规语义**：
用 `tools_owed` 判定 turn 何时继续、何时关闭，让"一个 turn 含多个 step"真正跑起来。

## 8. 简化了什么 vs 真实 DeepSeek Harness

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
