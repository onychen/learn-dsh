# L21 Capstone：合成一个可跑的 mini-dsh

> **Motto：核心主干合一，对照真实 harness 看每层如何插在一起。**
>
> 说明：本课整合的是"核心主干"那 8 层（ctx / 事件 / 日志 / 投影 / turn-step /
> llm seam / 工具管线 / subagent）。Scope、System Prompt、Skills、Compaction、
> Jobs、Goal、Trace 等"能力实验室"课不在此合并——它们在真实 dsh 里也是各自独立的 seam。

## 1. 30 秒运行

运行前先画出三条不会混在一起的状态线：root Session、child Session、`ctx` 服务表。shell 与
subagent 连续执行时，哪些数据回到 root，哪些只留在 child，哪些根本不是会话状态？

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

<!-- dsh:flow id=capstone-layers title="mini-dsh：所有机制围绕 Session 接成一个运行环" variant=map -->
| ID | 节点 | 说明 | 下一步 | 位置 | 类型 |
|---|---|---|---|---|---|
| input | 用户任务 | root agent 接住一次 headless 任务。 | pre | 1,1 | |
| pre | pre-step waterfall | 插件可以注入提醒或拒绝输入。 | user_event | 2,1 | |
| user_event | 追加 user/message | 处理后的输入先写入 root Session。 | session | 3,1 | |
| session | Root Session | 所有事实的唯一真源；模型历史随时从这里重建。 | derive | 4,1 | state |
| derive | derive_messages | 从日志投影出完整 user/assistant/tool 历史。 | llm | 5,1 | |
| llm | ctx.llm | 通过可替换 seam 请求模型。 | decide | 6,1 | |
| decide | 有工具调用吗？ | 无调用就结束；有调用交给工具注册表和策略管线。 | dispatch[有], done[无] | 7,1 | decision |
| done | 最终答复 | 关闭 step/turn，headless 任务完成。 | - | 8,1 | terminal |
| ctx | ctx 服务容器 | 组装 llm 与 tools provider，不参与保存会话事实。 | llm[提供模型], dispatch[提供工具] | 6,2 | state |
| dispatch | tools.dispatch | 经过注册表与 pre 策略执行 shell 或 subagent。 | result[普通工具], child[调用 subagent] | 7,3 | decision |
| result | 追加 tool/result | 权威工具结果写回 root Session，驱动下一 step。 | session[回到真源] | 4,3 | |
| child | Child AgentLoop | subagent 在独立上下文中运行自己的完整循环。 | child_session | 7,4 | |
| child_session | Child Session | 子 agent 的中间事件只留在子会话。 | child_result | 5,4 | state |
| child_result | 仅返回最终结论 | 子会话 final result 作为 root 的一个工具结果。 | result | 4,4 | |
<!-- /dsh:flow -->

## 5. 方案与图

<!-- dsh:stepper id=capstone-assembly title="从组装到运行 mini-dsh" -->
1. **提供模型** — `ctx.provide("llm", ReplayLLM)` 接上 L08 provider。
2. **提供工具管线** — 把 registry 与执行策略挂到 ctx。
3. **注册 subagent** — 将隔离委派能力作为一种工具加入注册表。
4. **创建 AgentLoop** — 注入 root session 与 pre-step reminder。
5. **运行任务** — 每步执行“日志投影 → 模型 → 工具分派 → 追加事件”。
<!-- /dsh:stepper -->

### 执行透视：八层机制在一次 root turn 中如何交汇

<!-- dsh:trace id=l21-runtime-xray title="root loop、工具管线与 child loop 的状态分工" -->
| 步骤 | 执行位置 | 发生什么 | Root Session | Child Session | ctx / tools |
|---|---|---|---|---|---|
| 组装产品 | `ctx.provide` | root llm、tools、subagent 接入。 | 尚无事件。 | 不存在。 | `{llm, tools:{shell,subagent}}` |
| pre-step | `context_reminder` | 输入被追加能力提醒。 | `turn/start; user(改写后)` | 不存在。 | 服务表不变。 |
| root shell | `dispatch(shell)` | policy 放行，结果写回。 | `step0; call c1; result c1` | 不存在。 | shell handler 执行。 |
| root 委派 | `dispatch(subagent)` | handler 创建 child ctx/session/loop。 | `step1; call c2` | 新建并开始 turn。 | child 有独立 llm/tools。 |
| child 完成 | `child loop.run` | child 调 shell 后收尾。 | 等待一个结果。 | 完整 11 条事件。 | child tools 完成。 |
| 边界回传 | `return result+count` | child final 成为 root c2 result。 | 新增一条 result。 | 原日志保留。 | handler 返回。 |
| root 收尾 | `root llm s3` | 模型读两次观察，关闭 turn。 | 16 条权威事件。 | 与 root 隔离。 | ctx 不保存会话事实。 |
<!-- /dsh:trace -->

## 6. 代码拆解

整个文件按课号标注了每一块的来源：

- `Session` + `SessionEvent`（L04）、`derive_messages`（L05）：唯一真源与投影。
- `Context`（L02）：极简 ctx，`llm`/`tools` 挂在上面。
- `ToolRegistry` + `dispatch`（L10/L11）：工具注册 + pre 策略（拒绝 `rm -rf`）。
- `run_waterfall`（L03）：pre-step 注入上下文提醒。
- `AgentLoop.run`（L06）：turn/step 驱动，全程 append 事件。
- `make_subagent_tool`（L16）：委派子任务到独立会话，只回传结果。
- 底部组装对照真实 `headless` profile（L20）。

### 动手破坏一次

让 child AgentLoop 复用 root Session。root 日志会混入 child turn/step，投影也无法区分说话者。
这验证：**组合机制可以复用，运行状态必须按 agent 隔离。**

## 7. 代码解读：八层不是八个阶段，而是三条协作主线

<!-- dsh:code-walkthrough id=l21-code-reading title="状态主线、能力主线与委派边界" source=main.py -->
| 阶段 | 行号 | 读代码 | 设计原因 |
|---|---|---|---|
| Session 与投影组成状态主线 | 38-71 | Session 保存事实；derive_messages 投影 user、assistant、tool result 并保留 callId。 | 后续能力只追加或读取这条主线，不各自维护对话副本。 |
| Context 与 Registry 组成能力主线 | 75-103 | ctx 按 key 提供服务；registry 在 pre policy 后查 handler。 | 会话事实与能力对象分开：ctx 可重组，Session 仍是同一历史。 |
| AgentLoop 是两条主线交汇点 | 116-148 | pre-step 后落日志，每 step 重新投影、请求 llm、分派工具并写结果。 | 循环不拥有能力，但保证每个观察回到真源后才进入下一请求。 |
| Subagent 建立第二套主线 | 152-161 | spawn 创建 child ctx、tools、Session 和 Loop，只返回 final + count。 | 委派是实例化另一套相同机制，并限制边界输出。 |
| 入口选择 root 产品形态 | 198-217 | 提供 root llm、注册工具、创建 root session，并注入 reminder。 | profile 选择 provider/consumer，运行时 loop 无需知道为何这样组装。 |
<!-- /dsh:code-walkthrough -->

## 8. 相对上一课新增了什么

不新增机制，而是**把 8 层机制整合**成一个可运行的整体，并用课号标注每块出处，
让你看清各层如何协同。这是从"逐层理解"到"整体贯通"的收束。

## 9. 简化了什么 vs 真实 DeepSeek Harness

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
