# L01 最小 Agent Loop

> **Motto：一个循环 + 一次模型调用 + 一个工具，就是 agent 的胚胎。**

## 1. 30 秒运行

先别急着运行。先猜两个问题：**shell 执行完后，循环为什么不能直接结束？第二次调用模型时，
模型凭什么知道 shell 的结果？** 把答案写下来，再和下面的执行透视对照。

```powershell
python lessons/L01_agent_loop/main.py
```

预期输出（Windows / PowerShell）：

```text
--- step 1 ---
[assistant] 我先看看当前目录里有什么。
[tool_call] shell({'command': 'echo hello from dsh lesson 01'})
[tool_result] hello
from
dsh
lesson
01

--- step 2 ---
[assistant] 命令执行完毕，输出是：'hello\nfrom\ndsh\nlesson\n01'。任务完成。

==============================
[最终答复] 命令执行完毕，输出是：'hello\nfrom\ndsh\nlesson\n01'。任务完成。
```

## 2. 观察输出

你看到了一个 agent 的完整生命周期：它先**思考**（决定调工具）、**行动**（执行 shell）、
**观察**（看到工具结果）、再**总结**（给出最终答复）。整个过程跑了两个 step 就停了——
因为第二次模型不再想调工具。

（顺带：`echo` 的输出被拆成多行，是因为 Windows 上我们走的是 PowerShell。
这不是 bug，而是"shell 是平台相关的"的第一个信号——记住它，L12 会把它变成一个 seam。）

## 3. 为什么需要这一层

没有循环，模型只能"说一句话"就结束。但真实任务需要"做一步、看结果、再做下一步"。
**agent 的本质就是：把模型放进一个循环里，让它能反复调用工具直到任务完成。**

这一层是所有 agent 的地基。你会发现后面 21 课**从不修改这个循环的本质**——
它们只是往循环旁边挂插件、挂事件、挂 seam。这正是 dsh 和"不断改 while 循环"的
教学项目最大的区别。

## 4. 心智模型

不要把 agent 理解成固定走完的五个步骤。它更像一个**围绕消息历史反复决策的循环**：

<!-- dsh:flow id=agent-conversation title="Agent Loop：围绕 messages 反复决策" variant=agent-loop -->
| ID | 节点 | 说明 | 下一步 |
|---|---|---|---|
| input | 接住请求 | 用用户输入创建最初的 `messages`。 | model |
| model | 询问模型 | 模型读取完整 `messages`，给出本轮 AssistantTurn。 | decide |
| decide | 要调用工具吗？ | 每一轮都在这里分岔，而不是固定执行工具。 | tool[是], done[否] |
| tool | 执行工具 | 按 tool call 执行真实动作并取得结果。 | observe |
| observe | 写回观察 | 把 assistant turn 和工具结果追加进 `messages`。 | model[带着新历史继续] |
| done | 最终答复 | 模型不再请求工具时，返回文本并退出循环。 | - |
<!-- /dsh:flow -->

### 执行透视：真正驱动循环的是状态变化

点击“下一步”，不要只看输出；同时观察当前代码位置、`messages` 内容和循环判定。

<!-- dsh:trace id=l01-runtime-xray title="一条请求怎样跑过两次模型调用" -->
| 步骤 | 执行位置 | 发生什么 | 事件日志 | 模型视图 | 继续条件 |
|---|---|---|---|---|---|
| 接住请求 | `agent_loop(): messages = [...]` | 用户输入成为初始历史。 | 本课还没有 SessionEvent；`messages` 自己就是状态。 | `[user: 看看当前环境]` | 至少要请求模型一次。 |
| 第一次决策 | `llm.complete(messages)` | 模型读取 1 条消息，返回文本和 shell tool call。 | 仍未记录；返回值暂存在 `turn`。 | `[user]` | `turn.wants_tools == True`，不能结束。 |
| 记录意图 | `messages.append(assistant)` | 先把模型为什么调用工具写入历史。 | 无独立日志。 | `[user, assistant+tool_call(c1)]` | 工具调用尚未执行。 |
| 执行工具 | `call_tool()` | 宿主执行 shell，得到真实结果。 | 无独立日志。 | `[user, assistant+tool_call(c1)]` | 结果还没进入模型视野。 |
| 写回观察 | `messages.append(tool)` | 工具结果按 `tool_call_id=c1` 追加进历史。 | 无独立日志。 | `[user, assistant+tool_call(c1), tool(c1)]` | 结果已写回，但模型还没读过它，所以进入下一轮。 |
| 第二次决策 | `llm.complete(messages)` | 模型读到工具结果，返回最终总结。 | 无独立日志。 | `[user, assistant+tool_call(c1), tool(c1)]` | `turn.wants_tools == False`，返回文本并退出。 |
<!-- /dsh:trace -->

