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

```text
        ┌─────────── ctx.llm（插座，接口约定）───────────┐
        │             stream(messages) -> chunks         │
        └───▲──────────────▲───────────────▲─────────────┘
            │              │               │
      llm-deepseek   llm-pi-ai        llm-replay
      （真模型）      （另一家）        （测试/教学）
```

任何 provider 插上去都能用，因为它们符合同一个"插座标准"。

## 5. 方案与图

```text
run_step(provider, messages):
  append step/start
  for chunk in provider.stream(messages):     ← 流式：一个个 chunk
      append assistant/chunk (chunk)           ← token 级回放
      if text_delta: 累积文本
  append assistant/message (合成的完整文本)      ← 派生历史用这条
  append step/end

  try/except:
     provider 抛错 → attempt < max_retries ? 重试 : 保留原错误   ← 错误恢复边界
```

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
