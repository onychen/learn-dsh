# L08 LLM 适配器与流式响应（llm seam）

> **Motto：模型本身也是可替换的 provider。**

## 1. 30 秒运行

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

## 6. 代码拆解

- `LLMProvider`：接口（Service Definition），只约定一个 `stream(messages)`。
- `ScriptedProvider` / `UpperCaseProvider`：两个可互换实现。`fail_first` 演示瞬时错误。
- `run_step()`：消费流 → 每个 chunk 记 `assistant/chunk` → 流结束合成 `assistant/message`
  （**chunk 用于回放，message 用于派生历史**，二者分工）→ `try/except` 里实现重试/保留原错误的**恢复边界**。

## 7. 相对上一课新增了什么

前 7 课都把模型当成一个直接可调的函数。本课把它抽成 **llm seam + 可互换 provider**，
并引入两样新东西：**流式 chunk（token 级回放）** 和 **错误恢复边界**，回扣 L01 的简化点。

## 8. 简化了什么 vs 真实 DeepSeek Harness

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
