# L01 最小 Agent Loop

> **Motto：一个循环 + 一次模型调用 + 一个工具，就是 agent 的胚胎。**

## 1. 30 秒运行

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

把 agent 想成一个**反复问答的对话**：

<!-- dsh:stepper id=agent-conversation title="一个请求怎样跑完整条链路" loop-from=4 loop-to=2 loop-label="观察写回后，进入下一轮" -->
1. **接住请求** — 用户提出“看看当前环境，然后告诉我结果”。
2. **询问模型** — 把当前消息历史交给模型，模型决定调用 `shell`。
3. **执行工具** — 执行 shell 命令并取得真实输出。
4. **写回观察** — 把工具结果追加进消息历史，让模型能看到刚才发生了什么。
5. **再次判断** — 再问模型；如果还需要工具就继续循环，否则形成最终答复。
<!-- /dsh:stepper -->

`messages` 列表是这一课**唯一的状态**。模型每次都读它、我们每次都往里追加。

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

## 7. 相对上一课新增了什么

这是第一课，一切都是新的。建立了三样最小的东西：**循环、模型调用、一个工具**。

## 8. 简化了什么 vs 真实 DeepSeek Harness

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
