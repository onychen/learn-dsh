# L21 Capstone：合成一个可跑的 mini-dsh

> **Motto：核心主干合一，对照真实 harness 看每层如何插在一起。**
>
> 说明：本课整合的是"核心主干"那 8 层（ctx / 事件 / 日志 / 投影 / turn-step /
> llm seam / 工具管线 / subagent）。Scope、System Prompt、Skills、Compaction、
> Jobs、Goal、Trace 等"能力实验室"课不在此合并——它们在真实 dsh 里也是各自独立的 seam。

## 1. 30 秒运行

```powershell
python lessons/L21_capstone/main.py
```

预期输出（节选）：

```text
========== mini-dsh 启动（headless 缩影）==========
  [assistant] 先本地跑一条命令。
  [tool] shell → 'mini-dsh\nalive'
  [assistant] 再委派一个子任务隔离上下文。
  [tool] subagent → '子任务完成：环境正常。（子会话内 11 条事件，未回传）'
  [assistant] 全部完成。mini-dsh 跑通了 8 层机制。

========== 唯一真源：root 会话日志 ==========
  #0 turn/start ... #15 turn/end
  共 16 条事件。模型历史随时可从这份日志重新派生（可回放）。
```

## 2. 观察输出

一个约 200 行的 mini-dsh 跑通了**完整流程**：pre-step 注入提醒 → 本地 shell →
委派 subagent（子会话隔离）→ 收尾。整个过程只留下一份 16 条事件的 root 日志，
子 agent 的中间过程留在它自己的会话——root 保持干净。

## 3. 为什么需要这一层

前 20 课每课只看一层。但真正的理解，来自看清**这些层如何插在一起**。这一课把
8 层核心机制装进一个文件，让你亲眼看到：一次 `loop.run()` 是怎么穿过 pre-step、
turn/step、llm seam、工具管线、subagent，同时始终把一切追加进那份唯一真源的。

## 4. 心智模型

回到最开始的锚点——**L01 那个循环从没变过**。这一课只是把 20 课的每一层
都插到那个循环旁边：

```text
        ┌─────────────── ctx（L02）───────────────┐
        │  llm(L08)   tools(L10/11)   ...          │
        └──────────────────┬──────────────────────┘
                           │
  user_input → pre-step(L03) → AgentLoop.run（L06 turn/step）
                                   │
                                   ├─ derive_messages（L05）从日志投影
                                   ├─ llm.complete（L08 seam）
                                   ├─ tools.dispatch（L10/11 管线）
                                   │      └─ subagent（L16 隔离子会话）
                                   └─ 一切 append 进 Session（L04 真源）
```

## 5. 方案与图

```text
组装（L20 缩影）:
  ctx.provide("llm", ReplayLLM)          # L08
  ctx.provide("tools", registry+管线)     # L10/L11
  registry.register("subagent", spawn)   # L16

运行:
  loop = AgentLoop(ctx, root_session, pre_step=[reminder])   # L06 + L03
  loop.run(task)
     每步: derive_messages(log) → llm → tools.dispatch → append 事件   # L05/L04
```

## 6. 代码拆解

整个文件按课号标注了每一块的来源：

- `Session` + `SessionEvent`（L04）、`derive_messages`（L05）：唯一真源与投影。
- `Context`（L02）：极简 ctx，`llm`/`tools` 挂在上面。
- `ToolRegistry` + `dispatch`（L10/L11）：工具注册 + pre 策略（拒绝 `rm -rf`）。
- `run_waterfall`（L03）：pre-step 注入上下文提醒。
- `AgentLoop.run`（L06）：turn/step 驱动，全程 append 事件。
- `make_subagent_tool`（L16）：委派子任务到独立会话，只回传结果。
- 底部组装对照真实 `headless` profile（L20）。

## 7. 相对上一课新增了什么

不新增机制，而是**把 8 层机制整合**成一个可运行的整体，并用课号标注每块出处，
让你看清各层如何协同。这是从"逐层理解"到"整体贯通"的收束。

## 8. 简化了什么 vs 真实 DeepSeek Harness

| 教学版（本课） | 真实 dsh（examples/headless-agent） | 为什么真实工程需要那层复杂度 |
|---|---|---|
| 200 行单文件 | 数十个 package 组成的插件树 | 每层独立演进、可替换、可测试 |
| 手动组装 ctx | `dsh --profile headless` 声明式启动 | 配置驱动，多产品复用（见 L20） |
| 内存日志 | JSONL 持久化 + checkpoint policy | 崩溃恢复、跨进程存活（见附录 X） |
| Replay LLM | DeepSeek V4 + 真实流式 | 生产级模型能力 |
| 只集成 8 层 | 还有 compaction/goal/jobs/skills/scope 全都在线 | 完整产品需要全部能力协同 |

> **对照真实入口**：`deepseek-harness/examples/headless-agent` 的 headless profile
> 也是"组合 agent 主干 + 一个 root agent + 持久化 + checkpoint"，接一个任务、跑完、
> 打印最终文本、退出。本课就是它的教学缩影——机制等价，规模不同。

### 教学类名 → 真实 dsh 映射

| 本课 | 真实 dsh |
|---|---|
| 整个 mini-dsh | `examples/headless-agent` 的 headless 组合 |
| `AgentLoop` | `ctx.agentLoop`（`core/agent-loop`） |
| 组装段 | `dsh --profile headless` |
| root/child Session | root agent + subagent 的独立会话 |

---
🎓 **恭喜你走完 21 课！** 你已经从最小循环一路叠到多 agent 协作，理解了 dsh 的完整骨架。

[← 上一课 L20](../L20_profile_bundle/README.zh.md) · [返回总览](../../README.md) · [下一课 L22 →](../L22_session_trace/README.zh.md)
