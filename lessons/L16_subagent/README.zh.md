# L16 Subagent：大任务拆小，上下文隔离（仅 one-shot）

> **Motto：每个子任务一份干净的上下文，只回传结果。**

## 1. 30 秒运行

运行前先猜：子会话里的 shell result 是否应该逐条复制回父会话？如果只回最终结果，父会话
还需要知道子会话事件数量吗？

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

### 执行透视：委派边界两侧各自保存什么

<!-- dsh:trace id=l16-runtime-xray title="父会话保持干净，子会话保留完整过程" -->
| 步骤 | 执行位置 | 发生什么 | Parent Session | Child Session | 跨边界载荷 |
|---|---|---|---|---|---|
| 父决定委派 | `parent_llm.complete` | 父返回 subagent call。 | `user; assistant(delegate)` | 尚不存在。 | description + prompt。 |
| 创建隔离会话 | `Session(child)` | provider 新建 child。 | 不变。 | 空日志。 | 只传任务输入。 |
| 子执行工具 | `run_agent(child)` | 子模型调用 shell 并读结果。 | 不变。 | `user; assistant; tool/result` | 中间事件不跨界。 |
| 子形成结论 | `not wants_tools` | child 返回最终文本。 | 不变。 | 新增 final assistant。 | `{result,event_count}` |
| 父接收结果 | `messages.append(tool)` | 结论成为父侧一个 tool result。 | 父 history 增加一条观察。 | 完整日志留在原地。 | 只回 final result。 |
| 父收尾 | `parent_llm.complete` | 父根据结论生成答复。 | 只有父自己的事件。 | 子过程未复制。 | 委派完成。 |
<!-- /dsh:trace -->

## 6. 代码拆解

- `spawn_subagent()`：**one-shot** provider——建一个全新 `Session`，跑 `run_agent`，只返回 `result`。
- `run_agent()`：就是 L06 的精简 agent loop，跑在子会话上。
- 父循环：模型调 `subagent` 工具 → spawn → 把子 agent 的 `result` 作为 tool_result 塞回父历史。
- 末尾对比父/子会话事件数，证明上下文隔离。

### 动手破坏一次

把 `child.events` 全部追加进 parent messages。父仍能完成任务，但中间噪音会迅速膨胀主上下文。
这验证：**隔离的价值不只是另开执行器，而是明确限制回传面。**

## 7. 代码解读：one-shot provider 如何建立并关闭隔离边界

<!-- dsh:code-walkthrough id=l16-code-reading title="父任务、子循环与结果回传" source=main.py -->
| 阶段 | 行号 | 读代码 | 设计原因 |
|---|---|---|---|
| Session 以实例保存事件 | 31-36 | 每个 Session 自带 label 与独立 events。 | 隔离首先是状态所有权；父子若共享全局日志，再多 provider 抽象也挡不住污染。 |
| 子 agent 运行完整循环 | 39-55 | run_agent 追加自己的 user、assistant、tool result，并维护 messages。 | 子任务需要观察工具结果再决策，因此必须拥有循环与历史，不是一次普通函数调用。 |
| spawn 只返回边界对象 | 61-66 | 新建 child、运行到完成，再返回 result 与诊断计数，不返回 events。 | provider 决定跨会话协议；真正进入父上下文的只有收敛结论。 |
| 父把 subagent 当普通工具 | 70-80 | 父发出结构化 call，第二步从最后一条 tool content 读取结果。 | 委派仍遵守“调用—观察”的工具协议，父 Agent Loop 无需特殊控制流。 |
| 子脚本保留中间噪音 | 83-90 | child 先调用 shell，再生成干净总结。 | 两步脚本明确展示哪些过程被挡在隔离边界内。 |
<!-- /dsh:code-walkthrough -->

## 8. 相对上一课新增了什么

前面所有 agent 都是单个。本课引入 **subagent 委派**：把子任务丢进一个独立会话的子 agent，
用"全新上下文 + 只回传结果"实现隔离。

## 9. 简化了什么 vs 真实 DeepSeek Harness

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