这里最容易漏掉的底层因果是：**工具执行完不等于 agent 完成。工具结果只是新的输入，
必须再调用一次模型，模型才能基于观察作出下一次决策。**

图里真正转动循环的不是箭头，而是 `messages`：模型每轮都读它，工具执行后又把新观察写回它。

## 5. 方案与图

<!-- dsh:flow id=agent-loop-flow title="最小 Agent Loop" -->
| ID | 节点 | 说明 | 下一步 |
|---|---|---|---|
| input | 用户输入 | 用 user message 初始化 `messages` | model |
| model | 请求模型 | 调用 `llm.complete(messages)` | tools[需要工具], done[无需工具] |
| tools | 执行工具 | 执行每个 tool call，并把结果追加进 `messages` | model[继续循环] |
| done | 最终答复 | 返回 `turn.text`，循环结束 | - |
<!-- /dsh:flow -->

## 6. 代码拆解

核心就是 `agent_loop()` 这 15 行：

- `messages` 初始只有一条 user 消息。
- 每轮调 `llm.complete(messages)` 拿到一个 `AssistantTurn`。
- 若 `turn.wants_tools` 为假 → 返回文本，循环结束。
- 否则：把 assistant 消息追加进历史，逐个执行工具，把每个 `tool_result` 也追加进历史，再循环。
- `call_tool()` 是一个**硬编码的 if 分支**——目前只认 `shell` 一个工具。

`ReplayLLM` 用一段脚本模拟模型：step1 决定调 shell，step2 看到结果后收尾。
真实模型与 Replay **共用同一个 seam 接口**（说同一套消息词汇）；但要接真实模型需显式
设 `DSH_LIVE=1`（+ `DEEPSEEK_API_KEY`），且真实路径仅演示纯文本对话——工具调用用的是
教学格式、也没把 shell schema 传给模型，所以不保证复现这里的工具流程。想完整跑通
工具型 agent，用默认的 Replay。

### 动手破坏一次

临时注释掉追加 `tool` 消息的那一行，再运行。第二次模型调用将拿不到工具观察；这能验证
本课的不变量：**影响下一次决策的观察，必须先进入模型历史。** 改完后请恢复该行。

## 7. 代码解读：沿真实执行路径读懂 Agent Loop

前面的“代码拆解”告诉你有哪些零件；这一节换一种读法：**从程序入口出发，跟着一次请求
实际经过的路径走**。右侧代码由网站构建器直接从本课 `main.py` 的对应行提取，不是复制品。

