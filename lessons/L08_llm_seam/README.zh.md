# L08 LLM 适配器与流式响应（llm seam）

> **Motto：模型本身也是可替换的 provider。**

## 1. 30 秒运行

运行前先猜：每个 chunk 都写进日志后，为什么还要再追加完整 `assistant/message`？第一次
provider 报错时，已写下的 `step/start` 应不应该保留？

```powershell
python lessons/L08_llm_seam/main.py
```

预期输出（节选）：

```text
--- provider = scripted ---
  [scripted] 流式输出: 你好，我是脚本 provider。
  日志里有 17 个 assistant/chunk（token 级回放）

--- provider = uppercase（换 provider，行为立刻不同）---
  [uppercase] 流式输出: ECHO: CHANGE ME

--- provider = scripted，第一次故意失败（演示错误恢复）---
  [scripted] 流式输出:
  [恢复] 捕获错误 RuntimeError('模拟的瞬时网络错误')，重试第 1 次
  [scripted] 流式输出: 重试后成功了。
```

## 2. 观察输出

同一个 `run_step` driver，喂进三个不同 provider，行为立刻不同——因为它们都实现同一个
`stream` 接口。流式输出被切成一个个 chunk，每个 chunk 都记成一条 `assistant/chunk`
事件（token 级回放）。第三个 provider 第一次故意失败，driver 重试后成功。

## 3. 为什么需要这一层

回想 **L01**：我们直接 `llm.complete(messages)`。那其实偷偷省略了一整层——
真实 dsh 里模型不是一个函数，而是 `ctx.llm` 这个 **seam** 背后的 provider。

为什么要抽成 seam？因为你要能：换模型厂商（DeepSeek / Pi-AI）、在测试里换成
确定性 Replay、在不同 profile 里挂不同模型——而 driver 一行都不用改。
这就是 L01 的"直接调模型"到这里被补全的那一层。

## 4. 心智模型

llm seam 就是**电源插座标准**：

<!-- dsh:structure id=llm-provider-structure title="同一个插座，可以接不同模型 provider" -->
- **ctx.llm 接口** — 统一约定 `stream(messages) → chunks`。
  - **llm-deepseek** — 连接真实 DeepSeek 模型。
  - **llm-pi-ai** — 连接另一家模型实现。
  - **llm-replay** — 用确定性脚本支撑测试和离线教学。
<!-- /dsh:structure -->

任何 provider 插上去都能用，因为它们符合同一个"插座标准"。

## 5. 方案与图

<!-- dsh:flow id=llm-stream-flow title="每次流式尝试都有完整的事件边界" variant=map -->
| ID | 节点 | 说明 | 下一步 | 位置 | 类型 |
|---|---|---|---|---|---|
| start | 追加 step/start | 每一次首次请求或重试都开启一段新的尝试边界。 | stream | 1,2 | boundary |
| stream | provider.stream | 通过统一 seam 消费 provider 返回的流。 | chunk[收到 chunk], message[流结束], error[抛错] | 2,2 | decision |
| chunk | 追加 assistant/chunk | 每个增量都进入日志，同时累计 text delta。 | stream[继续消费] | 3,1 | |
| message | 合成 assistant/message | 流正常结束后生成供 deriveMessages 使用的完整消息。 | end | 4,2 | |
| end | 追加 step/end | 正常尝试完整收口。 | done | 5,2 | boundary |
| done | 返回完整文本 | 上层得到本次模型结果。 | - | 6,2 | terminal |
| error | 保存原始错误 | 失败尝试也先结束 step，不能留下半截生命周期。 | failed_end | 3,3 | |
| failed_end | 追加 step/end | 关闭失败尝试后再判断是否重试。 | retry | 4,3 | boundary |
| retry | 还有重试预算吗？ | 有预算就从新的 step/start 重来；否则向上抛原错误。 | start[有], failed[没有] | 5,3 | decision |
| failed | 请求失败 | 保留 provider 原始错误，交给上层恢复边界。 | - | 6,3 | terminal |
<!-- /dsh:flow -->

### 执行透视：失败与成功共享 seam，不共享恢复决定

<!-- dsh:trace id=l08-runtime-xray title="chunk 缓冲、会话事实与重试状态" -->
| 步骤 | 执行位置 | 发生什么 | text_parts 缓冲 | Session 事件 | Recovery 状态 |
|---|---|---|---|---|---|
| 开始尝试 | `step/start` | Driver 开启一次 provider 调用。 | `[]` | `step/start` | `attempt=0` |
| 首次失败 | `raise RuntimeError` | provider 尚未 yield 就抛错。 | `[]` | `step/start; step/end` | 预算允许，`attempt=1`。 |
| 重开请求 | `continue` | 新循环重新创建缓冲并调用同一 seam。 | 新的 `[]` | 新 `step/start` | 最后一次机会。 |
| 消费流 | `for chunk in stream` | 每个 delta 同时入日志并追加缓冲。 | `[重, 试, 后, …]` | `assistant/chunk × N` | 无错误，继续消费。 |
| 合成语义消息 | `"".join(text_parts)` | 流结束后形成完整 assistant。 | `"重试后成功了。"` | `assistant/message; step/end` | 成功，重试状态退出。 |
<!-- /dsh:trace -->

