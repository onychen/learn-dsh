# L16 Subagent：大任务拆小，上下文隔离（仅 one-shot）

> **Motto：每个子任务一份干净的上下文，只回传结果。**

## 1. 30 秒运行

```powershell
python lessons/L16_subagent/main.py
```

预期输出（节选）：

```text
[父 assistant] 这个子任务过程会很啰嗦，我委派给子 agent。
  [spawn] 启动子 agent: '环境探测'（全新独立会话）
  [spawn] 子 agent 完成，子会话内部有 4 条事件（留在子会话，不回传）
[父 assistant] 子 agent 回传了结果，我据此收尾：环境探测完毕：一切正常...

===== 上下文隔离证明 =====
  父会话事件数: 3（干净——子 agent 的中间过程没进来）
```

## 2. 观察输出

父 agent 把一个"啰嗦"的子任务委派出去。子 agent 在**自己的独立会话**里跑了 4 条事件，
但父会话只有 3 条——子 agent 的中间过程一条都没污染父上下文。父只拿到最终结论。

## 3. 为什么需要这一层

主 agent 的上下文很宝贵。有些子任务（"读完 20 个文件总结架构"）会产生大量中间噪音。
如果都堆进主对话，主 agent 很快被淹没、token 也爆。

**Subagent 用"全新会话 + 只回传结果"隔离上下文。** 子 agent 有自己独立的事件日志
（回顾 L04），中间过程留在子会话，父只接收最终结果。这就是"大任务拆小、上下文隔离"。

## 4. 心智模型

Subagent 就像**把活外包**：

<!-- dsh:structure id=subagent-structure title="项目经理与隔离的外包团队" -->
- **父 agent（项目经理）** — 保留主任务上下文，只提出清晰的子任务。
  - **委派边界** — 把“环境探测”作为一个独立 prompt 交出去。
  - **子 agent（外包团队）** — 在自己的会话里思考、调用工具和记录中间事件。
    - **隔离会话** — 啰嗦的中间过程不进入父会话。
    - **最终结论** — 只把完成后的结果交回父 agent。
  - **继续推进** — 父 agent 根据结论完成主任务。
<!-- /dsh:structure -->

## 5. 方案与图

<!-- dsh:flow id=subagent-flow title="父子会话之间只交换任务与结论" -->
| ID | 节点 | 说明 | 下一步 |
|---|---|---|---|
| parent | 父会话 | 接收用户请求并决定委派 | delegate |
| delegate | 子任务 prompt | 创建一份全新的隔离会话 | child |
| child | 子会话内部执行 | assistant、tool 和中间事件全部留在子会话 | result |
| result | 最终结论 | 只把 final result 作为 tool result 交回 | finish |
| finish | 父 agent 收尾 | 父会话依据结论继续，历史保持干净 | - |
<!-- /dsh:flow -->

## 6. 代码拆解

- `spawn_subagent()`：**one-shot** provider——建一个全新 `Session`，跑 `run_agent`，只返回 `result`。
- `run_agent()`：就是 L06 的精简 agent loop，跑在子会话上。
- 父循环：模型调 `subagent` 工具 → spawn → 把子 agent 的 `result` 作为 tool_result 塞回父历史。
- 末尾对比父/子会话事件数，证明上下文隔离。

## 7. 相对上一课新增了什么

前面所有 agent 都是单个。本课引入 **subagent 委派**：把子任务丢进一个独立会话的子 agent，
用"全新上下文 + 只回传结果"实现隔离。

## 8. 简化了什么 vs 真实 DeepSeek Harness

| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |
|---|---|---|
| 只有 one-shot spawn | spawn **和** fork（从父会话分叉）两条启动路径 | fork 能带上父上下文的一部分 |
| 一个进程内 provider | 六种 provider：spawn-in-process / fork / acp / codex / claude-code / dsh-sdk | 子 agent 可以是另一个产品/远程进程 |
| 跑完即结束 | continuable（可继续）子 agent + followup + report 返回通道 | 父可与子多轮交互、子可中途汇报 |
| 无能力校验 | `SubagentCapabilities`（outputSchema/depthLimit/toolFilter/persona）启动前校验 | 请求不支持的能力要"fail loud"而非静默降级 |
| 结果是字符串 | 结构化 `SubagentResult.structured`（按 output schema）+ 冷恢复 | 类型化结果、崩溃后可从存储恢复 |

> **限定说明**（呼应审查意见）：本课只实现 one-shot，标题已限定。真实 subagent seam
> 是 dsh 里最丰富的能力之一，切勿把这个教学玩具当成它的全部语义。

### 教学类名 → 真实 dsh 映射

| 本课 | 真实 dsh |
|---|---|
| `spawn_subagent` | `ctx.subagents` + `dsh-subagent-spawn-in-process` |
| `subagent` 工具 | `dsh-tool-subagent`（consumer） |
| 独立 `Session` | 子 agent 的独立会话日志 |
| `result` 回传 | `SubagentResult`（含 structured） |

---
[← 上一课 L15](../L15_compaction/README.zh.md) · [返回总览](../../README.md) · [下一课 L17 →](../L17_jobs/README.zh.md)