<!-- dsh:code-walkthrough id=l01-code-reading title="从宿主工具到第二次模型决策" source=main.py -->
| 阶段 | 行号 | 读代码 | 设计原因 |
|---|---|---|---|
| 先划清模型与宿主的边界 | 31-34 | `call_tool` 接收的只是模型生成的工具名和参数；真正的 Python 函数由宿主按名称选择并执行。模型没有获得 `run_shell` 函数对象，也不能直接执行代码。 | Agent 的能力来自宿主授权，而不是模型自身。这里虽然只是硬编码 `if`，却已经形成“模型提议、宿主执行”的安全边界；L10 会把这条边界升级为注册表。 |
| 创建本轮唯一状态 | 40-47 | `messages` 先放入 user 消息，然后循环把完整历史交给 `llm.complete`。注意模型每次调用都是无状态的：它只知道这次参数里出现的内容。 | 循环本身没有智能；连续性全部来自宿主反复携带 `messages`。漏传或漏记任何观察，下一次模型调用就等于失忆。 |
| 用返回值决定退出还是行动 | 49-54 | 文本只负责展示；真正控制循环的是 `turn.wants_tools`。没有工具调用就立刻 `return`，有调用才进入执行分支。 | 不能用“有没有文本”判断结束，因为模型可以一边解释一边调用工具。终止条件必须来自结构化的 tool call 状态。 |
| 先记录意图，再执行动作 | 56-62 | assistant 消息连同 `tool_calls` 先进入历史，随后才逐个调用 `call_tool`。这保留了“哪个模型决定导致了哪个外部动作”。 | 如果只记录工具结果、不记录调用意图，下一轮模型无法把结果与原调用配对，审计时也解释不了动作来源。 |
| 把工具结果变成下一轮输入 | 63-66 | 结果用相同 `tool_call_id` 追加为 tool 消息。循环回到顶部后，第二次 `llm.complete(messages)` 才第一次看到这个观察。`max_steps` 则防止模型无限调用工具。 | 工具成功不代表任务完成；结果只是新的证据。必须让模型再决策一次，才能继续行动或形成最终答复。上限是宿主对失控循环的最后保护。 |
| Replay 如何证明历史真的被读取 | 73-84 | `step1` 无条件发起调用；`step2` 从 `messages[-1]` 读取工具结果再生成总结。脚本列表让两次 `complete` 返回不同决策。 | Replay 不是另一套 Agent 逻辑，它只是可预测的模型替身。正因为它从同一个 `messages` 接口取数据，测试才能验证循环的因果链，而无需联网。 |
| 最后才做依赖组装 | 87-91 | 入口先创建 LLM provider，再把它和用户输入交给 `agent_loop`。循环只依赖传入对象具有 `complete(messages)`，并不负责创建模型。 | 创建依赖与消费依赖分开，是后面 seam/provider 插件化的胚胎；替换 Replay 或真实模型时，循环主体不必重写。 |
<!-- /dsh:code-walkthrough -->

把七段连起来，真正的控制流只有一句话：**宿主把历史交给模型，模型提出下一步，宿主执行并
把观察写回历史，再由下一次模型调用决定是否结束。** 这就是后面所有插件、事件和 seam
最终都要服务的那条主干。

## 8. 相对上一课新增了什么

这是第一课，一切都是新的。建立了三样最小的东西：**循环、模型调用、一个工具**。

## 9. 简化了什么 vs 真实 DeepSeek Harness

| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |
|---|---|---|
| 裸 `while` 循环，写死在一个函数里 | agent loop 本身是插件 `core/agent-loop`，实现 `ctx.agentLoop` 接口 | 循环可被替换（比如 Ralph 迭代、goal 续跑用不同 driver） |
| `messages` 列表就是状态 | 唯一真源是**仅追加的 SessionEvent 日志**，`messages` 由 `deriveMessages()` 投影 | 回放、fork、持久化、遥测全都从日志派生（见 L04/L05） |
| `call_tool` 是 if 分支 | 工具是注册进 `ctx.tools` 的 `ToolDefinition`，经 pre/execute/post 管线分派 | 权限、超时、沙箱、并发都挂在管线上（见 L10/L11） |
| 直接 `llm.complete(messages)` | 模型是 `ctx.llm` seam 背后的 provider | 可换 DeepSeek / Pi-AI / Replay，测试与生产同一接口（见 L08） |
| `shell` 直接 subprocess | shell 是 `ctx.shell` seam，本地/沙箱是不同 provider | 换 provider 就能把命令送去远程沙箱（见 L12） |

> **一句话**：这一课的每一个"简化点"，都对应后面某一课要展开的一层。
> 记住这个循环的样子——它是你理解整套 dsh 的锚点。

### 教学类名 → 真实 dsh 映射

| 本课 | 真实 dsh |
|---|---|
| `agent_loop()` | `ctx.agentLoop`（`core/agent-loop`） |
| `messages` | `Session` 事件日志 + `deriveMessages()`（`core/session`） |
| `llm.complete()` | `ctx.llm.stream()`（`llm/llm` seam） |
| `call_tool()` | `ctx.tools` 注册表 + 执行管线（`core/tools`） |
| `run_shell()` | `ctx.shell` provider（`packages/shell`） |

---
[返回总览](../../README.md) · [下一课 L02 →](../L02_cordis_plugins/README.zh.md)