## 6. 代码拆解

- `LLMProvider`：接口（Service Definition），只约定一个 `stream(messages)`。
- `ScriptedProvider` / `UpperCaseProvider`：两个可互换实现。`fail_first` 演示瞬时错误。
- `run_step()`：消费流 → 每个 chunk 记 `assistant/chunk` → 流结束合成 `assistant/message`
  （**chunk 用于回放，message 用于派生历史**，二者分工）→ `try/except` 里实现重试/保留原错误的**恢复边界**。

### 动手破坏一次

删掉合成 `assistant/message` 的三行，只保留 chunks。终端仍能看到文字，但下一次投影没有稳定
assistant 消息。这验证：**流式 chunk 是回放事实，完整 message 才是模型历史的语义单位。**

## 7. 代码解读：Provider 如何被隔离在统一 stream 接口后

<!-- dsh:code-walkthrough id=l08-code-reading title="从 seam 定义到错误恢复" source=main.py -->
| 阶段 | 行号 | 读代码 | 设计原因 |
|---|---|---|---|
| seam 只承诺最小协议 | 31-37 | `LLMProvider` 只定义 `stream(messages)`，不规定 HTTP SDK、模型厂商或 chunk 来源。 | consumer 依赖稳定输出协议，而不是某个客户端类型，provider 才能在 Replay、真实 API 和测试替身间互换。 |
| Replay 同时模拟流和故障 | 40-56 | ScriptedProvider 维护调用次数，可在第一次抛错，成功时逐字符 yield delta。 | 可控故障让恢复路径成为确定性测试；逐字符则迫使 Driver 真正消费迭代器。 |
| 第二实现证明可替换 | 59-67 | UpperCaseProvider 使用同一签名，却根据输入生成不同的流。 | 只有出现第二个实现，接口可替换性才被证明；否则 seam 可能只是给单一实现换名。 |
| Driver 保存原始流与语义消息 | 84-101 | chunk 立即 append 并累积；流结束后 join 成完整文本，再写 assistant/message。 | UI/调试需要 token 级事实，下一轮模型需要稳定消息；两种读模型职责不同。 |
| 重试属于 consumer 边界 | 102-111 | 异常先关闭 step，再由 Driver 根据 attempt 决定 continue 或抛出原错误。 | provider 只报告失败；重试次数、预算和错误呈现必须由拥有 turn 语义的 Driver 控制。 |
<!-- /dsh:code-walkthrough -->

## 8. 相对上一课新增了什么

前 7 课都把模型当成一个直接可调的函数。本课把它抽成 **llm seam + 可互换 provider**，
并引入两样新东西：**流式 chunk（token 级回放）** 和 **错误恢复边界**，回扣 L01 的简化点。

## 9. 简化了什么 vs 真实 DeepSeek Harness

| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |
|---|---|---|
| `stream` 返回 dict chunk | 完整的 `StreamChunk` 词汇 + `agent/request`/`llm/stream` waterfall | 请求构造、流处理都是可拦截扩展点 |
| 文本 chunk | text、tool_call、usage、reasoning 等多种 chunk | 工具调用、推理、token 计费都在流里 |
| try/except 重试 | `agent/request-error` waterfall，区分瞬时错误与上下文溢出 | 上下文溢出要触发压缩而非重试（见 L15） |
| `assistant/message` 存文本 | 带 `usage` 和 `sourceEventSeqs`（精确列出源 chunk），空内容也记账 | 回放保真、计费、遥测 |
| if/else 选 provider | profile/bundle 组合决定挂哪个 provider | 生产/测试/多厂商用配置切换（见 L20） |

### 教学类名 → 真实 dsh 映射

| 本课 | 真实 dsh |
|---|---|
| `LLMProvider.stream` | `ctx.llm.stream()`（`llm/llm` seam） |
| `ScriptedProvider` | `dsh-llm-replay` |
| `UpperCaseProvider` / 真模型 | `dsh-llm-deepseek` / `dsh-llm-pi-ai` |
| `assistant/chunk` | 同名事件（token 级回放） |
| 重试分支 | `agent/request-error` 恢复 |

---
[← 上一课 L07](../L07_pre_step/README.zh.md) · [返回总览](../../README.md) · [下一课 L09 →](../L09_scope/README.zh.md)
