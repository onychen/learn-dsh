// 由 build_site.py 自动生成，请勿手工编辑
window.DSH_DATA = {
 "title": "learn-dsh",
 "subtitle": "拆解 DeepSeek Harness：22 课 + 1 附录",
 "tagline": "先立 Cordis 插件 / 事件 / seam 骨架，再逐层把能力挂上去",
 "layers": [
  {
   "id": "kernel",
   "name": "内核骨架",
   "color": "blue",
   "desc": "Cordis 插件 / 事件 / 可逆注册"
  },
  {
   "id": "session",
   "name": "会话即真源",
   "color": "emerald",
   "desc": "仅追加事件日志与投影"
  },
  {
   "id": "turn",
   "name": "轮次与模型边界",
   "color": "purple",
   "desc": "turn/step 生命周期与 llm seam"
  },
  {
   "id": "tools",
   "name": "作用域与工具",
   "color": "amber",
   "desc": "scope / 注册表 / 管线 / seam"
  },
  {
   "id": "context",
   "name": "上下文可持续",
   "color": "rose",
   "desc": "skills 与 compaction"
  },
  {
   "id": "concurrency",
   "name": "委派与并发",
   "color": "cyan",
   "desc": "subagent / jobs / goal"
  },
  {
   "id": "product",
   "name": "组装成产品",
   "color": "red",
   "desc": "profile / capstone / trace"
  }
 ],
 "lessons": [
  {
   "id": "L01",
   "dir": "L01_agent_loop",
   "num": "01",
   "title": "最小 Agent Loop",
   "fullTitle": "L01 最小 Agent Loop",
   "subtitle": "最小 while 循环 + 一个工具",
   "motto": "一个循环 + 一次模型调用 + 一个工具，就是 agent 的胚胎。",
   "layer": "kernel",
   "loc": 91,
   "hasCode": true,
   "sections": [
    {
     "name": "1. 30 秒运行",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "先别急着运行。先猜两个问题：**shell 执行完后，循环为什么不能直接结束？第二次调用模型时，\n模型凭什么知道 shell 的结果？** 把答案写下来，再和下面的执行透视对照。\n\n```powershell\npython lessons/L01_agent_loop/main.py\n```\n\n预期输出（Windows / PowerShell）：\n\n```text\n--- step 1 ---\n[assistant] 我先看看当前目录里有什么。\n[tool_call] shell({'command': 'echo hello from dsh lesson 01'})\n[tool_result] hello\nfrom\ndsh\nlesson\n01\n\n--- step 2 ---\n[assistant] 命令执行完毕，输出是：'hello\\nfrom\\ndsh\\nlesson\\n01'。任务完成。\n\n==============================\n[最终答复] 命令执行完毕，输出是：'hello\\nfrom\\ndsh\\nlesson\\n01'。任务完成。\n```"
      }
     ]
    },
    {
     "name": "2. 观察输出",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "你看到了一个 agent 的完整生命周期：它先**思考**（决定调工具）、**行动**（执行 shell）、\n**观察**（看到工具结果）、再**总结**（给出最终答复）。整个过程跑了两个 step 就停了——\n因为第二次模型不再想调工具。\n\n（顺带：`echo` 的输出被拆成多行，是因为 Windows 上我们走的是 PowerShell。\n这不是 bug，而是\"shell 是平台相关的\"的第一个信号——记住它，L12 会把它变成一个 seam。）"
      }
     ]
    },
    {
     "name": "3. 为什么需要这一层",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "没有循环，模型只能\"说一句话\"就结束。但真实任务需要\"做一步、看结果、再做下一步\"。\n**agent 的本质就是：把模型放进一个循环里，让它能反复调用工具直到任务完成。**\n\n这一层是所有 agent 的地基。你会发现后面 21 课**从不修改这个循环的本质**——\n它们只是往循环旁边挂插件、挂事件、挂 seam。这正是 dsh 和\"不断改 while 循环\"的\n教学项目最大的区别。"
      }
     ]
    },
    {
     "name": "4. 心智模型",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "不要把 agent 理解成固定走完的五个步骤。它更像一个**围绕消息历史反复决策的循环**："
      },
      {
       "type": "flow",
       "id": "agent-conversation",
       "title": "Agent Loop：围绕 messages 反复决策",
       "nodes": [
        {
         "id": "input",
         "title": "接住请求",
         "detail": "用用户输入创建最初的 `messages`。",
         "edges": [
          {
           "target": "model",
           "label": ""
          }
         ]
        },
        {
         "id": "model",
         "title": "询问模型",
         "detail": "模型读取完整 `messages`，给出本轮 AssistantTurn。",
         "edges": [
          {
           "target": "decide",
           "label": ""
          }
         ]
        },
        {
         "id": "decide",
         "title": "要调用工具吗？",
         "detail": "每一轮都在这里分岔，而不是固定执行工具。",
         "edges": [
          {
           "target": "tool",
           "label": "是"
          },
          {
           "target": "done",
           "label": "否"
          }
         ]
        },
        {
         "id": "tool",
         "title": "执行工具",
         "detail": "按 tool call 执行真实动作并取得结果。",
         "edges": [
          {
           "target": "observe",
           "label": ""
          }
         ]
        },
        {
         "id": "observe",
         "title": "写回观察",
         "detail": "把 assistant turn 和工具结果追加进 `messages`。",
         "edges": [
          {
           "target": "model",
           "label": "带着新历史继续"
          }
         ]
        },
        {
         "id": "done",
         "title": "最终答复",
         "detail": "模型不再请求工具时，返回文本并退出循环。",
         "edges": []
        }
       ],
       "variant": "agent-loop"
      },
      {
       "type": "markdown",
       "markdown": "### 执行透视：真正驱动循环的是状态变化\n\n点击“下一步”，不要只看输出；同时观察当前代码位置、`messages` 内容和循环判定。"
      },
      {
       "type": "trace",
       "id": "l01-runtime-xray",
       "title": "一条请求怎样跑过两次模型调用",
       "panels": [
        "事件日志",
        "模型视图",
        "继续条件"
       ],
       "steps": [
        {
         "title": "接住请求",
         "location": "`agent_loop(): messages = [...]`",
         "action": "用户输入成为初始历史。",
         "states": [
          "本课还没有 SessionEvent；`messages` 自己就是状态。",
          "`[user: 看看当前环境]`",
          "至少要请求模型一次。"
         ]
        },
        {
         "title": "第一次决策",
         "location": "`llm.complete(messages)`",
         "action": "模型读取 1 条消息，返回文本和 shell tool call。",
         "states": [
          "仍未记录；返回值暂存在 `turn`。",
          "`[user]`",
          "`turn.wants_tools == True`，不能结束。"
         ]
        },
        {
         "title": "记录意图",
         "location": "`messages.append(assistant)`",
         "action": "先把模型为什么调用工具写入历史。",
         "states": [
          "无独立日志。",
          "`[user, assistant+tool_call(c1)]`",
          "工具调用尚未执行。"
         ]
        },
        {
         "title": "执行工具",
         "location": "`call_tool()`",
         "action": "宿主执行 shell，得到真实结果。",
         "states": [
          "无独立日志。",
          "`[user, assistant+tool_call(c1)]`",
          "结果还没进入模型视野。"
         ]
        },
        {
         "title": "写回观察",
         "location": "`messages.append(tool)`",
         "action": "工具结果按 `tool_call_id=c1` 追加进历史。",
         "states": [
          "无独立日志。",
          "`[user, assistant+tool_call(c1), tool(c1)]`",
          "结果已写回，但模型还没读过它，所以进入下一轮。"
         ]
        },
        {
         "title": "第二次决策",
         "location": "`llm.complete(messages)`",
         "action": "模型读到工具结果，返回最终总结。",
         "states": [
          "无独立日志。",
          "`[user, assistant+tool_call(c1), tool(c1)]`",
          "`turn.wants_tools == False`，返回文本并退出。"
         ]
        }
       ]
      },
      {
       "type": "markdown",
       "markdown": "这里最容易漏掉的底层因果是：**工具执行完不等于 agent 完成。工具结果只是新的输入，\n必须再调用一次模型，模型才能基于观察作出下一次决策。**\n\n图里真正转动循环的不是箭头，而是 `messages`：模型每轮都读它，工具执行后又把新观察写回它。"
      }
     ]
    },
    {
     "name": "5. 方案与图",
     "blocks": [
      {
       "type": "flow",
       "id": "agent-loop-flow",
       "title": "最小 Agent Loop",
       "nodes": [
        {
         "id": "input",
         "title": "用户输入",
         "detail": "用 user message 初始化 `messages`",
         "edges": [
          {
           "target": "model",
           "label": ""
          }
         ]
        },
        {
         "id": "model",
         "title": "请求模型",
         "detail": "调用 `llm.complete(messages)`",
         "edges": [
          {
           "target": "tools",
           "label": "需要工具"
          },
          {
           "target": "done",
           "label": "无需工具"
          }
         ]
        },
        {
         "id": "tools",
         "title": "执行工具",
         "detail": "执行每个 tool call，并把结果追加进 `messages`",
         "edges": [
          {
           "target": "model",
           "label": "继续循环"
          }
         ]
        },
        {
         "id": "done",
         "title": "最终答复",
         "detail": "返回 `turn.text`，循环结束",
         "edges": []
        }
       ]
      }
     ]
    },
    {
     "name": "6. 代码拆解",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "核心就是 `agent_loop()` 这 15 行：\n\n- `messages` 初始只有一条 user 消息。\n- 每轮调 `llm.complete(messages)` 拿到一个 `AssistantTurn`。\n- 若 `turn.wants_tools` 为假 → 返回文本，循环结束。\n- 否则：把 assistant 消息追加进历史，逐个执行工具，把每个 `tool_result` 也追加进历史，再循环。\n- `call_tool()` 是一个**硬编码的 if 分支**——目前只认 `shell` 一个工具。\n\n`ReplayLLM` 用一段脚本模拟模型：step1 决定调 shell，step2 看到结果后收尾。\n真实模型与 Replay **共用同一个 seam 接口**（说同一套消息词汇）；但要接真实模型需显式\n设 `DSH_LIVE=1`（+ `DEEPSEEK_API_KEY`），且真实路径仅演示纯文本对话——工具调用用的是\n教学格式、也没把 shell schema 传给模型，所以不保证复现这里的工具流程。想完整跑通\n工具型 agent，用默认的 Replay。\n\n### 动手破坏一次\n\n临时注释掉追加 `tool` 消息的那一行，再运行。第二次模型调用将拿不到工具观察；这能验证\n本课的不变量：**影响下一次决策的观察，必须先进入模型历史。** 改完后请恢复该行。"
      }
     ]
    },
    {
     "name": "7. 代码解读：沿真实执行路径读懂 Agent Loop",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "前面的“代码拆解”告诉你有哪些零件；这一节换一种读法：**从程序入口出发，跟着一次请求\n实际经过的路径走**。右侧代码由网站构建器直接从本课 `main.py` 的对应行提取，不是复制品。"
      },
      {
       "type": "code-walkthrough",
       "id": "l01-code-reading",
       "title": "从宿主工具到第二次模型决策",
       "source": "main.py",
       "language": "python",
       "segments": [
        {
         "title": "先划清模型与宿主的边界",
         "start": 31,
         "end": 34,
         "reading": "`call_tool` 接收的只是模型生成的工具名和参数；真正的 Python 函数由宿主按名称选择并执行。模型没有获得 `run_shell` 函数对象，也不能直接执行代码。",
         "reason": "Agent 的能力来自宿主授权，而不是模型自身。这里虽然只是硬编码 `if`，却已经形成“模型提议、宿主执行”的安全边界；L10 会把这条边界升级为注册表。",
         "code": "def call_tool(name: str, arguments: dict) -> str:\n    if name == \"shell\":\n        return run_shell(arguments.get(\"command\", \"\"))\n    return f\"[未知工具] {name}\""
        },
        {
         "title": "创建本轮唯一状态",
         "start": 40,
         "end": 47,
         "reading": "`messages` 先放入 user 消息，然后循环把完整历史交给 `llm.complete`。注意模型每次调用都是无状态的：它只知道这次参数里出现的内容。",
         "reason": "循环本身没有智能；连续性全部来自宿主反复携带 `messages`。漏传或漏记任何观察，下一次模型调用就等于失忆。",
         "code": "def agent_loop(llm, user_input: str, max_steps: int = 8) -> str:\n    # messages 就是\"喂给模型的历史\"。这一课我们直接把它当唯一状态。\n    # （L04 会揭示：真实 dsh 不存 messages，只存事件，messages 是投影出来的。）\n    messages: list[dict] = [{\"role\": \"user\", \"content\": user_input}]\n\n    for step in range(max_steps):\n        print(f\"\\n--- step {step + 1} ---\")\n        turn: AssistantTurn = llm.complete(messages)"
        },
        {
         "title": "用返回值决定退出还是行动",
         "start": 49,
         "end": 54,
         "reading": "文本只负责展示；真正控制循环的是 `turn.wants_tools`。没有工具调用就立刻 `return`，有调用才进入执行分支。",
         "reason": "不能用“有没有文本”判断结束，因为模型可以一边解释一边调用工具。终止条件必须来自结构化的 tool call 状态。",
         "code": "        if turn.text:\n            print(f\"[assistant] {turn.text}\")\n\n        # 模型不想调工具了 -> 循环结束，这段文本就是最终答复。\n        if not turn.wants_tools:\n            return turn.text"
        },
        {
         "title": "先记录意图，再执行动作",
         "start": 56,
         "end": 62,
         "reading": "assistant 消息连同 `tool_calls` 先进入历史，随后才逐个调用 `call_tool`。这保留了“哪个模型决定导致了哪个外部动作”。",
         "reason": "如果只记录工具结果、不记录调用意图，下一轮模型无法把结果与原调用配对，审计时也解释不了动作来源。",
         "code": "        # 模型想调工具：把这次 assistant 消息记下，然后逐个执行工具。\n        messages.append(\n            {\"role\": \"assistant\", \"content\": turn.text, \"tool_calls\": [tc.__dict__ for tc in turn.tool_calls]}\n        )\n        for tc in turn.tool_calls:\n            print(f\"[tool_call] {tc.name}({tc.arguments})\")\n            result = call_tool(tc.name, tc.arguments)"
        },
        {
         "title": "把工具结果变成下一轮输入",
         "start": 63,
         "end": 66,
         "reading": "结果用相同 `tool_call_id` 追加为 tool 消息。循环回到顶部后，第二次 `llm.complete(messages)` 才第一次看到这个观察。`max_steps` 则防止模型无限调用工具。",
         "reason": "工具成功不代表任务完成；结果只是新的证据。必须让模型再决策一次，才能继续行动或形成最终答复。上限是宿主对失控循环的最后保护。",
         "code": "            print(f\"[tool_result] {result}\")\n            messages.append({\"role\": \"tool\", \"tool_call_id\": tc.id, \"content\": result})\n\n    return \"[达到最大步数，停止]\""
        },
        {
         "title": "Replay 如何证明历史真的被读取",
         "start": 73,
         "end": 84,
         "reading": "`step1` 无条件发起调用；`step2` 从 `messages[-1]` 读取工具结果再生成总结。脚本列表让两次 `complete` 返回不同决策。",
         "reason": "Replay 不是另一套 Agent 逻辑，它只是可预测的模型替身。正因为它从同一个 `messages` 接口取数据，测试才能验证循环的因果链，而无需联网。",
         "code": "def build_script():\n    def step1(_messages):\n        return AssistantTurn(\n            text=\"我先看看当前目录里有什么。\",\n            tool_calls=[ToolCall(id=\"c1\", name=\"shell\", arguments={\"command\": \"echo hello from dsh lesson 01\"})],\n        )\n\n    def step2(messages):\n        last_result = messages[-1][\"content\"]\n        return AssistantTurn(text=f\"命令执行完毕，输出是：{last_result!r}。任务完成。\")\n\n    return [step1, step2]"
        },
        {
         "title": "最后才做依赖组装",
         "start": 87,
         "end": 91,
         "reading": "入口先创建 LLM provider，再把它和用户输入交给 `agent_loop`。循环只依赖传入对象具有 `complete(messages)`，并不负责创建模型。",
         "reason": "创建依赖与消费依赖分开，是后面 seam/provider 插件化的胚胎；替换 Replay 或真实模型时，循环主体不必重写。",
         "code": "if __name__ == \"__main__\":\n    llm = make_llm(script=build_script())\n    final = agent_loop(llm, user_input=\"看看当前环境，然后告诉我结果\")\n    print(\"\\n==============================\")\n    print(f\"[最终答复] {final}\")"
        }
       ]
      },
      {
       "type": "markdown",
       "markdown": "把七段连起来，真正的控制流只有一句话：**宿主把历史交给模型，模型提出下一步，宿主执行并\n把观察写回历史，再由下一次模型调用决定是否结束。** 这就是后面所有插件、事件和 seam\n最终都要服务的那条主干。"
      }
     ]
    },
    {
     "name": "8. 相对上一课新增了什么",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "这是第一课，一切都是新的。建立了三样最小的东西：**循环、模型调用、一个工具**。"
      }
     ]
    },
    {
     "name": "9. 简化了什么 vs 真实 DeepSeek Harness",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| 裸 `while` 循环，写死在一个函数里 | agent loop 本身是插件 `core/agent-loop`，实现 `ctx.agentLoop` 接口 | 循环可被替换（比如 Ralph 迭代、goal 续跑用不同 driver） |\n| `messages` 列表就是状态 | 唯一真源是**仅追加的 SessionEvent 日志**，`messages` 由 `deriveMessages()` 投影 | 回放、fork、持久化、遥测全都从日志派生（见 L04/L05） |\n| `call_tool` 是 if 分支 | 工具是注册进 `ctx.tools` 的 `ToolDefinition`，经 pre/execute/post 管线分派 | 权限、超时、沙箱、并发都挂在管线上（见 L10/L11） |\n| 直接 `llm.complete(messages)` | 模型是 `ctx.llm` seam 背后的 provider | 可换 DeepSeek / Pi-AI / Replay，测试与生产同一接口（见 L08） |\n| `shell` 直接 subprocess | shell 是 `ctx.shell` seam，本地/沙箱是不同 provider | 换 provider 就能把命令送去远程沙箱（见 L12） |\n\n> **一句话**：这一课的每一个\"简化点\"，都对应后面某一课要展开的一层。\n> 记住这个循环的样子——它是你理解整套 dsh 的锚点。\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `agent_loop()` | `ctx.agentLoop`（`core/agent-loop`） |\n| `messages` | `Session` 事件日志 + `deriveMessages()`（`core/session`） |\n| `llm.complete()` | `ctx.llm.stream()`（`llm/llm` seam） |\n| `call_tool()` | `ctx.tools` 注册表 + 执行管线（`core/tools`） |\n| `run_shell()` | `ctx.shell` provider（`packages/shell`） |\n\n---\n[返回总览](../../README.md) · [下一课 L02 →](../L02_cordis_plugins/README.zh.md)"
      }
     ]
    }
   ],
   "code": "\"\"\"L01 最小 Agent Loop\n====================\nMotto：一个循环 + 一次模型调用 + 一个工具，就是 agent 的胚胎。\n\n这一课不引入 Cordis、不引入 llm seam、不引入事件日志。就一个裸 while 循环：\n    while 模型还想调用工具:\n        调模型 -> 拿到它想调的工具 -> 执行工具 -> 把结果塞回历史 -> 再问模型\n\n这就是所有 agent 的最小内核。后面 21 课都是往这个骨架旁边\"挂东西\"，\n而不是改这个循环本身。\n\n运行：  python lessons/L01_agent_loop/main.py\n\"\"\"\n\nfrom __future__ import annotations\n\nimport os\nimport sys\n\n# 让本文件能独立运行：把 learn-dsh 根目录加进 import 路径\nsys.path.insert(0, os.path.join(os.path.dirname(__file__), \"..\", \"..\"))\n\nfrom shared.llm import AssistantTurn, ToolCall, make_llm  # noqa: E402\nfrom shared.shell import run_shell  # noqa: E402\n\n\n# --------------------------------------------------------------------------\n# 这一课只有一个工具：shell。它就是一个普通 Python 函数。\n# 注意：这里工具是\"硬编码\"进循环的——L10 才会把它变成注册表里的一条定义。\n# --------------------------------------------------------------------------\ndef call_tool(name: str, arguments: dict) -> str:\n    if name == \"shell\":\n        return run_shell(arguments.get(\"command\", \"\"))\n    return f\"[未知工具] {name}\"\n\n\n# --------------------------------------------------------------------------\n# 这就是 agent loop 的全部。约 15 行。\n# --------------------------------------------------------------------------\ndef agent_loop(llm, user_input: str, max_steps: int = 8) -> str:\n    # messages 就是\"喂给模型的历史\"。这一课我们直接把它当唯一状态。\n    # （L04 会揭示：真实 dsh 不存 messages，只存事件，messages 是投影出来的。）\n    messages: list[dict] = [{\"role\": \"user\", \"content\": user_input}]\n\n    for step in range(max_steps):\n        print(f\"\\n--- step {step + 1} ---\")\n        turn: AssistantTurn = llm.complete(messages)\n\n        if turn.text:\n            print(f\"[assistant] {turn.text}\")\n\n        # 模型不想调工具了 -> 循环结束，这段文本就是最终答复。\n        if not turn.wants_tools:\n            return turn.text\n\n        # 模型想调工具：把这次 assistant 消息记下，然后逐个执行工具。\n        messages.append(\n            {\"role\": \"assistant\", \"content\": turn.text, \"tool_calls\": [tc.__dict__ for tc in turn.tool_calls]}\n        )\n        for tc in turn.tool_calls:\n            print(f\"[tool_call] {tc.name}({tc.arguments})\")\n            result = call_tool(tc.name, tc.arguments)\n            print(f\"[tool_result] {result}\")\n            messages.append({\"role\": \"tool\", \"tool_call_id\": tc.id, \"content\": result})\n\n    return \"[达到最大步数，停止]\"\n\n\n# --------------------------------------------------------------------------\n# 用 Replay 脚本演示一个真实场景：让 agent 报告当前目录里有什么。\n# 脚本第一步：模型决定调 shell；第二步：看到结果后给出总结。\n# --------------------------------------------------------------------------\ndef build_script():\n    def step1(_messages):\n        return AssistantTurn(\n            text=\"我先看看当前目录里有什么。\",\n            tool_calls=[ToolCall(id=\"c1\", name=\"shell\", arguments={\"command\": \"echo hello from dsh lesson 01\"})],\n        )\n\n    def step2(messages):\n        last_result = messages[-1][\"content\"]\n        return AssistantTurn(text=f\"命令执行完毕，输出是：{last_result!r}。任务完成。\")\n\n    return [step1, step2]\n\n\nif __name__ == \"__main__\":\n    llm = make_llm(script=build_script())\n    final = agent_loop(llm, user_input=\"看看当前环境，然后告诉我结果\")\n    print(\"\\n==============================\")\n    print(f\"[最终答复] {final}\")\n",
   "locPct": 42
  },
  {
   "id": "L02",
   "dir": "L02_cordis_plugins",
   "num": "02",
   "title": "Cordis：一切皆插件 + 可逆注册",
   "fullTitle": "L02 Cordis：一切皆插件 + 可逆注册",
   "subtitle": "ctx 服务与可逆 effect",
   "motto": "不改核心，只在旁边挂插件；每个注册都能被回退。",
   "layer": "kernel",
   "loc": 181,
   "hasCode": true,
   "sections": [
    {
     "name": "1. 30 秒运行",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "运行前先猜：如果先挂载 `tools`、后挂载它依赖的 `shell`，系统应该默默等待、运行时报错，\n还是在启动阶段立即拒绝？再想一想：为什么卸载顺序必须与注册顺序相反？\n\n```powershell\npython lessons/L02_cordis_plugins/main.py\n```\n\n预期输出（节选）：\n\n```text\n[boot] 挂载插件 llm\n  [ctx] 提供服务 ctx.llm\n[boot] 挂载插件 shell\n  [ctx] 提供服务 ctx.shell\n[boot] 挂载插件 tools\n  [ctx] 提供服务 ctx.tools\n  [tools] 注册工具 shell\n[boot] 挂载插件 agent-loop\n  [ctx] 提供服务 ctx.agent_loop\n\n[boot] 插件树就绪，运行 agent\n...\n[boot] 卸载所有插件（逆序）\n  [ctx] 卸载服务 ctx.agent_loop\n  [tools] 注销工具 shell\n  [ctx] 卸载服务 ctx.tools\n  [ctx] 卸载服务 ctx.shell\n  [ctx] 卸载服务 ctx.llm\n```"
      }
     ]
    },
    {
     "name": "2. 观察输出",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "agent 干的活和 L01 一模一样。但**启动方式变了**：不再是调一个函数，\n而是往 `ctx` 上依次挂 4 个插件，每个插件认领一个服务。结尾还演示了\n**逆序卸载**——每个注册都被干净回退了。"
      }
     ]
    },
    {
     "name": "3. 为什么需要这一层",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "L01 的循环把 llm、tools、shell 全焊死在一起。想换模型？改函数。想加权限？改函数。\n**一切改动都得动核心。**\n\ndsh 的答案是：**没有核心可动。** 每一块都是插件，向共享 `ctx` 贡献服务；\n要扩展，就在旁边挂一个新插件。而且每个注册都是**可逆副作用**——\n插件卸载时，它装的东西（服务、工具、监听器）都能预测地回退。"
      }
     ]
    },
    {
     "name": "4. 心智模型",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "把 `ctx` 想成一块**公告板 + 一个仓库**："
      },
      {
       "type": "structure",
       "id": "ctx-service-structure",
       "title": "插件通过 ctx 共享服务",
       "nodes": [
        {
         "title": "ctx（服务仓库）",
         "detail": "按稳定的 key 保存已经就绪的能力。",
         "children": [
          {
           "title": "ctx.llm",
           "detail": "由 llm 插件提供。",
           "children": []
          },
          {
           "title": "ctx.shell",
           "detail": "由 shell 插件提供。",
           "children": []
          },
          {
           "title": "ctx.tools",
           "detail": "tools 插件注入 shell 后提供工具注册表。",
           "children": []
          },
          {
           "title": "ctx.agent_loop",
           "detail": "agent-loop 插件注入 llm 与 tools 后提供循环。",
           "children": []
          }
         ]
        }
       ]
      },
      {
       "type": "markdown",
       "markdown": "插件不互相 import，而是**按 key 找服务**。谁依赖谁，用 `inject` 声明，\n`ctx` 保证依赖就绪后才 `apply`。"
      }
     ]
    },
    {
     "name": "5. 方案与图",
     "blocks": [
      {
       "type": "flow",
       "id": "plugin-lifecycle",
       "title": "挂载建立能力，卸载沿 effect 栈反向回退",
       "nodes": [
        {
         "id": "register",
         "title": "ctx.plugin(P)",
         "detail": "提交一个带 inject 声明和 apply 的插件。",
         "edges": [
          {
           "target": "deps",
           "label": ""
          }
         ],
         "position": {
          "column": 1,
          "row": 1
         },
         "kind": ""
        },
        {
         "id": "deps",
         "title": "检查 inject",
         "detail": "所有依赖服务就绪后才能执行插件代码。",
         "edges": [
          {
           "target": "apply",
           "label": "齐全"
          },
          {
           "target": "error",
           "label": "缺失"
          }
         ],
         "position": {
          "column": 2,
          "row": 1
         },
         "kind": "decision"
        },
        {
         "id": "apply",
         "title": "P.apply(ctx)",
         "detail": "插件开始提供服务并注册其他副作用。",
         "edges": [
          {
           "target": "effects",
           "label": ""
          }
         ],
         "position": {
          "column": 3,
          "row": 1
         },
         "kind": ""
        },
        {
         "id": "effects",
         "title": "Effect 栈",
         "detail": "每次 provide/effect 都登记对应 disposer。",
         "edges": [
          {
           "target": "running",
           "label": ""
          }
         ],
         "position": {
          "column": 4,
          "row": 1
         },
         "kind": "state"
        },
        {
         "id": "running",
         "title": "运行期",
         "detail": "能力保持可用；卸载不是挂载后的自动下一步。",
         "edges": [
          {
           "target": "unload",
           "label": "外部触发卸载"
          }
         ],
         "position": {
          "column": 5,
          "row": 1
         },
         "kind": ""
        },
        {
         "id": "unload",
         "title": "开始卸载",
         "detail": "停止插件并进入回退阶段。",
         "edges": [
          {
           "target": "dispose",
           "label": ""
          }
         ],
         "position": {
          "column": 5,
          "row": 3
         },
         "kind": "boundary"
        },
        {
         "id": "dispose",
         "title": "逆序调用 disposer",
         "detail": "后注册的副作用先撤销，依赖关系不会被提前拆掉。",
         "edges": [
          {
           "target": "clean",
           "label": ""
          }
         ],
         "position": {
          "column": 4,
          "row": 3
         },
         "kind": ""
        },
        {
         "id": "clean",
         "title": "回到挂载前状态",
         "detail": "服务和副作用都已移除。",
         "edges": [],
         "position": {
          "column": 3,
          "row": 3
         },
         "kind": "terminal"
        },
        {
         "id": "error",
         "title": "拒绝挂载",
         "detail": "依赖缺失时不运行 apply，也不留下半成品。",
         "edges": [],
         "position": {
          "column": 2,
          "row": 3
         },
         "kind": "terminal"
        }
       ],
       "variant": "map"
      },
      {
       "type": "markdown",
       "markdown": "### 执行透视：一次插件启动如何变成可回退的服务树"
      },
      {
       "type": "trace",
       "id": "l02-runtime-xray",
       "title": "从挂载 provider 到逆序卸载",
       "panels": [
        "ctx 服务表",
        "Effect / disposer 栈",
        "依赖判定"
       ],
       "steps": [
        {
         "title": "创建容器",
         "location": "`ctx = Context()`",
         "action": "初始化空服务表和 disposer 栈。",
         "states": [
          "`{}`",
          "`[]`",
          "尚无依赖可满足。"
         ]
        },
        {
         "title": "提供基础能力",
         "location": "`ctx.plugin(llm)` 与 `ctx.plugin(shell)`",
         "action": "两个 provider 分别认领稳定 key。",
         "states": [
          "`{llm, shell}`",
          "`[dispose(llm), dispose(shell)]`",
          "`tools.inject=[shell]` 已满足。"
         ]
        },
        {
         "title": "注册工具",
         "location": "`tools_plugin()`",
         "action": "提供工具表，并用 effect 注册 shell handler。",
         "states": [
          "`{llm, shell, tools}`",
          "`[…, dispose(tools), unregister(shell-tool)]`",
          "`agent-loop.inject=[llm,tools]` 已满足。"
         ]
        },
        {
         "title": "提供循环",
         "location": "`agent_loop_plugin()`",
         "action": "循环改为经 ctx 读取模型和工具。",
         "states": [
          "`{llm, shell, tools, agent_loop}`",
          "`[…, dispose(agent_loop)]`",
          "插件树就绪。"
         ]
        },
        {
         "title": "执行任务",
         "location": "`ctx.agent_loop(...)`",
         "action": "consumer 经服务 key 串起模型、工具和 shell。",
         "states": [
          "服务表不变。",
          "栈不变；运行不注册副作用。",
          "依赖只在挂载期校验一次。"
         ]
        },
        {
         "title": "逆序卸载",
         "location": "`ctx.unload_all()`",
         "action": "从最后一个 disposer 开始回退。",
         "states": [
          "`agent_loop → tools → shell → llm` 依次消失。",
          "栈从尾到头清空。",
          "consumer 总在 provider 之前移除。"
         ]
        }
       ]
      }
     ]
    },
    {
     "name": "6. 代码拆解",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "- `Context.provide(key, svc)`：认领一个 `ctx.<key>`，返回 disposer。这是\"可逆注册\"的最小形态。\n- `Context.effect(setup)`：执行 setup、登记它返回的 disposer。对应真实 `ctx.effect()`。\n- `Context.plugin(plug)`：挂载前检查 `inject` 依赖是否就绪，再 `apply`。\n- `Context.unload_all()`：**逆序**调用所有 disposer——保证 teardown 顺序正确。\n\n4 个插件把 L01 拆开：`llm_plugin`、`shell_plugin`、`tools_plugin`（`inject=[\"shell\"]`）、\n`agent_loop_plugin`（`inject=[\"llm\",\"tools\"]`）。循环逻辑没变，只是改成通过 `ctx` 找服务。\n\n### 动手破坏一次\n\n把入口处 `shell` 与 `tools` 的挂载顺序调换，观察启动阶段直接失败。再把 `unload_all()` 中的\n`reversed` 去掉，思考为什么 provider 可能先于消费者消失。这验证：**依赖先就绪，卸载按\n依赖反方向进行。**"
      }
     ]
    },
    {
     "name": "7. 代码解读：服务是怎样被注册、消费并回退的",
     "blocks": [
      {
       "type": "code-walkthrough",
       "id": "l02-code-reading",
       "title": "迷你 Cordis 的完整生命周期",
       "source": "main.py",
       "language": "python",
       "segments": [
        {
         "title": "认领服务并生成撤销动作",
         "start": 40,
         "end": 53,
         "reading": "`provide` 拒绝重名 key，再保存 service；内部 `dispose` 只删除仍指向同一对象的注册。",
         "reason": "身份检查避免旧插件卸载时误删后来替换的新 provider。注册与回退在同一处定义，副作用才不会只进不出。",
         "code": "    def provide(self, key: str, service: Any) -> Callable[[], None]:\n        \"\"\"认领一个服务 key。返回 disposer（可逆注册的最小形态）。\"\"\"\n        if key in self._services:\n            raise RuntimeError(f\"服务 {key!r} 已被占用\")\n        self._services[key] = service\n        print(f\"  [ctx] 提供服务 ctx.{key}\")\n\n        def dispose():\n            if self._services.get(key) is service:\n                del self._services[key]\n                print(f\"  [ctx] 卸载服务 ctx.{key}\")\n\n        self._disposers.append(dispose)\n        return dispose"
        },
        {
         "title": "把任意副作用纳入生命周期",
         "start": 62,
         "end": 80,
         "reading": "`effect` 保存 setup 返回的 disposer；`plugin` 校验 inject；`unload_all` 逆序回放撤销函数。",
         "reason": "服务和工具注册本质上都是副作用。统一 disposer 栈后，reload、测试隔离和异常清理才有同一语义。",
         "code": "    def effect(self, setup: Callable[[], Callable[[], None]]) -> Callable[[], None]:\n        \"\"\"执行一个 setup，登记它返回的 disposer。这是 Cordis 的 ctx.effect() 缩影。\"\"\"\n        dispose = setup()\n        self._disposers.append(dispose)\n        return dispose\n\n    # -- 挂载插件：处理 inject 依赖顺序\n    def plugin(self, plug: \"Plugin\"):\n        for dep in plug.inject:\n            if dep not in self._services:\n                raise RuntimeError(f\"插件 {plug.name!r} 依赖 ctx.{dep}，但它还没就绪\")\n        print(f\"[boot] 挂载插件 {plug.name}\")\n        plug.apply(self)\n\n    def unload_all(self):\n        \"\"\"按注册逆序卸载——这就是\"reload 和 teardown 可预测地回退\"。\"\"\"\n        print(\"\\n[boot] 卸载所有插件（逆序）\")\n        for dispose in reversed(self._disposers):\n            dispose()"
        },
        {
         "title": "工具插件通过服务组合能力",
         "start": 105,
         "end": 124,
         "reading": "工具表由本插件提供，shell handler 在执行时读取 `ctx.shell`；注册动作同时定义注销动作。",
         "reason": "consumer 依赖接口 key，而不是具体实现函数。替换 shell provider 时，工具插件无需修改。",
         "code": "def tools_plugin(ctx: Context):\n    \"\"\"贡献 ctx.tools 注册表。依赖 ctx.shell（inject 声明）。\n\n    注意 ctx.effect：注册 shell 工具是一个可逆副作用，返回 disposer。\n    卸载本插件时，这个工具会被干净移除。\n    \"\"\"\n    registry: dict[str, Callable[[dict], str]] = {}\n    ctx.provide(\"tools\", registry)\n\n    def register_shell_tool():\n        registry[\"shell\"] = lambda args: ctx.shell(args.get(\"command\", \"\"))\n        print(\"  [tools] 注册工具 shell\")\n\n        def dispose():\n            registry.pop(\"shell\", None)\n            print(\"  [tools] 注销工具 shell\")\n\n        return dispose\n\n    ctx.effect(register_shell_tool)"
        },
        {
         "title": "循环只消费抽象服务",
         "start": 127,
         "end": 151,
         "reading": "Agent Loop 从 `ctx.llm` 请求模型，从 `ctx.tools` 查 handler，自己不创建模型也不 import shell。",
         "reason": "核心循环只负责调度。能力的创建、选择和生命周期全部留在插件树，才真正做到“不改核心”。",
         "code": "def agent_loop_plugin(ctx: Context):\n    \"\"\"贡献 ctx.agent_loop。依赖 ctx.llm 和 ctx.tools。\n\n    循环逻辑和 L01 一样，但它现在通过 ctx 找服务，而不是写死。\n    \"\"\"\n\n    def run(user_input: str, max_steps: int = 8) -> str:\n        messages = [{\"role\": \"user\", \"content\": user_input}]\n        for step in range(max_steps):\n            print(f\"\\n--- step {step + 1} ---\")\n            turn: AssistantTurn = ctx.llm.complete(messages)\n            if turn.text:\n                print(f\"[assistant] {turn.text}\")\n            if not turn.wants_tools:\n                return turn.text\n            messages.append({\"role\": \"assistant\", \"content\": turn.text})\n            for tc in turn.tool_calls:\n                print(f\"[tool_call] {tc.name}({tc.arguments})\")\n                handler = ctx.tools.get(tc.name)\n                result = handler(tc.arguments) if handler else f\"[未知工具] {tc.name}\"\n                print(f\"[tool_result] {result}\")\n                messages.append({\"role\": \"tool\", \"tool_call_id\": tc.id, \"content\": result})\n        return \"[达到最大步数]\"\n\n    ctx.provide(\"agent_loop\", run)"
        },
        {
         "title": "启动顺序就是依赖拓扑",
         "start": 167,
         "end": 181,
         "reading": "入口先挂基础 provider，再挂 consumer；运行结束后统一卸载。错误顺序会被 inject 校验拒绝。",
         "reason": "把配置错误提前到启动期，比任务执行一半才报缺服务更容易定位，也不会留下半完成副作用。",
         "code": "if __name__ == \"__main__\":\n    ctx = Context()\n    # 挂载顺序体现 inject 依赖：先 llm/shell，再 tools（依赖 shell），最后 loop\n    ctx.plugin(Plugin(\"llm\", llm_plugin))\n    ctx.plugin(Plugin(\"shell\", shell_plugin))\n    ctx.plugin(Plugin(\"tools\", tools_plugin, inject=[\"shell\"]))\n    ctx.plugin(Plugin(\"agent-loop\", agent_loop_plugin, inject=[\"llm\", \"tools\"]))\n\n    print(\"\\n[boot] 插件树就绪，运行 agent\")\n    final = ctx.agent_loop(\"用 ctx 里的 shell 工具做点事\")\n    print(\"\\n==============================\")\n    print(f\"[最终答复] {final}\")\n\n    # 演示可逆：卸载所有插件，服务被逆序干净移除\n    ctx.unload_all()"
        }
       ]
      }
     ]
    },
    {
     "name": "8. 相对上一课新增了什么",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "L01 的三块（循环/工具/模型）从\"写死在一个函数\"变成了\"**四个向 ctx 贡献服务的插件**\"。\n新增了三个 Cordis 核心概念：**服务（`ctx.<key>`）、依赖声明（`inject`）、可逆注册（`effect`/disposer）**。"
      }
     ]
    },
    {
     "name": "9. 简化了什么 vs 真实 DeepSeek Harness",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| 手写 40 行 `Context` | 完整的 Cordis 框架（vendored） | 类型化服务、生命周期、reload、隔离 realm 都要框架支撑 |\n| `provide` + 属性访问 | `Service` 子类 / 带 `inject` 的函数插件，Cordis 挂载其生命周期 | 服务有 start/stop、依赖图、热重载 |\n| `inject` 只查存在性 | `inject` 驱动加载顺序，服务未就绪则插件挂起等待 | 大插件树的启动顺序由依赖表达，而非手工排序 |\n| `effect` 就是登记 disposer | `ctx.effect()` + Cordis helper，按 scope 生命周期自动回退 | 卸载/reload 要精确 unwind 大量注册 |\n| 事件？本课还没有 | 插件间还靠**类型化事件**通信（emit/waterfall/parallel/serial） | 观察、拦截、策略组合都走事件（见 L03） |\n\n> **关键澄清**（两位审查者都强调）：插件间**不是**\"只能通过事件通信\"。正确原则是——\n> **直接能力调用走 `ctx.<service>`，观察/拦截/策略组合才走事件**。本课演示的是前者（服务调用），\n> L03 演示后者（事件）。\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `Context` | Cordis `Context`（`vendor/cordis`） |\n| `ctx.provide(key, svc)` | 服务认领 `ctx.<key>` |\n| `Plugin.inject` | 插件 `inject` 字段 |\n| `ctx.effect(setup)` | `ctx.effect()` 可逆副作用 |\n| `unload_all()` 逆序回退 | 插件卸载/reload 的 disposer unwind |\n\n---\n[← 上一课 L01](../L01_agent_loop/README.zh.md) · [返回总览](../../README.md) · [下一课 L03 →](../L03_event_dispatch/README.zh.md)"
      }
     ]
    }
   ],
   "code": "\"\"\"L02 Cordis：一切皆插件 + 可逆注册\n=====================================\nMotto：不改核心，只在旁边挂插件；每个注册都能被回退。\n\nL01 里循环、工具、模型全写死在一个函数里。这一课我们把它们拆开——\n每一块都变成一个\"插件\"，向共享的 ctx 贡献服务。从此：\n  - 不再有\"要改就改核心函数\"，而是\"挂一个新插件上去\"。\n  - 每个注册都返回一个 disposer，卸载插件时能干净回退（ctx.effect）。\n  - 插件用 inject 声明依赖，ctx 保证依赖就绪后才 apply。\n\n这就是 Cordis 的五个核心思想里最关键的三个（服务、inject、可逆 effect）。\n我们手写一个约 40 行的迷你 ctx 来演示，不搬真实 Cordis。\n\n运行：  python lessons/L02_cordis_plugins/main.py\n\"\"\"\n\nfrom __future__ import annotations\n\nimport os\nimport sys\nfrom typing import Any, Callable\n\nsys.path.insert(0, os.path.join(os.path.dirname(__file__), \"..\", \"..\"))\n\nfrom shared.llm import AssistantTurn, ToolCall, make_llm  # noqa: E402\nfrom shared.shell import run_shell  # noqa: E402\n\n\n# ==========================================================================\n# 迷你 Cordis：一个 Context 就是\"服务的仓库\"\n# ==========================================================================\nclass Context:\n    \"\"\"共享上下文。插件通过 ctx.<key> 认领服务，别的插件按 key 找服务。\"\"\"\n\n    def __init__(self):\n        self._services: dict[str, Any] = {}\n        self._disposers: list[Callable[[], None]] = []\n\n    # -- 服务：用属性方式访问，ctx.tools / ctx.llm / ctx.shell ...\n    def provide(self, key: str, service: Any) -> Callable[[], None]:\n        \"\"\"认领一个服务 key。返回 disposer（可逆注册的最小形态）。\"\"\"\n        if key in self._services:\n            raise RuntimeError(f\"服务 {key!r} 已被占用\")\n        self._services[key] = service\n        print(f\"  [ctx] 提供服务 ctx.{key}\")\n\n        def dispose():\n            if self._services.get(key) is service:\n                del self._services[key]\n                print(f\"  [ctx] 卸载服务 ctx.{key}\")\n\n        self._disposers.append(dispose)\n        return dispose\n\n    def __getattr__(self, key: str) -> Any:\n        services = self.__dict__.get(\"_services\", {})\n        if key in services:\n            return services[key]\n        raise AttributeError(f\"没有服务 ctx.{key}\")\n\n    # -- 可逆副作用：任何注册都应有 disposer\n    def effect(self, setup: Callable[[], Callable[[], None]]) -> Callable[[], None]:\n        \"\"\"执行一个 setup，登记它返回的 disposer。这是 Cordis 的 ctx.effect() 缩影。\"\"\"\n        dispose = setup()\n        self._disposers.append(dispose)\n        return dispose\n\n    # -- 挂载插件：处理 inject 依赖顺序\n    def plugin(self, plug: \"Plugin\"):\n        for dep in plug.inject:\n            if dep not in self._services:\n                raise RuntimeError(f\"插件 {plug.name!r} 依赖 ctx.{dep}，但它还没就绪\")\n        print(f\"[boot] 挂载插件 {plug.name}\")\n        plug.apply(self)\n\n    def unload_all(self):\n        \"\"\"按注册逆序卸载——这就是\"reload 和 teardown 可预测地回退\"。\"\"\"\n        print(\"\\n[boot] 卸载所有插件（逆序）\")\n        for dispose in reversed(self._disposers):\n            dispose()\n\n\nclass Plugin:\n    \"\"\"一个插件 = 名字 + inject 依赖声明 + apply(ctx)。\"\"\"\n\n    def __init__(self, name: str, apply: Callable[[Context], None], inject: list[str] | None = None):\n        self.name = name\n        self.apply = apply\n        self.inject = inject or []\n\n\n# ==========================================================================\n# 现在把 L01 的三块拆成三个插件\n# ==========================================================================\ndef llm_plugin(ctx: Context):\n    \"\"\"贡献 ctx.llm 服务。\"\"\"\n    ctx.provide(\"llm\", make_llm(script=build_script()))\n\n\ndef shell_plugin(ctx: Context):\n    \"\"\"贡献 ctx.shell 服务（一个可调用对象）。\"\"\"\n    ctx.provide(\"shell\", run_shell)\n\n\ndef tools_plugin(ctx: Context):\n    \"\"\"贡献 ctx.tools 注册表。依赖 ctx.shell（inject 声明）。\n\n    注意 ctx.effect：注册 shell 工具是一个可逆副作用，返回 disposer。\n    卸载本插件时，这个工具会被干净移除。\n    \"\"\"\n    registry: dict[str, Callable[[dict], str]] = {}\n    ctx.provide(\"tools\", registry)\n\n    def register_shell_tool():\n        registry[\"shell\"] = lambda args: ctx.shell(args.get(\"command\", \"\"))\n        print(\"  [tools] 注册工具 shell\")\n\n        def dispose():\n            registry.pop(\"shell\", None)\n            print(\"  [tools] 注销工具 shell\")\n\n        return dispose\n\n    ctx.effect(register_shell_tool)\n\n\ndef agent_loop_plugin(ctx: Context):\n    \"\"\"贡献 ctx.agent_loop。依赖 ctx.llm 和 ctx.tools。\n\n    循环逻辑和 L01 一样，但它现在通过 ctx 找服务，而不是写死。\n    \"\"\"\n\n    def run(user_input: str, max_steps: int = 8) -> str:\n        messages = [{\"role\": \"user\", \"content\": user_input}]\n        for step in range(max_steps):\n            print(f\"\\n--- step {step + 1} ---\")\n            turn: AssistantTurn = ctx.llm.complete(messages)\n            if turn.text:\n                print(f\"[assistant] {turn.text}\")\n            if not turn.wants_tools:\n                return turn.text\n            messages.append({\"role\": \"assistant\", \"content\": turn.text})\n            for tc in turn.tool_calls:\n                print(f\"[tool_call] {tc.name}({tc.arguments})\")\n                handler = ctx.tools.get(tc.name)\n                result = handler(tc.arguments) if handler else f\"[未知工具] {tc.name}\"\n                print(f\"[tool_result] {result}\")\n                messages.append({\"role\": \"tool\", \"tool_call_id\": tc.id, \"content\": result})\n        return \"[达到最大步数]\"\n\n    ctx.provide(\"agent_loop\", run)\n\n\ndef build_script():\n    def step1(_m):\n        return AssistantTurn(\n            text=\"我通过 ctx 找到 shell 工具并执行。\",\n            tool_calls=[ToolCall(id=\"c1\", name=\"shell\", arguments={\"command\": \"echo plugins wired via ctx\"})],\n        )\n\n    def step2(m):\n        return AssistantTurn(text=f\"完成，输出：{m[-1]['content']!r}\")\n\n    return [step1, step2]\n\n\nif __name__ == \"__main__\":\n    ctx = Context()\n    # 挂载顺序体现 inject 依赖：先 llm/shell，再 tools（依赖 shell），最后 loop\n    ctx.plugin(Plugin(\"llm\", llm_plugin))\n    ctx.plugin(Plugin(\"shell\", shell_plugin))\n    ctx.plugin(Plugin(\"tools\", tools_plugin, inject=[\"shell\"]))\n    ctx.plugin(Plugin(\"agent-loop\", agent_loop_plugin, inject=[\"llm\", \"tools\"]))\n\n    print(\"\\n[boot] 插件树就绪，运行 agent\")\n    final = ctx.agent_loop(\"用 ctx 里的 shell 工具做点事\")\n    print(\"\\n==============================\")\n    print(f\"[最终答复] {final}\")\n\n    # 演示可逆：卸载所有插件，服务被逆序干净移除\n    ctx.unload_all()\n",
   "locPct": 83
  },
  {
   "id": "L03",
   "dir": "L03_event_dispatch",
   "num": "03",
   "title": "类型化事件与四种分发",
   "fullTitle": "L03 类型化事件与四种分发",
   "subtitle": "emit / waterfall / parallel / serial",
   "motto": "能力调用走 `ctx.<service>`，观察 / 拦截 / 策略走事件。",
   "layer": "kernel",
   "loc": 175,
   "hasCode": true,
   "sections": [
    {
     "name": "1. 30 秒运行",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "运行前先预测：waterfall 的第二个监听者不调用 `next()` 时，第三个监听者会不会执行？\nserial 中第一个监听者返回 `False`，应当停止还是继续？先写下答案再运行。\n\n```powershell\npython lessons/L03_event_dispatch/main.py\n```\n\n预期输出（节选）：\n\n```text\n=== emit（观察，无返回）===\n  [日志] 工具被调用: shell\n  [遥测] 计数 +1: shell\n\n=== waterfall（环绕中间件，next() 委派）===\n-- 危险请求 --\n  [A] 看到请求: {'command': 'rm -rf /'}，加个标记后委派\n  [B] 危险命令，短路拒绝（不调 next）\n  结果: {'denied': True}\n\n=== parallel（并行 await，无返回）===\n  [并发] 工具 B 完成（更快先完成）\n  [并发] 工具 A 完成\n\n=== serial（按序 await，第一个 bail 值胜出并停止）===\n  [预算检查] 预算充足，不干预（返回 None，不 bail）\n  [目标检查] 目标未完成 → bail，要求继续（后续监听者不再执行）\n  第一个 bail 值（胜出）: {'action': 'continue', 'reason': 'goal-not-done'}\n```"
      }
     ]
    },
    {
     "name": "2. 观察输出",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "四段演示对应四种分发模式。注意三个关键现象：\n**waterfall 里 B 不调 `next()` 就短路了**（C 根本没执行）；\n**parallel 里 B 比 A 先完成**（真并发，谁快谁先）；\n**serial 里 check_goal 一 bail，第三个监听者 `never_runs` 就再也没机会执行**\n（第一个非空返回值胜出并停止，这是 serial 的真实语义，不是 reducer）。"
      }
     ]
    },
    {
     "name": "3. 为什么需要这一层",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "L02 解决了\"插件怎么直接用别人的能力\"（调 `ctx.<service>`）。但还有一类需求：\n我想**观察**工具调用、**拦截**并改写请求、**组合**多个策略——而且不想让被观察方\n知道我的存在。如果都用直接调用，就得让每个工具去 import 每个策略，耦合爆炸。\n\n**事件是解耦的拦截点。** 而\"选哪种分发模式\"是设计一个事件时的**第一决策**，\n因为它决定了监听者是\"只看\"、\"能改\"、\"并发跑\"还是\"投票\"。"
      }
     ]
    },
    {
     "name": "4. 心智模型",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "四种模式，四种社交场合："
      },
      {
       "type": "compare",
       "id": "dispatch-modes",
       "title": "四种分发模式对应四种协作关系",
       "items": [
        {
         "title": "emit · 广播通知",
         "detail": "我喊一声，所有监听者都能听到；调用方不收集决定。"
        },
        {
         "title": "waterfall · 流水线审批",
         "detail": "值逐层传递，每一层都能改写、继续或短路。"
        },
        {
         "title": "parallel · 同时开工",
         "detail": "所有监听者并发执行，彼此不等待、不争夺最终决定。"
        },
        {
         "title": "serial · 依次表决",
         "detail": "按顺序询问，首个非空结论立即 bail，后续不再执行。"
        }
       ]
      }
     ]
    },
    {
     "name": "5. 方案与图",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "waterfall 是四者里最重要、也最烧脑的一个。它是**环绕中间件（around middleware）**："
      },
      {
       "type": "flow",
       "id": "waterfall-around",
       "title": "waterfall 的委派与短路",
       "nodes": [
        {
         "id": "a",
         "title": "监听器 A",
         "detail": "可先改写 req，再决定是否调用 `next()`",
         "edges": [
          {
           "target": "b",
           "label": "调用 next"
          }
         ]
        },
        {
         "id": "b",
         "title": "监听器 B",
         "detail": "调用 next 就继续委派；不调用则由 B 直接拥有结果",
         "edges": [
          {
           "target": "c",
           "label": "继续"
          },
          {
           "target": "short",
           "label": "不调用 next"
          }
         ]
        },
        {
         "id": "c",
         "title": "监听器 C",
         "detail": "链尾产生返回值",
         "edges": [
          {
           "target": "unwind",
           "label": ""
          }
         ]
        },
        {
         "id": "unwind",
         "title": "返回值回卷",
         "detail": "结果沿每一层 `next()` 的返回值逐层回到 A",
         "edges": []
        },
        {
         "id": "short",
         "title": "短路结果",
         "detail": "下游不再参与，B 的结果直接回卷",
         "edges": []
        }
       ]
      },
      {
       "type": "markdown",
       "markdown": "- **调 `next()`**：把（可能改写过的）值委派给下一个监听者。\n- **不调 `next()`**：短路——我拥有这个决定，下游不再参与。\n- 权限、压缩触发、请求构造都靠它。真实的 `agent/pre-step`、`agent/request`、\n  `llm/stream`、`tools/*` 三件套全是 waterfall。\n\n### 执行透视：危险请求怎样在 waterfall 中被短路"
      },
      {
       "type": "trace",
       "id": "l03-runtime-xray",
       "title": "同一请求穿过 annotate 与 permission",
       "panels": [
        "当前 value",
        "下一监听者",
        "控制权归属"
       ],
       "steps": [
        {
         "title": "建立链",
         "location": "`bus.on(...)`",
         "action": "三个监听者按注册顺序进入数组。",
         "states": [
          "`{command: rm -rf /}`",
          "`annotate (index 0)`",
          "EventBus 创建第一个 next。"
         ]
        },
        {
         "title": "A 改写",
         "location": "`annotate(req, next_)`",
         "action": "A 添加 `annotated=True`，调用 `next_(new_req)`。",
         "states": [
          "`{command:…, annotated: true}`",
          "`permission (index 1)`",
          "A 暂时把控制权交给 B，等待返回。"
         ]
        },
        {
         "title": "B 检查",
         "location": "`permission(req, next_)`",
         "action": "B 发现危险命令。",
         "states": [
          "改写后的 value 未丢失。",
          "`execute (index 2)` 尚未进入",
          "控制权当前属于 B。"
         ]
        },
        {
         "title": "B 短路",
         "location": "`return {\"denied\": True}`",
         "action": "B 不调用 next，直接产生结果。",
         "states": [
          "`{denied: true}`",
          "execute 永远不执行。",
          "B 拥有本次决定。"
         ]
        },
        {
         "title": "结果回卷",
         "location": "`return listener(v, next_)`",
         "action": "denied 沿 B → A → 调用方返回。",
         "states": [
          "`{denied: true}`",
          "无。",
          "下游控制权没有被重新取得。"
         ]
        }
       ]
      }
     ]
    },
    {
     "name": "6. 代码拆解",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "- `emit`：一个 for 循环挨个调，无返回。\n- `waterfall`：`dispatch(index, v)` 递归——给监听者传 `(v, next_)`，\n  `next_` 会带着（可能被替换的）值走到 `index+1`。链尾返回当前值。\n- `parallel`：`asyncio.gather` 并发所有监听者。\n- `serial`：for 循环挨个 `await`，谁先返回非 `None`/`False` 的值就 **bail**——立即返回该值并停止后续监听者（不是把 value 一路 reduce）。\n- `prepend=True`：让某监听者插到最前（真实里\"必须先跑\"的策略用它）。\n\n四段 demo 分别把四种模式映射到 dsh 真实事件：`tool/call`(emit)、\n`agent/pre-step`(waterfall)、`tools/execute`(parallel)、`agent/turn-stopping`(serial)。\n\n### 动手破坏一次\n\n把 waterfall 里的 `return listener(v, next_)` 改成先调用监听者、再无条件调用下一个。危险请求会\n穿过权限策略抵达 execute。这验证：**waterfall 的控制权属于监听者，是否调用 `next()`\n本身就是策略结果。**"
      }
     ]
    },
    {
     "name": "7. 代码解读：四种分发为什么不能合并成一个 emit",
     "blocks": [
      {
       "type": "code-walkthrough",
       "id": "l03-code-reading",
       "title": "从监听者注册到返回值回卷",
       "source": "main.py",
       "language": "python",
       "segments": [
        {
         "title": "注册顺序是一等语义",
         "start": 35,
         "end": 40,
         "reading": "`on` 用列表保存监听者；普通注册 append，必须抢先运行的策略用 prepend 插到开头。",
         "reason": "waterfall 与 serial 的结果依赖先后顺序，所以顺序不能交给无序集合或偶然的 import 顺序。",
         "code": "    def on(self, event: str, listener: Callable, prepend: bool = False):\n        lst = self._listeners.setdefault(event, [])\n        if prepend:\n            lst.insert(0, listener)  # 必须先跑的监听者用 prepend\n        else:\n            lst.append(listener)"
        },
        {
         "title": "emit 只负责通知",
         "start": 43,
         "end": 45,
         "reading": "emit 逐个调用所有监听者，既不收集返回值，也不给监听者停止后续分发的能力。",
         "reason": "遥测和日志不应改变业务决定；明确丢弃返回值能防止观察者意外成为策略。",
         "code": "    def emit(self, event: str, *args):\n        for fn in self._listeners.get(event, []):\n            fn(*args)"
        },
        {
         "title": "waterfall 用递归保存控制权",
         "start": 48,
         "end": 62,
         "reading": "`dispatch(index, value)` 构造只指向下一个节点的 `next_`；监听者可替换值、委派或直接返回。",
         "reason": "递归调用栈同时表达下行委派和上行回卷，不需要中央分发器理解每个策略的含义。",
         "code": "    def waterfall(self, event: str, value: Any) -> Any:\n        chain = list(self._listeners.get(event, []))\n\n        def dispatch(index: int, v: Any) -> Any:\n            if index >= len(chain):\n                return v  # 链尾：返回最终值\n            listener = chain[index]\n\n            def next_(nv=None):\n                # 不传参就沿用当前值；监听者也可替换值再委派\n                return dispatch(index + 1, nv if nv is not None else v)\n\n            return listener(v, next_)\n\n        return dispatch(0, value)"
        },
        {
         "title": "parallel 与 serial 终止规则相反",
         "start": 65,
         "end": 76,
         "reading": "parallel 用 gather 等待全部任务；serial 逐个 await，并在首个非空且非 False 的结果处返回。",
         "reason": "并发副作用要求“全部完成”，策略仲裁要求“首个结论胜出”。混成同一 API 会让调用方猜测语义。",
         "code": "    async def parallel(self, event: str, *args):\n        await asyncio.gather(*(fn(*args) for fn in self._listeners.get(event, [])))\n\n    # ---- serial：按序 await，直到某个监听者 bail（返回非 None/False）----\n    # 返回第一个 bail 值并**立即停止**后续监听者。这是 Cordis serial 的真实语义，\n    # 不是把 value 一路 reduce 下去。（bail = 提前终止分发）\n    async def serial(self, event: str, *args) -> Any:\n        for fn in self._listeners.get(event, []):\n            result = await fn(*args)\n            if result is not None and result is not False:\n                return result   # 第一个 bail 值胜出，后续监听者不再执行\n        return None              # 无人 bail"
        },
        {
         "title": "示例证明短路不是 reducer",
         "start": 92,
         "end": 120,
         "reading": "annotate 通过 next 传入新值，permission 可拒绝，execute 只在被委派时运行。",
         "reason": "值不是自动经过每个函数折叠；每层都显式交出控制权，这才允许权限插件真正阻止下游动作。",
         "code": "def demo_waterfall(bus: EventBus):\n    print(\"\\n=== waterfall（环绕中间件，next() 委派）===\")\n\n    # 监听者 A：观察 + 改写请求，然后委派\n    def annotate(req, next_):\n        print(f\"  [A] 看到请求: {req}，加个标记后委派\")\n        return next_({**req, \"annotated\": True})\n\n    # 监听者 B：权限策略——若命令危险则短路（不调 next）\n    def permission(req, next_):\n        if \"rm -rf\" in req.get(\"command\", \"\"):\n            print(\"  [B] 危险命令，短路拒绝（不调 next）\")\n            return {\"denied\": True}\n        print(\"  [B] 命令安全，委派\")\n        return next_(req)\n\n    # 监听者 C：链尾，真正\"执行\"\n    def execute(req, next_):\n        print(f\"  [C] 执行: {req}\")\n        return next_({**req, \"executed\": True})\n\n    bus.on(\"agent/pre-step\", annotate)\n    bus.on(\"agent/pre-step\", permission)\n    bus.on(\"agent/pre-step\", execute)\n\n    print(\"-- 安全请求 --\")\n    print(\"  结果:\", bus.waterfall(\"agent/pre-step\", {\"command\": \"echo hi\"}))\n    print(\"-- 危险请求 --\")\n    print(\"  结果:\", bus.waterfall(\"agent/pre-step\", {\"command\": \"rm -rf /\"}))"
        }
       ]
      }
     ]
    },
    {
     "name": "8. 相对上一课新增了什么",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "L02 只有\"服务调用\"这一条插件间通路。本课加上第二条：**类型化事件 + 四种分发**。\n至此 Cordis 五大思想里的\"服务、inject、可逆 effect、事件\"都齐了。"
      }
     ]
    },
    {
     "name": "9. 简化了什么 vs 真实 DeepSeek Harness",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| 字符串事件名，无类型 | TypeScript **声明合并**扩展 `SessionEventMap` 等，编译期检查 | 事件是公开契约，误用要在编译期挡住 |\n| 分发模式靠调对方法 | 每个事件用 `@mode` 标注，生成的目录校验声明与分发点一致 | 防止\"声明是 waterfall 却用 emit 分发\"这类错误 |\n| `next()` 简化处理 None | waterfall 是严格的 around 语义，值通过 `next()` 返回值传播 | 协作式监听可改写或替换结果，顺序敏感 |\n| `serial` bail 用非 None/False | 真实 `serial` 返回第一个 non-null/non-false/non-undefined 的 bail 值并停止 | 单决策事件靠第一个拍板者短路 |\n| 事件不带 scope | 事件按 agent scope 过滤分发（scope carrier） | 一个 agent 的事件不该惊动别的 agent（见 L09） |\n\n> **parallel / serial 的承接点**（呼应审查意见）：本课先建立四种模式的直觉。\n> `parallel` 会在 **L11 工具执行管线**再现（真实的 `ordered pre → concurrent execute → ordered post`）；\n> `serial` 会在 **L19 Goal Round Driver** 再现。注意一个重要特例：真实的\n> `agent/turn-stopping` 虽然是 serial 事件，但它的监听器**返回 `void`**——想让 turn 继续的\n> 监听器通过 `agent.steer(...)` 写入 steering（副作用），loop 再重读 inbox 决定续跑，\n> 而不是\"返回一个 stop 决策\"。L19 会专门演示这一点。\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `bus.emit` | `ctx.emit`（如 `tool/call`、`session/event`） |\n| `bus.waterfall` | `ctx.waterfall`（`agent/pre-step`、`agent/request`、`tools/*`） |\n| `bus.parallel` | `ctx.parallel` |\n| `bus.serial` | `ctx.serial`（`agent/turn-stopping`） |\n| `next()` 委派 | Cordis waterfall 的 `next()` around 语义 |\n\n---\n[← 上一课 L02](../L02_cordis_plugins/README.zh.md) · [返回总览](../../README.md) · [下一课 L04 →](../L04_session_log/README.zh.md)"
      }
     ]
    }
   ],
   "code": "\"\"\"L03 类型化事件与四种分发\n============================\nMotto：能力调用走 ctx.<service>，观察/拦截/策略走事件。\n\nL02 建立了\"服务调用\"。但 dsh 里插件之间还有第二条通路：**事件**。\n关键原则（务必记住）：\n  - 想直接用一个能力 → 调 ctx.<service>（如 ctx.shell(cmd)）。\n  - 想观察/拦截/组合策略而不侵入被观察方 → 用事件。\n\nCordis 有且只有四种分发模式，每种对应一类需求。本课全部实现：\n\n  emit      —— 观察：所有监听者按注册序看到事件，无返回值，不 await。\n  waterfall —— 环绕中间件：监听者拿到 (args, next)，调 next() 委派给下一个，\n               不调 next() 就短路。值通过 next() 的返回值传递。★ 最重要\n  parallel  —— 扇出：所有监听者并行 await，无返回值。\n  serial    —— 按序 await，直到某个监听者 \"bail\"（返回非 null/false/undefined）：\n               返回第一个 bail 值并立即停止后续监听者。不是 reducer！\n\n运行：  python lessons/L03_event_dispatch/main.py\n\"\"\"\n\nfrom __future__ import annotations\n\nimport asyncio\nfrom typing import Any, Callable\n\n\n# ==========================================================================\n# 迷你事件总线：四种分发模式\n# ==========================================================================\nclass EventBus:\n    def __init__(self):\n        self._listeners: dict[str, list[Callable]] = {}\n\n    def on(self, event: str, listener: Callable, prepend: bool = False):\n        lst = self._listeners.setdefault(event, [])\n        if prepend:\n            lst.insert(0, listener)  # 必须先跑的监听者用 prepend\n        else:\n            lst.append(listener)\n\n    # ---- emit：观察，无返回，按注册序 ----\n    def emit(self, event: str, *args):\n        for fn in self._listeners.get(event, []):\n            fn(*args)\n\n    # ---- waterfall：环绕中间件，靠 next() 委派 ----\n    def waterfall(self, event: str, value: Any) -> Any:\n        chain = list(self._listeners.get(event, []))\n\n        def dispatch(index: int, v: Any) -> Any:\n            if index >= len(chain):\n                return v  # 链尾：返回最终值\n            listener = chain[index]\n\n            def next_(nv=None):\n                # 不传参就沿用当前值；监听者也可替换值再委派\n                return dispatch(index + 1, nv if nv is not None else v)\n\n            return listener(v, next_)\n\n        return dispatch(0, value)\n\n    # ---- parallel：并行 await，无返回 ----\n    async def parallel(self, event: str, *args):\n        await asyncio.gather(*(fn(*args) for fn in self._listeners.get(event, [])))\n\n    # ---- serial：按序 await，直到某个监听者 bail（返回非 None/False）----\n    # 返回第一个 bail 值并**立即停止**后续监听者。这是 Cordis serial 的真实语义，\n    # 不是把 value 一路 reduce 下去。（bail = 提前终止分发）\n    async def serial(self, event: str, *args) -> Any:\n        for fn in self._listeners.get(event, []):\n            result = await fn(*args)\n            if result is not None and result is not False:\n                return result   # 第一个 bail 值胜出，后续监听者不再执行\n        return None              # 无人 bail\n\n\n# ==========================================================================\n# 演示 1：emit —— 多个观察者记录同一个事实\n# ==========================================================================\ndef demo_emit(bus: EventBus):\n    print(\"\\n=== emit（观察，无返回）===\")\n    bus.on(\"tool/call\", lambda name: print(f\"  [日志] 工具被调用: {name}\"))\n    bus.on(\"tool/call\", lambda name: print(f\"  [遥测] 计数 +1: {name}\"))\n    bus.emit(\"tool/call\", \"shell\")\n\n\n# ==========================================================================\n# 演示 2：waterfall —— pre-step 改写 + 权限短路（★ 核心）\n# ==========================================================================\ndef demo_waterfall(bus: EventBus):\n    print(\"\\n=== waterfall（环绕中间件，next() 委派）===\")\n\n    # 监听者 A：观察 + 改写请求，然后委派\n    def annotate(req, next_):\n        print(f\"  [A] 看到请求: {req}，加个标记后委派\")\n        return next_({**req, \"annotated\": True})\n\n    # 监听者 B：权限策略——若命令危险则短路（不调 next）\n    def permission(req, next_):\n        if \"rm -rf\" in req.get(\"command\", \"\"):\n            print(\"  [B] 危险命令，短路拒绝（不调 next）\")\n            return {\"denied\": True}\n        print(\"  [B] 命令安全，委派\")\n        return next_(req)\n\n    # 监听者 C：链尾，真正\"执行\"\n    def execute(req, next_):\n        print(f\"  [C] 执行: {req}\")\n        return next_({**req, \"executed\": True})\n\n    bus.on(\"agent/pre-step\", annotate)\n    bus.on(\"agent/pre-step\", permission)\n    bus.on(\"agent/pre-step\", execute)\n\n    print(\"-- 安全请求 --\")\n    print(\"  结果:\", bus.waterfall(\"agent/pre-step\", {\"command\": \"echo hi\"}))\n    print(\"-- 危险请求 --\")\n    print(\"  结果:\", bus.waterfall(\"agent/pre-step\", {\"command\": \"rm -rf /\"}))\n\n\n# ==========================================================================\n# 演示 3：parallel —— 多个工具并发执行（对应真实执行管线的 concurrent execute）\n# ==========================================================================\nasync def demo_parallel(bus: EventBus):\n    print(\"\\n=== parallel（并行 await，无返回）===\")\n\n    async def fetch_a(_):\n        await asyncio.sleep(0.05)\n        print(\"  [并发] 工具 A 完成\")\n\n    async def fetch_b(_):\n        await asyncio.sleep(0.02)\n        print(\"  [并发] 工具 B 完成（更快先完成）\")\n\n    bus.on(\"tools/execute\", fetch_a)\n    bus.on(\"tools/execute\", fetch_b)\n    await bus.parallel(\"tools/execute\", None)\n\n\n# ==========================================================================\n# 演示 4：serial —— 第一个 bail 值胜出并停止（对应真实 agent/turn-stopping）\n# 语义：按序 await，谁先返回非 null/false 的值，谁就胜出，后续监听者不再执行。\n# ==========================================================================\nasync def demo_serial(bus: EventBus):\n    print(\"\\n=== serial（按序 await，第一个 bail 值胜出并停止）===\")\n\n    async def check_budget(ctx):\n        # 观察但不干预 → 返回 None（不 bail），让分发继续到下一个监听者\n        print(f\"  [预算检查] 预算充足，不干预（返回 None，不 bail）\")\n        return None\n\n    async def check_goal(ctx):\n        # 目标未完成 → bail：返回一个非 None 值，分发在此停止\n        print(\"  [目标检查] 目标未完成 → bail，要求继续（后续监听者不再执行）\")\n        return {\"action\": \"continue\", \"reason\": \"goal-not-done\"}\n\n    async def never_runs(ctx):\n        print(\"  [不该出现] 如果这行打印了，说明 serial 语义错了！\")\n        return {\"action\": \"stop\"}\n\n    bus.on(\"agent/turn-stopping\", check_budget)\n    bus.on(\"agent/turn-stopping\", check_goal)\n    bus.on(\"agent/turn-stopping\", never_runs)  # 在 check_goal bail 后，这个绝不执行\n    final = await bus.serial(\"agent/turn-stopping\", {\"turn\": 0})\n    print(f\"  第一个 bail 值（胜出）: {final}\")\n\n\nif __name__ == \"__main__\":\n    bus = EventBus()\n    demo_emit(bus)\n    demo_waterfall(bus)\n    asyncio.run(demo_parallel(bus))\n    asyncio.run(demo_serial(bus))\n",
   "locPct": 81
  },
  {
   "id": "L04",
   "dir": "L04_session_log",
   "num": "04",
   "title": "仅追加的 SessionEvent 日志",
   "fullTitle": "L04 仅追加的 SessionEvent 日志",
   "subtitle": "append-only SessionEvent",
   "motto": "不存消息历史，只存事件；一切皆可回放。",
   "layer": "session",
   "loc": 120,
   "hasCode": true,
   "sections": [
    {
     "name": "1. 30 秒运行",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "运行前先预测：如果系统同时保存 `messages` 和审计日志，而进程恰好在“更新 messages”之后、\n“写审计日志”之前崩溃，恢复时应该相信哪一份？如果答不出来，说明系统存在两个真源。\n\n```powershell\npython lessons/L04_session_log/main.py\n```\n\n预期输出（节选）：\n\n```text\n===== 会话日志（仅追加，seq 连续）=====\n  #0  user/message       {'content': '演示事件日志', 'source': 'human'}\n  #1  assistant/message  {'text': '先执行一条命令。'}\n  #2  tool/call          {'callId': 'c1', 'name': 'shell', ...}\n  #3  tool/result        {'callId': 'c1', 'result': 'event\\nsourcing'}\n  #4  assistant/message  {'text': '任务完成。'}\n\n===== 回放：从日志重新派生模型历史 =====\n  user       '演示事件日志'\n  assistant  '先执行一条命令。'\n  tool       'event\\nsourcing'\n  assistant  '任务完成。'\n```"
      }
     ]
    },
    {
     "name": "2. 观察输出",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "agent 干的活还是没变。但状态的形态彻底变了：不再是一个会被覆盖的 `messages` 列表，\n而是一条**只增不改的事件流**。每件发生过的事（说话、调工具、拿结果）都是日志里一条带\n`seq` 的事件。最后我们用同一份日志重新\"回放\"出模型历史。\n\n> 注意：本课**故意不引入 `turn`/`step` 事件**——那是 L06 的主题。这里只追加最基本的\n> 四类事件（user/message、assistant/message、tool/call、tool/result），先把\"仅追加日志\"\n> 这一件事讲透，避免过早引入尚未定义的轮次语义。"
      }
     ]
    },
    {
     "name": "3. 为什么需要这一层",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "前三课的 `messages` 有个致命问题：它**既是给模型看的历史，又是唯一的状态**。\n一旦你想 fork 会话、崩溃恢复、生成遥测、或者事后审计\"当时到底发生了什么\"，\n一个可变列表根本扛不住。\n\ndsh 的答案：**把\"发生了什么\"和\"模型该看什么\"彻底分开。** 前者是仅追加日志（本课），\n后者是从日志派生出的投影（下一课 L05）。\n\n最直觉但会坏掉的实现是：\n\n```python\nmessages.append(new_message)       # 给模型看的状态\naudit_log.append(new_message)      # 用于恢复和审计的状态\n```\n\n这两行之间总可能失败。加重试也会带来重复写入。真正的修复不是“把两次写操作做得更小心”，\n而是只写一次权威事实：`session.append(event)`；`messages` 需要时再从事实计算。\n\n**为什么先立日志、再讲 turn/step（L06）？** 因为一旦\"唯一真源\"确立，\n后面每一层（轮次、压缩、fork、持久化）都只是\"往日志追加事件\"或\"从日志派生\"，\n不必各自维护一份状态。日志是所有后续机制的地基。"
      }
     ]
    },
    {
     "name": "4. 心智模型",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "把会话想成**银行账本**，而不是**账户余额**："
      },
      {
       "type": "compare",
       "id": "balance-vs-ledger",
       "title": "不要保存余额，要保存账本",
       "items": [
        {
         "title": "账户余额（可变状态）",
         "detail": "`100` 被改成 `80` 后，变化过程消失，无法解释余额怎么来的。"
        },
        {
         "title": "交易账本（仅追加日志）",
         "detail": "依次记录“存入 100、取出 20”，每笔都在，当前余额随时可以重算。"
        }
       ]
      },
      {
       "type": "markdown",
       "markdown": "模型历史 = 账本上算出来的\"当前余额\"。账本本身永不修改。"
      }
     ]
    },
    {
     "name": "5. 方案与图",
     "blocks": [
      {
       "type": "flow",
       "id": "session-log-flow",
       "title": "Session 是循环的真源，messages 只是临时投影",
       "nodes": [
        {
         "id": "input",
         "title": "接收用户输入",
         "detail": "输入先变成事件，不直接修改一个长期 messages。",
         "edges": [
          {
           "target": "user_event",
           "label": ""
          }
         ],
         "position": {
          "column": 1,
          "row": 1
         },
         "kind": ""
        },
        {
         "id": "user_event",
         "title": "追加 user/message",
         "detail": "把用户事实写进仅追加日志。",
         "edges": [
          {
           "target": "session",
           "label": ""
          }
         ],
         "position": {
          "column": 2,
          "row": 1
         },
         "kind": ""
        },
        {
         "id": "session",
         "title": "Session 事件日志",
         "detail": "保存所有用户、助手、工具调用和结果，是唯一真源。",
         "edges": [
          {
           "target": "derive",
           "label": ""
          }
         ],
         "position": {
          "column": 3,
          "row": 1
         },
         "kind": "state"
        },
        {
         "id": "derive",
         "title": "派生 messages",
         "detail": "每次请求模型前，从当前日志重新投影。",
         "edges": [
          {
           "target": "model",
           "label": ""
          }
         ],
         "position": {
          "column": 4,
          "row": 1
         },
         "kind": ""
        },
        {
         "id": "model",
         "title": "请求模型",
         "detail": "模型只读取投影结果，返回文本或工具调用。",
         "edges": [
          {
           "target": "assistant_event",
           "label": ""
          }
         ],
         "position": {
          "column": 5,
          "row": 1
         },
         "kind": ""
        },
        {
         "id": "assistant_event",
         "title": "追加 assistant/message",
         "detail": "模型输出仍先回到日志，再判断是否需要工具。",
         "edges": [
          {
           "target": "decide",
           "label": ""
          }
         ],
         "position": {
          "column": 6,
          "row": 1
         },
         "kind": ""
        },
        {
         "id": "decide",
         "title": "有工具调用吗？",
         "detail": "没有就结束；有则执行并继续追加事件。",
         "edges": [
          {
           "target": "tool",
           "label": "有"
          },
          {
           "target": "done",
           "label": "没有"
          }
         ],
         "position": {
          "column": 7,
          "row": 1
         },
         "kind": "decision"
        },
        {
         "id": "done",
         "title": "返回最终答复",
         "detail": "日志保留完整过程，当前循环结束。",
         "edges": [],
         "position": {
          "column": 8,
          "row": 1
         },
         "kind": "terminal"
        },
        {
         "id": "tool",
         "title": "追加 call 并执行",
         "detail": "写入 tool/call 后执行对应工具。",
         "edges": [
          {
           "target": "result",
           "label": ""
          }
         ],
         "position": {
          "column": 7,
          "row": 3
         },
         "kind": ""
        },
        {
         "id": "result",
         "title": "追加 tool/result",
         "detail": "工具观察写回日志，下一轮重新派生 messages。",
         "edges": [
          {
           "target": "session",
           "label": "写回真源"
          }
         ],
         "position": {
          "column": 3,
          "row": 3
         },
         "kind": ""
        }
       ],
       "variant": "map"
      },
      {
       "type": "markdown",
       "markdown": "### 执行透视：日志如何取代可变 messages"
      },
      {
       "type": "trace",
       "id": "l04-runtime-xray",
       "title": "每个可观察事实都先落入唯一真源",
       "panels": [
        "事件日志",
        "模型视图",
        "继续条件"
       ],
       "steps": [
        {
         "title": "记录输入",
         "location": "`session.append(\"user/message\")`",
         "action": "用户输入先成为 seq=0 的不可变事实。",
         "states": [
          "`#0 user/message`",
          "`naive_derive → [user]`",
          "模型尚未作出决策。"
         ]
        },
        {
         "title": "请求模型",
         "location": "`llm.complete(naive_derive(session))`",
         "action": "模型只读取临时投影，不持有日志。",
         "states": [
          "`#0 user/message`",
          "`[user]`",
          "返回了 tool call。"
         ]
        },
        {
         "title": "记录回答",
         "location": "`session.append(\"assistant/message\")`",
         "action": "模型文本先写日志。",
         "states": [
          "`#0 user; #1 assistant`",
          "`[user, assistant]`",
          "`turn.wants_tools == True`。"
         ]
        },
        {
         "title": "记录调用",
         "location": "`session.append(\"tool/call\")`",
         "action": "在执行外部动作前，先留下调用事实和 callId。",
         "states": [
          "`#0…#2 tool/call(c1)`",
          "`[user, assistant]`",
          "工具尚未产生结果。"
         ]
        },
        {
         "title": "记录结果",
         "location": "`session.append(\"tool/result\")`",
         "action": "shell 观察作为 seq=3 追加，旧事件完全不动。",
         "states": [
          "`#0…#3 tool/result(c1)`",
          "`[user, assistant, tool]`",
          "新观察需要交给模型。"
         ]
        },
        {
         "title": "记录收尾",
         "location": "`session.append(\"assistant/message\")`",
         "action": "第二次模型调用给出最终文本。",
         "states": [
          "`#0…#4 assistant`",
          "`[user, assistant, tool, assistant]`",
          "无工具调用，循环退出；日志可重新投影。"
         ]
        }
       ]
      }
     ]
    },
    {
     "name": "6. 代码拆解",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "- `SessionEvent` 用 `frozen=True`：事件不可变，写入即定。\n- `Session.append(type, data)`：`seq = len(events)`，保证连续且单调。**只有 append，没有 update/delete。**\n- `run()`：把 L01 的\"追加消息\"全换成\"追加事件\"——`user/message`、\n  `assistant/message`、`tool/call`、`tool/result`（本课故意不含 turn/step，见 L06）。\n- `naive_derive()`：本课临时的粗糙投影，L05 升级为正规 `deriveMessages`。\n\n### 动手验证不变量\n\n尝试给 `Session` 增加一个 `update(seq, data)`，然后问自己：回放时还能否证明“当时模型看到的\n就是现在重建出的内容”？答案是否定的。这正是仅追加约束保护的东西：**历史事实不能被事后改写。**"
      }
     ]
    },
    {
     "name": "7. 代码解读：可变历史如何被单一事件流取代",
     "blocks": [
      {
       "type": "code-walkthrough",
       "id": "l04-code-reading",
       "title": "一次事实从 append 到重新回放",
       "source": "main.py",
       "language": "python",
       "segments": [
        {
         "title": "用类型冻结一条历史事实",
         "start": 32,
         "end": 35,
         "reading": "`SessionEvent` 同时保存顺序、类型和完整数据，`frozen=True` 禁止字段重新赋值。",
         "reason": "回放必须面对“当时发生的事实”，而不是后来被修改过的对象；不可变是可审计的前提。",
         "code": "class SessionEvent:\n    seq: int\n    type: str          # user/message, assistant/message, tool/call, tool/result ...（turn/step 见 L06）\n    data: dict[str, Any]"
        },
        {
         "title": "只暴露 append 和快照读取",
         "start": 38,
         "end": 56,
         "reading": "`seq` 由当前长度生成，事件只追加到尾部；`events()` 返回副本而不是内部列表。",
         "reason": "连续 seq 给事件稳定身份，复制列表防止调用方绕过 API 删除或重排权威历史。",
         "code": "class Session:\n    \"\"\"仅追加的事件日志。这是 agent 交互历史的唯一真源。\"\"\"\n\n    def __init__(self):\n        self._events: list[SessionEvent] = []\n\n    def append(self, type: str, data: dict[str, Any]) -> SessionEvent:\n        # 关键不变式：只能往后追加，seq 连续，事件本身 frozen（不可变）。\n        ev = SessionEvent(seq=len(self._events), type=type, data=data)\n        self._events.append(ev)\n        return ev\n\n    def events(self) -> list[SessionEvent]:\n        return list(self._events)\n\n    def dump(self):\n        print(\"\\n===== 会话日志（仅追加，seq 连续）=====\")\n        for ev in self._events:\n            print(f\"  #{ev.seq:<2} {ev.type:<18} {ev.data}\")"
        },
        {
         "title": "投影是读侧临时计算",
         "start": 63,
         "end": 73,
         "reading": "`naive_derive` 遍历事件，挑出模型需要的三类内容，既不修改事件也不缓存第二份长期状态。",
         "reason": "messages 可以随时丢弃重算；只要事件日志还在，模型视图就能恢复。L05 会把这些规则正规化。",
         "code": "def naive_derive(session: Session) -> list[dict]:\n    \"\"\"临时的、粗糙的历史拼装——L05 会替换成正规投影。\"\"\"\n    msgs = []\n    for ev in session.events():\n        if ev.type == \"user/message\":\n            msgs.append({\"role\": \"user\", \"content\": ev.data[\"content\"]})\n        elif ev.type == \"assistant/message\":\n            msgs.append({\"role\": \"assistant\", \"content\": ev.data[\"text\"]})\n        elif ev.type == \"tool/result\":\n            msgs.append({\"role\": \"tool\", \"content\": ev.data[\"result\"]})\n    return msgs"
        },
        {
         "title": "所有外部变化先落日志",
         "start": 76,
         "end": 93,
         "reading": "用户、assistant、tool call 与 result 都通过 `session.append` 记录；每轮模型调用前重新 derive。",
         "reason": "单一写路径消除了“messages 已更新但审计日志没写成”的双写窗口，模型可见内容也都有来源。",
         "code": "def run(session: Session, llm, user_input: str, max_steps: int = 8) -> str:\n    # 本课只聚焦\"仅追加日志\"，故意不引入 turn/step 语义——那是 L06 的主题。\n    # 这里只追加最基本的四类事件：user/message、assistant/message、tool/call、tool/result。\n    session.append(\"user/message\", {\"content\": user_input, \"source\": \"human\"})\n\n    for _ in range(max_steps):\n        turn: AssistantTurn = llm.complete(naive_derive(session))\n        session.append(\"assistant/message\", {\"text\": turn.text})\n\n        if not turn.wants_tools:\n            return turn.text\n\n        for tc in turn.tool_calls:\n            session.append(\"tool/call\", {\"callId\": tc.id, \"name\": tc.name, \"arguments\": tc.arguments})\n            result = run_shell(tc.arguments.get(\"command\", \"\")) if tc.name == \"shell\" else f\"[未知] {tc.name}\"\n            session.append(\"tool/result\", {\"callId\": tc.id, \"result\": result})\n\n    return \"[达到最大步数]\""
        },
        {
         "title": "用同一份日志证明可回放",
         "start": 108,
         "end": 120,
         "reading": "任务结束后不复用旧 messages，而是再次调用 `naive_derive(session)` 打印历史。",
         "reason": "可回放不是备份功能，而是投影函数对权威日志的自然结果；进程内临时视图不再重要。",
         "code": "\nif __name__ == \"__main__\":\n    session = Session()\n    llm = make_llm(script=build_script())\n    final = run(session, llm, \"演示事件日志\")\n    print(f\"\\n[最终答复] {final}\")\n    session.dump()\n\n    # 关键演示：日志是唯一真源。同一份日志重新走一遍 naive_derive，\n    # 得到的模型历史完全一致——这就是\"可回放\"。\n    print(\"\\n===== 回放：从日志重新派生模型历史 =====\")\n    for m in naive_derive(session):\n        print(f\"  {m['role']:<10} {m['content']!r}\")"
        }
       ]
      }
     ]
    },
    {
     "name": "8. 相对上一课新增了什么",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "L01-L03 的状态是可变 `messages` 列表。本课把它替换成**仅追加的 `SessionEvent` 日志**，\n并证明\"同一份日志可重复回放出相同历史\"。这是全套课程最有辨识度的转折点。"
      }
     ]
    },
    {
     "name": "9. 简化了什么 vs 真实 DeepSeek Harness",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| 内存 list，进程退出就没了 | `ctx.sessions` + 持久化 seam（JSONL/后端），崩溃可恢复 | 会话要跨进程存活、可恢复（见附录 X） |\n| 事件类型 5~6 种 | `SessionEventMap`，可用**声明合并**扩展（compaction、hook 等各自加事件） | 新的模型可见输入必须先加事件类型，不能塞临时变量 |\n| `data` 是任意 dict | 每条事件是 lossless JSON，`append` 运行时校验 `isJsonValue` | 日志要能逐字节存储与回放，非法数据在源头被拒 |\n| `naive_derive` 内联 | `deriveMessages()` 独立纯函数（L05） | 投影逻辑要被回放、fork、遥测复用 |\n| 无 surface/记账区分 | 事件分 surface（进模型）与 log-only（记账），`assistant/chunk` 保留 token 级回放 | UI 保真、usage 记账、compaction 的 shadow 都靠这个区分 |\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `Session` | `ctx.sessions` 里的 `Session`（`core/session`） |\n| `SessionEvent` | `SessionEvent` / `SessionEventMap` |\n| `append` | `Session.append`（仅追加不变式） |\n| `naive_derive` | `deriveMessages()`（见 L05） |\n\n---\n[← 返回总览](../../README.md) · [下一课 L05 →](../L05_derive_messages/README.zh.md)"
      }
     ]
    }
   ],
   "code": "\"\"\"L04 仅追加的 SessionEvent 日志\n=================================\nMotto：不存消息历史，只存事件；一切皆可回放。\n\n前三课我们一直用一个 messages 列表当状态。但真实 dsh 从不单独存\"消息历史\"——\n它只存一份**仅追加（append-only）的事件日志**。为什么先在裸循环上立起这个真源，\n再在它之上长出 turn/step（L06）？因为一旦\"唯一真源\"确立，回放、fork、持久化、\n遥测就全都是\"从同一组事件派生\"，后面每一层都不必再各自维护状态。\n\n这一课只做一件事：把\"追加消息\"改成\"追加事件\"。事件一旦写入，绝不修改、绝不删除。\n\n运行：  python lessons/L04_session_log/main.py\n\"\"\"\n\nfrom __future__ import annotations\n\nimport os\nimport sys\nfrom dataclasses import dataclass, field\nfrom typing import Any\n\nsys.path.insert(0, os.path.join(os.path.dirname(__file__), \"..\", \"..\"))\n\nfrom shared.llm import AssistantTurn, ToolCall, make_llm  # noqa: E402\nfrom shared.shell import run_shell  # noqa: E402\n\n\n# ==========================================================================\n# SessionEvent：一条不可变的事件。seq 单调递增且连续。\n# ==========================================================================\n@dataclass(frozen=True)\nclass SessionEvent:\n    seq: int\n    type: str          # user/message, assistant/message, tool/call, tool/result ...（turn/step 见 L06）\n    data: dict[str, Any]\n\n\nclass Session:\n    \"\"\"仅追加的事件日志。这是 agent 交互历史的唯一真源。\"\"\"\n\n    def __init__(self):\n        self._events: list[SessionEvent] = []\n\n    def append(self, type: str, data: dict[str, Any]) -> SessionEvent:\n        # 关键不变式：只能往后追加，seq 连续，事件本身 frozen（不可变）。\n        ev = SessionEvent(seq=len(self._events), type=type, data=data)\n        self._events.append(ev)\n        return ev\n\n    def events(self) -> list[SessionEvent]:\n        return list(self._events)\n\n    def dump(self):\n        print(\"\\n===== 会话日志（仅追加，seq 连续）=====\")\n        for ev in self._events:\n            print(f\"  #{ev.seq:<2} {ev.type:<18} {ev.data}\")\n\n\n# ==========================================================================\n# agent loop：现在往 Session 追加事件，而不是往 messages 追加消息。\n# 注意：模型请求需要的历史，我们暂时\"手工\"从事件里拼（L05 会做成正规的 deriveMessages）。\n# ==========================================================================\ndef naive_derive(session: Session) -> list[dict]:\n    \"\"\"临时的、粗糙的历史拼装——L05 会替换成正规投影。\"\"\"\n    msgs = []\n    for ev in session.events():\n        if ev.type == \"user/message\":\n            msgs.append({\"role\": \"user\", \"content\": ev.data[\"content\"]})\n        elif ev.type == \"assistant/message\":\n            msgs.append({\"role\": \"assistant\", \"content\": ev.data[\"text\"]})\n        elif ev.type == \"tool/result\":\n            msgs.append({\"role\": \"tool\", \"content\": ev.data[\"result\"]})\n    return msgs\n\n\ndef run(session: Session, llm, user_input: str, max_steps: int = 8) -> str:\n    # 本课只聚焦\"仅追加日志\"，故意不引入 turn/step 语义——那是 L06 的主题。\n    # 这里只追加最基本的四类事件：user/message、assistant/message、tool/call、tool/result。\n    session.append(\"user/message\", {\"content\": user_input, \"source\": \"human\"})\n\n    for _ in range(max_steps):\n        turn: AssistantTurn = llm.complete(naive_derive(session))\n        session.append(\"assistant/message\", {\"text\": turn.text})\n\n        if not turn.wants_tools:\n            return turn.text\n\n        for tc in turn.tool_calls:\n            session.append(\"tool/call\", {\"callId\": tc.id, \"name\": tc.name, \"arguments\": tc.arguments})\n            result = run_shell(tc.arguments.get(\"command\", \"\")) if tc.name == \"shell\" else f\"[未知] {tc.name}\"\n            session.append(\"tool/result\", {\"callId\": tc.id, \"result\": result})\n\n    return \"[达到最大步数]\"\n\n\ndef build_script():\n    def step1(_m):\n        return AssistantTurn(\n            text=\"先执行一条命令。\",\n            tool_calls=[ToolCall(id=\"c1\", name=\"shell\", arguments={\"command\": \"echo event sourcing\"})],\n        )\n\n    def step2(m):\n        return AssistantTurn(text=\"任务完成。\")\n\n    return [step1, step2]\n\n\nif __name__ == \"__main__\":\n    session = Session()\n    llm = make_llm(script=build_script())\n    final = run(session, llm, \"演示事件日志\")\n    print(f\"\\n[最终答复] {final}\")\n    session.dump()\n\n    # 关键演示：日志是唯一真源。同一份日志重新走一遍 naive_derive，\n    # 得到的模型历史完全一致——这就是\"可回放\"。\n    print(\"\\n===== 回放：从日志重新派生模型历史 =====\")\n    for m in naive_derive(session):\n        print(f\"  {m['role']:<10} {m['content']!r}\")\n",
   "locPct": 55
  },
  {
   "id": "L05",
   "dir": "L05_derive_messages",
   "num": "05",
   "title": "deriveMessages：日志是事实，消息是投影",
   "fullTitle": "L05 deriveMessages：日志是事实，消息是投影",
   "subtitle": "deriveMessages 纯函数投影",
   "motto": "模型看到的是投影，不是存储；模型可见即已记录。",
   "layer": "session",
   "loc": 127,
   "hasCode": true,
   "sections": [
    {
     "name": "1. 30 秒运行",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "运行前先做分类：下面 8 条事件中，哪些应该进入模型请求，哪些只用于记账？尤其想一想：\n`tool/call` 为什么不单独成为一条模型消息？\n\n```powershell\npython lessons/L05_derive_messages/main.py\n```\n\n预期输出（节选）：\n\n```text\n===== 原始事件日志（8 条，含记账事件与一条空消息）=====\n  #0 turn/start\n  #1 user/message\n  #2 assistant/message\n  #3 tool/call\n  #4 tool/result\n  #5 assistant/message      ← 空内容消息\n  #6 assistant/message\n  #7 turn/end\n\n===== deriveMessages 投影出的模型历史 =====\n  {'role': 'user', 'content': '看看环境'}\n  {'role': 'assistant', 'content': '我调一下工具', 'tool_calls': [...]}\n  {'role': 'tool', 'tool_call_id': 'c1', 'content': 'hi'}\n  {'role': 'assistant', 'content': '环境正常，任务完成。'}\n\n===== 关键：同一日志再投影一次，结果完全一致（可回放）=====\n  两次投影相等: True\n  投影出 4 条消息，但日志有 8 条事件\n\n===== callId 配对校验：每条 tool 消息都回溯到了对应的 tool/call =====\n  1 条 tool 结果全部配对成功（无孤儿）: True\n```"
      }
     ]
    },
    {
     "name": "2. 观察输出",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "**8 条事件，投影出 4 条消息。** 差额来自三类不进模型历史的东西：\n记账事件（`turn/start`、`turn/end`、`tool/call`）、以及一条空的 `assistant/message`。\n最关键的一行：**同一日志投影两次，结果完全相等**——这就是\"可回放\"的数学保证。"
      }
     ]
    },
    {
     "name": "3. 为什么需要这一层",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "L04 已经把状态变成日志了，但日志里\"什么该给模型看、什么只是记账\"是混在一起的。\n如果每个用到历史的地方（主循环、压缩、fork、遥测）都自己写一遍\"从事件拼消息\"，\n逻辑会漂移、会出 bug。\n\n**答案是一个纯函数 `deriveMessages`：日志进、消息出，无副作用、结果确定。**\n它是唯一一处定义\"模型到底看到什么\"的地方。由此得到 dsh 的铁律——\n**\"模型可见即已记录\"**：任何进入模型请求的东西，都必须能从日志重建。\n所以想给模型加一种新输入，就必须先加一种新事件类型。"
      }
     ]
    },
    {
     "name": "4. 心智模型",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "`deriveMessages` 就是数据库里的**视图（VIEW）**："
      },
      {
       "type": "compare",
       "id": "table-vs-view",
       "title": "日志是表，消息历史是视图",
       "items": [
        {
         "title": "事件日志（底层表）",
         "detail": "保存全部原始事件，是唯一可追加、可回放的真源。"
        },
        {
         "title": "模型历史（只读视图）",
         "detail": "`deriveMessages()` 像 SELECT 一样筛选并投影模型真正需要的消息。"
        }
       ]
      },
      {
       "type": "markdown",
       "markdown": "### 执行透视：8 条事实怎样折叠成 4 条消息"
      },
      {
       "type": "trace",
       "id": "l05-runtime-xray",
       "title": "deriveMessages 的逐事件投影",
       "panels": [
        "事件日志",
        "模型视图",
        "继续条件"
       ],
       "steps": [
        {
         "title": "建立配对索引",
         "location": "`known_call_ids = {...}`",
         "action": "先扫描全部 tool/call，得到可验证的 callId 集合。",
         "states": [
          "`8 events; known={c1}`",
          "`[]`",
          "还未开始逐事件投影。"
         ]
        },
        {
         "title": "跳过 turn/start",
         "location": "`for ev in events`",
         "action": "轮次边界用于记账，不进入模型上下文。",
         "states": [
          "`#0 turn/start`",
          "`[]`",
          "继续读取下一事件。"
         ]
        },
        {
         "title": "投影用户输入",
         "location": "`ev.type == \"user/message\"`",
         "action": "生成一条 user message。",
         "states": [
          "`#0…#1`",
          "`[user]`",
          "继续折叠。"
         ]
        },
        {
         "title": "投影助手决策",
         "location": "`ev.type == \"assistant/message\"`",
         "action": "文本和 tool_calls 合成同一条 assistant message。",
         "states": [
          "`#0…#2`",
          "`[user, assistant+call(c1)]`",
          "继续；调用定义已在 assistant 消息里。"
         ]
        },
        {
         "title": "忽略调用记账",
         "location": "`ev.type == \"tool/call\"`",
         "action": "不额外生成消息；它只提供执行事实和配对依据。",
         "states": [
          "`#0…#3`",
          "`[user, assistant+call(c1)]`",
          "继续读取结果。"
         ]
        },
        {
         "title": "投影工具结果",
         "location": "`call_id in known_call_ids`",
         "action": "result 与 c1 配对，生成 tool message。",
         "states": [
          "`#0…#4`",
          "`[user, assistant+call(c1), tool(c1)]`",
          "配对成功，继续。"
         ]
        },
        {
         "title": "过滤空消息",
         "location": "`if not text and not calls: continue`",
         "action": "空 assistant 事件仍保留在日志，但不污染模型视图。",
         "states": [
          "`#0…#5`",
          "`[user, assistant+call(c1), tool(c1)]`",
          "继续；事实保留，视图不变。"
         ]
        },
        {
         "title": "完成投影",
         "location": "`return messages`",
         "action": "最终 assistant 进入视图；turn/end 被忽略。",
         "states": [
          "`8 events`",
          "`[user, assistant+call(c1), tool(c1), assistant]`",
          "纯函数结束；相同输入必得相同输出。"
         ]
        }
       ]
      },
      {
       "type": "markdown",
       "markdown": "你永远不 UPDATE 视图，你只改底层的表（追加事件），视图自动反映最新状态。"
      }
     ]
    },
    {
     "name": "5. 方案与图",
     "blocks": [
      {
       "type": "compare",
       "id": "event-projection",
       "title": "不同事件怎样进入模型视图",
       "items": [
        {
         "title": "user/message",
         "detail": "投影为 `{role: user}`。"
        },
        {
         "title": "assistant/message",
         "detail": "投影为 `{role: assistant}`；空内容且无 tool calls 时跳过。"
        },
        {
         "title": "tool/result",
         "detail": "按 callId 配对，投影为带 `tool_call_id` 的 tool 消息。"
        },
        {
         "title": "turn/start、turn/end",
         "detail": "只负责记账，不进入模型历史。"
        },
        {
         "title": "tool/call",
         "detail": "调用定义已经并入对应 assistant 消息，不单独投影。"
        },
        {
         "title": "assistant/chunk",
         "detail": "用于 token 级回放，完整消息形成后不再进入模型历史。"
        }
       ]
      }
     ]
    },
    {
     "name": "6. 代码拆解",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "`derive_messages(events)` 就是一个 for 循环 + 分类：\n\n- `user/message` → user 消息。\n- `assistant/message` → **规则 1**：`text` 为空且无 `tool_calls` 就 `continue`（不进历史，\n  但事件仍在日志里，保留 usage 与回放）。有 `tool_calls` 就带上。\n- `tool/result` → **规则 2**：先收集所有 `tool/call` 的 `callId` 成集合，再校验这条 result\n  的 `callId` 确实回溯得到某条 call（否则标记为孤儿），然后挂成带 `tool_call_id` 的 tool 消息。\n- 其余（`turn/*`、`tool/call`）是记账事件，全部跳过。\n\n`demo()` 手工构造一段含\"空 assistant 消息\"的事件序列，然后证明**两次投影相等**。\n\n### 动手验证不变量\n\n把示例中 `tool/result` 的 `callId` 改成 `ghost` 再运行。它会被标记为 `_orphan`，说明投影器\n不是简单格式转换器，还承担一致性检查：**每个工具结果都必须能追溯到模型曾发出的调用。**"
      }
     ]
    },
    {
     "name": "7. 代码解读：投影器如何保护模型视图的不变量",
     "blocks": [
      {
       "type": "code-walkthrough",
       "id": "l05-code-reading",
       "title": "从配对索引到确定性消息列表",
       "source": "main.py",
       "language": "python",
       "segments": [
        {
         "title": "先建立工具调用索引",
         "start": 55,
         "end": 58,
         "reading": "投影开始前扫描全部 `tool/call`，把合法 callId 收集为集合。",
         "reason": "tool result 可能出现在后续位置；预先建索引让每个结果都能做 O(1) 来源校验，也把跨事件约束集中起来。",
         "code": "def derive_messages(events: list[SessionEvent]) -> list[dict]:\n    # 先收集所有 tool/call 的 callId，供 tool/result 配对校验。\n    # \"配对\"= 每条 tool/result 都能回溯到一条同 callId 的 tool/call；\n    # 否则它是孤儿结果（真实 dsh 的不变式不允许，这里显式标出以名副其实）。"
        },
        {
         "title": "user 与 assistant 使用不同规则",
         "start": 60,
         "end": 75,
         "reading": "user 直接映射；assistant 则同时检查文本和 calls，空内容且无调用时跳过，有调用时保留结构化字段。",
         "reason": "日志需要保存空响应的 usage 等事实，但模型视图不能被无意义空消息污染；“是否进入 surface”与“是否记录”是两回事。",
         "code": "\n    messages: list[dict] = []\n    for ev in events:\n        if ev.type == \"user/message\":\n            messages.append({\"role\": \"user\", \"content\": ev.data[\"content\"]})\n\n        elif ev.type == \"assistant/message\":\n            text = ev.data.get(\"text\", \"\")\n            calls = ev.data.get(\"tool_calls\", [])\n            # 规则 1：空内容且无工具调用 → 不进派生历史（事件仍在日志，保留 usage/回放）\n            if not text and not calls:\n                continue\n            msg: dict = {\"role\": \"assistant\", \"content\": text}\n            if calls:\n                msg[\"tool_calls\"] = calls\n            messages.append(msg)"
        },
        {
         "title": "result 必须回指 call",
         "start": 77,
         "end": 88,
         "reading": "每个 tool/result 取出 callId，生成 `tool_call_id`；找不到来源时显式标记 `_orphan`。",
         "reason": "模型协议靠 ID 将动作与观察配对。静默接受孤儿结果会让模型看到一个没有问题来源的答案。",
         "code": "        elif ev.type == \"tool/result\":\n            # 规则 2：按 callId 配对——校验它确实对应某条 tool/call，再挂成 tool 消息。\n            call_id = ev.data[\"callId\"]\n            paired = call_id in known_call_ids\n            messages.append({\n                \"role\": \"tool\",\n                \"tool_call_id\": call_id,\n                \"content\": ev.data[\"result\"],\n                # 教学用标记：真实 dsh 中孤儿结果会在 append/投影处被不变式拒绝。\n                **({} if paired else {\"_orphan\": True}),\n            })\n"
        },
        {
         "title": "demo 构造边界而非只跑 happy path",
         "start": 93,
         "end": 107,
         "reading": "示例刻意加入 turn 记账事件、tool call、空 assistant 和正常收尾。",
         "reason": "只有混合事件才能证明投影器确实在筛选，而不是简单把日志逐条改名。",
         "code": "def demo():\n    s = Session()\n    # 手工构造一段真实会话会产生的事件序列（含一条空 assistant 消息）\n    s.append(\"turn/start\", {\"turn\": 0})\n    s.append(\"user/message\", {\"content\": \"看看环境\", \"source\": \"human\"})\n    s.append(\"assistant/message\", {\"text\": \"我调一下工具\", \"tool_calls\": [{\"id\": \"c1\", \"name\": \"shell\"}]})\n    s.append(\"tool/call\", {\"callId\": \"c1\", \"name\": \"shell\", \"arguments\": {\"command\": \"echo hi\"}})\n    s.append(\"tool/result\", {\"callId\": \"c1\", \"result\": \"hi\"})\n    s.append(\"assistant/message\", {\"text\": \"\", \"tool_calls\": []})  # ← 空消息：max-tokens 之类\n    s.append(\"assistant/message\", {\"text\": \"环境正常，任务完成。\"})\n    s.append(\"turn/end\", {\"turn\": 0, \"reason\": \"natural-stop\"})\n\n    print(\"===== 原始事件日志（8 条，含记账事件与一条空消息）=====\")\n    for ev in s.events():\n        print(f\"  #{ev.seq} {ev.type}\")"
        },
        {
         "title": "两次投影验证纯函数性质",
         "start": 115,
         "end": 123,
         "reading": "对同一事件列表调用两次并比较，同时单独检查所有 tool message 是否配对。",
         "reason": "确定性是 fork、resume、compaction 和测试复现的共同基础；如果相同日志产生不同视图，整个事件源架构都会失效。",
         "code": "    second = derive_messages(s.events())\n    print(f\"  两次投影相等: {first == second}\")\n    print(f\"  投影出 {len(first)} 条消息，但日志有 {len(s.events())} 条事件\")\n    print(\"  → 差额来自：turn/start、turn/end、tool/call、以及被跳过的空 assistant 消息\")\n\n    print(\"\\n===== callId 配对校验：每条 tool 消息都回溯到了对应的 tool/call =====\")\n    tool_msgs = [m for m in first if m[\"role\"] == \"tool\"]\n    all_paired = all(\"_orphan\" not in m for m in tool_msgs)\n    print(f\"  {len(tool_msgs)} 条 tool 结果全部配对成功（无孤儿）: {all_paired}\")"
        }
       ]
      }
     ]
    },
    {
     "name": "8. 相对上一课新增了什么",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "L04 用的是临时粗糙的 `naive_derive`。本课把它升级为正规的 `deriveMessages` 纯函数，\n并明确三条投影规则（空消息跳过、callId 配对、记账事件排除），把\"可回放\"从口号变成可验证的等式。"
      }
     ]
    },
    {
     "name": "9. 简化了什么 vs 真实 DeepSeek Harness",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| 一个 for 循环分类 | `deriveMessages()` 处理 surface 顺序、compaction 替换、附加上下文注入 | 压缩后的 surface 要正确遮蔽旧范围（见 L15） |\n| 空消息简单跳过 | 保留 `usage`、`sourceEventSeqs`（精确列出源 chunk），空内容仍记账 | token 计费、遥测、回放保真都依赖它 |\n| callId 直接配对 | surface 投影 + `surfaceOp`（replace 等）参与折叠 | 压缩摘要就是一条带 `surfaceOp:replace` 的 user/message |\n| 无不变式断言 | 运行时不变式断言\"模型可见必可从日志重建\" | 防止有人偷偷塞未记录的输入进模型 |\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `derive_messages()` | `deriveMessages()`（`core/session`，见 session-projection.md） |\n| \"空消息跳过\" | 空内容不进派生历史，但 `assistant/message` 事件保留 usage |\n| \"模型可见即已记录\" | session.md 的核心不变式 |\n\n---\n[← 上一课 L04](../L04_session_log/README.zh.md) · [返回总览](../../README.md) · [下一课 L06 →](../L06_turn_step/README.zh.md)"
      }
     ]
    }
   ],
   "code": "\"\"\"L05 deriveMessages：日志是事实，消息是投影\n=============================================\nMotto：模型看到的是投影，不是存储；模型可见即已记录。\n\nL04 用了一个粗糙的 naive_derive。这一课把它升级成正规的 deriveMessages：\n一个**纯函数**，把事件日志\"折叠\"成模型请求要的消息列表。\n\n核心洞察（dsh 最有辨识度的设计）：\n  - 消息历史从不单独存储，永远从日志派生。\n  - \"模型可见即已记录\"——任何进入模型请求的东西，都必须能从日志重建。\n    因此想给模型加一种新输入，就得先加一种新事件类型（而不是塞个临时变量）。\n\n本课演示三件事投影能优雅处理的事：\n  1) 空 assistant 文本不进历史（但事件仍在日志里，保留 usage/回放）。\n  2) tool/call 和 tool/result 按 callId 配对成模型要的格式。\n  3) 同一份日志，投影永远确定——这就是 fork / resume / 回放的基础。\n\n运行：  python lessons/L05_derive_messages/main.py\n\"\"\"\n\nfrom __future__ import annotations\n\nimport os\nimport sys\nfrom dataclasses import dataclass\nfrom typing import Any\n\nsys.path.insert(0, os.path.join(os.path.dirname(__file__), \"..\", \"..\"))\n\n\n@dataclass(frozen=True)\nclass SessionEvent:\n    seq: int\n    type: str\n    data: dict[str, Any]\n\n\nclass Session:\n    def __init__(self):\n        self._events: list[SessionEvent] = []\n\n    def append(self, type: str, data: dict[str, Any]) -> SessionEvent:\n        ev = SessionEvent(len(self._events), type, data)\n        self._events.append(ev)\n        return ev\n\n    def events(self):\n        return list(self._events)\n\n\n# ==========================================================================\n# deriveMessages：纯函数，把事件日志投影成模型消息历史。\n# 输入：事件列表。输出：messages。无副作用、可重复、结果确定。\n# ==========================================================================\ndef derive_messages(events: list[SessionEvent]) -> list[dict]:\n    # 先收集所有 tool/call 的 callId，供 tool/result 配对校验。\n    # \"配对\"= 每条 tool/result 都能回溯到一条同 callId 的 tool/call；\n    # 否则它是孤儿结果（真实 dsh 的不变式不允许，这里显式标出以名副其实）。\n    known_call_ids = {ev.data[\"callId\"] for ev in events if ev.type == \"tool/call\"}\n\n    messages: list[dict] = []\n    for ev in events:\n        if ev.type == \"user/message\":\n            messages.append({\"role\": \"user\", \"content\": ev.data[\"content\"]})\n\n        elif ev.type == \"assistant/message\":\n            text = ev.data.get(\"text\", \"\")\n            calls = ev.data.get(\"tool_calls\", [])\n            # 规则 1：空内容且无工具调用 → 不进派生历史（事件仍在日志，保留 usage/回放）\n            if not text and not calls:\n                continue\n            msg: dict = {\"role\": \"assistant\", \"content\": text}\n            if calls:\n                msg[\"tool_calls\"] = calls\n            messages.append(msg)\n\n        elif ev.type == \"tool/result\":\n            # 规则 2：按 callId 配对——校验它确实对应某条 tool/call，再挂成 tool 消息。\n            call_id = ev.data[\"callId\"]\n            paired = call_id in known_call_ids\n            messages.append({\n                \"role\": \"tool\",\n                \"tool_call_id\": call_id,\n                \"content\": ev.data[\"result\"],\n                # 教学用标记：真实 dsh 中孤儿结果会在 append/投影处被不变式拒绝。\n                **({} if paired else {\"_orphan\": True}),\n            })\n\n        # turn/start、turn/end、assistant/chunk 等是\"记账/回放\"事件，不进派生历史。\n    return messages\n\n\ndef demo():\n    s = Session()\n    # 手工构造一段真实会话会产生的事件序列（含一条空 assistant 消息）\n    s.append(\"turn/start\", {\"turn\": 0})\n    s.append(\"user/message\", {\"content\": \"看看环境\", \"source\": \"human\"})\n    s.append(\"assistant/message\", {\"text\": \"我调一下工具\", \"tool_calls\": [{\"id\": \"c1\", \"name\": \"shell\"}]})\n    s.append(\"tool/call\", {\"callId\": \"c1\", \"name\": \"shell\", \"arguments\": {\"command\": \"echo hi\"}})\n    s.append(\"tool/result\", {\"callId\": \"c1\", \"result\": \"hi\"})\n    s.append(\"assistant/message\", {\"text\": \"\", \"tool_calls\": []})  # ← 空消息：max-tokens 之类\n    s.append(\"assistant/message\", {\"text\": \"环境正常，任务完成。\"})\n    s.append(\"turn/end\", {\"turn\": 0, \"reason\": \"natural-stop\"})\n\n    print(\"===== 原始事件日志（8 条，含记账事件与一条空消息）=====\")\n    for ev in s.events():\n        print(f\"  #{ev.seq} {ev.type}\")\n\n    print(\"\\n===== deriveMessages 投影出的模型历史 =====\")\n    for m in derive_messages(s.events()):\n        print(f\"  {m}\")\n\n    print(\"\\n===== 关键：同一日志再投影一次，结果完全一致（可回放）=====\")\n    first = derive_messages(s.events())\n    second = derive_messages(s.events())\n    print(f\"  两次投影相等: {first == second}\")\n    print(f\"  投影出 {len(first)} 条消息，但日志有 {len(s.events())} 条事件\")\n    print(\"  → 差额来自：turn/start、turn/end、tool/call、以及被跳过的空 assistant 消息\")\n\n    print(\"\\n===== callId 配对校验：每条 tool 消息都回溯到了对应的 tool/call =====\")\n    tool_msgs = [m for m in first if m[\"role\"] == \"tool\"]\n    all_paired = all(\"_orphan\" not in m for m in tool_msgs)\n    print(f\"  {len(tool_msgs)} 条 tool 结果全部配对成功（无孤儿）: {all_paired}\")\n\n\nif __name__ == \"__main__\":\n    demo()\n",
   "locPct": 59
  },
  {
   "id": "L06",
   "dir": "L06_turn_step",
   "num": "06",
   "title": "Turn 与 Step 的轮次生命周期",
   "fullTitle": "L06 Turn 与 Step 的轮次生命周期",
   "subtitle": "turn/step 驱动器",
   "motto": "step = 一次请求 + 其工具；turn = 零或多个 step，跑完才关。",
   "layer": "turn",
   "loc": 147,
   "hasCode": true,
   "sections": [
    {
     "name": "1. 30 秒运行",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "运行前先猜：第一个 shell 已经成功返回时，为什么 `turn` 还不能结束？如果把\n`tools_owed=True` 错写成 `False`，最终答复会缺少什么？\n\n```powershell\npython lessons/L06_turn_step/main.py\n```\n\n预期输出（节选）：\n\n```text\n╔══ turn/start turn=0 ══\n║  ┌─ step/start step=0\n║  │  [assistant] 第一步：调工具。\n║  │  [tool] shell → 'step\\none'\n║  └─ step/end（工具已跑，仍欠一次请求 → 再开一 step）\n║  ┌─ step/start step=1\n║  │  ...\n║  ┌─ step/start step=2\n║  │  [assistant] 第三步：够了，收尾。\n║  └─ step/end（自然停止，本 turn 不再欠账）\n╚══ turn/end turn=0 ══\n[统计] 这个 turn 里跑了 3 个 step\n```"
      }
     ]
    },
    {
     "name": "2. 观察输出",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "一个 turn 里嵌了**三个 step**。前两个 step 因为\"调了工具、还欠模型一次请求\"\n而继续，第三个 step 模型不再调工具（自然停止），turn 才关闭。这就是\nturn 与 step 的嵌套关系。"
      }
     ]
    },
    {
     "name": "3. 为什么需要这一层",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "L04/L05 里我们已经在追加 `turn/start`、`step/start` 了，但那只是记账，\n没人真正解释\"一个 turn 什么时候该继续、什么时候该关\"。\n\n**turn/step 是 agent loop 的节奏器。** 它回答一个核心问题：模型调完工具后，\n要不要再问它一次？答案是\"要\"（得把工具结果给它看）。所以一个 turn 会自然地\n展开成多个 step，直到模型说\"够了\"或没有新输入。"
      }
     ]
    },
    {
     "name": "4. 心智模型",
     "blocks": [
      {
       "type": "structure",
       "id": "turn-step-structure",
       "title": "一个 turn 包含零到多个 step",
       "nodes": [
        {
         "title": "Turn：一整轮对话交锋",
         "detail": "从用户开口开始，到 agent 彻底停下为止。",
         "children": [
          {
           "title": "Step 0",
           "detail": "模型调用 shell，工具结果让系统还欠一次模型请求。",
           "children": []
          },
          {
           "title": "Step 1",
           "detail": "模型再次调用 shell，仍需继续。",
           "children": []
          },
          {
           "title": "Step 2",
           "detail": "模型给出收尾文本，不再欠请求，turn 才能关闭。",
           "children": []
          }
         ]
        }
       ]
      }
     ]
    },
    {
     "name": "5. 方案与图",
     "blocks": [
      {
       "type": "flow",
       "id": "turn-step-loop",
       "title": "Turn / Step 驱动循环",
       "nodes": [
        {
         "id": "turn",
         "title": "开启 turn",
         "detail": "追加 `turn/start` 与 `user/message`",
         "edges": [
          {
           "target": "step",
           "label": ""
          }
         ]
        },
        {
         "id": "step",
         "title": "开启 step",
         "detail": "追加 `step/start`，从日志派生 messages 并请求模型",
         "edges": [
          {
           "target": "decide",
           "label": ""
          }
         ]
        },
        {
         "id": "decide",
         "title": "检查工具调用",
         "detail": "assistant 有工具调用就执行；没有则自然停止",
         "edges": [
          {
           "target": "tools",
           "label": "有调用"
          },
          {
           "target": "close",
           "label": "无调用"
          }
         ]
        },
        {
         "id": "tools",
         "title": "执行工具",
         "detail": "追加 tool/call、tool/result 和 step/end；仍欠一次请求",
         "edges": [
          {
           "target": "step",
           "label": "进入下一 step"
          }
         ]
        },
        {
         "id": "close",
         "title": "关闭 turn",
         "detail": "追加 step/end 与 turn/end",
         "edges": []
        }
       ]
      },
      {
       "type": "markdown",
       "markdown": "### 执行透视：谁决定再开一个 step"
      },
      {
       "type": "trace",
       "id": "l06-runtime-xray",
       "title": "一个 turn 为什么自然展开成三个 step",
       "panels": [
        "事件日志",
        "模型视图",
        "继续条件"
       ],
       "steps": [
        {
         "title": "开启 turn",
         "location": "`run_turn()`",
         "action": "认领输入，追加 turn/start 和 user/message。",
         "states": [
          "`turn/start; user/message`",
          "`[user]`",
          "`tools_owed=True`，至少跑一个 step。"
         ]
        },
        {
         "title": "Step 0 请求",
         "location": "`llm.complete(...)`",
         "action": "模型返回第一次 shell 调用。",
         "states": [
          "`… step/start(0); assistant`",
          "`[user, assistant]`",
          "有 tool call，执行工具。"
         ]
        },
        {
         "title": "Step 0 结束",
         "location": "`session.append(\"step/end\")`",
         "action": "结果已入日志，但模型尚未读到。",
         "states": [
          "`… tool/call; tool/result; step/end(0)`",
          "`[user, assistant, tool]`",
          "`tools_owed=True`，结果欠一次模型请求。"
         ]
        },
        {
         "title": "Step 1 请求",
         "location": "`while tools_owed`",
         "action": "新 step 读取包含第一次结果的完整投影，又返回一次调用。",
         "states": [
          "`… step/start(1); assistant`",
          "`[user, assistant, tool, assistant]`",
          "再次有 tool call。"
         ]
        },
        {
         "title": "Step 1 结束",
         "location": "`tools_owed = True`",
         "action": "第二个工具结果写回，仍不能直接结束 turn。",
         "states": [
          "`… tool/result; step/end(1)`",
          "`[…, tool(c2)]`",
          "第二个结果也欠一次模型请求。"
         ]
        },
        {
         "title": "Step 2 请求",
         "location": "`if not turn.wants_tools`",
         "action": "模型读到两个结果，只返回收尾文本。",
         "states": [
          "`… step/start(2); assistant`",
          "`[…, assistant final]`",
          "无 tool call，设置 `tools_owed=False`。"
         ]
        },
        {
         "title": "关闭 turn",
         "location": "`session.append(\"turn/end\")`",
         "action": "step/end 与 turn/end 记录自然停止。",
         "states": [
          "`… step/end(2); turn/end`",
          "完整对话投影",
          "不再欠请求，本 turn 关闭。"
         ]
        },
        {
         "title": "第二个 turn",
         "location": "`driver.run_turn(...)`",
         "action": "新 turn 继续使用同一会话，但局部 step 重新从 0 开始。",
         "states": [
          "`turn/start(1); step/start(0)`",
          "包含前一 turn 的历史",
          "验证 step 是 turn 内局部编号。"
         ]
        }
       ]
      }
     ]
    },
    {
     "name": "6. 代码拆解",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "`Driver.run_turn()`：\n\n- turn 开始：`turn/start` + `user/message`，`tools_owed=True`（至少跑一个 step）。\n- `while tools_owed`：每轮就是一个 step。`step/start` → 调模型 → `assistant/message`。\n- 无工具 → `tools_owed=False`，记 `step/end`，跳出。\n- 有工具 → 执行、记 `tool/call`+`tool/result`，`tools_owed=True`，继续。\n- 收尾：`turn/end`，reason 记 `natural-stop` 或 `max-steps`。\n\n### 动手破坏一次\n\n在工具执行完成后把 `tools_owed` 改成 `False`。循环会提前关闭，模型从未看到工具结果，\n也就无法生成基于观察的最终答复。这验证了驱动器的核心不变量：**产生工具结果的 step，\n必然还欠后续一次模型请求。**"
      }
     ]
    },
    {
     "name": "7. 代码解读：Driver 如何把“欠一次请求”变成循环",
     "blocks": [
      {
       "type": "code-walkthrough",
       "id": "l06-code-reading",
       "title": "turn/step 生命周期的控制变量",
       "source": "main.py",
       "language": "python",
       "segments": [
        {
         "title": "turn 认领输入并初始化局部状态",
         "start": 75,
         "end": 88,
         "reading": "`turn_no` 跨 turn 增长，而 `step=-1` 在每次 `run_turn` 内重建；输入与 turn/start 先进入日志。",
         "reason": "turn 是会话级顺序，step 只在当前 turn 内有意义。把 step 放到实例字段会让编号跨 turn 泄漏。",
         "code": "    def run_turn(self, user_input: str, max_steps: int = 8) -> str:\n        # ---- turn 开始：认领输入 ----\n        self.turn_no += 1\n        self.session.append(\"turn/start\", {\"turn\": self.turn_no})\n        self.session.append(\"user/message\", {\"content\": user_input, \"source\": \"human\"})\n        print(f\"\\n╔══ turn/start turn={self.turn_no} ══\")\n\n        final_text = \"\"\n        tools_owed = True  # 至少要跑一个 step\n        step = -1          # ★ step 是 turn 内局部计数，每个 turn 从 0 开始\n\n        while tools_owed and step + 1 < max_steps:\n            # ---- 一个 step ----\n            step += 1"
        },
        {
         "title": "每个 step 只包含一次模型请求",
         "start": 90,
         "end": 103,
         "reading": "while 开一轮就追加一个 step/start，随后从完整日志派生 messages，调用模型并记录 assistant。",
         "reason": "“一次请求 + 其工具”是可回放和计费的最小节奏单位；工具再多也不能偷偷产生第二次模型请求。",
         "code": "            print(f\"║  ┌─ step/start step={step}\")\n\n            turn: AssistantTurn = self.llm.complete(derive_messages(self.session.events()))\n            self.session.append(\"assistant/message\", {\"text\": turn.text, \"tool_calls\": [tc.id for tc in turn.tool_calls]})\n            if turn.text:\n                print(f\"║  │  [assistant] {turn.text}\")\n\n            if not turn.wants_tools:\n                # 自然停止：这个 step 不欠请求了\n                tools_owed = False\n                final_text = turn.text\n                self.session.append(\"step/end\", {\"turn\": self.turn_no, \"step\": step})\n                print(f\"║  └─ step/end（自然停止，本 turn 不再欠账）\")\n                break"
        },
        {
         "title": "无工具才消除欠账",
         "start": 104,
         "end": 111,
         "reading": "`not turn.wants_tools` 时设置 `tools_owed=False`、保存 final_text、结束 step 并 break。",
         "reason": "文本不是停止信号，结构化工具调用才是。只有没有待执行动作时，本 turn 才不欠下一次观察后的决策。",
         "code": "\n            # 有工具：执行它们，执行完\"还欠一次请求\"（要把结果给模型看）\n            for tc in turn.tool_calls:\n                self.session.append(\"tool/call\", {\"callId\": tc.id, \"name\": tc.name, \"arguments\": tc.arguments})\n                result = run_shell(tc.arguments.get(\"command\", \"\")) if tc.name == \"shell\" else f\"[未知] {tc.name}\"\n                self.session.append(\"tool/result\", {\"callId\": tc.id, \"result\": result})\n                print(f\"║  │  [tool] {tc.name} → {result!r}\")\n            self.session.append(\"step/end\", {\"turn\": self.turn_no, \"step\": step})"
        },
        {
         "title": "工具结果制造下一次请求",
         "start": 113,
         "end": 117,
         "reading": "调用与结果写入后关闭当前 step，并保持 `tools_owed=True`。",
         "reason": "结果虽然已产生，但模型尚未读到；继续循环不是重试，而是把新观察交给模型的正常下一步。",
         "code": "            tools_owed = True\n\n        self.session.append(\"turn/end\", {\"turn\": self.turn_no, \"reason\": \"natural-stop\" if not tools_owed else \"max-steps\"})\n        print(f\"╚══ turn/end turn={self.turn_no}，本 turn 跑了 {step + 1} 个 step ══\")\n        return final_text"
        },
        {
         "title": "turn/end 记录真正终止原因",
         "start": 114,
         "end": 117,
         "reading": "循环外根据欠账状态写 `natural-stop` 或 `max-steps`。",
         "reason": "同样是停止，模型自然完成与宿主强制截断语义不同；恢复、UI 和遥测需要区分二者。",
         "code": "\n        self.session.append(\"turn/end\", {\"turn\": self.turn_no, \"reason\": \"natural-stop\" if not tools_owed else \"max-steps\"})\n        print(f\"╚══ turn/end turn={self.turn_no}，本 turn 跑了 {step + 1} 个 step ══\")\n        return final_text"
        },
        {
         "title": "第二个 turn 验证作用域",
         "start": 136,
         "end": 147,
         "reading": "同一 Driver 再跑一次，脚本只返回文本，并检查 step 从 0 重置。",
         "reason": "通过连续运行而非静态注释证明局部计数不变量，防止单 turn 测试掩盖状态泄漏。",
         "code": "\nif __name__ == \"__main__\":\n    session = Session()\n    driver = Driver(session, make_llm(script=build_script()))\n\n    final = driver.run_turn(\"跑一个多 step 的 turn\")\n    print(f\"[最终答复] {final}\")\n\n    # ★ 连续跑第二个 turn：step 编号应从 0 重新开始（验证 step 不跨 turn 累加）\n    final2 = driver.run_turn(\"再跑一个 turn，验证 step 从 0 重置\")\n    print(f\"[最终答复] {final2}\")\n    print(\"\\n[验证] 第二个 turn 的 step/start 应是 step=0，而不是接着第一个 turn 往上涨。\")"
        }
       ]
      }
     ]
    },
    {
     "name": "8. 相对上一课新增了什么",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "L04/L05 把 turn/step 当记账事件写进日志。本课把它们变成**驱动循环的正规语义**：\n用 `tools_owed` 判定 turn 何时继续、何时关闭，让\"一个 turn 含多个 step\"真正跑起来。"
      }
     ]
    },
    {
     "name": "9. 简化了什么 vs 真实 DeepSeek Harness",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| 单条输入直入 | 一个 **inbox** 队列，认领 next-step 输入 + 一条排队消息 | 注入的上下文要排队等待，直到有消息唤醒 driver |\n| `tools_owed` 布尔 | 完整的 turn 流：`agent/pre-step` → `step/start` → `agent/request` → `llm/stream` → tools → `agent/turn-stopping` | 每个阶段都是可拦截的扩展点 |\n| 无终止检查点 | `agent/turn-stopping` 是 serial 终止检查点（见 L19） | goal 续跑、预算控制在这里决定要不要真停 |\n| 无取消/错误恢复 | 取消信号、`agent/request-error` 恢复分支 | 长任务要能中断、瞬时错误要能重试（见 L08） |\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `Driver.run_turn` | `ctx.agentLoop` 的 turn 驱动（`core/agent-loop`） |\n| `tools_owed` | \"工具欠一次请求\"的继续判定 |\n| `turn/start`,`step/start`,... | 同名 SessionEvent（durable） |\n\n---\n[← 上一课 L05](../L05_derive_messages/README.zh.md) · [返回总览](../../README.md) · [下一课 L07 →](../L07_pre_step/README.zh.md)"
      }
     ]
    }
   ],
   "code": "\"\"\"L06 Turn 与 Step 的轮次生命周期\n===================================\nMotto：step = 一次请求 + 其工具；turn = 零或多个 step，跑完才关。\n\nL04/L05 已经在日志里追加 turn/start、turn/end、step 了，但那只是\"记账\"。\n这一课把 Turn/Step 的**语义**讲清楚，并把它做成一个正规的驱动器（driver）：\n\n  turn（一轮）  = 一次\"排空输入\"的过程，开始于认领输入，结束于\"再没有欠账\"。\n  step（一步）  = 一次模型请求 + 它触发的所有工具调用。\n  一个 turn 里可以有 0 个 step（比如输入被 pre-step 拒了）或多个 step\n  （模型调了工具、还欠一次请求，就再开一 step）。\n\n关键判定：一个 step 结束后，\"工具还欠一次请求\"或\"有新输入到达\" → 再开一 step；\n否则这个 turn 就关闭。\n\n运行：  python lessons/L06_turn_step/main.py\n\"\"\"\n\nfrom __future__ import annotations\n\nimport os\nimport sys\nfrom dataclasses import dataclass\nfrom typing import Any\n\nsys.path.insert(0, os.path.join(os.path.dirname(__file__), \"..\", \"..\"))\n\nfrom shared.llm import AssistantTurn, ToolCall, make_llm  # noqa: E402\nfrom shared.shell import run_shell  # noqa: E402\n\n\n@dataclass(frozen=True)\nclass SessionEvent:\n    seq: int\n    type: str\n    data: dict[str, Any]\n\n\nclass Session:\n    def __init__(self):\n        self._events: list[SessionEvent] = []\n\n    def append(self, type, data):\n        ev = SessionEvent(len(self._events), type, data)\n        self._events.append(ev)\n        return ev\n\n    def events(self):\n        return list(self._events)\n\n\ndef derive_messages(events):\n    msgs = []\n    for ev in events:\n        if ev.type == \"user/message\":\n            msgs.append({\"role\": \"user\", \"content\": ev.data[\"content\"]})\n        elif ev.type == \"assistant/message\" and (ev.data.get(\"text\") or ev.data.get(\"tool_calls\")):\n            msgs.append({\"role\": \"assistant\", \"content\": ev.data.get(\"text\", \"\")})\n        elif ev.type == \"tool/result\":\n            msgs.append({\"role\": \"tool\", \"content\": ev.data[\"result\"]})\n    return msgs\n\n\n# ==========================================================================\n# Driver：正规的 turn/step 循环。\n# ==========================================================================\nclass Driver:\n    def __init__(self, session: Session, llm):\n        self.session = session\n        self.llm = llm\n        self.turn_no = -1\n        # 注意：这里没有 step_no 字段——step 是 turn 内局部计数（见 run_turn），\n        # 不能跨 turn 累加，否则第二个 turn 的 step 号会接着第一个 turn 往上涨。\n\n    def run_turn(self, user_input: str, max_steps: int = 8) -> str:\n        # ---- turn 开始：认领输入 ----\n        self.turn_no += 1\n        self.session.append(\"turn/start\", {\"turn\": self.turn_no})\n        self.session.append(\"user/message\", {\"content\": user_input, \"source\": \"human\"})\n        print(f\"\\n╔══ turn/start turn={self.turn_no} ══\")\n\n        final_text = \"\"\n        tools_owed = True  # 至少要跑一个 step\n        step = -1          # ★ step 是 turn 内局部计数，每个 turn 从 0 开始\n\n        while tools_owed and step + 1 < max_steps:\n            # ---- 一个 step ----\n            step += 1\n            self.session.append(\"step/start\", {\"turn\": self.turn_no, \"step\": step})\n            print(f\"║  ┌─ step/start step={step}\")\n\n            turn: AssistantTurn = self.llm.complete(derive_messages(self.session.events()))\n            self.session.append(\"assistant/message\", {\"text\": turn.text, \"tool_calls\": [tc.id for tc in turn.tool_calls]})\n            if turn.text:\n                print(f\"║  │  [assistant] {turn.text}\")\n\n            if not turn.wants_tools:\n                # 自然停止：这个 step 不欠请求了\n                tools_owed = False\n                final_text = turn.text\n                self.session.append(\"step/end\", {\"turn\": self.turn_no, \"step\": step})\n                print(f\"║  └─ step/end（自然停止，本 turn 不再欠账）\")\n                break\n\n            # 有工具：执行它们，执行完\"还欠一次请求\"（要把结果给模型看）\n            for tc in turn.tool_calls:\n                self.session.append(\"tool/call\", {\"callId\": tc.id, \"name\": tc.name, \"arguments\": tc.arguments})\n                result = run_shell(tc.arguments.get(\"command\", \"\")) if tc.name == \"shell\" else f\"[未知] {tc.name}\"\n                self.session.append(\"tool/result\", {\"callId\": tc.id, \"result\": result})\n                print(f\"║  │  [tool] {tc.name} → {result!r}\")\n            self.session.append(\"step/end\", {\"turn\": self.turn_no, \"step\": step})\n            print(f\"║  └─ step/end（工具已跑，仍欠一次请求 → 再开一 step）\")\n            tools_owed = True\n\n        self.session.append(\"turn/end\", {\"turn\": self.turn_no, \"reason\": \"natural-stop\" if not tools_owed else \"max-steps\"})\n        print(f\"╚══ turn/end turn={self.turn_no}，本 turn 跑了 {step + 1} 个 step ══\")\n        return final_text\n\n\ndef build_script():\n    def s1(_m):\n        return AssistantTurn(text=\"第一步：调工具。\", tool_calls=[ToolCall(\"c1\", \"shell\", {\"command\": \"echo step one\"})])\n\n    def s2(_m):\n        return AssistantTurn(text=\"第二步：再调一次。\", tool_calls=[ToolCall(\"c2\", \"shell\", {\"command\": \"echo step two\"})])\n\n    def s3(_m):\n        return AssistantTurn(text=\"第三步：够了，收尾。\")\n\n    # 第二个 turn 的脚本：只跑一个 step 就收尾\n    def t2s1(_m):\n        return AssistantTurn(text=\"第二个 turn：一步搞定。\")\n\n    return [s1, s2, s3, t2s1]\n\n\nif __name__ == \"__main__\":\n    session = Session()\n    driver = Driver(session, make_llm(script=build_script()))\n\n    final = driver.run_turn(\"跑一个多 step 的 turn\")\n    print(f\"[最终答复] {final}\")\n\n    # ★ 连续跑第二个 turn：step 编号应从 0 重新开始（验证 step 不跨 turn 累加）\n    final2 = driver.run_turn(\"再跑一个 turn，验证 step 从 0 重置\")\n    print(f\"[最终答复] {final2}\")\n    print(\"\\n[验证] 第二个 turn 的 step/start 应是 step=0，而不是接着第一个 turn 往上涨。\")\n",
   "locPct": 68
  },
  {
   "id": "L07",
   "dir": "L07_pre_step",
   "num": "07",
   "title": "pre-step 拦截：让插件决定模型看什么",
   "fullTitle": "L07 pre-step 拦截：让插件决定模型看什么",
   "subtitle": "agent/pre-step waterfall",
   "motto": "用 waterfall 在请求前改写或拒绝要进模型的消息。",
   "layer": "turn",
   "loc": 137,
   "hasCode": true,
   "sections": [
    {
     "name": "1. 30 秒运行",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "运行前先猜：空输入被拒绝时，日志里应该完全没有痕迹，还是应该留下一个 0-step turn？\n注入器改写后的文本，应记录原文还是模型真正看到的版本？\n\n```powershell\npython lessons/L07_pre_step/main.py\n```\n\n预期输出（节选）：\n\n```text\n### 场景 1：正常输入（会被注入器改写，然后跑一个 step）\n╔══ turn/start turn=0（输入='看看环境'）\n  [pre-step:注入器] 给 1 条输入追加上下文提醒\n  [pre-step:守卫] 输入非空 → 委派\n║  [assistant] 我收到的输入是：'看看环境（提醒：优先用 shell 工具）'\n╚══ turn/end\n\n### 场景 2：空输入（被守卫拒绝，turn 关闭但不花 step）\n  [pre-step:守卫] 空输入 → 拒绝（短路，不调 next），本 turn 不花 step\n\n===== 日志证明：场景 2 也留下了 turn/start + turn/end =====\n  #6 turn/start\n  #7 turn/end rejected-no-step\n```"
      }
     ]
    },
    {
     "name": "2. 观察输出",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "场景 1 里，模型看到的输入被**注入器改写**了（多了一段提醒）。场景 2 里，空输入被\n**守卫短路拒绝**，这个 turn 没花任何 step——但日志里仍留下了 `turn/start`+`turn/end`，\n记录了\"曾经尝试过\"。"
      }
     ]
    },
    {
     "name": "3. 为什么需要这一层",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "L06 的 driver 直接把输入喂给模型。但很多需求要在\"进模型之前\"动手脚：注入项目上下文、\n脱敏、加系统提醒、检测上下文是否该压缩、甚至直接拒绝某些输入。\n\n如果把这些都写进 driver，driver 会变成一个巨型 if 堆。**dsh 的做法是开一个\n`agent/pre-step` waterfall（回顾 L03）**：谁想拦截就挂个监听者，driver 本身不认识它们。\n压缩（L15）就是挂在这里做上下文压力检测的。"
      }
     ]
    },
    {
     "name": "4. 心智模型",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "pre-step 是模型的**门卫 + 化妆师**："
      },
      {
       "type": "stepper",
       "id": "pre-step-gate",
       "title": "模型门前的补妆与查验",
       "steps": [
        {
         "title": "认领输入",
         "detail": "Driver 从 inbox 取出下一条待处理消息。"
        },
        {
         "title": "注入器补妆",
         "detail": "为 messages 加入提醒或上下文，也可以改写已有内容。"
        },
        {
         "title": "守卫查证件",
         "detail": "检查输入是否为空、违规或不应继续。"
        },
        {
         "title": "形成决定",
         "detail": "放行就进入模型；拒绝则关闭 turn，且不消耗 step。"
        }
       ]
      }
     ]
    },
    {
     "name": "5. 方案与图",
     "blocks": [
      {
       "type": "flow",
       "id": "pre-step-flow",
       "title": "pre-step 的放行与短路",
       "nodes": [
        {
         "id": "claim",
         "title": "认领输入",
         "detail": "取得 claimed messages",
         "edges": [
          {
           "target": "inject",
           "label": ""
          }
         ]
        },
        {
         "id": "inject",
         "title": "注入器",
         "detail": "改写 messages 后调用 `next(d')`",
         "edges": [
          {
           "target": "guard",
           "label": ""
          }
         ]
        },
        {
         "id": "guard",
         "title": "空输入守卫",
         "detail": "检查是否仍有合法消息",
         "edges": [
          {
           "target": "reject",
           "label": "为空或违规"
          },
          {
           "target": "step",
           "label": "合法"
          }
         ]
        },
        {
         "id": "reject",
         "title": "拒绝且记账",
         "detail": "追加 rejected-no-step 的 turn/end，不产生 step",
         "edges": []
        },
        {
         "id": "step",
         "title": "正常执行",
         "detail": "把最终 decision 交给模型请求流程",
         "edges": []
        }
       ]
      },
      {
       "type": "markdown",
       "markdown": "### 执行透视：pre-step 的权威对象是 decision"
      },
      {
       "type": "trace",
       "id": "l07-runtime-xray",
       "title": "正常输入与空输入在 step 前分岔",
       "panels": [
        "decision.messages",
        "Session 日志",
        "Step 预算"
       ],
       "steps": [
        {
         "title": "开启 turn",
         "location": "`run_turn()`",
         "action": "无论输入是否为空，先记录尝试。",
         "states": [
          "`claimed=[user]` 或 `[]`",
          "`turn/start`",
          "尚未消耗。"
         ]
        },
        {
         "title": "注入提醒",
         "location": "`injector()`",
         "action": "正常 user 被复制并追加 shell 提醒。",
         "states": [
          "`[user+reminder]`",
          "仍只有 turn/start。",
          "未开 step。"
         ]
        },
        {
         "title": "守卫放行",
         "location": "`empty_guard()`",
         "action": "非空 decision 调用 next。",
         "states": [
          "`[user+reminder]`",
          "不变。",
          "即将消耗 1 step。"
         ]
        },
        {
         "title": "正常落盘",
         "location": "`session.append(user/message)`",
         "action": "改写后的最终版本写日志并交给模型。",
         "states": [
          "与模型请求完全相同。",
          "`step/start; user; assistant; step/end`",
          "已用 1 step。"
         ]
        },
        {
         "title": "空输入短路",
         "location": "`return rejected=True`",
         "action": "guard 不调用 next。",
         "states": [
          "`[]` 且 rejected。",
          "第二个 `turn/start`。",
          "仍为 0。"
         ]
        },
        {
         "title": "关闭 0-step turn",
         "location": "`reason=rejected-no-step`",
         "action": "尝试留痕，但从未请求模型。",
         "states": [
          "空。",
          "`turn/start; turn/end`",
          "0 step。"
         ]
        }
       ]
      }
     ]
    },
    {
     "name": "6. 代码拆解",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "- `injector(decision, next_)`：给每条 user 消息 `content` 追加提醒，然后 `next_(改写后)`。\n- `empty_guard(decision, next_)`：`messages` 为空就返回 `{rejected:True}` 且**不调 next_**（短路）；否则委派。\n- `Driver.run_turn()`：认领输入 → 跑 pre-step waterfall → 若被拒/空，只写 `turn/start`+`turn/end`；否则正常跑 step。\n\n关键点：**被拒的 turn 也是一个 durable turn**，日志记录了这次尝试（reason=`rejected-no-step`）。\n\n### 动手破坏一次\n\n把 user/message 的写入移动到 pre-step 之前。注入器改写后，模型看到的文本与日志记录会不一致，\n回放无法重建当时请求。这验证：**模型可见的改写必须先完成，再写入唯一真源。**"
      }
     ]
    },
    {
     "name": "7. 代码解读：拦截点如何位于日志写入与模型请求之前",
     "blocks": [
      {
       "type": "code-walkthrough",
       "id": "l07-code-reading",
       "title": "一次 pre-step decision 的生命周期",
       "source": "main.py",
       "language": "python",
       "segments": [
        {
         "title": "waterfall 只提供委派机制",
         "start": 52,
         "end": 57,
         "reading": "递归 dispatch 把当前 decision 和 next 交给监听者；链尾原样返回最终值。",
         "reason": "分发器不理解 messages 或 rejected，策略语义由插件决定，机制才能被压缩、权限和注入共同复用。",
         "code": "def waterfall(listeners: list[Callable], value: Any) -> Any:\n    def dispatch(i, v):\n        if i >= len(listeners):\n            return v\n        return listeners[i](v, lambda nv=None: dispatch(i + 1, nv if nv is not None else v))\n    return dispatch(0, value)"
        },
        {
         "title": "注入器复制而非原地污染",
         "start": 64,
         "end": 70,
         "reading": "injector 为 user 构造新 dict 和新列表，再把替换后的 decision 交给 next。",
         "reason": "复制使每层改写边界清楚；共享对象原地修改会让短路前后的状态难以推理。",
         "code": "def injector(decision, next_):\n    \"\"\"注入器：给每条 user 消息补一段上下文提醒。\"\"\"\n    msgs = decision[\"messages\"]\n    if msgs:\n        print(f\"  [pre-step:注入器] 给 {len(msgs)} 条输入追加上下文提醒\")\n        msgs = [{**m, \"content\": m[\"content\"] + \"（提醒：优先用 shell 工具）\"} if m[\"role\"] == \"user\" else m for m in msgs]\n    return next_({**decision, \"messages\": msgs})"
        },
        {
         "title": "守卫用“不委派”表达拒绝",
         "start": 73,
         "end": 79,
         "reading": "空 messages 直接返回 rejected decision，非空才调用 next。",
         "reason": "拒绝发生在副作用前，才能保证不创建 step、不花模型调用，也不需要事后撤销。",
         "code": "def empty_guard(decision, next_):\n    \"\"\"守卫：空输入直接拒绝，短路。\"\"\"\n    if not decision[\"messages\"]:\n        print(\"  [pre-step:守卫] 空输入 → 拒绝（短路，不调 next），本 turn 不花 step\")\n        return {\"messages\": [], \"rejected\": True}\n    print(\"  [pre-step:守卫] 输入非空 → 委派\")\n    return next_(decision)"
        },
        {
         "title": "Driver 先形成 decision 再落日志",
         "start": 89,
         "end": 104,
         "reading": "turn/start 先记尝试，claimed 输入经过 waterfall；拒绝分支只追加 turn/end。",
         "reason": "审计保留“尝试过”，同时不会把被拒内容伪装成模型已见 user/message。",
         "code": "    def run_turn(self, user_input: str | None) -> str:\n        self.turn_no += 1\n        self.session.append(\"turn/start\", {\"turn\": self.turn_no})\n        print(f\"\\n╔══ turn/start turn={self.turn_no}（输入={user_input!r}）\")\n\n        claimed = [{\"role\": \"user\", \"content\": user_input}] if user_input else []\n\n        # ---- pre-step waterfall ----\n        decision = waterfall(self.pre_step, {\"messages\": claimed, \"rejected\": False})\n\n        if decision.get(\"rejected\") or not decision[\"messages\"]:\n            # 被拒或空：turn 关闭但没花 step，日志仍记录这次尝试\n            self.session.append(\"turn/end\", {\"turn\": self.turn_no, \"reason\": \"rejected-no-step\"})\n            print(\"╚══ turn/end（无 step）\")\n            return \"[本 turn 未产生 step]\"\n"
        },
        {
         "title": "正常分支记录模型实际所见",
         "start": 106,
         "end": 115,
         "reading": "step/start 后写入 decision.messages，再以同一对象调用模型。",
         "reason": "日志与请求参数来自同一权威 decision，满足“模型可见即已记录”。",
         "code": "        self.session.append(\"step/start\", {\"turn\": self.turn_no, \"step\": 0})\n        for m in decision[\"messages\"]:\n            self.session.append(\"user/message\", {\"content\": m[\"content\"], \"source\": \"human\"})\n        turn: AssistantTurn = self.llm.complete(decision[\"messages\"])\n        self.session.append(\"assistant/message\", {\"text\": turn.text})\n        self.session.append(\"step/end\", {\"turn\": self.turn_no, \"step\": 0})\n        self.session.append(\"turn/end\", {\"turn\": self.turn_no, \"reason\": \"natural-stop\"})\n        print(f\"║  [assistant] {turn.text}\")\n        print(\"╚══ turn/end\")\n        return turn.text"
        }
       ]
      }
     ]
    },
    {
     "name": "8. 相对上一课新增了什么",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "L06 的 driver 无脑把输入送进模型。本课在 step 之前插入 `agent/pre-step` waterfall，\n让插件能改写或拒绝输入，并明确\"被拒的 turn 不花 step 但仍留痕\"。"
      }
     ]
    },
    {
     "name": "9. 简化了什么 vs 真实 DeepSeek Harness",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| 两个内联监听者 | `agent/pre-step` 是权威 waterfall，多插件协作 | 压缩、steering、注入上下文都挂在这里 |\n| 拒绝 = 返回 rejected | 返回的决定是权威的；包裹 `next()` 的监听者默认保留下游消息 | 除非有意替换，否则不能吞掉别人的改写 |\n| 改写 content 字符串 | 改写的是结构化 `Message`，注入是 `agent.inject()` 落到下一次请求 | 注入内容也要成为可记录的 `user/message`（模型可见即已记录） |\n| 无压缩联动 | `dsh-compaction-basic` 用 pre-step 做请求前的上下文压力检测 | 上下文快满时要先压缩再请求（见 L15） |\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `waterfall(pre_step, ...)` | `agent/pre-step` waterfall |\n| `injector` | `agent.inject()` / steering 监听者 |\n| `empty_guard` 短路 | pre-step 的 reject（权威决定） |\n| `rejected-no-step` | \"被拒的 turn 无 step，日志仍记录尝试\" |\n\n---\n[← 上一课 L06](../L06_turn_step/README.zh.md) · [返回总览](../../README.md) · [下一课 L08 →](../L08_llm_seam/README.zh.md)"
      }
     ]
    }
   ],
   "code": "\"\"\"L07 pre-step 拦截：让插件决定模型看什么\n==========================================\nMotto：用 waterfall 在请求前改写或拒绝要进模型的消息。\n\nL06 的 driver 直接把认领到的输入送进模型。但真实 dsh 在每个 step 前，\n都会先跑一个 agent/pre-step 的 **waterfall**（回顾 L03）：监听者可以\n  - 改写要进模型的消息（比如注入上下文、脱敏、加系统提醒），或\n  - 直接拒绝这次输入（返回而不调 next），此时这个 step 不会真正发生。\n\n这就是\"插件决定模型看什么\"的拦截点。压缩（L15）就是挂在这里做上下文压力检测的。\n\n本课在 L06 的 driver 上加一个 pre-step waterfall，并挂两个监听者演示：\n  1) 一个\"注入器\"：给每次输入追加一段上下文提醒。\n  2) 一个\"守卫\"：遇到空输入就拒绝，让这个 turn 不花任何 step。\n\n运行：  python lessons/L07_pre_step/main.py\n\"\"\"\n\nfrom __future__ import annotations\n\nimport os\nimport sys\nfrom dataclasses import dataclass\nfrom typing import Any, Callable\n\nsys.path.insert(0, os.path.join(os.path.dirname(__file__), \"..\", \"..\"))\n\nfrom shared.llm import AssistantTurn, ToolCall, make_llm  # noqa: E402\n\n\n@dataclass(frozen=True)\nclass SessionEvent:\n    seq: int\n    type: str\n    data: dict[str, Any]\n\n\nclass Session:\n    def __init__(self):\n        self._events = []\n\n    def append(self, type, data):\n        ev = SessionEvent(len(self._events), type, data)\n        self._events.append(ev)\n        return ev\n\n    def events(self):\n        return list(self._events)\n\n\n# ---- 迷你 waterfall（同 L03）----\ndef waterfall(listeners: list[Callable], value: Any) -> Any:\n    def dispatch(i, v):\n        if i >= len(listeners):\n            return v\n        return listeners[i](v, lambda nv=None: dispatch(i + 1, nv if nv is not None else v))\n    return dispatch(0, value)\n\n\n# ==========================================================================\n# pre-step 决定对象：{messages, rejected}\n# 监听者要么改写 messages 后 next()，要么设 rejected 并短路（不调 next）。\n# ==========================================================================\ndef injector(decision, next_):\n    \"\"\"注入器：给每条 user 消息补一段上下文提醒。\"\"\"\n    msgs = decision[\"messages\"]\n    if msgs:\n        print(f\"  [pre-step:注入器] 给 {len(msgs)} 条输入追加上下文提醒\")\n        msgs = [{**m, \"content\": m[\"content\"] + \"（提醒：优先用 shell 工具）\"} if m[\"role\"] == \"user\" else m for m in msgs]\n    return next_({**decision, \"messages\": msgs})\n\n\ndef empty_guard(decision, next_):\n    \"\"\"守卫：空输入直接拒绝，短路。\"\"\"\n    if not decision[\"messages\"]:\n        print(\"  [pre-step:守卫] 空输入 → 拒绝（短路，不调 next），本 turn 不花 step\")\n        return {\"messages\": [], \"rejected\": True}\n    print(\"  [pre-step:守卫] 输入非空 → 委派\")\n    return next_(decision)\n\n\nclass Driver:\n    def __init__(self, session, llm, pre_step_listeners):\n        self.session = session\n        self.llm = llm\n        self.pre_step = pre_step_listeners\n        self.turn_no = -1\n\n    def run_turn(self, user_input: str | None) -> str:\n        self.turn_no += 1\n        self.session.append(\"turn/start\", {\"turn\": self.turn_no})\n        print(f\"\\n╔══ turn/start turn={self.turn_no}（输入={user_input!r}）\")\n\n        claimed = [{\"role\": \"user\", \"content\": user_input}] if user_input else []\n\n        # ---- pre-step waterfall ----\n        decision = waterfall(self.pre_step, {\"messages\": claimed, \"rejected\": False})\n\n        if decision.get(\"rejected\") or not decision[\"messages\"]:\n            # 被拒或空：turn 关闭但没花 step，日志仍记录这次尝试\n            self.session.append(\"turn/end\", {\"turn\": self.turn_no, \"reason\": \"rejected-no-step\"})\n            print(\"╚══ turn/end（无 step）\")\n            return \"[本 turn 未产生 step]\"\n\n        # ---- 正常 step ----\n        self.session.append(\"step/start\", {\"turn\": self.turn_no, \"step\": 0})\n        for m in decision[\"messages\"]:\n            self.session.append(\"user/message\", {\"content\": m[\"content\"], \"source\": \"human\"})\n        turn: AssistantTurn = self.llm.complete(decision[\"messages\"])\n        self.session.append(\"assistant/message\", {\"text\": turn.text})\n        self.session.append(\"step/end\", {\"turn\": self.turn_no, \"step\": 0})\n        self.session.append(\"turn/end\", {\"turn\": self.turn_no, \"reason\": \"natural-stop\"})\n        print(f\"║  [assistant] {turn.text}\")\n        print(\"╚══ turn/end\")\n        return turn.text\n\n\ndef build_script():\n    def s1(messages):\n        got = messages[-1][\"content\"]\n        return AssistantTurn(text=f\"我收到的输入是：{got!r}\")\n    return [s1]\n\n\nif __name__ == \"__main__\":\n    session = Session()\n    driver = Driver(session, make_llm(script=build_script()), pre_step_listeners=[injector, empty_guard])\n\n    print(\"### 场景 1：正常输入（会被注入器改写，然后跑一个 step）\")\n    driver.run_turn(\"看看环境\")\n\n    print(\"\\n### 场景 2：空输入（被守卫拒绝，turn 关闭但不花 step）\")\n    driver.run_turn(None)\n\n    print(\"\\n===== 日志证明：场景 2 也留下了 turn/start + turn/end（记录了这次尝试）=====\")\n    for ev in session.events():\n        print(f\"  #{ev.seq} {ev.type} {ev.data.get('reason','')}\")\n",
   "locPct": 63
  },
  {
   "id": "L08",
   "dir": "L08_llm_seam",
   "num": "08",
   "title": "LLM 适配器与流式响应（llm seam）",
   "fullTitle": "L08 LLM 适配器与流式响应（llm seam）",
   "subtitle": "ctx.llm 适配器与流式",
   "motto": "模型本身也是可替换的 provider。",
   "layer": "turn",
   "loc": 128,
   "hasCode": true,
   "sections": [
    {
     "name": "1. 30 秒运行",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "运行前先猜：每个 chunk 都写进日志后，为什么还要再追加完整 `assistant/message`？第一次\nprovider 报错时，已写下的 `step/start` 应不应该保留？\n\n```powershell\npython lessons/L08_llm_seam/main.py\n```\n\n预期输出（节选）：\n\n```text\n--- provider = scripted ---\n  [scripted] 流式输出: 你好，我是脚本 provider。\n  日志里有 17 个 assistant/chunk（token 级回放）\n\n--- provider = uppercase（换 provider，行为立刻不同）---\n  [uppercase] 流式输出: ECHO: CHANGE ME\n\n--- provider = scripted，第一次故意失败（演示错误恢复）---\n  [scripted] 流式输出:\n  [恢复] 捕获错误 RuntimeError('模拟的瞬时网络错误')，重试第 1 次\n  [scripted] 流式输出: 重试后成功了。\n```"
      }
     ]
    },
    {
     "name": "2. 观察输出",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "同一个 `run_step` driver，喂进三个不同 provider，行为立刻不同——因为它们都实现同一个\n`stream` 接口。流式输出被切成一个个 chunk，每个 chunk 都记成一条 `assistant/chunk`\n事件（token 级回放）。第三个 provider 第一次故意失败，driver 重试后成功。"
      }
     ]
    },
    {
     "name": "3. 为什么需要这一层",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "回想 **L01**：我们直接 `llm.complete(messages)`。那其实偷偷省略了一整层——\n真实 dsh 里模型不是一个函数，而是 `ctx.llm` 这个 **seam** 背后的 provider。\n\n为什么要抽成 seam？因为你要能：换模型厂商（DeepSeek / Pi-AI）、在测试里换成\n确定性 Replay、在不同 profile 里挂不同模型——而 driver 一行都不用改。\n这就是 L01 的\"直接调模型\"到这里被补全的那一层。"
      }
     ]
    },
    {
     "name": "4. 心智模型",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "llm seam 就是**电源插座标准**："
      },
      {
       "type": "structure",
       "id": "llm-provider-structure",
       "title": "同一个插座，可以接不同模型 provider",
       "nodes": [
        {
         "title": "ctx.llm 接口",
         "detail": "统一约定 `stream(messages) → chunks`。",
         "children": [
          {
           "title": "llm-deepseek",
           "detail": "连接真实 DeepSeek 模型。",
           "children": []
          },
          {
           "title": "llm-pi-ai",
           "detail": "连接另一家模型实现。",
           "children": []
          },
          {
           "title": "llm-replay",
           "detail": "用确定性脚本支撑测试和离线教学。",
           "children": []
          }
         ]
        }
       ]
      },
      {
       "type": "markdown",
       "markdown": "任何 provider 插上去都能用，因为它们符合同一个\"插座标准\"。"
      }
     ]
    },
    {
     "name": "5. 方案与图",
     "blocks": [
      {
       "type": "flow",
       "id": "llm-stream-flow",
       "title": "每次流式尝试都有完整的事件边界",
       "nodes": [
        {
         "id": "start",
         "title": "追加 step/start",
         "detail": "每一次首次请求或重试都开启一段新的尝试边界。",
         "edges": [
          {
           "target": "stream",
           "label": ""
          }
         ],
         "position": {
          "column": 1,
          "row": 2
         },
         "kind": "boundary"
        },
        {
         "id": "stream",
         "title": "provider.stream",
         "detail": "通过统一 seam 消费 provider 返回的流。",
         "edges": [
          {
           "target": "chunk",
           "label": "收到 chunk"
          },
          {
           "target": "message",
           "label": "流结束"
          },
          {
           "target": "error",
           "label": "抛错"
          }
         ],
         "position": {
          "column": 2,
          "row": 2
         },
         "kind": "decision"
        },
        {
         "id": "chunk",
         "title": "追加 assistant/chunk",
         "detail": "每个增量都进入日志，同时累计 text delta。",
         "edges": [
          {
           "target": "stream",
           "label": "继续消费"
          }
         ],
         "position": {
          "column": 3,
          "row": 1
         },
         "kind": ""
        },
        {
         "id": "message",
         "title": "合成 assistant/message",
         "detail": "流正常结束后生成供 deriveMessages 使用的完整消息。",
         "edges": [
          {
           "target": "end",
           "label": ""
          }
         ],
         "position": {
          "column": 4,
          "row": 2
         },
         "kind": ""
        },
        {
         "id": "end",
         "title": "追加 step/end",
         "detail": "正常尝试完整收口。",
         "edges": [
          {
           "target": "done",
           "label": ""
          }
         ],
         "position": {
          "column": 5,
          "row": 2
         },
         "kind": "boundary"
        },
        {
         "id": "done",
         "title": "返回完整文本",
         "detail": "上层得到本次模型结果。",
         "edges": [],
         "position": {
          "column": 6,
          "row": 2
         },
         "kind": "terminal"
        },
        {
         "id": "error",
         "title": "保存原始错误",
         "detail": "失败尝试也先结束 step，不能留下半截生命周期。",
         "edges": [
          {
           "target": "failed_end",
           "label": ""
          }
         ],
         "position": {
          "column": 3,
          "row": 3
         },
         "kind": ""
        },
        {
         "id": "failed_end",
         "title": "追加 step/end",
         "detail": "关闭失败尝试后再判断是否重试。",
         "edges": [
          {
           "target": "retry",
           "label": ""
          }
         ],
         "position": {
          "column": 4,
          "row": 3
         },
         "kind": "boundary"
        },
        {
         "id": "retry",
         "title": "还有重试预算吗？",
         "detail": "有预算就从新的 step/start 重来；否则向上抛原错误。",
         "edges": [
          {
           "target": "start",
           "label": "有"
          },
          {
           "target": "failed",
           "label": "没有"
          }
         ],
         "position": {
          "column": 5,
          "row": 3
         },
         "kind": "decision"
        },
        {
         "id": "failed",
         "title": "请求失败",
         "detail": "保留 provider 原始错误，交给上层恢复边界。",
         "edges": [],
         "position": {
          "column": 6,
          "row": 3
         },
         "kind": "terminal"
        }
       ],
       "variant": "map"
      },
      {
       "type": "markdown",
       "markdown": "### 执行透视：失败与成功共享 seam，不共享恢复决定"
      },
      {
       "type": "trace",
       "id": "l08-runtime-xray",
       "title": "chunk 缓冲、会话事实与重试状态",
       "panels": [
        "text_parts 缓冲",
        "Session 事件",
        "Recovery 状态"
       ],
       "steps": [
        {
         "title": "开始尝试",
         "location": "`step/start`",
         "action": "Driver 开启一次 provider 调用。",
         "states": [
          "`[]`",
          "`step/start`",
          "`attempt=0`"
         ]
        },
        {
         "title": "首次失败",
         "location": "`raise RuntimeError`",
         "action": "provider 尚未 yield 就抛错。",
         "states": [
          "`[]`",
          "`step/start; step/end`",
          "预算允许，`attempt=1`。"
         ]
        },
        {
         "title": "重开请求",
         "location": "`continue`",
         "action": "新循环重新创建缓冲并调用同一 seam。",
         "states": [
          "新的 `[]`",
          "新 `step/start`",
          "最后一次机会。"
         ]
        },
        {
         "title": "消费流",
         "location": "`for chunk in stream`",
         "action": "每个 delta 同时入日志并追加缓冲。",
         "states": [
          "`[重, 试, 后, …]`",
          "`assistant/chunk × N`",
          "无错误，继续消费。"
         ]
        },
        {
         "title": "合成语义消息",
         "location": "`\"\".join(text_parts)`",
         "action": "流结束后形成完整 assistant。",
         "states": [
          "`\"重试后成功了。\"`",
          "`assistant/message; step/end`",
          "成功，重试状态退出。"
         ]
        }
       ]
      }
     ]
    },
    {
     "name": "6. 代码拆解",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "- `LLMProvider`：接口（Service Definition），只约定一个 `stream(messages)`。\n- `ScriptedProvider` / `UpperCaseProvider`：两个可互换实现。`fail_first` 演示瞬时错误。\n- `run_step()`：消费流 → 每个 chunk 记 `assistant/chunk` → 流结束合成 `assistant/message`\n  （**chunk 用于回放，message 用于派生历史**，二者分工）→ `try/except` 里实现重试/保留原错误的**恢复边界**。\n\n### 动手破坏一次\n\n删掉合成 `assistant/message` 的三行，只保留 chunks。终端仍能看到文字，但下一次投影没有稳定\nassistant 消息。这验证：**流式 chunk 是回放事实，完整 message 才是模型历史的语义单位。**"
      }
     ]
    },
    {
     "name": "7. 代码解读：Provider 如何被隔离在统一 stream 接口后",
     "blocks": [
      {
       "type": "code-walkthrough",
       "id": "l08-code-reading",
       "title": "从 seam 定义到错误恢复",
       "source": "main.py",
       "language": "python",
       "segments": [
        {
         "title": "seam 只承诺最小协议",
         "start": 31,
         "end": 37,
         "reading": "`LLMProvider` 只定义 `stream(messages)`，不规定 HTTP SDK、模型厂商或 chunk 来源。",
         "reason": "consumer 依赖稳定输出协议，而不是某个客户端类型，provider 才能在 Replay、真实 API 和测试替身间互换。",
         "code": "class LLMProvider:\n    \"\"\"Service Definition（接口）：所有 provider 都实现 stream。\"\"\"\n\n    name = \"abstract\"\n\n    def stream(self, messages: list[dict]) -> Iterator[dict]:\n        raise NotImplementedError"
        },
        {
         "title": "Replay 同时模拟流和故障",
         "start": 40,
         "end": 56,
         "reading": "ScriptedProvider 维护调用次数，可在第一次抛错，成功时逐字符 yield delta。",
         "reason": "可控故障让恢复路径成为确定性测试；逐字符则迫使 Driver 真正消费迭代器。",
         "code": "class ScriptedProvider(LLMProvider):\n    \"\"\"provider 实现之一：按脚本流式吐 chunk（对应 dsh-llm-replay）。\"\"\"\n\n    name = \"scripted\"\n\n    def __init__(self, text: str, fail_first: bool = False):\n        self._text = text\n        self._fail_first = fail_first\n        self._calls = 0\n\n    def stream(self, messages):\n        self._calls += 1\n        # 演示错误恢复：第一次调用故意抛错\n        if self._fail_first and self._calls == 1:\n            raise RuntimeError(\"模拟的瞬时网络错误\")\n        for ch in self._text:\n            yield {\"type\": \"text_delta\", \"text\": ch}"
        },
        {
         "title": "第二实现证明可替换",
         "start": 59,
         "end": 67,
         "reading": "UpperCaseProvider 使用同一签名，却根据输入生成不同的流。",
         "reason": "只有出现第二个实现，接口可替换性才被证明；否则 seam 可能只是给单一实现换名。",
         "code": "class UpperCaseProvider(LLMProvider):\n    \"\"\"另一个可互换 provider：把输出全大写。证明\"换 provider 就换行为\"。\"\"\"\n\n    name = \"uppercase\"\n\n    def stream(self, messages):\n        reply = f\"echo: {messages[-1]['content']}\".upper()\n        for ch in reply:\n            yield {\"type\": \"text_delta\", \"text\": ch}"
        },
        {
         "title": "Driver 保存原始流与语义消息",
         "start": 84,
         "end": 101,
         "reading": "chunk 立即 append 并累积；流结束后 join 成完整文本，再写 assistant/message。",
         "reason": "UI/调试需要 token 级事实，下一轮模型需要稳定消息；两种读模型职责不同。",
         "code": "def run_step(session: Session, provider: LLMProvider, messages: list[dict], max_retries: int = 1) -> str:\n    attempt = 0\n    while True:\n        try:\n            session.append(\"step/start\", {})\n            text_parts = []\n            print(f\"  [{provider.name}] 流式输出: \", end=\"\")\n            for chunk in provider.stream(messages):\n                # 每个 chunk 都作为 assistant/chunk 事件记录（token 级回放）\n                session.append(\"assistant/chunk\", chunk)\n                if chunk[\"type\"] == \"text_delta\":\n                    print(chunk[\"text\"], end=\"\", flush=True)\n                    text_parts.append(chunk[\"text\"])\n            print()\n            # 流结束 → 合成一条 assistant/message（派生历史用这条）\n            full = \"\".join(text_parts)\n            session.append(\"assistant/message\", {\"text\": full})\n            session.append(\"step/end\", {})"
        },
        {
         "title": "重试属于 consumer 边界",
         "start": 102,
         "end": 111,
         "reading": "异常先关闭 step，再由 Driver 根据 attempt 决定 continue 或抛出原错误。",
         "reason": "provider 只报告失败；重试次数、预算和错误呈现必须由拥有 turn 语义的 Driver 控制。",
         "code": "            return full\n        except Exception as e:  # noqa: BLE001\n            session.append(\"step/end\", {})\n            # ---- 错误恢复边界 ----\n            if attempt < max_retries:\n                attempt += 1\n                print(f\"\\n  [恢复] 捕获错误 {e!r}，重试第 {attempt} 次\")\n                continue\n            print(f\"\\n  [恢复] 重试用尽，保留原错误：{e!r}\")\n            raise"
        }
       ]
      }
     ]
    },
    {
     "name": "8. 相对上一课新增了什么",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "前 7 课都把模型当成一个直接可调的函数。本课把它抽成 **llm seam + 可互换 provider**，\n并引入两样新东西：**流式 chunk（token 级回放）** 和 **错误恢复边界**，回扣 L01 的简化点。"
      }
     ]
    },
    {
     "name": "9. 简化了什么 vs 真实 DeepSeek Harness",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| `stream` 返回 dict chunk | 完整的 `StreamChunk` 词汇 + `agent/request`/`llm/stream` waterfall | 请求构造、流处理都是可拦截扩展点 |\n| 文本 chunk | text、tool_call、usage、reasoning 等多种 chunk | 工具调用、推理、token 计费都在流里 |\n| try/except 重试 | `agent/request-error` waterfall，区分瞬时错误与上下文溢出 | 上下文溢出要触发压缩而非重试（见 L15） |\n| `assistant/message` 存文本 | 带 `usage` 和 `sourceEventSeqs`（精确列出源 chunk），空内容也记账 | 回放保真、计费、遥测 |\n| if/else 选 provider | profile/bundle 组合决定挂哪个 provider | 生产/测试/多厂商用配置切换（见 L20） |\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `LLMProvider.stream` | `ctx.llm.stream()`（`llm/llm` seam） |\n| `ScriptedProvider` | `dsh-llm-replay` |\n| `UpperCaseProvider` / 真模型 | `dsh-llm-deepseek` / `dsh-llm-pi-ai` |\n| `assistant/chunk` | 同名事件（token 级回放） |\n| 重试分支 | `agent/request-error` 恢复 |\n\n---\n[← 上一课 L07](../L07_pre_step/README.zh.md) · [返回总览](../../README.md) · [下一课 L09 →](../L09_scope/README.zh.md)"
      }
     ]
    }
   ],
   "code": "\"\"\"L08 LLM 适配器与流式响应（llm seam）\n=======================================\nMotto：模型本身也是可替换的 provider。\n\n回想 L01：我们直接 llm.complete(messages)。那其实是省略了一层——真实 dsh 里\n模型是 ctx.llm 这个 **seam** 背后的 provider（真实有 llm-deepseek / llm-pi-ai /\nllm-replay 三个实现）。这一课把这层补上，展示三件事：\n\n  1) 一个 seam 接口（stream 方法）+ 多个可互换的 provider。\n  2) 流式：模型不是一次吐完，而是一个个 chunk 流出来（text_delta / tool_call），\n     driver 把 chunk 追加成 assistant/chunk 事件（token 级回放），流结束后\n     再合成一条 assistant/message（派生历史用这条）。\n  3) 错误恢复边界：provider 报错时，driver 决定重试还是保留原错误。\n\n运行：  python lessons/L08_llm_seam/main.py\n\"\"\"\n\nfrom __future__ import annotations\n\nimport os\nimport sys\nfrom dataclasses import dataclass, field\nfrom typing import Any, Iterator\n\nsys.path.insert(0, os.path.join(os.path.dirname(__file__), \"..\", \"..\"))\n\n\n# ==========================================================================\n# llm seam：接口约定 = 一个 stream(messages) -> Iterator[chunk]\n# ==========================================================================\nclass LLMProvider:\n    \"\"\"Service Definition（接口）：所有 provider 都实现 stream。\"\"\"\n\n    name = \"abstract\"\n\n    def stream(self, messages: list[dict]) -> Iterator[dict]:\n        raise NotImplementedError\n\n\nclass ScriptedProvider(LLMProvider):\n    \"\"\"provider 实现之一：按脚本流式吐 chunk（对应 dsh-llm-replay）。\"\"\"\n\n    name = \"scripted\"\n\n    def __init__(self, text: str, fail_first: bool = False):\n        self._text = text\n        self._fail_first = fail_first\n        self._calls = 0\n\n    def stream(self, messages):\n        self._calls += 1\n        # 演示错误恢复：第一次调用故意抛错\n        if self._fail_first and self._calls == 1:\n            raise RuntimeError(\"模拟的瞬时网络错误\")\n        for ch in self._text:\n            yield {\"type\": \"text_delta\", \"text\": ch}\n\n\nclass UpperCaseProvider(LLMProvider):\n    \"\"\"另一个可互换 provider：把输出全大写。证明\"换 provider 就换行为\"。\"\"\"\n\n    name = \"uppercase\"\n\n    def stream(self, messages):\n        reply = f\"echo: {messages[-1]['content']}\".upper()\n        for ch in reply:\n            yield {\"type\": \"text_delta\", \"text\": ch}\n\n\n# ==========================================================================\n# 会话事件（精简）\n# ==========================================================================\n@dataclass\nclass Session:\n    events: list = field(default_factory=list)\n\n    def append(self, type, data):\n        self.events.append((len(self.events), type, data))\n\n\n# ==========================================================================\n# driver：消费流、追加 chunk 事件、合成 message、处理错误恢复\n# ==========================================================================\ndef run_step(session: Session, provider: LLMProvider, messages: list[dict], max_retries: int = 1) -> str:\n    attempt = 0\n    while True:\n        try:\n            session.append(\"step/start\", {})\n            text_parts = []\n            print(f\"  [{provider.name}] 流式输出: \", end=\"\")\n            for chunk in provider.stream(messages):\n                # 每个 chunk 都作为 assistant/chunk 事件记录（token 级回放）\n                session.append(\"assistant/chunk\", chunk)\n                if chunk[\"type\"] == \"text_delta\":\n                    print(chunk[\"text\"], end=\"\", flush=True)\n                    text_parts.append(chunk[\"text\"])\n            print()\n            # 流结束 → 合成一条 assistant/message（派生历史用这条）\n            full = \"\".join(text_parts)\n            session.append(\"assistant/message\", {\"text\": full})\n            session.append(\"step/end\", {})\n            return full\n        except Exception as e:  # noqa: BLE001\n            session.append(\"step/end\", {})\n            # ---- 错误恢复边界 ----\n            if attempt < max_retries:\n                attempt += 1\n                print(f\"\\n  [恢复] 捕获错误 {e!r}，重试第 {attempt} 次\")\n                continue\n            print(f\"\\n  [恢复] 重试用尽，保留原错误：{e!r}\")\n            raise\n\n\nif __name__ == \"__main__\":\n    print(\"### 同一个 seam，三个可互换 provider\")\n\n    print(\"\\n--- provider = scripted ---\")\n    s1 = Session()\n    run_step(s1, ScriptedProvider(\"你好，我是脚本 provider。\"), [{\"role\": \"user\", \"content\": \"hi\"}])\n    print(f\"  日志里有 {sum(1 for _,t,_ in s1.events if t=='assistant/chunk')} 个 assistant/chunk（token 级回放）\")\n\n    print(\"\\n--- provider = uppercase（换 provider，行为立刻不同）---\")\n    s2 = Session()\n    run_step(s2, UpperCaseProvider(), [{\"role\": \"user\", \"content\": \"change me\"}])\n\n    print(\"\\n--- provider = scripted，第一次故意失败（演示错误恢复）---\")\n    s3 = Session()\n    run_step(s3, ScriptedProvider(\"重试后成功了。\", fail_first=True), [{\"role\": \"user\", \"content\": \"hi\"}], max_retries=1)\n",
   "locPct": 59
  },
  {
   "id": "L09",
   "dir": "L09_scope",
   "num": "09",
   "title": "Scope 与 shadowing：给单个 agent 一套隔离能力",
   "fullTitle": "L09 Scope 与 shadowing：给单个 agent 一套隔离能力",
   "subtitle": "作用域链与 shadowing",
   "motto": "同名最具体者胜；作用域是 per-agent 人格的根。",
   "layer": "tools",
   "loc": 83,
   "hasCode": true,
   "sections": [
    {
     "name": "1. 30 秒运行",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "运行前先判断：translator 注册同名 `shell` 后，应该报冲突、保留全局版本，还是让 scoped\n版本胜出？readonly 的 restriction 应不应该连它自己的 scoped 工具也一起过滤？\n\n```powershell\npython lessons/L09_scope/main.py\n```\n\n预期输出（节选）：\n\n```text\n===== translator agent 看到的工具（shell 被遮蔽 + 多了 translate）=====\n  shell      翻译官专用 shell：只允许 echo 翻译结果  ← 遮蔽了全局同名\n  translate  翻译官私有工具：翻译文本  ← scope 私有\n\n===== readonly agent 看到的工具（write 被 restrict 过滤掉）=====\n  shell      全局 shell：执行任意命令\n  read       全局 read：读文件\n  （注意：write 不在列表里——被过滤的工具，和不存在没有区别）\n```"
      }
     ]
    },
    {
     "name": "2. 观察输出",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "三个 agent 看到三份不同的工具集。translator 的 `shell` 被它自己的同名工具**遮蔽**了，\n还多了私有的 `translate`；readonly 的 `write` 被 **restrict 过滤**掉，\n从它的视角看 `write` 根本不存在。"
      }
     ]
    },
    {
     "name": "3. 为什么需要这一层",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "**为什么 Scope 排在工具（L10/L11）之前？** 因为工具、提示段落、skill、事件分发\n全都建立在\"注册是全局还是 scoped\"这个模型之上。如果先讲一个纯全局的工具注册表，\n后面讲 per-agent 差异化时就得推翻它。所以先立起 scope，再讲挂在 scope 上的东西。\n\n真实产品里，一个只读子 agent 不该有 `write`；一个\"翻译官\"人格需要一个和全局同名\n但行为不同的工具。Scope 就是实现\"per-agent 人格\"的根机制。"
      }
     ]
    },
    {
     "name": "4. 心智模型",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "Scope 就像**编程语言的变量作用域**："
      },
      {
       "type": "structure",
       "id": "scope-shadowing",
       "title": "工具作用域像变量作用域",
       "nodes": [
        {
         "title": "global 层",
         "detail": "提供 shell、write、read，所有 agent 默认可见。",
         "children": [
          {
           "title": "translator 层",
           "detail": "提供私有 shell 与 translate；同名 shell 遮蔽 global shell。",
           "children": []
          },
          {
           "title": "readonly 层",
           "detail": "restriction 只放行 read 与 shell，其余全局工具不可见。",
           "children": []
          }
         ]
        }
       ]
      },
      {
       "type": "markdown",
       "markdown": "\"最具体者胜\"（most-specific-wins）就是 shadowing。"
      }
     ]
    },
    {
     "name": "5. 方案与图",
     "blocks": [
      {
       "type": "stepper",
       "id": "scope-resolution",
       "title": "most-specific-wins 解析过程",
       "steps": [
        {
         "title": "读取限制",
         "detail": "确定当前 scope 的 restriction 白名单。"
        },
        {
         "title": "建立基础集合",
         "detail": "从全局工具中只保留白名单允许的项目。"
        },
        {
         "title": "叠加局部工具",
         "detail": "遍历 scope 层，把局部定义按 name 写入集合。"
        },
        {
         "title": "发生遮蔽",
         "detail": "局部工具与全局工具同名时，局部定义直接覆盖。"
        },
        {
         "title": "返回结果",
         "detail": "consumer 只看到解析后的最终工具集。"
        }
       ]
      },
      {
       "type": "markdown",
       "markdown": "### 执行透视：同一个名称在不同 agent 中如何解析"
      },
      {
       "type": "trace",
       "id": "l09-runtime-xray",
       "title": "translator 与 readonly 的可见能力不是同一张表",
       "panels": [
        "Global 层",
        "当前 Scope 层",
        "resolve 结果"
       ],
       "steps": [
        {
         "title": "注册全局",
         "location": "`register_global`",
         "action": "shell、write、read 成为默认能力。",
         "states": [
          "`{shell, write, read}`",
          "尚未选择 scope。",
          "全局 agent 看见三者。"
         ]
        },
        {
         "title": "建 translator 层",
         "location": "`register_scoped`",
         "action": "translator 增加同名 shell 与私有 translate。",
         "states": [
          "全局层不变。",
          "`{shell:受限版, translate}`",
          "scoped shell 覆盖 global shell。"
         ]
        },
        {
         "title": "解析 translator",
         "location": "`resolve(translator)`",
         "action": "先复制 global，再覆盖 scoped 同名 key。",
         "states": [
          "`{shell, write, read}`",
          "`{shell, translate}`",
          "`{shell:受限版, write, read, translate}`"
         ]
        },
        {
         "title": "限制 readonly",
         "location": "`restrict(readonly)`",
         "action": "只允许 read 与 shell 进入 base。",
         "states": [
          "原始 global 不被修改。",
          "`allowed={read,shell}`",
          "write 在合并前已消失。"
         ]
        },
        {
         "title": "解析 readonly",
         "location": "`resolve(readonly)`",
         "action": "过滤 global；该 scope 没有私有项可覆盖。",
         "states": [
          "过滤后 `{read,shell}`",
          "`{}`",
          "`{read,shell}`"
         ]
        }
       ]
      }
     ]
    },
    {
     "name": "6. 代码拆解",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "- `register_global` / `register_scoped`：分别往全局层和某个 scope 层注册。\n- `restrict(scope, allowed)`：给某 scope 设白名单。\n- `resolve(scope)`：先按 restriction 过滤全局层，再用 scope 层同名覆盖。\n- scope key 用 `object()`：对应真实 dsh\"live agent 就是自己 scope 的 key\"（对象身份比较）。\n\n### 动手破坏一次\n\n把 `resolve` 中“过滤 global”移动到 scoped 合并之后，并对整个结果过滤。translator 的私有\n`translate` 可能被误删。这验证：**restriction 约束继承来的全局能力，shadowing 则在过滤后\n合并最具体层；两者顺序不能交换。**"
      }
     ]
    },
    {
     "name": "7. 代码解读：most-specific-wins 是怎样由合并顺序实现的",
     "blocks": [
      {
       "type": "code-walkthrough",
       "id": "l09-code-reading",
       "title": "作用域解析不是查找，而是过滤后覆盖",
       "source": "main.py",
       "language": "python",
       "segments": [
        {
         "title": "三张表分开保存三种语义",
         "start": 22,
         "end": 28,
         "reading": "global、scoped 和 restrictions 分别存储，不把规则压进一张复合表。",
         "reason": "注册事实、scope 私有项与继承过滤是不同维度；分开后 resolve 才能明确控制应用顺序。",
         "code": "class ScopedRegistry:\n    \"\"\"两层扁平作用域的工具注册表。\"\"\"\n\n    def __init__(self):\n        self._global: dict[str, str] = {}                     # name -> \"行为描述\"\n        self._scoped: dict[object, dict[str, str]] = {}       # scope_key -> {name -> 行为}\n        self._restrictions: dict[object, set[str]] = {}       # scope_key -> 允许的全局工具名集合"
        },
        {
         "title": "注册只写所属层",
         "start": 30,
         "end": 38,
         "reading": "global 直接按 name 写入；scoped 先按对象身份分桶；restrict 只记录允许集合。",
         "reason": "写入时不提前计算最终视图，新增全局工具后所有 scope 才能在下次 resolve 自动看到最新结果。",
         "code": "    def register_global(self, name: str, behavior: str):\n        self._global[name] = behavior\n\n    def register_scoped(self, scope_key: object, name: str, behavior: str):\n        self._scoped.setdefault(scope_key, {})[name] = behavior\n\n    def restrict(self, scope_key: object, allowed: set[str]):\n        \"\"\"限制：该 scope 只能看到 allowed 里的全局工具。\"\"\"\n        self._restrictions[scope_key] = allowed"
        },
        {
         "title": "先过滤继承，再覆盖最具体层",
         "start": 40,
         "end": 49,
         "reading": "resolve 先构造允许的 global base，再逐项写入当前 scope；字典赋值实现同名覆盖。",
         "reason": "私有能力不应被全局 restriction 误伤；覆盖顺序把“most-specific-wins”落实为代码规则。",
         "code": "    def resolve(self, scope_key: object | None = None) -> dict[str, str]:\n        \"\"\"解析某个 scope 实际可见的工具集。\"\"\"\n        # 1) 全局层，先按 restriction 过滤\n        allowed = self._restrictions.get(scope_key)\n        base = {n: b for n, b in self._global.items() if allowed is None or n in allowed}\n        # 2) 合并 scope 层：同名遮蔽（most-specific-wins）\n        if scope_key is not None:\n            for n, b in self._scoped.get(scope_key, {}).items():\n                base[n] = b  # scope 层直接覆盖同名全局\n        return base"
        },
        {
         "title": "对象身份隔离 agent",
         "start": 55,
         "end": 69,
         "reading": "translator 与 readonly 都是独立 object，并分别作为配置 key。",
         "reason": "即使两个 agent 配置内容相同，它们仍是不同作用域；身份 key 避免字符串名称碰撞和跨 agent 泄漏。",
         "code": "    # 全局工具：所有 agent 默认可见\n    reg.register_global(\"shell\", \"全局 shell：执行任意命令\")\n    reg.register_global(\"write\", \"全局 write：写文件\")\n    reg.register_global(\"read\", \"全局 read：读文件\")\n\n    # 两个 agent，用对象身份当 scope key（真实 dsh：live agent 就是自己 scope 的 key）\n    translator = object()\n    readonly = object()\n\n    # translator：注册一个同名 shell，但行为不同 → 会遮蔽全局 shell\n    reg.register_scoped(translator, \"shell\", \"翻译官专用 shell：只允许 echo 翻译结果\")\n    reg.register_scoped(translator, \"translate\", \"翻译官私有工具：翻译文本\")\n\n    # readonly：限制掉写能力，只保留 read/shell\n    reg.restrict(readonly, allowed={\"read\", \"shell\"})"
        }
       ]
      }
     ]
    },
    {
     "name": "8. 相对上一课新增了什么",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "前 8 课的注册都是隐式全局的。本课引入 **scope 两层结构 + shadowing + restriction**，\n让不同 agent 能看到不同的能力集，为后面工具、提示、skill 的 per-agent 差异化打地基。"
      }
     ]
    },
    {
     "name": "9. 简化了什么 vs 真实 DeepSeek Harness",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| 一个 dict 存 scope 层 | `core/scope` 的 scoped-registration 原语，`agent.ctx` 承载 | 注册的可见性与生命周期由一个事实驱动 |\n| scope key 是裸 object | scope key 按对象身份比较，live agent 是自己的 key | 稳定身份，subagent 不向下继承 |\n| 只有工具 | 工具、提示段落、变量、监听器、restriction 都可 scoped | per-agent 人格是多维度的 |\n| 两层，无 setup window | 有 setup window：创建时组合 agent 的 scoped 世界 | 在 agent 发布前把人格装好 |\n| 事件不过滤 | scoped dispatch：一个 agent 的事件带它的 scope carrier | 一个 agent 的活动不惊动别的 agent |\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `ScopedRegistry` | `core/scope` + 工具/提示注册表的分层 |\n| `register_scoped` | 通过 `agent.ctx` 的 scoped 注册 |\n| `resolve` shadowing | most-specific-wins 名称解析 |\n| `restrict` | `tools.restrict`（按交集组合） |\n\n---\n[← 上一课 L08](../L08_llm_seam/README.zh.md) · [返回总览](../../README.md) · [下一课 L10 →](../L10_tool_registry/README.zh.md)"
      }
     ]
    }
   ],
   "code": "\"\"\"L09 Scope 与 shadowing：给单个 agent 一套隔离能力\n====================================================\nMotto：同名最具体者胜；作用域是 per-agent 人格的根。\n\n到目前为止，工具、提示段落都是\"全局\"的——所有 agent 共享一份。但真实产品里，\n不同 agent 需要不同的能力集：一个只读 agent 不该有 write 工具；一个\"翻译官\"\nagent 需要一个和全局同名但行为不同的工具。\n\nScope（作用域）解决这个。规则很简单，两层扁平：\n  - 注册要么是 global（每个 agent 可见），要么 scoped（只属于某一个 scope key）。\n  - 读取时把 global 层和当前 scope 层合并；**同名时 scope 层遮蔽（shadow）global 层**。\n  - 还能 restrict：从全局工具集里过滤掉某些工具（被过滤的工具就像不存在）。\n\n本课用一个工具注册表演示 shadowing 和 restriction。\n\n运行：  python lessons/L09_scope/main.py\n\"\"\"\n\nfrom __future__ import annotations\n\n\nclass ScopedRegistry:\n    \"\"\"两层扁平作用域的工具注册表。\"\"\"\n\n    def __init__(self):\n        self._global: dict[str, str] = {}                     # name -> \"行为描述\"\n        self._scoped: dict[object, dict[str, str]] = {}       # scope_key -> {name -> 行为}\n        self._restrictions: dict[object, set[str]] = {}       # scope_key -> 允许的全局工具名集合\n\n    def register_global(self, name: str, behavior: str):\n        self._global[name] = behavior\n\n    def register_scoped(self, scope_key: object, name: str, behavior: str):\n        self._scoped.setdefault(scope_key, {})[name] = behavior\n\n    def restrict(self, scope_key: object, allowed: set[str]):\n        \"\"\"限制：该 scope 只能看到 allowed 里的全局工具。\"\"\"\n        self._restrictions[scope_key] = allowed\n\n    def resolve(self, scope_key: object | None = None) -> dict[str, str]:\n        \"\"\"解析某个 scope 实际可见的工具集。\"\"\"\n        # 1) 全局层，先按 restriction 过滤\n        allowed = self._restrictions.get(scope_key)\n        base = {n: b for n, b in self._global.items() if allowed is None or n in allowed}\n        # 2) 合并 scope 层：同名遮蔽（most-specific-wins）\n        if scope_key is not None:\n            for n, b in self._scoped.get(scope_key, {}).items():\n                base[n] = b  # scope 层直接覆盖同名全局\n        return base\n\n\nif __name__ == \"__main__\":\n    reg = ScopedRegistry()\n\n    # 全局工具：所有 agent 默认可见\n    reg.register_global(\"shell\", \"全局 shell：执行任意命令\")\n    reg.register_global(\"write\", \"全局 write：写文件\")\n    reg.register_global(\"read\", \"全局 read：读文件\")\n\n    # 两个 agent，用对象身份当 scope key（真实 dsh：live agent 就是自己 scope 的 key）\n    translator = object()\n    readonly = object()\n\n    # translator：注册一个同名 shell，但行为不同 → 会遮蔽全局 shell\n    reg.register_scoped(translator, \"shell\", \"翻译官专用 shell：只允许 echo 翻译结果\")\n    reg.register_scoped(translator, \"translate\", \"翻译官私有工具：翻译文本\")\n\n    # readonly：限制掉写能力，只保留 read/shell\n    reg.restrict(readonly, allowed={\"read\", \"shell\"})\n\n    print(\"===== 全局 agent 看到的工具 =====\")\n    for n, b in reg.resolve(None).items():\n        print(f\"  {n:<10} {b}\")\n\n    print(\"\\n===== translator agent 看到的工具（shell 被遮蔽 + 多了 translate）=====\")\n    for n, b in reg.resolve(translator).items():\n        marker = \"  ← 遮蔽了全局同名\" if n == \"shell\" else (\"  ← scope 私有\" if n == \"translate\" else \"\")\n        print(f\"  {n:<10} {b}{marker}\")\n\n    print(\"\\n===== readonly agent 看到的工具（write 被 restrict 过滤掉）=====\")\n    for n, b in reg.resolve(readonly).items():\n        print(f\"  {n:<10} {b}\")\n    print(f\"  （注意：write 不在列表里——被过滤的工具，和不存在没有区别）\")\n",
   "locPct": 38
  },
  {
   "id": "L10",
   "dir": "L10_tool_registry",
   "num": "10",
   "title": "工具注册表：schema + handler + 分派",
   "fullTitle": "L10 工具注册表：schema + handler + 分派",
   "subtitle": "schema + handler 注册表",
   "motto": "加一个工具，只加一个定义，循环不用动。",
   "layer": "tools",
   "loc": 99,
   "hasCode": true,
   "sections": [
    {
     "name": "1. 30 秒运行",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "运行前先猜：同一份 `ToolDefinition` 中既有 JSON schema 又有可执行函数，`schemas()` 为什么\n不能直接把 dataclass 转成字典？模型返回未知工具名时，注册表应该抛异常还是返回受控错误？\n\n```powershell\npython lessons/L10_tool_registry/main.py\n```\n\n预期输出（节选）：\n\n```text\n===== 发给模型的 schema（注意：没有 execute / timeout_ms）=====\n[ { \"name\": \"shell\", \"description\": \"...\", \"parameters\": {...} }, ... ]\n\n===== 循环通过注册表分派调用（loop 不认识具体工具）=====\n  add({'a': 2, 'b': 3}) → 5\n  echo({'text': 'hello'}) → 'hello'\n  shell({'command': 'echo via registry'}) → 'via\\nregistry'\n  nope({}) → '[未知工具] nope'\n```"
      }
     ]
    },
    {
     "name": "2. 观察输出",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "三个工具注册进一张表。发给模型的 schema **只有** name/description/parameters——\n`execute` 和 `timeout_ms` 这些宿主字段没泄漏。循环用 `dispatch(name, args)`\n统一分派，它根本不认识 `add`/`echo`/`shell` 具体是什么。"
      }
     ]
    },
    {
     "name": "3. 为什么需要这一层",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "L01 的 `call_tool` 是一堆 `if name == ...`。每加一个工具就得改这个函数、改循环。\n这违背了 dsh\"不改核心\"的原则。\n\n**工具注册表把\"工具\"变成数据（一条 `ToolDefinition`）。** 加工具 = 往表里加一条，\n循环通过表分派，永远不用改。而且注册表守着一条边界：**只有面向模型的字段能进\n模型请求**，handler/超时等宿主元数据严禁泄漏给模型。"
      }
     ]
    },
    {
     "name": "4. 心智模型",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "注册表就是**餐厅菜单 vs 后厨**："
      },
      {
       "type": "compare",
       "id": "menu-vs-kitchen",
       "title": "模型看到菜单，宿主掌握后厨",
       "items": [
        {
         "title": "菜单 schemas()",
         "detail": "给模型看工具名、描述和参数要求，不暴露执行能力。"
        },
        {
         "title": "后厨 execute",
         "detail": "宿主持有真实实现、超时和资源控制，模型看不到。"
        },
        {
         "title": "点单 dispatch",
         "detail": "按工具名查表，把合法参数交给后厨，再统一返回结果。"
        }
       ]
      }
     ]
    },
    {
     "name": "5. 方案与图",
     "blocks": [
      {
       "type": "flow",
       "id": "tool-registry-flow",
       "title": "同一份 ToolDefinition 跨过模型与宿主边界",
       "nodes": [
        {
         "id": "definition",
         "title": "ToolDefinition",
         "detail": "同时保存公开 schema 和宿主私有 handler/timeout。",
         "edges": [
          {
           "target": "schema",
           "label": "公开字段"
          },
          {
           "target": "handler",
           "label": "私有字段"
          }
         ],
         "position": {
          "column": 1,
          "row": 2
         },
         "kind": "state"
        },
        {
         "id": "schema",
         "title": "schemas() 投影",
         "detail": "只取 name、description、parameters。",
         "edges": [
          {
           "target": "model",
           "label": ""
          }
         ],
         "position": {
          "column": 2,
          "row": 1
         },
         "kind": "boundary"
        },
        {
         "id": "model",
         "title": "模型可见菜单",
         "detail": "模型只能看到 schema，不能接触 execute。",
         "edges": [
          {
           "target": "call",
           "label": ""
          }
         ],
         "position": {
          "column": 3,
          "row": 1
         },
         "kind": ""
        },
        {
         "id": "call",
         "title": "tool call",
         "detail": "模型返回工具名和参数，控制权回到宿主。",
         "edges": [
          {
           "target": "dispatch",
           "label": ""
          }
         ],
         "position": {
          "column": 4,
          "row": 1
         },
         "kind": "boundary"
        },
        {
         "id": "dispatch",
         "title": "dispatch(name,args)",
         "detail": "宿主按名称查找完整定义。",
         "edges": [
          {
           "target": "handler",
           "label": ""
          }
         ],
         "position": {
          "column": 4,
          "row": 3
         },
         "kind": ""
        },
        {
         "id": "handler",
         "title": "私有 execute",
         "detail": "真实实现和 timeout 始终留在宿主侧。",
         "edges": [
          {
           "target": "result",
           "label": ""
          }
         ],
         "position": {
          "column": 2,
          "row": 3
         },
         "kind": ""
        },
        {
         "id": "result",
         "title": "工具结果",
         "detail": "执行结果由宿主统一返回，handler 从未泄漏给模型。",
         "edges": [],
         "position": {
          "column": 1,
          "row": 3
         },
         "kind": "terminal"
        }
       ],
       "variant": "map"
      },
      {
       "type": "markdown",
       "markdown": "### 执行透视：同一工具在模型侧与宿主侧的两种视图"
      },
      {
       "type": "trace",
       "id": "l10-runtime-xray",
       "title": "ToolDefinition 跨边界时发生了什么",
       "panels": [
        "Registry 权威记录",
        "模型可见字段",
        "宿主执行能力"
       ],
       "steps": [
        {
         "title": "注册 shell",
         "location": "`register(ToolDefinition)`",
         "action": "完整定义按 name 存入表。",
         "states": [
          "schema + execute + timeout",
          "尚未投影。",
          "handler 保存在宿主内存。"
         ]
        },
        {
         "title": "生成菜单",
         "location": "`schemas()`",
         "action": "白名单复制 name、description、parameters。",
         "states": [
          "完整记录不变。",
          "只有三个 JSON 字段。",
          "execute 与 timeout 未跨边界。"
         ]
        },
        {
         "title": "模型点单",
         "location": "`tool call: add`",
         "action": "模型只返回 name 与 arguments。",
         "states": [
          "通过 name 定位完整定义。",
          "`{name:add,args:{a,b}}`",
          "控制权回到宿主。"
         ]
        },
        {
         "title": "分派执行",
         "location": "`dispatch(name,args)`",
         "action": "注册表查表后调用私有 execute。",
         "states": [
          "add 定义命中。",
          "模型接触不到函数对象。",
          "`lambda → 5`"
         ]
        },
        {
         "title": "未知工具",
         "location": "`dispatch(\"nope\",{})`",
         "action": "查表失败，生成稳定错误结果。",
         "states": [
          "Registry 不变。",
          "可作为 tool result 返回。",
          "没有任意函数被调用。"
         ]
        }
       ]
      }
     ]
    },
    {
     "name": "6. 代码拆解",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "- `ToolDefinition`：一个工具的全部。前三个字段面向模型，后两个（`execute`/`timeout_ms`）宿主私有。\n- `register()`：存入表，返回 disposer（可逆注册，呼应 L02）。\n- `schemas()`：**只**投影 name/description/parameters。这是防泄漏的关键。\n- `dispatch()`：查表、调 handler，未知工具返回错误。\n\n### 动手破坏一次\n\n把 `schemas()` 改成返回 `t.__dict__`。JSON 序列化会遇到函数对象，即使转成字符串也会泄漏\n宿主实现细节。这验证：**模型 schema 必须用字段白名单投影，不能序列化权威记录。**"
      }
     ]
    },
    {
     "name": "7. 代码解读：注册表如何同时守住开放扩展与执行边界",
     "blocks": [
      {
       "type": "code-walkthrough",
       "id": "l10-code-reading",
       "title": "定义、投影与分派三条路径",
       "source": "main.py",
       "language": "python",
       "segments": [
        {
         "title": "一个定义同时容纳公私字段",
         "start": 31,
         "end": 36,
         "reading": "ToolDefinition 把模型 schema、handler 与 timeout 放在同一权威对象里。",
         "reason": "注册与执行共享同一身份，避免 schema 表和 handler 表分别维护后发生名称漂移；边界由投影函数负责。",
         "code": "class ToolDefinition:\n    name: str\n    description: str\n    parameters: dict[str, Any]          # 面向模型的 JSON schema\n    execute: Callable[[dict], Any]      # handler（宿主侧，绝不给模型）\n    timeout_ms: int | None = None       # 宿主元数据，绝不给模型"
        },
        {
         "title": "注册返回 disposer",
         "start": 39,
         "end": 45,
         "reading": "registry 按 name 保存定义，并返回删除同名项的闭包。",
         "reason": "工具属于插件生命周期；可逆注册让卸载后 schema 与执行能力同时消失。",
         "code": "class ToolRegistry:\n    def __init__(self):\n        self._tools: dict[str, ToolDefinition] = {}\n\n    def register(self, tool: ToolDefinition):\n        self._tools[tool.name] = tool\n        return lambda: self._tools.pop(tool.name, None)  # 可逆注册（呼应 L02）"
        },
        {
         "title": "schemas 使用显式白名单",
         "start": 47,
         "end": 52,
         "reading": "列表推导只重建三个公开字段，不复制 dataclass 的其余属性。",
         "reason": "新增宿主字段时默认不会泄漏；安全边界采用 opt-in，而不是要求开发者记得排除敏感字段。",
         "code": "    def schemas(self) -> list[dict]:\n        \"\"\"只暴露面向模型的字段。handler/timeout 绝不泄漏。\"\"\"\n        return [\n            {\"name\": t.name, \"description\": t.description, \"parameters\": t.parameters}\n            for t in self._tools.values()\n        ]"
        },
        {
         "title": "dispatch 重新取得完整定义",
         "start": 54,
         "end": 58,
         "reading": "name 查表后只在宿主侧调用 execute；未知名称走受控返回。",
         "reason": "模型输出只是请求，不是函数引用。宿主始终保留最终分派权和错误规范。",
         "code": "    def dispatch(self, name: str, arguments: dict) -> Any:\n        tool = self._tools.get(name)\n        if tool is None:\n            return f\"[未知工具] {name}\"\n        return tool.execute(arguments)"
        },
        {
         "title": "新工具只新增数据定义",
         "start": 62,
         "end": 87,
         "reading": "shell、add、echo 以相同结构注册，dispatch 没有新增分支。",
         "reason": "扩展点从修改中央 if 变成追加定义，降低回归范围，也允许不同插件独立贡献工具。",
         "code": "def build_registry() -> ToolRegistry:\n    reg = ToolRegistry()\n\n    reg.register(ToolDefinition(\n        name=\"shell\",\n        description=\"执行一条 shell 命令并返回输出\",\n        parameters={\"command\": {\"type\": \"string\", \"required\": True}},\n        execute=lambda a: run_shell(a.get(\"command\", \"\")),\n        timeout_ms=30000,\n    ))\n\n    reg.register(ToolDefinition(\n        name=\"add\",\n        description=\"计算两个整数之和\",\n        parameters={\"a\": {\"type\": \"integer\", \"required\": True}, \"b\": {\"type\": \"integer\", \"required\": True}},\n        execute=lambda a: a[\"a\"] + a[\"b\"],\n    ))\n\n    reg.register(ToolDefinition(\n        name=\"echo\",\n        description=\"原样返回文本\",\n        parameters={\"text\": {\"type\": \"string\", \"required\": True}},\n        execute=lambda a: a.get(\"text\", \"\"),\n    ))\n\n    return reg"
        }
       ]
      }
     ]
    },
    {
     "name": "8. 相对上一课新增了什么",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "L01 的工具是 if 分支。本课把工具变成注册表里的 **`ToolDefinition` 数据**，\n让\"加工具不用改循环\"成立，并明确\"模型可见字段 vs 宿主私有字段\"的边界。"
      }
     ]
    },
    {
     "name": "9. 简化了什么 vs 真实 DeepSeek Harness",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| `dispatch` 直接调 execute | 一整条 pre/guard/execute/post 管线（见 L11） | 权限、超时、沙箱、结果改写都要能介入 |\n| `parameters` 手写 dict | `defineTool` + 类型化 schema DSL，自动校验/收窄 | 编译期类型安全，运行时校验模型输入 |\n| 返回值随意 | 强制 `output.schema` + `render()` 规范输出 | 结果必须是 lossless JSON，可回放 |\n| 无 UI 投影 | `presentCall` / `presentResult` 纯投影 | UI 在流式和回放时都能渲染卡片 |\n| 全局注册 | 注册落到 scope 层（见 L09） | per-agent 工具集差异化 |\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `ToolDefinition` | `ToolDefinition`（`core/tools`） |\n| `schemas()` | 注册表 `schemas()`（只白名单模型字段） |\n| `dispatch` | 执行管线的入口（见 L11） |\n| `execute` | `ToolDefinition.execute(args, exec)` |\n\n---\n[← 上一课 L09](../L09_scope/README.zh.md) · [返回总览](../../README.md) · [下一课 L11 →](../L11_tool_pipeline/README.zh.md)"
      }
     ]
    }
   ],
   "code": "\"\"\"L10 工具注册表：schema + handler + 分派\n==========================================\nMotto：加一个工具，只加一个定义，循环不用动。\n\nL01 里工具是硬编码的 if 分支。这一课把它做成正规注册表：一个工具 = 一个\nToolDefinition（面向模型的 schema + 执行 handler + 输出规范）。加工具 = 往\n注册表加一条定义，agent loop 完全不用动。\n\n注册表还负责一件关键的事：schemas() 只把\"面向模型的字段\"（name/description/\nparameters）暴露给模型，绝不泄漏 handler、timeout 等宿主元数据。\n\n注意：本课只讲\"注册 + 分派\"。执行时的 pre/guard/execute/post 管线是 L11 的事。\n\n运行：  python lessons/L10_tool_registry/main.py\n\"\"\"\n\nfrom __future__ import annotations\n\nimport json\nimport os\nimport sys\nfrom dataclasses import dataclass\nfrom typing import Any, Callable\n\nsys.path.insert(0, os.path.join(os.path.dirname(__file__), \"..\", \"..\"))\n\nfrom shared.shell import run_shell  # noqa: E402\n\n\n@dataclass\nclass ToolDefinition:\n    name: str\n    description: str\n    parameters: dict[str, Any]          # 面向模型的 JSON schema\n    execute: Callable[[dict], Any]      # handler（宿主侧，绝不给模型）\n    timeout_ms: int | None = None       # 宿主元数据，绝不给模型\n\n\nclass ToolRegistry:\n    def __init__(self):\n        self._tools: dict[str, ToolDefinition] = {}\n\n    def register(self, tool: ToolDefinition):\n        self._tools[tool.name] = tool\n        return lambda: self._tools.pop(tool.name, None)  # 可逆注册（呼应 L02）\n\n    def schemas(self) -> list[dict]:\n        \"\"\"只暴露面向模型的字段。handler/timeout 绝不泄漏。\"\"\"\n        return [\n            {\"name\": t.name, \"description\": t.description, \"parameters\": t.parameters}\n            for t in self._tools.values()\n        ]\n\n    def dispatch(self, name: str, arguments: dict) -> Any:\n        tool = self._tools.get(name)\n        if tool is None:\n            return f\"[未知工具] {name}\"\n        return tool.execute(arguments)\n\n\n# ---- 定义三个工具（加工具只需加定义）----\ndef build_registry() -> ToolRegistry:\n    reg = ToolRegistry()\n\n    reg.register(ToolDefinition(\n        name=\"shell\",\n        description=\"执行一条 shell 命令并返回输出\",\n        parameters={\"command\": {\"type\": \"string\", \"required\": True}},\n        execute=lambda a: run_shell(a.get(\"command\", \"\")),\n        timeout_ms=30000,\n    ))\n\n    reg.register(ToolDefinition(\n        name=\"add\",\n        description=\"计算两个整数之和\",\n        parameters={\"a\": {\"type\": \"integer\", \"required\": True}, \"b\": {\"type\": \"integer\", \"required\": True}},\n        execute=lambda a: a[\"a\"] + a[\"b\"],\n    ))\n\n    reg.register(ToolDefinition(\n        name=\"echo\",\n        description=\"原样返回文本\",\n        parameters={\"text\": {\"type\": \"string\", \"required\": True}},\n        execute=lambda a: a.get(\"text\", \"\"),\n    ))\n\n    return reg\n\n\nif __name__ == \"__main__\":\n    reg = build_registry()\n\n    print(\"===== 发给模型的 schema（注意：没有 execute / timeout_ms）=====\")\n    print(json.dumps(reg.schemas(), ensure_ascii=False, indent=2))\n\n    print(\"\\n===== 循环通过注册表分派调用（loop 不认识具体工具）=====\")\n    for name, args in [(\"add\", {\"a\": 2, \"b\": 3}), (\"echo\", {\"text\": \"hello\"}), (\"shell\", {\"command\": \"echo via registry\"}), (\"nope\", {})]:\n        result = reg.dispatch(name, args)\n        print(f\"  {name}({args}) → {result!r}\")\n",
   "locPct": 46
  },
  {
   "id": "L11",
   "dir": "L11_tool_pipeline",
   "num": "11",
   "title": "工具执行管线与策略",
   "fullTitle": "L11 工具执行管线与策略",
   "subtitle": "pre/guard/execute/post 管线",
   "motto": "pre → guard → execute → post → result，策略挂在管线上而非工具里。",
   "layer": "tools",
   "loc": 133,
   "hasCode": true,
   "sections": [
    {
     "name": "1. 30 秒运行",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "运行前先判断：权限拒绝后 post hook 应不应该运行？两个并发安全工具与一个不安全工具同批\n出现时，是否应该三个一起 gather？结果脱敏应发生在 tool/result 冻结之前还是之后？\n\n```powershell\npython lessons/L11_tool_pipeline/main.py\n```\n\n预期输出（节选）：\n\n```text\n### 单个工具穿过管线\n    tool/call echo({'text': 'the secret is 42'})\n    tool/result echo → 'the *** is 42'          ← post 改写脱敏\n    tool/call shell({'command': 'rm -rf /'})\n      pre-execute: 拒绝 shell                     ← pre 权限拒绝\n    tool/call sleep(...)  execute: sleep 超时       ← 超时策略\n\n### 一批工具：并发安全的用 parallel 同时执行\n  [并发批] 2 个并发安全工具用 parallel 同时执行\n    tool/result fetchB → 'fetched:B'             ← B 更快先完成\n    tool/result fetchA → 'fetched:A'\n  [顺序] write 非并发安全，单独执行\n```"
      }
     ]
    },
    {
     "name": "2. 观察输出",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "同一条管线处理了四种情况：结果被 post 钩子**脱敏**、危险命令被 pre **拒绝**、\n慢工具**超时**、两个并发安全工具用 **parallel 同时执行**（B 比 A 先完成）而\n非并发安全的 write 单独跑。工具本身对这些策略**一无所知**。"
      }
     ]
    },
    {
     "name": "3. 为什么需要这一层",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "L10 的 `dispatch` 是裸执行。但真实世界里，一次工具调用要经过权限审批、\n沙箱包裹、超时控制、结果脱敏……如果把这些塞进每个工具，工具会变得又长又耦合，\n而且每个工具都得重复实现一遍。\n\n**dsh 把策略从工具里剥离，挂到执行管线上。** 工具只管\"做事\"，管线管\"能不能做、\n做多久、结果怎么处理\"。这就是 pre/guard/execute/post 四段的意义。"
      }
     ]
    },
    {
     "name": "4. 心智模型",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "管线就是**机场安检 + 登机 + 行李处理**："
      },
      {
       "type": "stepper",
       "id": "tool-airport",
       "title": "一次工具调用怎样穿过管线",
       "steps": [
        {
         "title": "值机",
         "detail": "记录 `tool/call`，为这次调用建立可追踪身份。"
        },
        {
         "title": "安检",
         "detail": "`tools/pre-execute` 检查权限和沙箱策略，决定放行、拒绝或询问。"
        },
        {
         "title": "过闸机",
         "detail": "单调 guard 做最后检查，已经收紧的限制不能被后续环节放宽。"
        },
        {
         "title": "登机执行",
         "detail": "`tools/execute` 负责真实执行、超时与重试；安全调用可以并行。"
        },
        {
         "title": "行李分拣",
         "detail": "`tools/post-execute` 可以改写、拦截或补充工具结果。"
        },
        {
         "title": "领取结果",
         "detail": "记录并冻结权威 `tool/result`，后续只读取、不再修改。"
        }
       ]
      }
     ]
    },
    {
     "name": "5. 方案与图",
     "blocks": [
      {
       "type": "flow",
       "id": "tool-pipeline-flow",
       "title": "每个工具都穿过同一条策略管线",
       "nodes": [
        {
         "id": "batch",
         "title": "一批 tool calls",
         "detail": "调度器先按 concurrency_safe 把调用分组。",
         "edges": [
          {
           "target": "parallel",
           "label": "安全调用"
          },
          {
           "target": "serial",
           "label": "有副作用"
          }
         ],
         "position": {
          "column": 1,
          "row": 2
         },
         "kind": "decision"
        },
        {
         "id": "parallel",
         "title": "并发分组",
         "detail": "并发安全的调用可以同时进入各自管线。",
         "edges": [
          {
           "target": "call",
           "label": ""
          }
         ],
         "position": {
          "column": 2,
          "row": 1
         },
         "kind": ""
        },
        {
         "id": "serial",
         "title": "顺序分组",
         "detail": "有副作用的调用按顺序进入同一管线。",
         "edges": [
          {
           "target": "call",
           "label": ""
          }
         ],
         "position": {
          "column": 2,
          "row": 3
         },
         "kind": ""
        },
        {
         "id": "call",
         "title": "记录 tool/call",
         "detail": "先建立可追踪身份，失败路径也不能丢。",
         "edges": [
          {
           "target": "pre",
           "label": ""
          }
         ],
         "position": {
          "column": 3,
          "row": 2
         },
         "kind": ""
        },
        {
         "id": "pre",
         "title": "pre-execute",
         "detail": "权限、审批和沙箱策略可以提前拒绝。",
         "edges": [
          {
           "target": "guard",
           "label": "继续"
          },
          {
           "target": "result",
           "label": "拒绝"
          }
         ],
         "position": {
          "column": 4,
          "row": 2
         },
         "kind": ""
        },
        {
         "id": "guard",
         "title": "单调 guard",
         "detail": "已收紧的限制只能保持或继续收紧，不能被后续放宽。",
         "edges": [
          {
           "target": "execute",
           "label": "放行"
          },
          {
           "target": "result",
           "label": "阻止"
          }
         ],
         "position": {
          "column": 5,
          "row": 2
         },
         "kind": "decision"
        },
        {
         "id": "execute",
         "title": "execute",
         "detail": "执行真实工具，并由 around 层处理超时与重试。",
         "edges": [
          {
           "target": "post",
           "label": "成功"
          },
          {
           "target": "result",
           "label": "超时或异常"
          }
         ],
         "position": {
          "column": 6,
          "row": 2
         },
         "kind": ""
        },
        {
         "id": "post",
         "title": "post-execute",
         "detail": "对成功 outcome 做拦截、替换或补充。",
         "edges": [
          {
           "target": "result",
           "label": ""
          }
         ],
         "position": {
          "column": 7,
          "row": 1
         },
         "kind": ""
        },
        {
         "id": "result",
         "title": "冻结 tool/result",
         "detail": "所有成功、拒绝、异常路径汇入同一个权威结果。",
         "edges": [],
         "position": {
          "column": 8,
          "row": 2
         },
         "kind": "terminal"
        }
       ],
       "variant": "map"
      },
      {
       "type": "markdown",
       "markdown": "### 执行透视：三个调用为什么走出三条不同路径"
      },
      {
       "type": "trace",
       "id": "l11-runtime-xray",
       "title": "echo、shell 与 sleep 穿过同一管线",
       "panels": [
        "管线阶段",
        "outcome 状态",
        "副作用是否发生"
       ],
       "steps": [
        {
         "title": "echo 进入",
         "location": "`execute_one(echo)`",
         "action": "call 被记录，permission 返回 allow。",
         "states": [
          "pre → execute",
          "尚无 outcome。",
          "echo handler 已执行。"
         ]
        },
        {
         "title": "echo 后处理",
         "location": "`redact_post`",
         "action": "secret 被替换为 `***`。",
         "states": [
          "post → result",
          "`isError=False; content=***`",
          "冻结的是脱敏后结果。"
         ]
        },
        {
         "title": "shell 被拒",
         "location": "`permission_policy`",
         "action": "危险命令在 pre 阶段返回 deny。",
         "states": [
          "pre 后立即返回。",
          "`isError=True; denied`",
          "shell handler 从未执行。"
         ]
        },
        {
         "title": "sleep 超时",
         "location": "`asyncio.wait_for`",
         "action": "handler 已启动但超过 0.01s。",
         "states": [
          "execute 捕获 TimeoutError。",
          "`isError=True; timeout`",
          "任务被取消，不进入 post。"
         ]
        },
        {
         "title": "批量分组",
         "location": "`execute_batch`",
         "action": "fetchA/B 进入 safe，write 进入 unsafe。",
         "states": [
          "parallel safe → serial unsafe",
          "结果按批次收集。",
          "两个 fetch 并发，write 单独运行。"
         ]
        }
       ]
      }
     ]
    },
    {
     "name": "6. 代码拆解",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "- `Pipeline.execute_one()`：把一次调用穿过 pre → execute(+timeout) → post → result。\n- `permission_policy`：pre 阶段，`rm` 命令返回 `\"deny\"` 短路。\n- `redact_post`：post 阶段，把 `secret` 替换成 `***`。\n- `execute_batch()`：`concurrency_safe=True` 的工具用 `asyncio.gather` **并发**（呼应 L03 的 parallel），其余顺序执行。\n- 超时用 `asyncio.wait_for` 包裹（around-dispatch 关注点）。"
      },
      {
       "type": "code-focus",
       "id": "pipeline-sketch",
       "title": "把控制流翻译成代码",
       "language": "python",
       "code": "record_call(call)\ndecision = run_pre_policies(tool, call)\nif decision == \"deny\":\n    return freeze_error(call)\nconstraints = run_monotonic_guards(tool, call)\nif constraints.blocked:\n    return freeze_error(call)\noutcome = await execute_with_timeout(tool, call)\noutcome = run_post_hooks(call, outcome)\nreturn freeze_result(call, outcome)",
       "notes": [
        {
         "title": "先记录",
         "start": 1,
         "end": 1,
         "detail": "调用一进入管线就留下事件，失败路径同样可追踪。"
        },
        {
         "title": "前置策略",
         "start": 2,
         "end": 4,
         "detail": "pre policy 可以在真实执行前拒绝，并从统一错误出口返回。"
        },
        {
         "title": "单调守卫",
         "start": 5,
         "end": 7,
         "detail": "guard 只允许保持或收紧约束，不能推翻前面已经形成的限制。"
        },
        {
         "title": "执行与收口",
         "start": 8,
         "end": 10,
         "detail": "执行、post 改写和冻结结果保持固定顺序。"
        }
       ]
      },
      {
       "type": "markdown",
       "markdown": "### 动手破坏一次\n\n把 unsafe 工具也并入 `asyncio.gather`。示例可能仍通过，但 write 一类有顺序副作用的工具失去\n串行保证。这验证：**并发必须是工具显式声明的能力，不能由调度器猜测。**"
      }
     ]
    },
    {
     "name": "7. 代码解读：策略如何介入而不污染工具实现",
     "blocks": [
      {
       "type": "code-walkthrough",
       "id": "l11-code-reading",
       "title": "单调用管线与批量并发是两个层次",
       "source": "main.py",
       "language": "python",
       "segments": [
        {
         "title": "pre 在执行前拥有否决权",
         "start": 43,
         "end": 52,
         "reading": "execute_one 先遍历 pre policies；任何 deny 都直接生成错误 outcome。",
         "reason": "权限必须在外部副作用前完成。写进每个 handler 会重复逻辑，也无法保证所有工具一致执行。",
         "code": "    async def execute_one(self, tool: Tool, call: dict) -> dict:\n        # 1) tool/call 记录\n        print(f\"    tool/call {tool.name}({call})\")\n\n        # 2) pre-execute waterfall（权限/沙箱）\n        for policy in self.pre:\n            decision = policy(tool, call)\n            if decision == \"deny\":\n                print(f\"      pre-execute: 拒绝 {tool.name}\")\n                return {\"name\": tool.name, \"isError\": True, \"content\": \"denied by policy\"}"
        },
        {
         "title": "execute 层统一包裹超时",
         "start": 54,
         "end": 63,
         "reading": "同一 `_run` 被 wait_for 或直接 await；TimeoutError 转成规范化结果。",
         "reason": "工具只描述业务动作，超时是宿主策略。统一包裹后同步与异步 handler 共享错误语义。",
         "code": "        # 3) execute（around：超时）\n        try:\n            if tool.timeout_s:\n                result = await asyncio.wait_for(_run(tool, call), timeout=tool.timeout_s)\n            else:\n                result = await _run(tool, call)\n        except asyncio.TimeoutError:\n            print(f\"      execute: {tool.name} 超时\")\n            return {\"name\": tool.name, \"isError\": True, \"content\": f\"timeout > {tool.timeout_s}s\"}\n"
        },
        {
         "title": "post 改写尚未冻结的 outcome",
         "start": 65,
         "end": 71,
         "reading": "handler 结果先包装，再依次交给 post，最后才返回 tool/result。",
         "reason": "脱敏和 replace 必须发生在权威结果冻结前，否则日志与模型看到的内容会分叉。",
         "code": "        outcome = {\"name\": tool.name, \"isError\": False, \"content\": result}\n        for hook in self.post:\n            outcome = hook(call, outcome)\n\n        # 5) tool/result（冻结）\n        print(f\"    tool/result {tool.name} → {outcome['content']!r}\")\n        return outcome"
        },
        {
         "title": "_run 消除同步异步差异",
         "start": 74,
         "end": 78,
         "reading": "先调用 handler，再判断返回值是否 coroutine；调用方始终 await `_run`。",
         "reason": "注册表可接普通或 async 函数，管线无需为两种工具复制策略逻辑。",
         "code": "async def _run(tool: Tool, call: dict):\n    r = tool.execute(call)\n    if asyncio.iscoroutine(r):\n        return await r\n    return r"
        },
        {
         "title": "批量层按并发契约分组",
         "start": 82,
         "end": 93,
         "reading": "safe 用 gather，unsafe 保持 for 循环顺序；两组结果再合并。",
         "reason": "concurrency_safe 是工具作者的语义保证。调度器只执行契约，不猜测副作用是否可并发。",
         "code": "async def execute_batch(pipeline: Pipeline, tools_and_calls: list[tuple[Tool, dict]]):\n    safe = [(t, c) for t, c in tools_and_calls if t.concurrency_safe]\n    unsafe = [(t, c) for t, c in tools_and_calls if not t.concurrency_safe]\n\n    results = []\n    if safe:\n        print(f\"  [并发批] {len(safe)} 个并发安全工具用 parallel 同时执行\")\n        results += await asyncio.gather(*(pipeline.execute_one(t, c) for t, c in safe))\n    for t, c in unsafe:\n        print(f\"  [顺序] {t.name} 非并发安全，单独执行\")\n        results.append(await pipeline.execute_one(t, c))\n    return results"
        }
       ]
      }
     ]
    },
    {
     "name": "8. 相对上一课新增了什么",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "L10 只有裸 `dispatch`。本课在它外面套上 **pre/guard/execute/post 四段管线**，\n让权限、超时、脱敏等策略挂到管线上；并用 `execute_batch` 补讲 **parallel**\n（真实的 `ordered pre → concurrent execute → ordered post`）。"
      }
     ]
    },
    {
     "name": "9. 简化了什么 vs 真实 DeepSeek Harness",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| pre 返回字符串 | `tools/pre-execute` waterfall + `ctx.approval` 一次性询问 + 单调 guard | 权限有 allow/deny/ask 三态，guard 不可重排 |\n| post 改 dict | `tools/post-execute` waterfall（accept/block/replace/补充上下文） | 钩子可跨工具族，结果可注入后续上下文 |\n| 简单 timeout | `tools/execute` around 包裹 + 协作式取消信号 | 超时要能让工具优雅退出，不能硬杀进程 |\n| concurrency_safe 布尔 | `isConcurrencySafe` + barrier + 有界滚动池，执行前重分类 | 并发要保证不改父状态、共享状态可交换 |\n| 无 finalize/归一化 | `finalizeContent` + 注册表无损归一化 + `tool/result` 冻结 | 内容不变式、失败也走同一出口、结果不可变 |\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `pre` | `tools/pre-execute` waterfall + guard + `ctx.approval` |\n| `execute`(+timeout) | `tools/execute` around 分发 |\n| `post` | `tools/post-execute` waterfall |\n| `execute_batch` 并发 | 并发安全工具的 concurrent execute（parallel） |\n| `tool/result` | 冻结的权威 `tool/result` 事件 |\n\n---\n[← 上一课 L10](../L10_tool_registry/README.zh.md) · [返回总览](../../README.md) · [下一课 L12 →](../L12_capability_seam/README.zh.md)"
      }
     ]
    }
   ],
   "code": "\"\"\"L11 工具执行管线与策略\n=========================\nMotto：pre → guard → execute → post → result，策略挂在管线上而非工具里。\n\nL10 的 dispatch 是\"裸执行\"。真实 dsh 里，一次工具调用要穿过一条管线，\n让权限、超时、沙箱、结果改写等策略都能介入，而工具本身对这些一无所知：\n\n  tool/call (记录)\n    → tools/pre-execute  (waterfall：hooks / 权限 / 沙箱；可 allow/deny/ask)\n    → 单调 guard         (deny 或弃权)\n    → tools/execute      (around：超时、重试、指标；并发执行多个工具 ← parallel!)\n    → tools/post-execute (waterfall：accept / block / replace / 补充上下文)\n    → finalizeContent    (工具自有的最后内容约束)\n    → tool/result        (冻结的权威结果)\n\n本课实现这条管线的骨架，并演示：权限拒绝、超时策略、以及一批并发安全的工具\n用 parallel 同时执行（呼应 L03 的 parallel）。\n\n运行：  python lessons/L11_tool_pipeline/main.py\n\"\"\"\n\nfrom __future__ import annotations\n\nimport asyncio\nimport time\nfrom dataclasses import dataclass, field\nfrom typing import Any, Callable\n\n\n@dataclass\nclass Tool:\n    name: str\n    execute: Callable[[dict], Any]\n    concurrency_safe: bool = False       # 只有显式 True 才能并发（对应 isConcurrencySafe）\n    timeout_s: float | None = None\n\n\n@dataclass\nclass Pipeline:\n    pre: list[Callable] = field(default_factory=list)      # (call) -> \"allow\"/\"deny\"/\"ask\"\n    post: list[Callable] = field(default_factory=list)     # (call, result) -> result'\n\n    async def execute_one(self, tool: Tool, call: dict) -> dict:\n        # 1) tool/call 记录\n        print(f\"    tool/call {tool.name}({call})\")\n\n        # 2) pre-execute waterfall（权限/沙箱）\n        for policy in self.pre:\n            decision = policy(tool, call)\n            if decision == \"deny\":\n                print(f\"      pre-execute: 拒绝 {tool.name}\")\n                return {\"name\": tool.name, \"isError\": True, \"content\": \"denied by policy\"}\n\n        # 3) execute（around：超时）\n        try:\n            if tool.timeout_s:\n                result = await asyncio.wait_for(_run(tool, call), timeout=tool.timeout_s)\n            else:\n                result = await _run(tool, call)\n        except asyncio.TimeoutError:\n            print(f\"      execute: {tool.name} 超时\")\n            return {\"name\": tool.name, \"isError\": True, \"content\": f\"timeout > {tool.timeout_s}s\"}\n\n        # 4) post-execute waterfall（可改写结果）\n        outcome = {\"name\": tool.name, \"isError\": False, \"content\": result}\n        for hook in self.post:\n            outcome = hook(call, outcome)\n\n        # 5) tool/result（冻结）\n        print(f\"    tool/result {tool.name} → {outcome['content']!r}\")\n        return outcome\n\n\nasync def _run(tool: Tool, call: dict):\n    r = tool.execute(call)\n    if asyncio.iscoroutine(r):\n        return await r\n    return r\n\n\n# ---- 一批工具的执行：并发安全的走 parallel，其余顺序执行 ----\nasync def execute_batch(pipeline: Pipeline, tools_and_calls: list[tuple[Tool, dict]]):\n    safe = [(t, c) for t, c in tools_and_calls if t.concurrency_safe]\n    unsafe = [(t, c) for t, c in tools_and_calls if not t.concurrency_safe]\n\n    results = []\n    if safe:\n        print(f\"  [并发批] {len(safe)} 个并发安全工具用 parallel 同时执行\")\n        results += await asyncio.gather(*(pipeline.execute_one(t, c) for t, c in safe))\n    for t, c in unsafe:\n        print(f\"  [顺序] {t.name} 非并发安全，单独执行\")\n        results.append(await pipeline.execute_one(t, c))\n    return results\n\n\n# ---- 策略 ----\ndef permission_policy(tool: Tool, call: dict):\n    if tool.name == \"shell\" and \"rm\" in str(call.get(\"command\", \"\")):\n        return \"deny\"\n    return \"allow\"\n\n\ndef redact_post(call: dict, outcome: dict):\n    if isinstance(outcome[\"content\"], str) and \"secret\" in outcome[\"content\"]:\n        outcome[\"content\"] = outcome[\"content\"].replace(\"secret\", \"***\")\n    return outcome\n\n\nasync def slow_fetch(call):\n    await asyncio.sleep(call.get(\"delay\", 0.03))\n    return f\"fetched:{call.get('url')}\"\n\n\nif __name__ == \"__main__\":\n    pipeline = Pipeline(pre=[permission_policy], post=[redact_post])\n\n    async def main():\n        print(\"### 单个工具穿过管线\")\n        await pipeline.execute_one(Tool(\"echo\", lambda c: c[\"text\"]), {\"text\": \"the secret is 42\"})\n        await pipeline.execute_one(Tool(\"shell\", lambda c: \"ok\"), {\"command\": \"rm -rf /\"})  # 被拒\n        await pipeline.execute_one(Tool(\"sleep\", slow_fetch, timeout_s=0.01), {\"url\": \"x\", \"delay\": 0.5})  # 超时\n\n        print(\"\\n### 一批工具：并发安全的用 parallel 同时执行\")\n        batch = [\n            (Tool(\"fetchA\", slow_fetch, concurrency_safe=True), {\"url\": \"A\", \"delay\": 0.05}),\n            (Tool(\"fetchB\", slow_fetch, concurrency_safe=True), {\"url\": \"B\", \"delay\": 0.02}),\n            (Tool(\"write\", lambda c: \"written\", concurrency_safe=False), {\"path\": \"f\"}),\n        ]\n        t0 = time.perf_counter()\n        await execute_batch(pipeline, batch)\n        print(f\"  两个并发工具总耗时 ~{time.perf_counter()-t0:.2f}s（若串行应 ~0.07s+）\")\n\n    asyncio.run(main())\n",
   "locPct": 61
  },
  {
   "id": "L12",
   "dir": "L12_capability_seam",
   "num": "12",
   "title": "能力 seam：interface / implementation / consumer",
   "fullTitle": "L12 能力 seam：interface / implementation / consumer",
   "subtitle": "interface / impl / consumer",
   "motto": "换一个 provider，就换掉产品的一整块能力。",
   "layer": "tools",
   "loc": 100,
   "hasCode": true,
   "sections": [
    {
     "name": "1. 30 秒运行",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "运行前先猜：`ShellTool` 是否应该根据 provider.name 写 `if local / if sandbox`？如果 consumer\n需要知道实现类型，这条 seam 还算成立吗？沙箱审计日志又应该属于 tool 还是 provider？\n\n```powershell\npython lessons/L12_capability_seam/main.py\n```\n\n预期输出（节选）：\n\n```text\n--- provider = local（真执行）---\n  结果: 'capability\\nseam\\ndemo'\n\n--- provider = sandbox（假远程沙箱，consumer 一行没改）---\n  结果: \"[sandbox] 已在远程隔离环境模拟执行: 'echo capability seam demo'（宿主机未受影响）\"\n  沙箱审计日志: ['echo capability seam demo']\n\n→ 换 provider 就换掉了整块 shell 能力，ShellTool 代码完全没动。\n```"
      }
     ]
    },
    {
     "name": "2. 观察输出",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "同一个 `ShellTool`（consumer），先接本地执行器，再接假沙箱执行器——**代码一行没改**，\n行为却从\"真在本机跑\"变成\"送去远程隔离环境\"。这就是 seam 的威力。"
      }
     ]
    },
    {
     "name": "3. 为什么需要这一层",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "其实 L08 的 `ctx.llm` 就是一个 seam，我们只是没点破。这一课正式把这个模式讲清楚，\n因为它是 dsh\"一切皆可替换\"的核心机制。\n\n真实产品需要：本地开发用本机 shell、云端部署用远程沙箱、测试用假执行器——\n如果 shell 工具直接写死 `subprocess.run`，这些切换就得改工具代码。\n**seam 把\"接口\"和\"实现\"分开，consumer 只依赖接口，换实现就换能力。**"
      }
     ]
    },
    {
     "name": "4. 心智模型",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "seam 就是 **USB 接口标准**："
      },
      {
       "type": "structure",
       "id": "seam-usb-structure",
       "title": "能力 seam 就像 USB 标准",
       "nodes": [
        {
         "title": "ShellExecutor 接口",
         "detail": "只约定 `run(command)`，相当于稳定的 USB 口。",
         "children": [
          {
           "title": "LocalExecutor",
           "detail": "在本机真实执行命令。",
           "children": []
          },
          {
           "title": "SandboxExecutor",
           "detail": "把同一请求送进隔离沙箱。",
           "children": []
          },
          {
           "title": "未来 provider",
           "detail": "只要遵守接口，就能无缝替换。",
           "children": []
          }
         ]
        },
        {
         "title": "ShellTool consumer",
         "detail": "只依赖 ShellExecutor，不知道实际插入了哪个 provider。",
         "children": []
        }
       ]
      }
     ]
    },
    {
     "name": "5. 方案与图",
     "blocks": [
      {
       "type": "flow",
       "id": "seam-roles",
       "title": "Provider 实现契约，Consumer 只面向契约调用",
       "nodes": [
        {
         "id": "local",
         "title": "LocalShellExecutor",
         "detail": "用本机 subprocess 实现同一份 run 契约。",
         "edges": [
          {
           "target": "interface",
           "label": "实现"
          }
         ],
         "position": {
          "column": 1,
          "row": 1
         },
         "kind": ""
        },
        {
         "id": "sandbox",
         "title": "FakeSandboxExecutor",
         "detail": "用隔离执行世界实现相同契约。",
         "edges": [
          {
           "target": "interface",
           "label": "实现"
          }
         ],
         "position": {
          "column": 1,
          "row": 2
         },
         "kind": ""
        },
        {
         "id": "future",
         "title": "未来 Provider",
         "detail": "新 provider 只需遵守契约即可接入。",
         "edges": [
          {
           "target": "interface",
           "label": "实现"
          }
         ],
         "position": {
          "column": 1,
          "row": 3
         },
         "kind": ""
        },
        {
         "id": "interface",
         "title": "ShellExecutor Interface",
         "detail": "稳定约定 run(command)→str，不包含部署细节。",
         "edges": [
          {
           "target": "service",
           "label": ""
          }
         ],
         "position": {
          "column": 2,
          "row": 2
         },
         "kind": "boundary"
        },
        {
         "id": "service",
         "title": "ctx.shell",
         "detail": "profile 选择一个 provider，把能力认领到稳定服务位。",
         "edges": [
          {
           "target": "consumer",
           "label": ""
          }
         ],
         "position": {
          "column": 3,
          "row": 2
         },
         "kind": "state"
        },
        {
         "id": "consumer",
         "title": "ShellTool Consumer",
         "detail": "只注入 ctx.shell 并调用 run，不知道当前 provider 是谁。",
         "edges": [],
         "position": {
          "column": 4,
          "row": 2
         },
         "kind": "terminal"
        }
       ],
       "variant": "map"
      },
      {
       "type": "markdown",
       "markdown": "### 执行透视：替换 provider 时哪一层发生变化"
      },
      {
       "type": "trace",
       "id": "l12-runtime-xray",
       "title": "同一个 ShellTool 的两次调用",
       "panels": [
        "Interface 契约",
        "当前 Provider 世界",
        "Consumer 代码"
       ],
       "steps": [
        {
         "title": "构造本地工具",
         "location": "`ShellTool(LocalShellExecutor())`",
         "action": "本地实现注入 consumer。",
         "states": [
          "`run(command) -> str`",
          "宿主机 subprocess。",
          "`call → executor.run` 不变。"
         ]
        },
        {
         "title": "本地调用",
         "location": "`tool_local.call`",
         "action": "命令经接口抵达 run_shell。",
         "states": [
          "契约满足。",
          "真实执行并返回输出。",
          "不检查 provider 类型。"
         ]
        },
        {
         "title": "构造沙箱工具",
         "location": "`ShellTool(FakeSandboxExecutor())`",
         "action": "只替换注入对象。",
         "states": [
          "同一契约。",
          "隔离环境 + audit_log。",
          "完全相同的 ShellTool。"
         ]
        },
        {
         "title": "沙箱调用",
         "location": "`tool_sandbox.call`",
         "action": "命令被记录并生成模拟结果。",
         "states": [
          "返回仍是 str。",
          "宿主机没有执行命令。",
          "无分支、无改动。"
         ]
        },
        {
         "title": "观察审计",
         "location": "`sandbox.audit_log`",
         "action": "provider 暴露实现特有运维状态。",
         "states": [
          "不属于公共 run 契约。",
          "只有沙箱拥有。",
          "ShellTool 无需消费。"
         ]
        }
       ]
      }
     ]
    },
    {
     "name": "6. 代码拆解",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "- `ShellExecutor`：**interface**（Service Definition），只约定 `run(command)`。\n- `LocalShellExecutor` / `FakeSandboxExecutor`：两个 **implementation**（Provider）。后者带审计日志，模拟远程隔离。\n- `ShellTool`：**consumer**，构造时注入一个 `ShellExecutor`，只调 `.run()`，不关心具体实现。\n- main 里换一个 provider，`ShellTool` 行为立变——代码零改动。\n\n### 动手破坏一次\n\n让 `ShellTool.call` 使用 `isinstance` 区分两个 provider。添加第三个实现时就必须修改 consumer，\n这验证：**consumer 只能依赖接口语义；实现特有分支一旦进入 consumer，seam 就被击穿。**"
      }
     ]
    },
    {
     "name": "7. 代码解读：三角色怎样把替换范围限制在组装点",
     "blocks": [
      {
       "type": "code-walkthrough",
       "id": "l12-code-reading",
       "title": "interface、provider、consumer 的依赖方向",
       "source": "main.py",
       "language": "python",
       "segments": [
        {
         "title": "Interface 只描述可观察行为",
         "start": 32,
         "end": 38,
         "reading": "ShellExecutor 声明 name 与 run(command)，默认实现只抛 NotImplementedError。",
         "reason": "接口不携带进程、网络或审计细节，才能同时描述本地和远程执行世界。",
         "code": "class ShellExecutor:\n    \"\"\"能力接口：给一条命令，返回输出。谁实现都行。\"\"\"\n\n    name = \"abstract\"\n\n    def run(self, command: str) -> str:\n        raise NotImplementedError"
        },
        {
         "title": "本地 provider 封装真实副作用",
         "start": 44,
         "end": 50,
         "reading": "LocalShellExecutor 把公共 run 契约适配到 shared.run_shell。",
         "reason": "平台差异和 subprocess 细节停留在 provider 内，不扩散到工具或 Agent Loop。",
         "code": "class LocalShellExecutor(ShellExecutor):\n    \"\"\"本地实现：真的在本机执行（复用 L01 的 shared.shell）。\"\"\"\n\n    name = \"local\"\n\n    def run(self, command: str) -> str:\n        return run_shell(command)"
        },
        {
         "title": "沙箱 provider 拥有另一套状态",
         "start": 53,
         "end": 67,
         "reading": "FakeSandboxExecutor 维护 audit_log，run 只记录命令并返回隔离结果。",
         "reason": "实现可以拥有私有状态与安全模型，只要公共输入输出不变，consumer 就无需感知。",
         "code": "class FakeSandboxExecutor(ShellExecutor):\n    \"\"\"假沙箱实现：不真执行，只记录并返回模拟输出。\n\n    真实 dsh 里这会是 E2B 远程沙箱之类——命令送到远端隔离环境执行，\n    宿主机不受影响。这里用假的证明\"consumer 不用改，行为就变了\"。\n    \"\"\"\n\n    name = \"sandbox\"\n\n    def __init__(self):\n        self.audit_log: list[str] = []\n\n    def run(self, command: str) -> str:\n        self.audit_log.append(command)\n        return f\"[sandbox] 已在远程隔离环境模拟执行: {command!r}（宿主机未受影响）\""
        },
        {
         "title": "Consumer 只转发到接口",
         "start": 73,
         "end": 80,
         "reading": "ShellTool 构造时接收 ShellExecutor，call 中只有一行 `executor.run`。",
         "reason": "依赖箭头从 consumer 指向 interface，而非具体 provider；替换范围缩小到依赖组装点。",
         "code": "class ShellTool:\n    \"\"\"consumer：注入一个 ShellExecutor，自己不关心它是哪种实现。\"\"\"\n\n    def __init__(self, executor: ShellExecutor):\n        self._executor = executor  # 只认接口\n\n    def call(self, command: str) -> str:\n        return self._executor.run(command)"
        },
        {
         "title": "入口通过注入选择执行世界",
         "start": 83,
         "end": 96,
         "reading": "两次构造只替换 executor，随后调用相同的 `tool.call(command)`。",
         "reason": "产品配置决定实现，业务代码不决定。真实 profile/bundle 正是把这个组装点声明化。",
         "code": "if __name__ == \"__main__\":\n    command = \"echo capability seam demo\"\n\n    print(\"### 同一个 consumer（ShellTool），换不同 provider\")\n\n    print(f\"\\n--- provider = local（真执行）---\")\n    tool_local = ShellTool(LocalShellExecutor())\n    print(f\"  结果: {tool_local.call(command)!r}\")\n\n    print(f\"\\n--- provider = sandbox（假远程沙箱，consumer 一行没改）---\")\n    sandbox = FakeSandboxExecutor()\n    tool_sandbox = ShellTool(sandbox)\n    print(f\"  结果: {tool_sandbox.call(command)!r}\")\n    print(f\"  沙箱审计日志: {sandbox.audit_log}\")"
        }
       ]
      }
     ]
    },
    {
     "name": "8. 相对上一课新增了什么",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "前面的能力（llm、shell）都是\"用着但没点破\"。本课把 **seam 三角色\n（interface / implementation / consumer）** 正式讲清，并做一个可切换的 provider demo，\n把\"换 provider 就换能力\"从概念变成可运行的证据。"
      }
     ]
    },
    {
     "name": "9. 简化了什么 vs 真实 DeepSeek Harness",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| Python 抽象类 | Cordis `Service`（abstract class），认领 `ctx.<key>` | 服务有生命周期、类型词汇、依赖注入 |\n| 手动 new + 注入 | provider 注册进 `ctx`，consumer 用 `inject` 找 | 组合由 profile/bundle 决定（见 L20） |\n| 只有 shell | fs / subprocess / llm / subagent / compaction 都是 seam | 每块能力独立可换 |\n| 单一实现选一个 | subagent 允许**多个**同类 provider 按名注册 | 一个 agent 可同时用 spawn/fork/codex 等 |\n| 假沙箱 | fs + subprocess 共享执行世界，一起换成 E2B 远程沙箱 | 换一处，Bash/PTY/LSP 全跟着搬，无需 fork provider |\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `ShellExecutor` | `ShellExecutor`（`dsh-shell` Service Definition，`ctx.shell`） |\n| `LocalShellExecutor` | `dsh-bash-local` |\n| `FakeSandboxExecutor` | `dsh-bash-sandbox` / E2B provider |\n| `ShellTool` | `dsh-tool-bash`（consumer） |\n\n---\n[← 上一课 L11](../L11_tool_pipeline/README.zh.md) · [返回总览](../../README.md) · [下一课 L13 →](../L13_system_prompt/README.zh.md)"
      }
     ]
    }
   ],
   "code": "\"\"\"L12 能力 seam：interface / implementation / consumer\n======================================================\nMotto：换一个 provider，就换掉产品的一整块能力。\n\n前面几课其实一直在用 seam，只是没点破：ctx.llm（L08）就是一个 seam。这一课\n正式讲清 seam 的三角色，并做一个能真正切换的 demo：\n\n  interface（Service Definition）：定义能力接口 + ctx.<key>，如 ShellExecutor。\n  implementation（Service Provider）：一个或多个实现，如 本地执行 / 假沙箱。\n  consumer：使用该能力的一方，通常是面向模型的工具，如 shell 工具。\n\n关键威力：consumer 只依赖 interface。换一个 implementation，consumer 一行不改，\n整块能力的行为就变了——本课把\"本地执行\"换成\"假远程沙箱\"，shell 工具无感。\n真实 dsh 里，把 fs + subprocess 一起换成远程沙箱，Bash/PTY/LSP 全跟着搬。\n\n运行：  python lessons/L12_capability_seam/main.py\n\"\"\"\n\nfrom __future__ import annotations\n\nimport os\nimport sys\n\nsys.path.insert(0, os.path.join(os.path.dirname(__file__), \"..\", \"..\"))\n\nfrom shared.shell import run_shell  # noqa: E402\n\n\n# ==========================================================================\n# ① interface（Service Definition）\n# ==========================================================================\nclass ShellExecutor:\n    \"\"\"能力接口：给一条命令，返回输出。谁实现都行。\"\"\"\n\n    name = \"abstract\"\n\n    def run(self, command: str) -> str:\n        raise NotImplementedError\n\n\n# ==========================================================================\n# ② implementations（Service Providers）—— 两个可互换实现\n# ==========================================================================\nclass LocalShellExecutor(ShellExecutor):\n    \"\"\"本地实现：真的在本机执行（复用 L01 的 shared.shell）。\"\"\"\n\n    name = \"local\"\n\n    def run(self, command: str) -> str:\n        return run_shell(command)\n\n\nclass FakeSandboxExecutor(ShellExecutor):\n    \"\"\"假沙箱实现：不真执行，只记录并返回模拟输出。\n\n    真实 dsh 里这会是 E2B 远程沙箱之类——命令送到远端隔离环境执行，\n    宿主机不受影响。这里用假的证明\"consumer 不用改，行为就变了\"。\n    \"\"\"\n\n    name = \"sandbox\"\n\n    def __init__(self):\n        self.audit_log: list[str] = []\n\n    def run(self, command: str) -> str:\n        self.audit_log.append(command)\n        return f\"[sandbox] 已在远程隔离环境模拟执行: {command!r}（宿主机未受影响）\"\n\n\n# ==========================================================================\n# ③ consumer —— 面向模型的 shell 工具，只依赖 interface\n# ==========================================================================\nclass ShellTool:\n    \"\"\"consumer：注入一个 ShellExecutor，自己不关心它是哪种实现。\"\"\"\n\n    def __init__(self, executor: ShellExecutor):\n        self._executor = executor  # 只认接口\n\n    def call(self, command: str) -> str:\n        return self._executor.run(command)\n\n\nif __name__ == \"__main__\":\n    command = \"echo capability seam demo\"\n\n    print(\"### 同一个 consumer（ShellTool），换不同 provider\")\n\n    print(f\"\\n--- provider = local（真执行）---\")\n    tool_local = ShellTool(LocalShellExecutor())\n    print(f\"  结果: {tool_local.call(command)!r}\")\n\n    print(f\"\\n--- provider = sandbox（假远程沙箱，consumer 一行没改）---\")\n    sandbox = FakeSandboxExecutor()\n    tool_sandbox = ShellTool(sandbox)\n    print(f\"  结果: {tool_sandbox.call(command)!r}\")\n    print(f\"  沙箱审计日志: {sandbox.audit_log}\")\n\n    print(\"\\n→ 换 provider 就换掉了整块 shell 能力，ShellTool 代码完全没动。\")\n    print(\"  真实 dsh 里，fs + subprocess 共享一个执行世界，\")\n    print(\"  把它们一起指向远程沙箱，Bash / PTY / LSP 全都跟着搬。\")\n",
   "locPct": 46
  },
  {
   "id": "L13",
   "dir": "L13_system_prompt",
   "num": "13",
   "title": "System Prompt 装配",
   "fullTitle": "L13 System Prompt 装配",
   "subtitle": "提示词片段协作组装",
   "motto": "提示词不是一段字符串，是各插件贡献的段落 + 工具 schema 协作组装。",
   "layer": "tools",
   "loc": 79,
   "hasCode": true,
   "sections": [
    {
     "name": "1. 30 秒运行",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "运行前先猜：translator 的人格段落应该在“身份”之前还是之后？动态函数应在注册时执行还是\n每次 assemble 时执行？工具名应由段落插件手写还是由当前 registry 投影？\n\n```powershell\npython lessons/L13_system_prompt/main.py\n```\n\n预期输出（节选）：\n\n```text\n===== 全局 agent 的 system prompt =====\n## 身份\n你是 DeepSeek Harness 教学助手。\n## 环境\n当前工作目录：D:/ds harness；平台：Windows。\n## 时间\n当前时间：2026-08-14。\n## 可用工具\nshell, read\n\n===== translator agent 的 system prompt（多了'人格'段落）=====\n## 身份 ...\n## 人格\n你现在是翻译官，只做翻译。\n...\n## 可用工具\ntranslate\n```"
      }
     ]
    },
    {
     "name": "2. 观察输出",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "system prompt 是**拼**出来的：三个插件各贡献一个段落（身份/环境/时间），\n按 order 排序，末尾加上当前可见的工具名。translator scope 下多出一个\"人格\"段落，\n可用工具也换成了 `translate`——scope 决定了组装内容（呼应 L09）。"
      }
     ]
    },
    {
     "name": "3. 为什么需要这一层",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "新手常把 system prompt 当成一个写死的大字符串。但真实 harness 里，\n\"身份\"来自核心、\"环境信息\"来自 fs 插件、\"可用工具\"来自工具注册表、\n\"skill 提醒\"来自 skill 插件（见 L14）……如果全塞一个字符串，谁都没法独立维护。\n\n**dsh 让每个插件贡献自己的 `PromptSection`**，组装时按顺序拼起来。加一段提示 =\n挂一个 section（可逆，呼应 L02）；段落还能动态生成（插入当前时间/cwd）。"
      }
     ]
    },
    {
     "name": "4. 心智模型",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "system prompt 就像**杂志的拼版**："
      },
      {
       "type": "flow",
       "id": "prompt-magazine",
       "title": "多个插件与运行时上下文共同组装一次 system prompt",
       "nodes": [
        {
         "id": "global",
         "title": "全局插件 sections",
         "detail": "身份、环境、时间等段落对所有 agent 可见。",
         "edges": [
          {
           "target": "sections",
           "label": ""
          }
         ],
         "position": {
          "column": 1,
          "row": 1
         },
         "kind": ""
        },
        {
         "id": "scoped",
         "title": "Scope 专属 sections",
         "detail": "人格等段落只属于特定 agent scope。",
         "edges": [
          {
           "target": "sections",
           "label": ""
          }
         ],
         "position": {
          "column": 1,
          "row": 2
         },
         "kind": ""
        },
        {
         "id": "sections",
         "title": "PromptSection 注册表",
         "detail": "保存 name、order、text 和可选 scope。",
         "edges": [
          {
           "target": "filter",
           "label": ""
          }
         ],
         "position": {
          "column": 2,
          "row": 2
         },
         "kind": "state"
        },
        {
         "id": "scope",
         "title": "当前 agent scope",
         "detail": "同时约束可见段落和可见工具。",
         "edges": [
          {
           "target": "filter",
           "label": "筛段落"
          },
          {
           "target": "tools",
           "label": "筛工具"
          }
         ],
         "position": {
          "column": 3,
          "row": 1
         },
         "kind": "state"
        },
        {
         "id": "filter",
         "title": "Scope 过滤",
         "detail": "保留全局 section 与当前 scope 专属 section。",
         "edges": [
          {
           "target": "sort",
           "label": ""
          }
         ],
         "position": {
          "column": 3,
          "row": 2
         },
         "kind": ""
        },
        {
         "id": "sort",
         "title": "按 order 排序",
         "detail": "多插件贡献仍得到稳定、可预测的段落顺序。",
         "edges": [
          {
           "target": "render",
           "label": ""
          }
         ],
         "position": {
          "column": 4,
          "row": 2
         },
         "kind": ""
        },
        {
         "id": "context",
         "title": "运行时 ctx",
         "detail": "cwd、platform、时间等只在本次组装时求值。",
         "edges": [
          {
           "target": "render",
           "label": ""
          }
         ],
         "position": {
          "column": 5,
          "row": 1
         },
         "kind": "state"
        },
        {
         "id": "render",
         "title": "动态渲染 sections",
         "detail": "静态文本直接取值，函数 section 读取 ctx。",
         "edges": [
          {
           "target": "tools",
           "label": ""
          }
         ],
         "position": {
          "column": 5,
          "row": 2
         },
         "kind": ""
        },
        {
         "id": "tools",
         "title": "附加可见工具 schemas",
         "detail": "使用当前 scope 过滤后的工具清单。",
         "edges": [
          {
           "target": "prompt",
           "label": ""
          }
         ],
         "position": {
          "column": 6,
          "row": 2
         },
         "kind": ""
        },
        {
         "id": "prompt",
         "title": "最终 system prompt",
         "detail": "每次请求得到与当前 agent、环境和能力一致的提示词。",
         "edges": [],
         "position": {
          "column": 7,
          "row": 2
         },
         "kind": "terminal"
        }
       ],
       "variant": "map"
      }
     ]
    },
    {
     "name": "5. 方案与图",
     "blocks": [
      {
       "type": "stepper",
       "id": "prompt-assembly",
       "title": "assemble 的五个动作",
       "steps": [
        {
         "title": "收集",
         "detail": "取得所有已注册 PromptSection。"
        },
        {
         "title": "筛选",
         "detail": "选择全局段落和匹配当前 scope 的段落。"
        },
        {
         "title": "排序",
         "detail": "按 order 稳定排序。"
        },
        {
         "title": "求值并拼接",
         "detail": "调用动态 text 或读取静态 text，拼成带标题的段落。"
        },
        {
         "title": "附加工具清单",
         "detail": "将 tool schemas 作为“可用工具”段落追加。"
        }
       ]
      },
      {
       "type": "markdown",
       "markdown": "### 执行透视：translator prompt 从哪些贡献项装配出来"
      },
      {
       "type": "trace",
       "id": "l13-runtime-xray",
       "title": "段落选择、动态渲染与工具投影",
       "panels": [
        "候选 Sections",
        "chosen / order",
        "Prompt 快照"
       ],
       "steps": [
        {
         "title": "注册贡献",
         "location": "`register`",
         "action": "四个插件贡献身份、环境、时间、人格。",
         "states": [
          "`{身份10, 环境20, 时间30, 人格15@translator}`",
          "尚未选择。",
          "空。"
         ]
        },
        {
         "title": "Scope 过滤",
         "location": "`assemble(translator)`",
         "action": "全局段落与 translator 私有段落入选。",
         "states": [
          "四项。",
          "四项全部 chosen。",
          "尚未渲染。"
         ]
        },
        {
         "title": "稳定排序",
         "location": "`sort(order)`",
         "action": "人格放在身份与环境之间。",
         "states": [
          "不变。",
          "`10 → 15 → 20 → 30`",
          "章节顺序确定。"
         ]
        },
        {
         "title": "动态渲染",
         "location": "`callable(s.text)`",
         "action": "环境与时间读取本次 ctx。",
         "states": [
          "定义未修改。",
          "每项产生当前 body。",
          "cwd/platform/now 进入文本。"
         ]
        },
        {
         "title": "附加工具",
         "location": "`tool_schemas`",
         "action": "当前 scope 工具形成末尾章节。",
         "states": [
          "sections 不复制工具。",
          "顺序不变。",
          "`可用工具: translate`"
         ]
        },
        {
         "title": "拼接返回",
         "location": "`join(parts)`",
         "action": "所有贡献形成一个 system 字符串。",
         "states": [
          "Registry 可继续变化。",
          "本次 chosen 用完。",
          "模型收到不可变快照。"
         ]
        }
       ]
      }
     ]
    },
    {
     "name": "6. 代码拆解",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "- `PromptSection`：一个段落 = name + order + text（静态字符串或 `ctx -> str` 函数）+ 可选 scope。\n- `register()`：挂一个 section，返回 disposer（可逆注册）。\n- `assemble()`：选段落（全局 + 匹配 scope）→ 按 order 排序 → 渲染（静态/动态）→ 附工具名单。\n- main：三个全局段落 + 一个只在 translator scope 的\"人格\"段落，展示两种组装结果。\n\n### 动手破坏一次\n\n把动态 `text(ctx)` 移到 register 时执行。之后修改 cwd 或时间，多次 assemble 仍得到旧值。\n这验证：**注册保存贡献规则，组装才生成当前请求的 prompt 快照。**"
      }
     ]
    },
    {
     "name": "7. 代码解读：提示词如何从字符串变成协作式投影",
     "blocks": [
      {
       "type": "code-walkthrough",
       "id": "l13-code-reading",
       "title": "一次 assemble 的五个确定步骤",
       "source": "main.py",
       "language": "python",
       "segments": [
        {
         "title": "Section 保存规则而非结果",
         "start": 27,
         "end": 32,
         "reading": "section 携带 name、order、静态或动态 text，以及可选 scope。",
         "reason": "插件只声明贡献与相对位置，不必知道其他段落，也不提前冻结运行时环境。",
         "code": "class PromptSection:\n    name: str\n    order: int\n    # text 可以是静态字符串，也可以是接收组装上下文的函数\n    text: str | Callable[[dict], str]\n    scope: object | None = None       # None=全局；否则只在该 scope 组装时出现"
        },
        {
         "title": "注册是可逆贡献",
         "start": 35,
         "end": 41,
         "reading": "service 保存 section，并返回从同一列表移除它的 disposer。",
         "reason": "提示词跟随插件生命周期；卸载能力时，对应行为说明也必须消失。",
         "code": "class SystemPromptService:\n    def __init__(self):\n        self._sections: list[PromptSection] = []\n\n    def register(self, section: PromptSection):\n        self._sections.append(section)\n        return lambda: self._sections.remove(section)  # 可逆注册"
        },
        {
         "title": "scope 决定参与者",
         "start": 43,
         "end": 47,
         "reading": "assemble 选择全局或身份匹配 scope 的段落，再按 order 排序。",
         "reason": "prompt 与工具集一样是 per-agent 能力；身份比较阻止人格跨 agent 泄漏。",
         "code": "    def assemble(self, ctx: dict, scope: object | None = None, tool_schemas: list[dict] | None = None) -> str:\n        # 1) 选出参与本次组装的段落：全局 + 匹配 scope 的\n        chosen = [s for s in self._sections if s.scope is None or s.scope is scope]\n        # 2) 按 order 排序\n        chosen.sort(key=lambda s: s.order)"
        },
        {
         "title": "请求时才渲染",
         "start": 48,
         "end": 52,
         "reading": "callable text 在当前 ctx 上执行，静态字符串直接使用。",
         "reason": "cwd、时间会变化，只有请求时求值才能保证模型看到当前环境。",
         "code": "        # 3) 渲染每个段落（静态或动态）\n        parts = []\n        for s in chosen:\n            body = s.text(ctx) if callable(s.text) else s.text\n            parts.append(f\"## {s.name}\\n{body}\")"
        },
        {
         "title": "工具 schema 是另一条权威投影",
         "start": 53,
         "end": 57,
         "reading": "assemble 接收已过滤 schemas，只提取 name 后附加。",
         "reason": "prompt 服务不复制工具注册规则，避免两份工具名单漂移。",
         "code": "        # 4) 附上工具 schema（来自注册表 + scope 过滤）\n        if tool_schemas:\n            names = \", \".join(t[\"name\"] for t in tool_schemas)\n            parts.append(f\"## 可用工具\\n{names}\")\n        return \"\\n\\n\".join(parts)"
        }
       ]
      }
     ]
    },
    {
     "name": "8. 相对上一课新增了什么",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "前面 12 课从没管过 system prompt。本课把它从\"一段死字符串\"变成\n**多插件贡献的 `PromptSection` + 工具 schema 的协作组装**，并让 scope 决定组装内容。"
      }
     ]
    },
    {
     "name": "9. 简化了什么 vs 真实 DeepSeek Harness",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| 字符串拼接 | `system-prompt/assemble` waterfall，协作式组装 | 段落间可互相感知、可拦截改写 |\n| order 整数排序 | 注册顺序 + scope 链 + `complete` 段落语义 | 复杂的段落优先级与替换规则 |\n| scope 简单匹配 | scope 决定 section、工具 schema、shadowing | per-agent 人格（见 L09） |\n| 工具名单直接列 | `ToolProviderResult`（schemas + knownNames） | 区分\"拼错名\"与\"被 scope 隐藏\" |\n| 无信号 | `AssembleContext` 带 agent 实例与取消信号 | 动态段落可能需要 async 解析 |\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `SystemPromptService` | `ctx.systemPrompt`（`core/system-prompt`） |\n| `PromptSection` | `PromptSection` 注册约定 |\n| `assemble()` | `system-prompt/assemble` waterfall |\n| 工具名单 | `ToolProviderResult.schemas`（来自 L10 + L09） |\n\n---\n[← 上一课 L12](../L12_capability_seam/README.zh.md) · [返回总览](../../README.md) · [下一课 L14 →](../L14_skills/README.zh.md)"
      }
     ]
    }
   ],
   "code": "\"\"\"L13 System Prompt 装配\n=========================\nMotto：提示词不是一段字符串，是各插件贡献的段落 + 工具 schema 协作组装。\n\n到 L12 为止，我们从没认真管过 system prompt。但真实 dsh 里，system prompt 不是\n写死的一大段文本，而是**各插件各自贡献一个段落（PromptSection）**，在一次组装里\n按顺序拼起来，再加上当前可见的工具 schema（来自 L10 注册表 + L09 scope）。\n\n好处：\n  - 加一段提示 = 挂一个 section（可逆注册，呼应 L02 的 effect）。\n  - 段落可以是静态文本，也可以按组装上下文动态生成（如插入当前时间/cwd）。\n  - scope 决定哪些 section、哪些工具进入这次组装（呼应 L09）。\n\n本课实现一个迷你 system-prompt 服务，演示多个插件贡献段落 + 动态段落 + scope 过滤。\n\n运行：  python lessons/L13_system_prompt/main.py\n\"\"\"\n\nfrom __future__ import annotations\n\nimport datetime\nfrom dataclasses import dataclass\nfrom typing import Any, Callable\n\n\n@dataclass\nclass PromptSection:\n    name: str\n    order: int\n    # text 可以是静态字符串，也可以是接收组装上下文的函数\n    text: str | Callable[[dict], str]\n    scope: object | None = None       # None=全局；否则只在该 scope 组装时出现\n\n\nclass SystemPromptService:\n    def __init__(self):\n        self._sections: list[PromptSection] = []\n\n    def register(self, section: PromptSection):\n        self._sections.append(section)\n        return lambda: self._sections.remove(section)  # 可逆注册\n\n    def assemble(self, ctx: dict, scope: object | None = None, tool_schemas: list[dict] | None = None) -> str:\n        # 1) 选出参与本次组装的段落：全局 + 匹配 scope 的\n        chosen = [s for s in self._sections if s.scope is None or s.scope is scope]\n        # 2) 按 order 排序\n        chosen.sort(key=lambda s: s.order)\n        # 3) 渲染每个段落（静态或动态）\n        parts = []\n        for s in chosen:\n            body = s.text(ctx) if callable(s.text) else s.text\n            parts.append(f\"## {s.name}\\n{body}\")\n        # 4) 附上工具 schema（来自注册表 + scope 过滤）\n        if tool_schemas:\n            names = \", \".join(t[\"name\"] for t in tool_schemas)\n            parts.append(f\"## 可用工具\\n{names}\")\n        return \"\\n\\n\".join(parts)\n\n\nif __name__ == \"__main__\":\n    svc = SystemPromptService()\n\n    # 不同插件各自贡献段落\n    svc.register(PromptSection(\"身份\", 10, \"你是 DeepSeek Harness 教学助手。\"))\n    svc.register(PromptSection(\"环境\", 20, lambda c: f\"当前工作目录：{c['cwd']}；平台：{c['platform']}。\"))\n    svc.register(PromptSection(\"时间\", 30, lambda c: f\"当前时间：{c['now']}。\"))\n\n    # 一个只在 translator scope 出现的段落（呼应 L09 shadowing 思想）\n    translator = object()\n    svc.register(PromptSection(\"人格\", 15, \"你现在是翻译官，只做翻译。\", scope=translator))\n\n    base_ctx = {\"cwd\": \"D:/ds harness\", \"platform\": \"Windows\", \"now\": datetime.date(2026, 8, 14)}\n    tools = [{\"name\": \"shell\"}, {\"name\": \"read\"}]\n\n    print(\"===== 全局 agent 的 system prompt =====\")\n    print(svc.assemble(base_ctx, scope=None, tool_schemas=tools))\n\n    print(\"\\n\\n===== translator agent 的 system prompt（多了'人格'段落）=====\")\n    print(svc.assemble(base_ctx, scope=translator, tool_schemas=[{\"name\": \"translate\"}]))\n",
   "locPct": 36
  },
  {
   "id": "L14",
   "dir": "L14_skills",
   "num": "14",
   "title": "Skills：按需加载的知识（两段注入）",
   "fullTitle": "L14 Skills：按需加载的知识（两段注入）",
   "subtitle": "两段式按需注入",
   "motto": "用到什么知识再加载什么。",
   "layer": "context",
   "loc": 81,
   "hasCode": true,
   "sections": [
    {
     "name": "1. 30 秒运行",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "运行前先估算：三个 skill 的完整 body 若都常驻 prompt，和只放 name+summary 相比会多多少\n上下文？模型点名 `code-review` 后，其他两个 body 是否也应该顺便加载？\n\n```powershell\npython lessons/L14_skills/main.py\n```\n\n预期输出（节选）：\n\n```text\n===== 第一段：模型平时只看到目录（省 token）=====\n[可用技能目录 — 需要时用 skill 工具按名加载]\n  - pdf: 处理 PDF：拆分/合并/提取文本\n  - code-review: 结构化代码审查清单\n  - git: 常见 git 工作流\n\n===== 模型决定：'我要做代码审查'，于是调 skill 工具 =====\n  [tool_call] skill({'name': 'code-review'})\n  [tool_result] [skill:code-review 正文已加载] 代码审查步骤：1) ...\n```"
      }
     ]
    },
    {
     "name": "2. 观察输出",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "模型平时只看到一个约 100 字符的**目录**（每个 skill 一句话）。当它决定要做代码审查，\n才调 `skill` 工具把 `code-review` 的**完整正文**作为 tool result 拉进来。其余 skill 的\n正文始终没进上下文。"
      }
     ]
    },
    {
     "name": "3. 为什么需要这一层",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "上下文 token 很贵。把所有领域知识（PDF 操作、代码审查清单、git 工作流……）\n全塞进 system prompt，既烧 token 又让模型分心。\n\n**Skills 用\"渐进披露\"解决：知识分两段。** 目录（名字+摘要）always-on 但极小；\n正文 on-demand，用到才加载。这样模型既\"知道有哪些本事可用\"，又不必一直背着全部细节。"
      }
     ]
    },
    {
     "name": "4. 心智模型",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "Skills 就像**图书馆**："
      },
      {
       "type": "compare",
       "id": "skill-library",
       "title": "目录常驻，正文按需",
       "items": [
        {
         "title": "书架索引卡（always-on）",
         "detail": "模型一直看到 skill 名称和一句简介，占用很少上下文。"
        },
        {
         "title": "借书工具（on-demand）",
         "detail": "确认需要某项知识后才加载完整正文，避免把整座图书馆搬进上下文。"
        }
       ]
      },
      {
       "type": "markdown",
       "markdown": "你不会把整个图书馆搬回家，只借当下要看的那本。"
      }
     ]
    },
    {
     "name": "5. 方案与图",
     "blocks": [
      {
       "type": "flow",
       "id": "skill-two-stage",
       "title": "目录常驻，正文只有被选中才进入上下文",
       "nodes": [
        {
         "id": "catalog",
         "title": "Skill 目录",
         "detail": "provider 只暴露每项知识的 name 与 summary。",
         "edges": [
          {
           "target": "reminder",
           "label": ""
          }
         ],
         "position": {
          "column": 1,
          "row": 1
         },
         "kind": ""
        },
        {
         "id": "reminder",
         "title": "持久 reminder",
         "detail": "pre-step 每轮只把轻量目录注入 messages。",
         "edges": [
          {
           "target": "messages",
           "label": ""
          }
         ],
         "position": {
          "column": 2,
          "row": 1
         },
         "kind": ""
        },
        {
         "id": "messages",
         "title": "当前上下文",
         "detail": "始终包含目录，但默认不包含任何 skill 正文。",
         "edges": [
          {
           "target": "model",
           "label": ""
          }
         ],
         "position": {
          "column": 3,
          "row": 1
         },
         "kind": "state"
        },
        {
         "id": "model",
         "title": "模型判断",
         "detail": "根据当前任务判断是否真的需要某项专业知识。",
         "edges": [
          {
           "target": "load",
           "label": "需要"
          },
          {
           "target": "continue",
           "label": "不需要"
          }
         ],
         "position": {
          "column": 4,
          "row": 1
         },
         "kind": "decision"
        },
        {
         "id": "continue",
         "title": "直接继续任务",
         "detail": "不调用 skill，正文不会占用上下文。",
         "edges": [],
         "position": {
          "column": 5,
          "row": 1
         },
         "kind": "terminal"
        },
        {
         "id": "load",
         "title": "调用 skill(name)",
         "detail": "只按名称读取被选中的那一份正文。",
         "edges": [
          {
           "target": "body",
           "label": ""
          }
         ],
         "position": {
          "column": 4,
          "row": 3
         },
         "kind": ""
        },
        {
         "id": "body",
         "title": "正文 tool result",
         "detail": "完整正文作为工具结果写入当前历史。",
         "edges": [
          {
           "target": "messages",
           "label": "写回上下文"
          }
         ],
         "position": {
          "column": 3,
          "row": 3
         },
         "kind": ""
        }
       ],
       "variant": "map"
      },
      {
       "type": "markdown",
       "markdown": "### 执行透视：知识从“可发现”到“已加载”的两阶段状态"
      },
      {
       "type": "trace",
       "id": "l14-runtime-xray",
       "title": "code-review 被点名前后模型知道什么",
       "panels": [
        "Provider 内知识",
        "Always-on 目录",
        "本轮已加载正文"
       ],
       "steps": [
        {
         "title": "建索引",
         "location": "`SkillProvider(skills)`",
         "action": "三个完整 Skill 按 name 存入 provider。",
         "states": [
          "summary + body 全部可用。",
          "尚未生成。",
          "空。"
         ]
        },
        {
         "title": "注入目录",
         "location": "`build_skill_reminder`",
         "action": "只遍历 name 与 summary。",
         "states": [
          "bodies 留在 provider。",
          "`pdf; code-review; git` 摘要",
          "空。"
         ]
        },
        {
         "title": "模型选择",
         "location": "`tool_call skill(code-review)`",
         "action": "模型根据目录点名一项。",
         "states": [
          "不变。",
          "仍常驻。",
          "尚未返回。"
         ]
        },
        {
         "title": "精确加载",
         "location": "`provider.load(name)`",
         "action": "只查找 code-review。",
         "states": [
          "其他 bodies 未读取。",
          "不变。",
          "`code-review.body`"
         ]
        },
        {
         "title": "返回正文",
         "location": "`skill_tool`",
         "action": "body 包装成 tool result。",
         "states": [
          "Provider 保留全部来源。",
          "不变。",
          "仅一个正文可见。"
         ]
        }
       ]
      }
     ]
    },
    {
     "name": "6. 代码拆解",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "- `Skill`：name + summary（进目录）+ body（按需加载）。\n- `SkillProvider`：`list_summaries()` 给目录，`load(name)` 给正文。真实 dsh 有多种 provider（本地目录/远程）。\n- `build_skill_reminder()`：**第一段**——把目录拼成一段提醒文本。\n- `skill_tool()`：**第二段**——按名加载正文，作为 tool result 返回。\n\n### 动手破坏一次\n\n让 `build_skill_reminder` 同时拼接 body。功能仍正确，但渐进披露消失，所有知识永久占用上下文。\n这验证：**目录负责发现，tool result 负责按需读取，两条注入路径不能合并。**"
      }
     ]
    },
    {
     "name": "7. 代码解读：渐进披露如何由两个不同读接口保证",
     "blocks": [
      {
       "type": "code-walkthrough",
       "id": "l14-code-reading",
       "title": "summary 与 body 的物理分离",
       "source": "main.py",
       "language": "python",
       "segments": [
        {
         "title": "数据模型切开两种粒度",
         "start": 27,
         "end": 30,
         "reading": "Skill 把 summary 与 body 设为不同字段。",
         "reason": "“目录能看什么”成为显式选择，调用者不必用字符串长度猜哪些内容可常驻。",
         "code": "class Skill:\n    name: str\n    summary: str      # 一句话摘要（进目录）\n    body: str         # 完整正文（按需加载）"
        },
        {
         "title": "Provider 提供两个读面",
         "start": 33,
         "end": 44,
         "reading": "`list_summaries` 永不返回 body；`load(name)` 才取完整正文。",
         "reason": "API 自身保护渐进披露，即使 reminder 作者疏忽也拿不到全部正文。",
         "code": "class SkillProvider:\n    \"\"\"一个 skill 来源（这里是内存目录；真实 dsh 有本地目录/远程等 provider）。\"\"\"\n\n    def __init__(self, skills: list[Skill]):\n        self._skills = {s.name: s for s in skills}\n\n    def list_summaries(self) -> list[tuple[str, str]]:\n        return [(s.name, s.summary) for s in self._skills.values()]\n\n    def load(self, name: str) -> str | None:\n        s = self._skills.get(name)\n        return s.body if s else None"
        },
        {
         "title": "第一阶段构造发现索引",
         "start": 48,
         "end": 52,
         "reading": "reminder 遍历 summaries，产生短小且可操作的名单。",
         "reason": "模型需要足够信息决定是否加载，而不需要提前掌握操作细节。",
         "code": "def build_skill_reminder(provider: SkillProvider) -> str:\n    lines = [\"[可用技能目录 — 需要时用 skill 工具按名加载]\"]\n    for name, summary in provider.list_summaries():\n        lines.append(f\"  - {name}: {summary}\")\n    return \"\\n\".join(lines)"
        },
        {
         "title": "第二阶段返回可记录结果",
         "start": 56,
         "end": 60,
         "reading": "skill_tool 精确加载一个 name，并把正文包装成带来源标记的文本。",
         "reason": "正文作为 tool result 进入会话，满足模型可见即已记录；失败也可回放。",
         "code": "def skill_tool(provider: SkillProvider, name: str) -> str:\n    body = provider.load(name)\n    if body is None:\n        return f\"[skill] 找不到技能: {name}\"\n    return f\"[skill:{name} 正文已加载]\\n{body}\""
        },
        {
         "title": "示例证明未点名正文不泄漏",
         "start": 63,
         "end": 81,
         "reading": "先打印目录，再只调用 code-review，最后确认其余项仍是摘要。",
         "reason": "渐进披露要观察“没有发生什么”：未选择 body 未读取、未进入上下文。",
         "code": "if __name__ == \"__main__\":\n    provider = SkillProvider([\n        Skill(\"pdf\", \"处理 PDF：拆分/合并/提取文本\", \"PDF 操作步骤：1) 用 pypdf 打开 2) ... （此处是很长的正文，平时不进上下文）\"),\n        Skill(\"code-review\", \"结构化代码审查清单\", \"代码审查步骤：1) 检查命名 2) 检查边界条件 3) ... （很长）\"),\n        Skill(\"git\", \"常见 git 工作流\", \"git 工作流：1) 分支命名 2) 提交规范 3) ... （很长）\"),\n    ])\n\n    print(\"===== 第一段：模型平时只看到目录（省 token）=====\")\n    reminder = build_skill_reminder(provider)\n    print(reminder)\n    print(f\"\\n  目录约 {len(reminder)} 字符——远小于把所有正文塞进去\")\n\n    print(\"\\n===== 模型决定：'我要做代码审查'，于是调 skill 工具 =====\")\n    print(\"  [tool_call] skill({'name': 'code-review'})\")\n    result = skill_tool(provider, \"code-review\")\n    print(f\"  [tool_result] {result}\")\n\n    print(\"\\n===== 只有被点名的 skill 正文进了上下文，其余仍只在目录里 =====\")\n    print(\"  → 这就是渐进披露：目录 always-on，正文 on-demand\")"
        }
       ]
      }
     ]
    },
    {
     "name": "8. 相对上一课新增了什么",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "L13 让 system prompt 由段落组装。本课引入 **Skills 的两段注入**：\n目录作为持久 reminder（第一段）、正文作为 tool result 按需加载（第二段），\n实现\"知道有什么\"和\"用到才加载\"的分离。"
      }
     ]
    },
    {
     "name": "9. 简化了什么 vs 真实 DeepSeek Harness",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| 目录 = 拼字符串 | 目录经 `agent/pre-step` 作为持久 **user-role reminder** 注入 | 提醒要成为可记录的消息（模型可见即已记录） |\n| 内存 provider | `ctx.skills` 组合本地/内嵌/远程多 provider，分层 + 缓存 | 多来源、失效通知、发现缓存 |\n| load 直接返回 | 正文由 `skill` 工具加载，作为 tool result 进上下文 | 走工具管线（权限/记录/回放） |\n| 无 scope | 注册落 scope 层，同名 most-specific-wins | per-agent 技能集差异化（见 L09） |\n| 无失效 | `skills/change` 事件 + `snapshot()` 重取 | provider 目录变化要通知消费方 |\n\n> **精确表述**（呼应审查意见）：**不是**\"所有 skill 都只通过 tool result 注入\"。\n> 正确的是——**目录靠 reminder 注入（第一段），完整正文才靠 `skill` 工具作为 tool result 加载（第二段）**。\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `SkillProvider` | `ctx.skills` + `dsh-skill-filesystem` |\n| `build_skill_reminder` | `agent/pre-step` 注入的 skill 目录 reminder |\n| `skill_tool` | `dsh-tool-skill` 的 `skill` 工具 |\n| `Skill.summary` / `.body` | `SkillCandidate` 摘要 / `SkillDefinition` 正文 |\n\n---\n[← 上一课 L13](../L13_system_prompt/README.zh.md) · [返回总览](../../README.md) · [下一课 L15 →](../L15_compaction/README.zh.md)"
      }
     ]
    }
   ],
   "code": "\"\"\"L14 Skills：按需加载的知识（两段注入）\n=========================================\nMotto：用到什么知识再加载什么。\n\n上下文很贵。如果把所有领域知识都塞进 system prompt，token 会爆，模型也会分心。\nSkills 的思路：知识分两段暴露——\n\n  第一段（目录，always-on）：只把每个 skill 的\"名字 + 一句话摘要\"作为一条\n     持久提醒注入（真实 dsh 通过 agent/pre-step 作为 user-role reminder）。\n     模型平时只看到这个\"目录\"，很省 token。\n\n  第二段（正文，on-demand）：模型觉得某个 skill 有用时，调 `skill` 工具按名加载，\n     完整正文才作为 tool result 返回，进入这一轮上下文。\n\n这就是\"渐进披露\"。注意：不是\"所有 skill 都只通过 tool result 注入\"——\n目录靠 reminder 注入，正文才靠 tool result 加载。这个区分很重要。\n\n运行：  python lessons/L14_skills/main.py\n\"\"\"\n\nfrom __future__ import annotations\n\nfrom dataclasses import dataclass\n\n\n@dataclass\nclass Skill:\n    name: str\n    summary: str      # 一句话摘要（进目录）\n    body: str         # 完整正文（按需加载）\n\n\nclass SkillProvider:\n    \"\"\"一个 skill 来源（这里是内存目录；真实 dsh 有本地目录/远程等 provider）。\"\"\"\n\n    def __init__(self, skills: list[Skill]):\n        self._skills = {s.name: s for s in skills}\n\n    def list_summaries(self) -> list[tuple[str, str]]:\n        return [(s.name, s.summary) for s in self._skills.values()]\n\n    def load(self, name: str) -> str | None:\n        s = self._skills.get(name)\n        return s.body if s else None\n\n\n# ---- 第一段：把目录作为持久 reminder 注入（模拟 agent/pre-step 的 reminder）----\ndef build_skill_reminder(provider: SkillProvider) -> str:\n    lines = [\"[可用技能目录 — 需要时用 skill 工具按名加载]\"]\n    for name, summary in provider.list_summaries():\n        lines.append(f\"  - {name}: {summary}\")\n    return \"\\n\".join(lines)\n\n\n# ---- 第二段：skill 工具，按需把正文作为 tool result 返回 ----\ndef skill_tool(provider: SkillProvider, name: str) -> str:\n    body = provider.load(name)\n    if body is None:\n        return f\"[skill] 找不到技能: {name}\"\n    return f\"[skill:{name} 正文已加载]\\n{body}\"\n\n\nif __name__ == \"__main__\":\n    provider = SkillProvider([\n        Skill(\"pdf\", \"处理 PDF：拆分/合并/提取文本\", \"PDF 操作步骤：1) 用 pypdf 打开 2) ... （此处是很长的正文，平时不进上下文）\"),\n        Skill(\"code-review\", \"结构化代码审查清单\", \"代码审查步骤：1) 检查命名 2) 检查边界条件 3) ... （很长）\"),\n        Skill(\"git\", \"常见 git 工作流\", \"git 工作流：1) 分支命名 2) 提交规范 3) ... （很长）\"),\n    ])\n\n    print(\"===== 第一段：模型平时只看到目录（省 token）=====\")\n    reminder = build_skill_reminder(provider)\n    print(reminder)\n    print(f\"\\n  目录约 {len(reminder)} 字符——远小于把所有正文塞进去\")\n\n    print(\"\\n===== 模型决定：'我要做代码审查'，于是调 skill 工具 =====\")\n    print(\"  [tool_call] skill({'name': 'code-review'})\")\n    result = skill_tool(provider, \"code-review\")\n    print(f\"  [tool_result] {result}\")\n\n    print(\"\\n===== 只有被点名的 skill 正文进了上下文，其余仍只在目录里 =====\")\n    print(\"  → 这就是渐进披露：目录 always-on，正文 on-demand\")\n",
   "locPct": 37
  },
  {
   "id": "L15",
   "dir": "L15_compaction",
   "num": "15",
   "title": "Compaction：上下文总会满，要腾地方",
   "fullTitle": "L15 Compaction：上下文总会满，要腾地方",
   "subtitle": "surfaceOp:replace 遮蔽",
   "motto": "日志从不删除，只追加一条 replace 事件把旧范围移出 surface。",
   "layer": "context",
   "loc": 139,
   "hasCode": true,
   "sections": [
    {
     "name": "1. 30 秒运行",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "运行前先猜：压缩后日志事件数应该减少还是增加？摘要如果只是一条普通 append 消息，旧消息\n为什么不会继续进入模型 surface？`surfaceOp` 放在 data 内和事件顶层有什么语义差异？\n\n```powershell\npython lessons/L15_compaction/main.py\n```\n\n预期输出（节选）：\n\n```text\n===== 压缩前：日志 10 条事件 =====\n  deriveMessages → 10 条模型消息\n\n===== 执行压缩（保留最近 2 条 surface 事件）=====\n  [compaction] 已把 seq 0..7（8 条）摘要遮蔽\n\n===== 压缩后：日志变成 14 条事件（更多了，不是更少！）=====\n  deriveMessages → 3 条模型消息（surface 变短了）\n    user       用户消息 4\n    assistant  助手回复 4\n    user       [摘要]（此前 8 条消息的摘要：...）\n\n===== 关键：旧事件仍在日志里，可回放 =====\n  日志总事件数 14，其中被遮蔽的旧事件一条没删\n```"
      }
     ]
    },
    {
     "name": "2. 观察输出",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "请盯住这个**反直觉**的现象：压缩后日志**从 10 条变成 14 条**（更多，不是更少！），\n但 `deriveMessages` 投影出的模型消息**从 10 条缩到 3 条**。旧事件一条都没删——\n它们只是被一条\"摘要\"消息在 surface 上遮蔽了。"
      }
     ]
    },
    {
     "name": "3. 为什么需要这一层",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "会话越长，事件越多，模型请求的 token 迟早撑爆。直觉做法是\"删掉旧消息\"——但这会\n**违背 L04 的仅追加铁律**，也毁掉回放和审计能力。\n\n**dsh 的做法：不删，只遮蔽。** 追加一条带 `surfaceOp=replace` 的摘要消息，\n让它在 surface 上盖住旧范围。旧事件仍在日志里、仍可回放，只是不再进入当前模型请求。\n这样既腾出了 token，又没破坏\"唯一真源\"。"
      }
     ]
    },
    {
     "name": "4. 心智模型",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "压缩就像**在长文档上贴便利贴**，而不是**撕掉旧页**："
      },
      {
       "type": "compare",
       "id": "delete-vs-shadow",
       "title": "压缩不是撕页，而是遮蔽",
       "items": [
        {
         "title": "撕掉旧页（错误）",
         "detail": "删除 seq 0..7 后历史永久消失，无法回放也无法审计。"
        },
        {
         "title": "便利贴遮蔽（dsh）",
         "detail": "追加摘要并用 `surfaceOp:replace` 遮住旧范围；原事件仍在，shadowedSeqs 保存关联。"
        }
       ]
      }
     ]
    },
    {
     "name": "5. 方案与图",
     "blocks": [
      {
       "type": "stepper",
       "id": "compaction-lifecycle",
       "title": "一次压缩怎样安全落进日志",
       "steps": [
        {
         "title": "开始并加锁",
         "detail": "追加 log-only 的 `compaction/start`。"
        },
        {
         "title": "写入摘要",
         "detail": "追加 user/message，并携带 replace 的 start/end 范围。"
        },
        {
         "title": "记录遮蔽关系",
         "detail": "追加 compaction/summary，保存 shadowedSeqs 与 shadowedRange。"
        },
        {
         "title": "结束并解锁",
         "detail": "追加 `compaction/end`，表示这次压缩完整结束。"
        },
        {
         "title": "重新投影",
         "detail": "deriveMessages 跳过被遮蔽事件，但让摘要消息本身进入 surface。"
        }
       ]
      },
      {
       "type": "markdown",
       "markdown": "### 执行透视：日志增长时，模型 surface 为什么反而变短"
      },
      {
       "type": "trace",
       "id": "l15-runtime-xray",
       "title": "replace 事件如何遮蔽但不删除历史",
       "panels": [
        "Append-only 日志",
        "Active Surface Seq",
        "deriveMessages"
       ],
       "steps": [
        {
         "title": "压缩前",
         "location": "`10 个 surface events`",
         "action": "五轮 user/assistant 全部 append。",
         "states": [
          "`seq 0…9`",
          "`{0,1,2,3,4,5,6,7,8,9}`",
          "10 条消息。"
         ]
        },
        {
         "title": "选择旧范围",
         "location": "`surface[:-keep_last]`",
         "action": "最近两条保留，其余八条待遮蔽。",
         "states": [
          "日志未改。",
          "暂仍全部 active。",
          "暂仍 10 条。"
         ]
        },
        {
         "title": "开始记账",
         "location": "`compaction/start`",
         "action": "记录动作开始，事件不是 surface。",
         "states": [
          "新增 `seq10`。",
          "不变。",
          "不变。"
         ]
        },
        {
         "title": "追加摘要",
         "location": "`replace(0,7)`",
         "action": "摘要 user/message 指定遮蔽范围。",
         "states": [
          "新增 `seq11 summary`。",
          "`{8,9,11}`",
          "摘要 + 最近两条。"
         ]
        },
        {
         "title": "追加证据",
         "location": "`summary/end`",
         "action": "shadowedSeqs 与结束事实继续写日志。",
         "states": [
          "总事件数变 14。",
          "仍 `{8,9,11}`",
          "仍 3 条。"
         ]
        },
        {
         "title": "重新投影",
         "location": "`derive_messages`",
         "action": "先收集 shadowed，再跳过 0…7。",
         "states": [
          "旧事件完整保留。",
          "replace 决定当前 surface。",
          "3 条消息。"
         ]
        }
       ]
      }
     ]
    },
    {
     "name": "6. 代码拆解",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "- `compact()`：实现 **shadow 三件套**——① `compaction/start`（log-only 加锁）\n  ② 一条带 `surfaceOp:replace` 的 `user/message`（假摘要，真正的 surface 变更）\n  ③ `compaction/summary` 记 `shadowedSeqs` + `compaction/end`（log-only 解锁）。\n- `derive_messages()`：先收集所有被 replace 覆盖的 seq，投影时跳过它们，但摘要消息进 surface。\n- 触发条件：本课用\"surface 超过 keep_last 条\"，真实 dsh 用 token 压力检测。\n- ★ **surfaceOp 是 `SessionEvent` 的顶层字段**（与 `data` 平级），不是塞进 `data`。\n  而且它对每个 surface 事件（user/assistant/tool）**必填**：普通消息声明 `{op:'append'}`，\n  压缩摘要声明 `{op:'replace', start, end}`；非 surface 事件（turn/step、compaction/*）绝不携带它。\n  本课 `Session.append()` 已按此约定强制。\n\n### 动手破坏一次\n\n把摘要的 `surface_op` 改成普通 append。压缩后会同时出现旧消息与摘要，上下文反而更长。\n这验证：**摘要文本本身不产生压缩，真正改变 surface 的是 replace 操作。**"
      }
     ]
    },
    {
     "name": "7. 代码解读：写侧只追加，读侧如何执行 replace",
     "blocks": [
      {
       "type": "code-walkthrough",
       "id": "l15-code-reading",
       "title": "surfaceOp 连接写入约束与投影规则",
       "source": "main.py",
       "language": "python",
       "segments": [
        {
         "title": "append 在源头校验事件种类",
         "start": 43,
         "end": 60,
         "reading": "surface 类型缺省补 append；非 surface 携带 surface_op 会 assert。",
         "reason": "操作语义位于事件顶层并由写入口约束，投影器不必猜 data 中哪个字段是控制信息。",
         "code": "class Session:\n    def __init__(self):\n        self._events: list[SessionEvent] = []\n\n    def append(self, type, data, surface_op: dict | None = None) -> SessionEvent:\n        # 对齐真实约定：surface 事件必须声明 surfaceOp；默认 append。\n        if type in SURFACE_TYPES:\n            if surface_op is None:\n                surface_op = {\"op\": \"append\"}\n        else:\n            # 非 surface 事件绝不携带 surfaceOp（真实 dsh 在 append 处由编译器强制）\n            assert surface_op is None, f\"非 surface 事件 {type} 不应带 surfaceOp\"\n        ev = SessionEvent(len(self._events), type, data, surface_op)\n        self._events.append(ev)\n        return ev\n\n    def events(self):\n        return list(self._events)"
        },
        {
         "title": "投影先计算遮蔽集合",
         "start": 67,
         "end": 75,
         "reading": "第一遍寻找 replace，把 start…end 展开成 shadowed seq 集合。",
         "reason": "replace 影响更早的事件；先收集再投影，避免单遍时已经把旧消息错误输出。",
         "code": "def derive_messages(events: list[SessionEvent]) -> list[dict]:\n    # 收集所有被遮蔽的 seq（读顶层 surface_op，不是 data）\n    shadowed: set[int] = set()\n    for ev in events:\n        op = ev.surface_op\n        if op and op[\"op\"] == \"replace\":\n            shadowed.update(range(op[\"start\"], op[\"end\"] + 1))\n\n    msgs = []"
        },
        {
         "title": "第二遍生成当前 surface",
         "start": 76,
         "end": 85,
         "reading": "shadowed seq 跳过；replace 事件自身作为摘要 user 消息进入。",
         "reason": "被遮蔽不等于删除，摘要也不是 log-only；它是替代旧范围的新 surface 节点。",
         "code": "    for ev in events:\n        if ev.seq in shadowed:\n            continue  # 被摘要遮蔽，不进 surface（但事件仍在日志里！）\n        if ev.type == \"user/message\":\n            is_summary = ev.surface_op and ev.surface_op[\"op\"] == \"replace\"\n            tag = \"[摘要]\" if is_summary else \"\"\n            msgs.append({\"role\": \"user\", \"content\": tag + ev.data[\"content\"]})\n        elif ev.type == \"assistant/message\":\n            msgs.append({\"role\": \"assistant\", \"content\": ev.data[\"content\"]})\n    return msgs"
        },
        {
         "title": "compact 只追加三件套",
         "start": 88,
         "end": 111,
         "reading": "选择旧范围后，追加 start、replace summary、shadow 证据与 end。",
         "reason": "压缩器不修改缓存、不删除历史；它只向日志提交一组可解释事实。",
         "code": "def compact(session: Session, keep_last: int = 2):\n    \"\"\"把靠前的 surface 事件摘要成一条 replace user/message。\"\"\"\n    # 普通 surface 事件 = op 为 append 的那些\n    surface = [ev for ev in session.events()\n               if ev.type in (\"user/message\", \"assistant/message\")\n               and ev.surface_op and ev.surface_op[\"op\"] == \"append\"]\n    if len(surface) <= keep_last:\n        print(\"  [compaction] surface 事件不多，无需压缩\")\n        return\n\n    to_shadow = surface[:-keep_last]  # 除了最近几条，其余全摘要\n    start, end = to_shadow[0].seq, to_shadow[-1].seq\n\n    # ① log-only 记账：compaction/start（非 surface，不带 surfaceOp）\n    session.append(\"compaction/start\", {\"turn\": 0})\n    # ② surface 替换：一条 surfaceOp=replace 的 user/message（顶层字段！）\n    fake_summary = f\"（此前 {len(to_shadow)} 条消息的摘要：用户在调试 agent，已执行若干命令。）\"\n    session.append(\"user/message\", {\"content\": fake_summary, \"source\": \"compaction\"},\n                   surface_op={\"op\": \"replace\", \"start\": start, \"end\": end})\n    # ③ log-only 记账：compaction/summary（记录被遮蔽的 seq）\n    session.append(\"compaction/summary\", {\"shadowedSeqs\": [ev.seq for ev in to_shadow],\n                                          \"shadowedRange\": {\"start\": start, \"end\": end}})\n    session.append(\"compaction/end\", {\"turn\": 0})\n    print(f\"  [compaction] 已把 seq {start}..{end}（{len(to_shadow)} 条）摘要遮蔽\")"
        },
        {
         "title": "示例比较两个长度",
         "start": 114,
         "end": 139,
         "reading": "分别打印日志总数与 derive 消息数，并展示摘要顶层 surface_op。",
         "reason": "存储历史长度与模型当前视图是两个指标；只看一个会误解 compaction。",
         "code": "if __name__ == \"__main__\":\n    s = Session()\n    # 造一段长会话（每条普通消息自动带 surfaceOp='append'）\n    for i in range(5):\n        s.append(\"user/message\", {\"content\": f\"用户消息 {i}\", \"source\": \"human\"})\n        s.append(\"assistant/message\", {\"content\": f\"助手回复 {i}\"})\n\n    print(f\"===== 压缩前：日志 {len(s.events())} 条事件 =====\")\n    before = derive_messages(s.events())\n    print(f\"  deriveMessages → {len(before)} 条模型消息\")\n    print(f\"  （注意：每条普通消息的顶层 surface_op 都是 {{'op': 'append'}}）\")\n\n    print(\"\\n===== 执行压缩（保留最近 2 条 surface 事件）=====\")\n    compact(s, keep_last=2)\n\n    print(f\"\\n===== 压缩后：日志变成 {len(s.events())} 条事件（更多了，不是更少！）=====\")\n    after = derive_messages(s.events())\n    print(f\"  deriveMessages → {len(after)} 条模型消息（surface 变短了）\")\n    for m in after:\n        print(f\"    {m['role']:<10} {m['content']}\")\n\n    print(\"\\n===== 关键：旧事件仍在日志里，可回放 =====\")\n    print(f\"  日志总事件数 {len(s.events())}，其中被遮蔽的旧事件一条没删\")\n    # 展示那条摘要事件的顶层 surface_op\n    summary_ev = next(ev for ev in s.events() if ev.surface_op and ev.surface_op[\"op\"] == \"replace\")\n    print(f\"  摘要事件 #{summary_ev.seq} 的顶层 surface_op = {summary_ev.surface_op}\")"
        }
       ]
      }
     ]
    },
    {
     "name": "8. 相对上一课新增了什么",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "前面 14 课日志只增不减、surface 等于全部 surface 事件。本课引入 **compaction**：\n在不删日志的前提下，用一条 replace 摘要遮蔽旧范围，让 surface 变短、token 腾出，\n并讲清 **shadow 三件套** 与\"日志仍仅追加\"的关系。"
      }
     ]
    },
    {
     "name": "9. 简化了什么 vs 真实 DeepSeek Harness",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| 按条数触发 | `dsh-compaction-basic` 用 `agent/pre-step` 检测 token 压力，`agent/request-error` 处理上下文溢出 | 要在真正撑爆前压缩，溢出时还能恢复 |\n| 假摘要字符串 | 真调 `ctx.llm.stream()` 生成摘要，`llmStreamCall` 标记 + `rawOutput` 可重建 | 摘要质量决定后续对话，需可重建审计 |\n| shadowedSeqs 简单记录 | `shadowedRange`（surface 位置对，可 start>end）+ 按 surface 顺序的 `shadowedSeqs` | 多次压缩后位置关系复杂，需精确 |\n| 无锁 | `compaction/start`..`end` 括住整个操作，崩溃留可检测的遗留锁 | 中途崩溃不能伪报\"已完成\" |\n| compaction 是内联函数 | compaction 是**能力 seam**（Definition/Provider/Consumer） | 可换 tokenizer/模板后端（见 L12） |\n| surfaceOp 在事件顶层、surface 事件必填（本课已对齐） | 同左：`SessionEvent` 顶层字段，仅三种 surface 事件携带，编译器在 `append` 处强制 | 派生历史的唯一依据，必须严格且类型安全 |\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `compact()` | `ctx.compaction`（`compaction/compaction`） |\n| `surfaceOp:replace` | 摘要承载在带 `surfaceOp:{op:replace}` 的 `user/message` |\n| `shadowedSeqs` | `CompactionResult.shadowedSeqs`（按 surface 顺序） |\n| `compaction/start`,`summary`,`end` | 同名 log-only 事件 |\n\n---\n[← 上一课 L14](../L14_skills/README.zh.md) · [返回总览](../../README.md) · [下一课 L16 →](../L16_subagent/README.zh.md)"
      }
     ]
    }
   ],
   "code": "\"\"\"L15 Compaction：上下文总会满，要腾地方\n=========================================\nMotto：日志从不删除，只追加一条 replace 事件把旧范围移出 surface。\n\n会话越长，事件越多，模型请求的 token 迟早撑爆。Compaction（压缩）的办法：\n把一段旧事件\"摘要\"成一小段，让模型只看到摘要，而不是原始的一大堆。\n\n但这里有个 dsh 最关键的设计（务必讲真，别讲成\"删掉旧消息\"）：\n\n  ★ 压缩从不删除日志！日志永远仅追加（回顾 L04）。\n  ★ 压缩做的是：追加一条 surfaceOp=replace 的 user/message（摘要），\n    它在 surface 上\"遮蔽\"掉旧范围；旧事件仍在日志里，仍可回放，只是不再\n    进入当前模型 surface。\n  ★ shadow 三件套：① log-only 的 compaction/* 记账事件 ② surface 上的替换\n    ③ shadowedSeqs 记录被遮蔽的事件 seq，供回放恢复。\n\n★ 重要对齐（本次修订）：surfaceOp 是 SessionEvent 的**顶层字段**（与 data 平级），\n  不是塞进 data。而且它对每个 surface 事件（user/assistant/tool）都**必填**——\n  普通消息声明 surfaceOp='append'（尾部追加），压缩摘要声明 replace。\n  非 surface 事件（turn/step、compaction/* 等）绝不携带 surfaceOp。\n\n运行：  python lessons/L15_compaction/main.py\n\"\"\"\n\nfrom __future__ import annotations\n\nfrom dataclasses import dataclass\nfrom typing import Any\n\n# 只有这三种是 surface event，必须带 surfaceOp\nSURFACE_TYPES = {\"user/message\", \"assistant/message\", \"tool/result\"}\n\n\n@dataclass\nclass SessionEvent:\n    seq: int\n    type: str\n    data: dict[str, Any]\n    # ★ surface_op 在事件顶层，仅 surface 事件携带（非 surface 事件为 None）\n    surface_op: dict | None = None\n\n\nclass Session:\n    def __init__(self):\n        self._events: list[SessionEvent] = []\n\n    def append(self, type, data, surface_op: dict | None = None) -> SessionEvent:\n        # 对齐真实约定：surface 事件必须声明 surfaceOp；默认 append。\n        if type in SURFACE_TYPES:\n            if surface_op is None:\n                surface_op = {\"op\": \"append\"}\n        else:\n            # 非 surface 事件绝不携带 surfaceOp（真实 dsh 在 append 处由编译器强制）\n            assert surface_op is None, f\"非 surface 事件 {type} 不应带 surfaceOp\"\n        ev = SessionEvent(len(self._events), type, data, surface_op)\n        self._events.append(ev)\n        return ev\n\n    def events(self):\n        return list(self._events)\n\n\n# ==========================================================================\n# deriveMessages：尊重 replace 遮蔽。\n# 一条 surfaceOp={op:replace,start,end} 的事件会遮蔽 [start,end] 内的 surface 事件。\n# ==========================================================================\ndef derive_messages(events: list[SessionEvent]) -> list[dict]:\n    # 收集所有被遮蔽的 seq（读顶层 surface_op，不是 data）\n    shadowed: set[int] = set()\n    for ev in events:\n        op = ev.surface_op\n        if op and op[\"op\"] == \"replace\":\n            shadowed.update(range(op[\"start\"], op[\"end\"] + 1))\n\n    msgs = []\n    for ev in events:\n        if ev.seq in shadowed:\n            continue  # 被摘要遮蔽，不进 surface（但事件仍在日志里！）\n        if ev.type == \"user/message\":\n            is_summary = ev.surface_op and ev.surface_op[\"op\"] == \"replace\"\n            tag = \"[摘要]\" if is_summary else \"\"\n            msgs.append({\"role\": \"user\", \"content\": tag + ev.data[\"content\"]})\n        elif ev.type == \"assistant/message\":\n            msgs.append({\"role\": \"assistant\", \"content\": ev.data[\"content\"]})\n    return msgs\n\n\ndef compact(session: Session, keep_last: int = 2):\n    \"\"\"把靠前的 surface 事件摘要成一条 replace user/message。\"\"\"\n    # 普通 surface 事件 = op 为 append 的那些\n    surface = [ev for ev in session.events()\n               if ev.type in (\"user/message\", \"assistant/message\")\n               and ev.surface_op and ev.surface_op[\"op\"] == \"append\"]\n    if len(surface) <= keep_last:\n        print(\"  [compaction] surface 事件不多，无需压缩\")\n        return\n\n    to_shadow = surface[:-keep_last]  # 除了最近几条，其余全摘要\n    start, end = to_shadow[0].seq, to_shadow[-1].seq\n\n    # ① log-only 记账：compaction/start（非 surface，不带 surfaceOp）\n    session.append(\"compaction/start\", {\"turn\": 0})\n    # ② surface 替换：一条 surfaceOp=replace 的 user/message（顶层字段！）\n    fake_summary = f\"（此前 {len(to_shadow)} 条消息的摘要：用户在调试 agent，已执行若干命令。）\"\n    session.append(\"user/message\", {\"content\": fake_summary, \"source\": \"compaction\"},\n                   surface_op={\"op\": \"replace\", \"start\": start, \"end\": end})\n    # ③ log-only 记账：compaction/summary（记录被遮蔽的 seq）\n    session.append(\"compaction/summary\", {\"shadowedSeqs\": [ev.seq for ev in to_shadow],\n                                          \"shadowedRange\": {\"start\": start, \"end\": end}})\n    session.append(\"compaction/end\", {\"turn\": 0})\n    print(f\"  [compaction] 已把 seq {start}..{end}（{len(to_shadow)} 条）摘要遮蔽\")\n\n\nif __name__ == \"__main__\":\n    s = Session()\n    # 造一段长会话（每条普通消息自动带 surfaceOp='append'）\n    for i in range(5):\n        s.append(\"user/message\", {\"content\": f\"用户消息 {i}\", \"source\": \"human\"})\n        s.append(\"assistant/message\", {\"content\": f\"助手回复 {i}\"})\n\n    print(f\"===== 压缩前：日志 {len(s.events())} 条事件 =====\")\n    before = derive_messages(s.events())\n    print(f\"  deriveMessages → {len(before)} 条模型消息\")\n    print(f\"  （注意：每条普通消息的顶层 surface_op 都是 {{'op': 'append'}}）\")\n\n    print(\"\\n===== 执行压缩（保留最近 2 条 surface 事件）=====\")\n    compact(s, keep_last=2)\n\n    print(f\"\\n===== 压缩后：日志变成 {len(s.events())} 条事件（更多了，不是更少！）=====\")\n    after = derive_messages(s.events())\n    print(f\"  deriveMessages → {len(after)} 条模型消息（surface 变短了）\")\n    for m in after:\n        print(f\"    {m['role']:<10} {m['content']}\")\n\n    print(\"\\n===== 关键：旧事件仍在日志里，可回放 =====\")\n    print(f\"  日志总事件数 {len(s.events())}，其中被遮蔽的旧事件一条没删\")\n    # 展示那条摘要事件的顶层 surface_op\n    summary_ev = next(ev for ev in s.events() if ev.surface_op and ev.surface_op[\"op\"] == \"replace\")\n    print(f\"  摘要事件 #{summary_ev.seq} 的顶层 surface_op = {summary_ev.surface_op}\")\n",
   "locPct": 64
  },
  {
   "id": "L16",
   "dir": "L16_subagent",
   "num": "16",
   "title": "Subagent：大任务拆小，上下文隔离（仅 one-shot）",
   "fullTitle": "L16 Subagent：大任务拆小，上下文隔离（仅 one-shot）",
   "subtitle": "子会话上下文隔离",
   "motto": "每个子任务一份干净的上下文，只回传结果。",
   "layer": "concurrency",
   "loc": 117,
   "hasCode": true,
   "sections": [
    {
     "name": "1. 30 秒运行",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "运行前先猜：子会话里的 shell result 是否应该逐条复制回父会话？如果只回最终结果，父会话\n还需要知道子会话事件数量吗？\n\n```powershell\npython lessons/L16_subagent/main.py\n```\n\n预期输出（节选）：\n\n```text\n[父 assistant] 这个子任务过程会很啰嗦，我委派给子 agent。\n  [spawn] 启动子 agent: '环境探测'（全新独立会话）\n  [spawn] 子 agent 完成，子会话内部有 4 条事件（留在子会话，不回传）\n[父 assistant] 子 agent 回传了结果，我据此收尾：环境探测完毕：一切正常...\n\n===== 上下文隔离证明 =====\n  父会话事件数: 3（干净——子 agent 的中间过程没进来）\n```"
      }
     ]
    },
    {
     "name": "2. 观察输出",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "父 agent 把一个\"啰嗦\"的子任务委派出去。子 agent 在**自己的独立会话**里跑了 4 条事件，\n但父会话只有 3 条——子 agent 的中间过程一条都没污染父上下文。父只拿到最终结论。"
      }
     ]
    },
    {
     "name": "3. 为什么需要这一层",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "主 agent 的上下文很宝贵。有些子任务（\"读完 20 个文件总结架构\"）会产生大量中间噪音。\n如果都堆进主对话，主 agent 很快被淹没、token 也爆。\n\n**Subagent 用\"全新会话 + 只回传结果\"隔离上下文。** 子 agent 有自己独立的事件日志\n（回顾 L04），中间过程留在子会话，父只接收最终结果。这就是\"大任务拆小、上下文隔离\"。"
      }
     ]
    },
    {
     "name": "4. 心智模型",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "Subagent 就像**把活外包**："
      },
      {
       "type": "structure",
       "id": "subagent-structure",
       "title": "项目经理与隔离的外包团队",
       "nodes": [
        {
         "title": "父 agent（项目经理）",
         "detail": "保留主任务上下文，只提出清晰的子任务。",
         "children": [
          {
           "title": "委派边界",
           "detail": "把“环境探测”作为一个独立 prompt 交出去。",
           "children": []
          },
          {
           "title": "子 agent（外包团队）",
           "detail": "在自己的会话里思考、调用工具和记录中间事件。",
           "children": [
            {
             "title": "隔离会话",
             "detail": "啰嗦的中间过程不进入父会话。",
             "children": []
            },
            {
             "title": "最终结论",
             "detail": "只把完成后的结果交回父 agent。",
             "children": []
            }
           ]
          },
          {
           "title": "继续推进",
           "detail": "父 agent 根据结论完成主任务。",
           "children": []
          }
         ]
        }
       ]
      }
     ]
    },
    {
     "name": "5. 方案与图",
     "blocks": [
      {
       "type": "flow",
       "id": "subagent-flow",
       "title": "父子会话之间只交换任务与结论",
       "nodes": [
        {
         "id": "parent",
         "title": "父会话",
         "detail": "接收用户请求并决定委派",
         "edges": [
          {
           "target": "delegate",
           "label": ""
          }
         ]
        },
        {
         "id": "delegate",
         "title": "子任务 prompt",
         "detail": "创建一份全新的隔离会话",
         "edges": [
          {
           "target": "child",
           "label": ""
          }
         ]
        },
        {
         "id": "child",
         "title": "子会话内部执行",
         "detail": "assistant、tool 和中间事件全部留在子会话",
         "edges": [
          {
           "target": "result",
           "label": ""
          }
         ]
        },
        {
         "id": "result",
         "title": "最终结论",
         "detail": "只把 final result 作为 tool result 交回",
         "edges": [
          {
           "target": "finish",
           "label": ""
          }
         ]
        },
        {
         "id": "finish",
         "title": "父 agent 收尾",
         "detail": "父会话依据结论继续，历史保持干净",
         "edges": []
        }
       ]
      },
      {
       "type": "markdown",
       "markdown": "### 执行透视：委派边界两侧各自保存什么"
      },
      {
       "type": "trace",
       "id": "l16-runtime-xray",
       "title": "父会话保持干净，子会话保留完整过程",
       "panels": [
        "Parent Session",
        "Child Session",
        "跨边界载荷"
       ],
       "steps": [
        {
         "title": "父决定委派",
         "location": "`parent_llm.complete`",
         "action": "父返回 subagent call。",
         "states": [
          "`user; assistant(delegate)`",
          "尚不存在。",
          "description + prompt。"
         ]
        },
        {
         "title": "创建隔离会话",
         "location": "`Session(child)`",
         "action": "provider 新建 child。",
         "states": [
          "不变。",
          "空日志。",
          "只传任务输入。"
         ]
        },
        {
         "title": "子执行工具",
         "location": "`run_agent(child)`",
         "action": "子模型调用 shell 并读结果。",
         "states": [
          "不变。",
          "`user; assistant; tool/result`",
          "中间事件不跨界。"
         ]
        },
        {
         "title": "子形成结论",
         "location": "`not wants_tools`",
         "action": "child 返回最终文本。",
         "states": [
          "不变。",
          "新增 final assistant。",
          "`{result,event_count}`"
         ]
        },
        {
         "title": "父接收结果",
         "location": "`messages.append(tool)`",
         "action": "结论成为父侧一个 tool result。",
         "states": [
          "父 history 增加一条观察。",
          "完整日志留在原地。",
          "只回 final result。"
         ]
        },
        {
         "title": "父收尾",
         "location": "`parent_llm.complete`",
         "action": "父根据结论生成答复。",
         "states": [
          "只有父自己的事件。",
          "子过程未复制。",
          "委派完成。"
         ]
        }
       ]
      }
     ]
    },
    {
     "name": "6. 代码拆解",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "- `spawn_subagent()`：**one-shot** provider——建一个全新 `Session`，跑 `run_agent`，只返回 `result`。\n- `run_agent()`：就是 L06 的精简 agent loop，跑在子会话上。\n- 父循环：模型调 `subagent` 工具 → spawn → 把子 agent 的 `result` 作为 tool_result 塞回父历史。\n- 末尾对比父/子会话事件数，证明上下文隔离。\n\n### 动手破坏一次\n\n把 `child.events` 全部追加进 parent messages。父仍能完成任务，但中间噪音会迅速膨胀主上下文。\n这验证：**隔离的价值不只是另开执行器，而是明确限制回传面。**"
      }
     ]
    },
    {
     "name": "7. 代码解读：one-shot provider 如何建立并关闭隔离边界",
     "blocks": [
      {
       "type": "code-walkthrough",
       "id": "l16-code-reading",
       "title": "父任务、子循环与结果回传",
       "source": "main.py",
       "language": "python",
       "segments": [
        {
         "title": "Session 以实例保存事件",
         "start": 31,
         "end": 36,
         "reading": "每个 Session 自带 label 与独立 events。",
         "reason": "隔离首先是状态所有权；父子若共享全局日志，再多 provider 抽象也挡不住污染。",
         "code": "class Session:\n    label: str\n    events: list = field(default_factory=list)\n\n    def append(self, type, data):\n        self.events.append((type, data))"
        },
        {
         "title": "子 agent 运行完整循环",
         "start": 39,
         "end": 55,
         "reading": "run_agent 追加自己的 user、assistant、tool result，并维护 messages。",
         "reason": "子任务需要观察工具结果再决策，因此必须拥有循环与历史，不是一次普通函数调用。",
         "code": "def run_agent(session: Session, llm, prompt: str, max_steps=6) -> str:\n    \"\"\"一个最小 agent loop（就是 L06 的精简版），跑在自己独立的 session 上。\"\"\"\n    session.append(\"user/message\", {\"content\": prompt})\n    messages = [{\"role\": \"user\", \"content\": prompt}]\n    final = \"\"\n    for _ in range(max_steps):\n        turn: AssistantTurn = llm.complete(messages)\n        session.append(\"assistant/message\", {\"text\": turn.text})\n        if not turn.wants_tools:\n            final = turn.text\n            break\n        for tc in turn.tool_calls:\n            result = run_shell(tc.arguments.get(\"command\", \"\")) if tc.name == \"shell\" else f\"[未知] {tc.name}\"\n            session.append(\"tool/result\", {\"result\": result})\n            messages.append({\"role\": \"assistant\", \"content\": turn.text})\n            messages.append({\"role\": \"tool\", \"content\": result})\n    return final"
        },
        {
         "title": "spawn 只返回边界对象",
         "start": 61,
         "end": 66,
         "reading": "新建 child、运行到完成，再返回 result 与诊断计数，不返回 events。",
         "reason": "provider 决定跨会话协议；真正进入父上下文的只有收敛结论。",
         "code": "def spawn_subagent(description: str, prompt: str, sub_llm) -> dict:\n    print(f\"  [spawn] 启动子 agent: {description!r}（全新独立会话）\")\n    child = Session(label=f\"child:{description}\")\n    result = run_agent(child, sub_llm, prompt)\n    print(f\"  [spawn] 子 agent 完成，子会话内部有 {len(child.events)} 条事件（留在子会话，不回传）\")\n    return {\"result\": result, \"child_event_count\": len(child.events)}"
        },
        {
         "title": "父把 subagent 当普通工具",
         "start": 70,
         "end": 80,
         "reading": "父发出结构化 call，第二步从最后一条 tool content 读取结果。",
         "reason": "委派仍遵守“调用—观察”的工具协议，父 Agent Loop 无需特殊控制流。",
         "code": "def parent_script():\n    def s1(_m):\n        return AssistantTurn(\n            text=\"这个子任务过程会很啰嗦，我委派给子 agent。\",\n            tool_calls=[ToolCall(\"c1\", \"subagent\", {\"description\": \"环境探测\", \"prompt\": \"探测运行环境并总结\"})],\n        )\n\n    def s2(m):\n        return AssistantTurn(text=f\"子 agent 回传了结果，我据此收尾：{m[-1]['content']}\")\n\n    return [s1, s2]"
        },
        {
         "title": "子脚本保留中间噪音",
         "start": 83,
         "end": 90,
         "reading": "child 先调用 shell，再生成干净总结。",
         "reason": "两步脚本明确展示哪些过程被挡在隔离边界内。",
         "code": "def child_script():\n    def s1(_m):\n        return AssistantTurn(text=\"子任务：探测环境。\", tool_calls=[ToolCall(\"x1\", \"shell\", {\"command\": \"echo probing\"})])\n\n    def s2(_m):\n        return AssistantTurn(text=\"环境探测完毕：一切正常（这是回传给父 agent 的干净结论）。\")\n\n    return [s1, s2]"
        }
       ]
      }
     ]
    },
    {
     "name": "8. 相对上一课新增了什么",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "前面所有 agent 都是单个。本课引入 **subagent 委派**：把子任务丢进一个独立会话的子 agent，\n用\"全新上下文 + 只回传结果\"实现隔离。"
      }
     ]
    },
    {
     "name": "9. 简化了什么 vs 真实 DeepSeek Harness",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| 只有 one-shot spawn | spawn **和** fork（从父会话分叉）两条启动路径 | fork 能带上父上下文的一部分 |\n| 一个进程内 provider | 六种 provider：spawn-in-process / fork / acp / codex / claude-code / dsh-sdk | 子 agent 可以是另一个产品/远程进程 |\n| 跑完即结束 | continuable（可继续）子 agent + followup + report 返回通道 | 父可与子多轮交互、子可中途汇报 |\n| 无能力校验 | `SubagentCapabilities`（outputSchema/depthLimit/toolFilter/persona）启动前校验 | 请求不支持的能力要\"fail loud\"而非静默降级 |\n| 结果是字符串 | 结构化 `SubagentResult.structured`（按 output schema）+ 冷恢复 | 类型化结果、崩溃后可从存储恢复 |\n\n> **限定说明**（呼应审查意见）：本课只实现 one-shot，标题已限定。真实 subagent seam\n> 是 dsh 里最丰富的能力之一，切勿把这个教学玩具当成它的全部语义。\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `spawn_subagent` | `ctx.subagents` + `dsh-subagent-spawn-in-process` |\n| `subagent` 工具 | `dsh-tool-subagent`（consumer） |\n| 独立 `Session` | 子 agent 的独立会话日志 |\n| `result` 回传 | `SubagentResult`（含 structured） |\n\n---\n[← 上一课 L15](../L15_compaction/README.zh.md) · [返回总览](../../README.md) · [下一课 L17 →](../L17_jobs/README.zh.md)"
      }
     ]
    }
   ],
   "code": "\"\"\"L16 Subagent：大任务拆小，上下文隔离（仅 one-shot）\n=====================================================\nMotto：每个子任务一份干净的上下文，只回传结果。\n\n主 agent 的上下文很宝贵。有些子任务（\"读完这 20 个文件总结架构\"）会产生大量\n中间过程，如果都堆进主对话，主 agent 很快就被噪音淹没。\n\nSubagent 的办法：把子任务委派给一个**全新会话**的子 agent。子 agent 有自己\n独立的事件日志（回顾 L04），跑完后只把**最终结果**回传给父 agent——中间过程\n留在子会话里，不污染父上下文。\n\n★ 本课只实现 one-shot（一次性）子 agent：启动 → 跑完 → 回传结果 → 结束。\n  真实 dsh 的 subagent seam 远比这丰富（见第 8 段），标题特意限定 one-shot。\n\n运行：  python lessons/L16_subagent/main.py\n\"\"\"\n\nfrom __future__ import annotations\n\nimport os\nimport sys\nfrom dataclasses import dataclass, field\n\nsys.path.insert(0, os.path.join(os.path.dirname(__file__), \"..\", \"..\"))\n\nfrom shared.llm import AssistantTurn, ToolCall, make_llm  # noqa: E402\nfrom shared.shell import run_shell  # noqa: E402\n\n\n@dataclass\nclass Session:\n    label: str\n    events: list = field(default_factory=list)\n\n    def append(self, type, data):\n        self.events.append((type, data))\n\n\ndef run_agent(session: Session, llm, prompt: str, max_steps=6) -> str:\n    \"\"\"一个最小 agent loop（就是 L06 的精简版），跑在自己独立的 session 上。\"\"\"\n    session.append(\"user/message\", {\"content\": prompt})\n    messages = [{\"role\": \"user\", \"content\": prompt}]\n    final = \"\"\n    for _ in range(max_steps):\n        turn: AssistantTurn = llm.complete(messages)\n        session.append(\"assistant/message\", {\"text\": turn.text})\n        if not turn.wants_tools:\n            final = turn.text\n            break\n        for tc in turn.tool_calls:\n            result = run_shell(tc.arguments.get(\"command\", \"\")) if tc.name == \"shell\" else f\"[未知] {tc.name}\"\n            session.append(\"tool/result\", {\"result\": result})\n            messages.append({\"role\": \"assistant\", \"content\": turn.text})\n            messages.append({\"role\": \"tool\", \"content\": result})\n    return final\n\n\n# ==========================================================================\n# subagent provider：one-shot。启动一个全新 session 的子 agent，返回结果。\n# ==========================================================================\ndef spawn_subagent(description: str, prompt: str, sub_llm) -> dict:\n    print(f\"  [spawn] 启动子 agent: {description!r}（全新独立会话）\")\n    child = Session(label=f\"child:{description}\")\n    result = run_agent(child, sub_llm, prompt)\n    print(f\"  [spawn] 子 agent 完成，子会话内部有 {len(child.events)} 条事件（留在子会话，不回传）\")\n    return {\"result\": result, \"child_event_count\": len(child.events)}\n\n\n# ---- 脚本：父 agent 决定委派一个子任务；子 agent 独立完成 ----\ndef parent_script():\n    def s1(_m):\n        return AssistantTurn(\n            text=\"这个子任务过程会很啰嗦，我委派给子 agent。\",\n            tool_calls=[ToolCall(\"c1\", \"subagent\", {\"description\": \"环境探测\", \"prompt\": \"探测运行环境并总结\"})],\n        )\n\n    def s2(m):\n        return AssistantTurn(text=f\"子 agent 回传了结果，我据此收尾：{m[-1]['content']}\")\n\n    return [s1, s2]\n\n\ndef child_script():\n    def s1(_m):\n        return AssistantTurn(text=\"子任务：探测环境。\", tool_calls=[ToolCall(\"x1\", \"shell\", {\"command\": \"echo probing\"})])\n\n    def s2(_m):\n        return AssistantTurn(text=\"环境探测完毕：一切正常（这是回传给父 agent 的干净结论）。\")\n\n    return [s1, s2]\n\n\nif __name__ == \"__main__\":\n    parent = Session(label=\"parent\")\n    parent_llm = make_llm(script=parent_script())\n    child_llm = make_llm(script=child_script())\n\n    parent.append(\"user/message\", {\"content\": \"帮我探测环境并给结论\"})\n    messages = [{\"role\": \"user\", \"content\": \"帮我探测环境并给结论\"}]\n\n    print(\"===== 父 agent 开始 =====\")\n    for _ in range(4):\n        turn = parent_llm.complete(messages)\n        parent.append(\"assistant/message\", {\"text\": turn.text})\n        if turn.text:\n            print(f\"[父 assistant] {turn.text}\")\n        if not turn.wants_tools:\n            break\n        for tc in turn.tool_calls:\n            if tc.name == \"subagent\":\n                out = spawn_subagent(tc.arguments[\"description\"], tc.arguments[\"prompt\"], child_llm)\n                messages.append({\"role\": \"assistant\", \"content\": turn.text})\n                messages.append({\"role\": \"tool\", \"content\": out[\"result\"]})\n\n    print(f\"\\n===== 上下文隔离证明 =====\")\n    print(f\"  父会话事件数: {len(parent.events)}（干净——子 agent 的中间过程没进来）\")\n    print(f\"  子 agent 的啰嗦过程留在它自己的会话里，父只拿到最终结论\")\n",
   "locPct": 54
  },
  {
   "id": "L17",
   "dir": "L17_jobs",
   "num": "17",
   "title": "Jobs：慢操作丢后台，agent 继续想",
   "fullTitle": "L17 Jobs：慢操作丢后台，agent 继续想",
   "subtitle": "后台任务与交付控制器",
   "motto": "Jobs 管生命周期，控制器负责把完成事实重新交回 Agent。",
   "layer": "concurrency",
   "loc": 118,
   "hasCode": true,
   "sections": [
    {
     "name": "1. 30 秒运行",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "运行前先判断：后台线程完成后，是 JobRegistry 直接写 agent.inbox，还是只发完成通知？agent\n仍在运行与已经空闲时，结果应走同一种交付方式吗？\n\n```powershell\npython lessons/L17_jobs/main.py\n```\n\n预期输出（节选）：\n\n```text\n===== agent 把慢操作丢后台，立刻继续 =====\n  agent 拿到 bash-1，不等它，继续想下一步...\n  [agent] 我先去分析别的文件（后台任务并行跑着）\n\n===== agent 忙完停下，变为空闲 =====\n    [控制器→followup] 唤醒 agent 新一轮处理: '[后台任务 bash-1 完成] npm run build → 构建成功，0 error'\n\n===== agent 的 inbox（完成事实已由控制器交回）=====\n  [后台任务 bash-1 完成] npm run build → 构建成功，0 error\n```"
      }
     ]
    },
    {
     "name": "2. 观察输出",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "agent 把 `npm run build` 丢后台，立刻拿到 `bash-1` 继续干别的（不傻等）。\n后台任务完成后，**控制器**（不是 jobs 注册表自己）根据 agent 当时的状态，\n选择 `followup` 唤醒它处理这个完成事实。"
      }
     ]
    },
    {
     "name": "3. 为什么需要这一层",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "编译、跑测试、下载都很慢。agent 傻等就浪费了\"继续想下一步\"的时间。\n\n**Jobs 把慢操作丢后台**：agent 立刻拿 job id 继续，任务完成后再把结果送回。\n但这里有个常见误解要纠正——**不是 jobs 注册表自己把结果写回会话**。\n职责是分离的：Jobs 管生命周期与身份；**控制器（consumer）** 监听完成事件，\n再根据 owner agent 的状态决定用 `inject`（塞下一次请求）还是 `followup`（唤醒新一轮）。"
      }
     ]
    },
    {
     "name": "4. 心智模型",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "Jobs 就像**餐厅的取餐器**："
      },
      {
       "type": "stepper",
       "id": "job-pager",
       "title": "后台任务像餐厅取餐器",
       "steps": [
        {
         "title": "点餐",
         "detail": "`start job` 创建后台工作并立即返回 job id。"
        },
        {
         "title": "拿取餐器",
         "detail": "agent 保存 job id，不必停在原地等待，可以继续当前思考。"
        },
        {
         "title": "后厨完成",
         "detail": "JobRegistry 更新生命周期并触发 onJobDone。"
        },
        {
         "title": "服务员判断",
         "detail": "控制器查看 agent 当前忙闲状态。"
        },
        {
         "title": "完成交付",
         "detail": "空闲就 followup 唤醒；忙碌就 inject，等下一轮自然带入。"
        }
       ]
      },
      {
       "type": "markdown",
       "markdown": "后厨（jobs）不管你坐哪桌；服务员（控制器）才负责把餐送到对的人。"
      }
     ]
    },
    {
     "name": "5. 方案与图",
     "blocks": [
      {
       "type": "flow",
       "id": "job-delivery-flow",
       "title": "生命周期与交付控制分离",
       "nodes": [
        {
         "id": "start",
         "title": "JobRegistry.start",
         "detail": "创建身份并让 work 在后台运行；注册表不碰会话",
         "edges": [
          {
           "target": "work",
           "label": ""
          }
         ]
        },
        {
         "id": "work",
         "title": "后台工作",
         "detail": "完成后通知所有 on_done 订阅者",
         "edges": [
          {
           "target": "controller",
           "label": ""
          }
         ]
        },
        {
         "id": "controller",
         "title": "交付控制器",
         "detail": "根据 agent 是否空闲选择交付方式",
         "edges": [
          {
           "target": "followup",
           "label": "空闲"
          },
          {
           "target": "inject",
           "label": "忙碌"
          }
         ]
        },
        {
         "id": "followup",
         "title": "followup",
         "detail": "立即唤醒 agent，开启新一轮处理结果",
         "edges": []
        },
        {
         "id": "inject",
         "title": "inject",
         "detail": "将结果排入上下文，等待下一轮消费",
         "edges": []
        }
       ]
      },
      {
       "type": "markdown",
       "markdown": "### 执行透视：生命周期事实怎样被控制器路由回 owner"
      },
      {
       "type": "trace",
       "id": "l17-runtime-xray",
       "title": "JobRegistry 与 Agent 之间没有直接写入",
       "panels": [
        "Job 状态",
        "Agent 状态 / inbox",
        "交付责任方"
       ],
       "steps": [
        {
         "title": "启动任务",
         "location": "`registry.start`",
         "action": "创建 bash-1 并启动线程。",
         "states": [
          "`running; result=None`",
          "`idle=False; inbox=[]`",
          "Registry 只返回 id。"
         ]
        },
        {
         "title": "agent 继续",
         "location": "`start` 立即返回",
         "action": "主线程分析其他文件。",
         "states": [
          "后台 running。",
          "agent 忙碌。",
          "无交付。"
         ]
        },
        {
         "title": "agent 停下",
         "location": "`idle=True`",
         "action": "owner 在完成前进入空闲。",
         "states": [
          "仍可能 running。",
          "idle=True。",
          "Controller 等通知。"
         ]
        },
        {
         "title": "worker 完成",
         "location": "`runner()`",
         "action": "写 result，status 变 completed。",
         "states": [
          "`completed; 构建成功`",
          "尚未写 inbox。",
          "Registry 调 on_done。"
         ]
        },
        {
         "title": "控制器判路由",
         "location": "`on_job_done`",
         "action": "读取 owner 当前状态。",
         "states": [
          "不变。",
          "idle=True。",
          "Controller 选择 followup。"
         ]
        },
        {
         "title": "唤醒新一轮",
         "location": "`agent.followup`",
         "action": "完成事实入 inbox，并置 idle=False。",
         "states": [
          "生命周期结束。",
          "inbox=[完成事实]",
          "Agent 被唤醒。"
         ]
        }
       ]
      }
     ]
    },
    {
     "name": "6. 代码拆解",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "- `JobRegistry.start()`：登记 job，起后台线程跑 `work`，完成后**只通知订阅者**——它不碰会话。\n- `JobRegistry.on_done()`：控制器在这里订阅。\n- `Agent.inject()` / `followup()`：两种把完成事实交回 agent 的方式。\n- `make_controller()`：**控制器**——按 `agent.idle` 选择 `followup`（已停下）或 `inject`（还在忙）。\n\n### 动手破坏一次\n\n让 `JobRegistry.runner` 直接引用 agent 并写 inbox。再把同一 registry 给两个 owner 共用，生命周期\n层将不得不理解会话路由。这验证：**Jobs 管身份和状态，consumer 才知道结果属于谁。**"
      }
     ]
    },
    {
     "name": "7. 代码解读：后台执行与结果交付为何拆成两层",
     "blocks": [
      {
       "type": "code-walkthrough",
       "id": "l17-code-reading",
       "title": "Job 完成不等于 Agent 已经看到",
       "source": "main.py",
       "language": "python",
       "segments": [
        {
         "title": "Job 只描述生命周期事实",
         "start": 28,
         "end": 32,
         "reading": "id、label、status 与 result 构成记录。",
         "reason": "Job 不保存 agent/session 引用，才能被查询、持久化并在不同 consumer 间复用。",
         "code": "class Job:\n    id: str\n    label: str\n    status: str = \"running\"     # running / completed / failed\n    result: str | None = None"
        },
        {
         "title": "Registry 收敛成功与失败",
         "start": 35,
         "end": 64,
         "reading": "start 分配 id，线程更新状态，最后只遍历 on_done callbacks。",
         "reason": "无论 work 成功或抛错都形成终态通知；Registry 不决定错误如何呈现给用户。",
         "code": "class JobRegistry:\n    \"\"\"只管生命周期与身份。它绝不碰会话。\"\"\"\n\n    def __init__(self):\n        self._jobs: dict[str, Job] = {}\n        self._counter = 0\n        self._on_done: list[Callable[[Job], None]] = []\n\n    def on_done(self, cb: Callable[[Job], None]):\n        \"\"\"控制器在这里订阅完成事件。\"\"\"\n        self._on_done.append(cb)\n\n    def start(self, kind: str, label: str, work: Callable[[], str]) -> str:\n        self._counter += 1\n        job = Job(id=f\"{kind}-{self._counter}\", label=label)\n        self._jobs[job.id] = job\n\n        def runner():\n            try:\n                job.result = work()\n                job.status = \"completed\"\n            except Exception as e:  # noqa: BLE001\n                job.result = str(e)\n                job.status = \"failed\"\n            # 只通知订阅者——注册表自己不写会话！\n            for cb in self._on_done:\n                cb(job)\n\n        threading.Thread(target=runner, daemon=True).start()\n        return job.id"
        },
        {
         "title": "Agent 明确两种输入动作",
         "start": 71,
         "end": 82,
         "reading": "inject 只排队；followup 还把 idle 改为 False。",
         "reason": "“下一 step 看见”与“另开一轮处理”调度语义不同，不能都简化成 append inbox。",
         "code": "class Agent:\n    inbox: list = field(default_factory=list)     # 注入的上下文，等下一次请求\n    idle: bool = True\n\n    def inject(self, text: str):\n        self.inbox.append(text)\n        print(f\"    [控制器→inject] agent 空闲时下一轮会看到: {text!r}\")\n\n    def followup(self, text: str):\n        self.idle = False\n        self.inbox.append(text)\n        print(f\"    [控制器→followup] 唤醒 agent 新一轮处理: {text!r}\")"
        },
        {
         "title": "Controller 理解 job 与 owner",
         "start": 85,
         "end": 93,
         "reading": "回调格式化 Job，再按 agent.idle 选择交付方式。",
         "reason": "只有 consumer 同时拥有两个领域上下文，因此路由放这里不会污染底层服务。",
         "code": "def make_controller(agent: Agent):\n    def on_job_done(job: Job):\n        fact = f\"[后台任务 {job.id} 完成] {job.label} → {job.result}\"\n        # 控制器按 owner 状态选择交付方式\n        if agent.idle:\n            agent.followup(fact)   # agent 已停下 → 唤醒新一轮\n        else:\n            agent.inject(fact)     # agent 还在忙 → 注入等下一次请求\n    return on_job_done"
        },
        {
         "title": "示例制造完成时序差",
         "start": 96,
         "end": 118,
         "reading": "agent 先忙、后 idle，job 更晚完成，稳定触发 followup。",
         "reason": "后台 bug 多来自时间关系；显式序列让“完成时 owner 状态”成为可观察条件。",
         "code": "if __name__ == \"__main__\":\n    agent = Agent()\n    registry = JobRegistry()\n    registry.on_done(make_controller(agent))\n\n    print(\"===== agent 把慢操作丢后台，立刻继续 =====\")\n    def slow_build():\n        time.sleep(0.1)\n        return \"构建成功，0 error\"\n\n    agent.idle = False  # agent 此刻还在忙别的\n    job_id = registry.start(\"bash\", \"npm run build\", slow_build)\n    print(f\"  agent 拿到 {job_id}，不等它，继续想下一步...\")\n    print(\"  [agent] 我先去分析别的文件（后台任务并行跑着）\")\n\n    time.sleep(0.05)\n    print(\"\\n===== agent 忙完停下，变为空闲 =====\")\n    agent.idle = True\n\n    time.sleep(0.15)  # 等后台任务完成，触发控制器\n    print(f\"\\n===== agent 的 inbox（完成事实已由控制器交回）=====\")\n    for item in agent.inbox:\n        print(f\"  {item}\")"
        }
       ]
      }
     ]
    },
    {
     "name": "8. 相对上一课新增了什么",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "前面的工具都是同步跑完才返回。本课引入 **Jobs 后台运行时**：慢操作丢后台、\nagent 不阻塞，并明确 **Jobs（生命周期）与控制器（交付）的职责分离**。"
      }
     ]
    },
    {
     "name": "9. 简化了什么 vs 真实 DeepSeek Harness",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| Python 线程 | `ctx.jobs` 运行时，生产方拥有执行资源 | bash/subagent 等多种 job kind 统一管理 |\n| `on_done` 回调 | consumer 监听 `onJobDone`，按 owner 状态 inject/followup | 交付方式取决于 agent 实时状态 |\n| 无访问控制 | job 访问按 owner session id 围栏，agent 释放时取消并 await | 一个 agent 不能碰别人的 job |\n| status 三态 | running/stopping/completed/killed/failed + `detail` | 精细的生命周期与停止语义 |\n| 无 job 工具 | `job_*` 工具收集/停止后台任务 | 模型能主动查询和终止后台任务 |\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `JobRegistry` | `ctx.jobs`（`jobs/jobs`） |\n| `make_controller` | `tool-jobs` consumer / 控制器 |\n| `inject` / `followup` | `agent.inject()` / `agent.followup()` |\n| `Job.id` = `kind-N` | `JobId`（`<kind>-N` 品牌化 id） |\n\n---\n[← 上一课 L16](../L16_subagent/README.zh.md) · [返回总览](../../README.md) · [下一课 L18 →](../L18_goal/README.zh.md)"
      }
     ]
    }
   ],
   "code": "\"\"\"L17 Jobs：慢操作丢后台，agent 继续想\n=======================================\nMotto：Jobs 管生命周期，控制器负责把完成事实重新交回 Agent。\n\n有些操作很慢（编译、跑测试、下载）。如果 agent 傻等，就浪费了它\"继续想下一步\"\n的时间。Jobs 的办法：把慢操作丢进后台运行时，agent 立刻拿到一个 job id 继续干别的；\n后台任务完成后，再把结果**注入回**会话。\n\n★ 关键澄清（很多人搞错）：不是 jobs 注册表自己把结果写回会话！\n  真实 dsh 里，是 job 工具的 **consumer/控制器** 监听 job 完成事件（onJobDone），\n  再根据 owner（那个 agent）的状态，选择 inject（塞进下一次请求）或 followup（唤醒新一轮）。\n  职责分离：Jobs 管生命周期与身份；控制器管\"把完成事实交回哪个 agent、怎么交\"。\n\n本课用线程模拟后台任务，演示这个职责分离。\n\n运行：  python lessons/L17_jobs/main.py\n\"\"\"\n\nfrom __future__ import annotations\n\nimport threading\nimport time\nfrom dataclasses import dataclass, field\nfrom typing import Callable\n\n\n@dataclass\nclass Job:\n    id: str\n    label: str\n    status: str = \"running\"     # running / completed / failed\n    result: str | None = None\n\n\nclass JobRegistry:\n    \"\"\"只管生命周期与身份。它绝不碰会话。\"\"\"\n\n    def __init__(self):\n        self._jobs: dict[str, Job] = {}\n        self._counter = 0\n        self._on_done: list[Callable[[Job], None]] = []\n\n    def on_done(self, cb: Callable[[Job], None]):\n        \"\"\"控制器在这里订阅完成事件。\"\"\"\n        self._on_done.append(cb)\n\n    def start(self, kind: str, label: str, work: Callable[[], str]) -> str:\n        self._counter += 1\n        job = Job(id=f\"{kind}-{self._counter}\", label=label)\n        self._jobs[job.id] = job\n\n        def runner():\n            try:\n                job.result = work()\n                job.status = \"completed\"\n            except Exception as e:  # noqa: BLE001\n                job.result = str(e)\n                job.status = \"failed\"\n            # 只通知订阅者——注册表自己不写会话！\n            for cb in self._on_done:\n                cb(job)\n\n        threading.Thread(target=runner, daemon=True).start()\n        return job.id\n\n\n# ==========================================================================\n# 控制器（consumer）：监听 job 完成，决定把结果交回 agent 的方式\n# ==========================================================================\n@dataclass\nclass Agent:\n    inbox: list = field(default_factory=list)     # 注入的上下文，等下一次请求\n    idle: bool = True\n\n    def inject(self, text: str):\n        self.inbox.append(text)\n        print(f\"    [控制器→inject] agent 空闲时下一轮会看到: {text!r}\")\n\n    def followup(self, text: str):\n        self.idle = False\n        self.inbox.append(text)\n        print(f\"    [控制器→followup] 唤醒 agent 新一轮处理: {text!r}\")\n\n\ndef make_controller(agent: Agent):\n    def on_job_done(job: Job):\n        fact = f\"[后台任务 {job.id} 完成] {job.label} → {job.result}\"\n        # 控制器按 owner 状态选择交付方式\n        if agent.idle:\n            agent.followup(fact)   # agent 已停下 → 唤醒新一轮\n        else:\n            agent.inject(fact)     # agent 还在忙 → 注入等下一次请求\n    return on_job_done\n\n\nif __name__ == \"__main__\":\n    agent = Agent()\n    registry = JobRegistry()\n    registry.on_done(make_controller(agent))\n\n    print(\"===== agent 把慢操作丢后台，立刻继续 =====\")\n    def slow_build():\n        time.sleep(0.1)\n        return \"构建成功，0 error\"\n\n    agent.idle = False  # agent 此刻还在忙别的\n    job_id = registry.start(\"bash\", \"npm run build\", slow_build)\n    print(f\"  agent 拿到 {job_id}，不等它，继续想下一步...\")\n    print(\"  [agent] 我先去分析别的文件（后台任务并行跑着）\")\n\n    time.sleep(0.05)\n    print(\"\\n===== agent 忙完停下，变为空闲 =====\")\n    agent.idle = True\n\n    time.sleep(0.15)  # 等后台任务完成，触发控制器\n    print(f\"\\n===== agent 的 inbox（完成事实已由控制器交回）=====\")\n    for item in agent.inbox:\n        print(f\"  {item}\")\n",
   "locPct": 54
  },
  {
   "id": "L18",
   "dir": "L18_goal",
   "num": "18",
   "title": "持久 Goal 领域",
   "fullTitle": "L18 持久 Goal 领域",
   "subtitle": "目标是状态不是调度器",
   "motto": "给会话挂一个持久目标，它是状态不是调度器。",
   "layer": "concurrency",
   "loc": 80,
   "hasCode": true,
   "sections": [
    {
     "name": "1. 30 秒运行",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "运行前先猜：blocked 后重新 active，是修改原 Goal 对象还是追加新事件？`revision` 应表示当前\n阶段编号、事件 seq，还是每次状态变更次数？Goal complete 后会不会自动启动下一轮？\n\n```powershell\npython lessons/L18_goal/main.py\n```\n\n预期输出（节选）：\n\n```text\n===== 挂一个目标 =====\n  当前: {'phase': 'active', 'text': '把仓库里所有失败的测试修绿', 'revision': 1, ...}\n\n===== 中途遇到障碍 → blocked（带机器可路由的 code）=====\n  当前: {'phase': 'blocked', ..., 'block': {'code': 'needs-approval', ...}}\n\n===== 目标的真源是事件日志（折叠得到状态）=====\n  #0 goal/change {'phase': 'active', ...}\n  #1 goal/change {'phase': 'blocked', ...}\n  #3 goal/change {'phase': 'complete', ...}\n  → revision=4：每次变更 +1，用于 compare-and-set\n```"
      }
     ]
    },
    {
     "name": "2. 观察输出",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "一个目标经历 active → blocked → active → complete。每次变更都追加一条 `goal/change`\n事件，当前状态由这些事件**折叠**得到；`revision` 每次变更 +1。阻塞时带一个\n机器可路由的 `code`。"
      }
     ]
    },
    {
     "name": "3. 为什么需要这一层",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "有些会话有一个跨多轮的大目标（\"把测试全修绿\"）。需要一个地方记录：目标是什么、\n现在什么阶段、改了几次、为什么阻塞。\n\n**但要害是：Goal 只是状态，不是调度器、不是另一条对话线。** 它复用 L04 的事件溯源——\n真源仍是日志，状态靠折叠。这一课只讲\"状态怎么记\"；\"谁来驱动续跑\"是下一课 L19 的事。\n把这两层分开，是理解 goal 的关键。"
      }
     ]
    },
    {
     "name": "4. 心智模型",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "Goal 就像项目的**里程碑状态牌**，不是**催办的人**："
      },
      {
       "type": "compare",
       "id": "goal-vs-driver",
       "title": "状态与调度是两种职责",
       "items": [
        {
         "title": "Goal 领域：里程碑状态牌",
         "detail": "记录目标文本、active/blocked/complete 阶段和 revision，只回答“现在是什么状态”。"
        },
        {
         "title": "Round Driver：催办的人",
         "detail": "读取状态；发现目标仍 active 时才安排“再干一轮”，它属于下一课。"
        }
       ]
      },
      {
       "type": "markdown",
       "markdown": "状态牌只记录，不催办。两者分工。"
      }
     ]
    },
    {
     "name": "5. 方案与图",
     "blocks": [
      {
       "type": "flow",
       "id": "goal-domain-flow",
       "title": "命令只追加事件，当前 Goal 由日志折叠得到",
       "nodes": [
        {
         "id": "set",
         "title": "set_goal(text)",
         "detail": "创建目标或解除阻塞，写入 phase=active。",
         "edges": [
          {
           "target": "change",
           "label": "追加事件"
          }
         ],
         "position": {
          "column": 1,
          "row": 1
         },
         "kind": ""
        },
        {
         "id": "block",
         "title": "block(code,msg)",
         "detail": "active 遇到外部阻碍时写入 phase=blocked 和原因。",
         "edges": [
          {
           "target": "change",
           "label": "追加事件"
          }
         ],
         "position": {
          "column": 1,
          "row": 2
         },
         "kind": ""
        },
        {
         "id": "complete",
         "title": "complete()",
         "detail": "active 达成后写入 phase=complete。",
         "edges": [
          {
           "target": "change",
           "label": "追加事件"
          }
         ],
         "position": {
          "column": 1,
          "row": 3
         },
         "kind": ""
        },
        {
         "id": "change",
         "title": "goal/change",
         "detail": "每次状态变化都只追加事件，不原地修改 Goal 对象。",
         "edges": [
          {
           "target": "log",
           "label": ""
          }
         ],
         "position": {
          "column": 2,
          "row": 2
         },
         "kind": ""
        },
        {
         "id": "log",
         "title": "Goal 事件日志",
         "detail": "它才是目标状态的持久真源。",
         "edges": [
          {
           "target": "fold",
           "label": ""
          }
         ],
         "position": {
          "column": 3,
          "row": 2
         },
         "kind": "state"
        },
        {
         "id": "fold",
         "title": "按 seq 折叠",
         "detail": "依次合并所有 change，并让 revision 每次加一。",
         "edges": [
          {
           "target": "snapshot",
           "label": ""
          }
         ],
         "position": {
          "column": 4,
          "row": 2
         },
         "kind": ""
        },
        {
         "id": "snapshot",
         "title": "当前 snapshot",
         "detail": "读取 phase、text、block 和 revision；它本身不驱动续跑。",
         "edges": [
          {
           "target": "active",
           "label": "active"
          },
          {
           "target": "blocked",
           "label": "blocked"
          },
          {
           "target": "completed",
           "label": "complete"
          }
         ],
         "position": {
          "column": 5,
          "row": 2
         },
         "kind": "decision"
        },
        {
         "id": "active",
         "title": "可继续推进",
         "detail": "之后可以 block 或 complete。",
         "edges": [
          {
           "target": "block",
           "label": "遇到阻碍"
          },
          {
           "target": "complete",
           "label": "目标达成"
          }
         ],
         "position": {
          "column": 6,
          "row": 1
         },
         "kind": ""
        },
        {
         "id": "blocked",
         "title": "等待外部解除",
         "detail": "只能由新的 set_goal 重新激活。",
         "edges": [
          {
           "target": "set",
           "label": "重新激活"
          }
         ],
         "position": {
          "column": 6,
          "row": 2
         },
         "kind": ""
        },
        {
         "id": "completed",
         "title": "已完成",
         "detail": "终态；Goal 只记录这个事实。",
         "edges": [],
         "position": {
          "column": 6,
          "row": 3
         },
         "kind": "terminal"
        }
       ],
       "variant": "map"
      },
      {
       "type": "markdown",
       "markdown": "### 执行透视：四次 change 如何折叠成一个当前快照"
      },
      {
       "type": "trace",
       "id": "l18-runtime-xray",
       "title": "Goal 是事件溯源状态，不是调度器",
       "panels": [
        "goal/change 日志",
        "snapshot",
        "revision"
       ],
       "steps": [
        {
         "title": "创建目标",
         "location": "`set_goal`",
         "action": "追加 active + text。",
         "states": [
          "`#0 created`",
          "`active; 修绿测试`",
          "1"
         ]
        },
        {
         "title": "标记阻塞",
         "location": "`block`",
         "action": "追加 blocked 与机器 code。",
         "states": [
          "`#0; #1 blocked`",
          "`blocked; needs-approval`",
          "2"
         ]
        },
        {
         "title": "重新激活",
         "location": "`set_goal`",
         "action": "再追加 active，不修改 #1。",
         "states": [
          "`#0; #1; #2 active`",
          "`active; 原目标`",
          "3"
         ]
        },
        {
         "title": "标记完成",
         "location": "`complete`",
         "action": "追加 complete。",
         "states": [
          "`#0…#3 complete`",
          "`complete; reason=done`",
          "4"
         ]
        },
        {
         "title": "重建状态",
         "location": "`snapshot()`",
         "action": "从 none 开始依次 update。",
         "states": [
          "四条事实均保留。",
          "与最后一次折叠一致。",
          "每处理一条 +1。"
         ]
        },
        {
         "title": "不发生调度",
         "location": "无 driver 调用",
         "action": "状态停在 complete。",
         "states": [
          "日志不再变化。",
          "complete。",
          "Goal 自己不开新 turn。"
         ]
        }
       ]
      }
     ]
    },
    {
     "name": "6. 代码拆解",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "- `GoalDomain._append()`：每次变更追加一条 `goal/change` 事件（仅追加，同 L04）。\n- `set_goal` / `block` / `complete`：三种变更，写入不同 phase。\n- `snapshot()`：把所有事件**折叠**成当前状态，`revision = seq + 1`。\n- `block` 带 `code`（机器可路由）+ `message`（给人看）。\n\n### 动手破坏一次\n\n把 `block()` 改成直接设置实例字段，不追加事件。snapshot 将不知道这次阻塞，重启后也无法恢复。\n这验证：**领域状态的每次变化都必须先成为 durable event。**"
      }
     ]
    },
    {
     "name": "7. 代码解读：当前状态怎样从变更日志确定性折叠出来",
     "blocks": [
      {
       "type": "code-walkthrough",
       "id": "l18-code-reading",
       "title": "写入命令与读取快照完全分离",
       "source": "main.py",
       "language": "python",
       "segments": [
        {
         "title": "GoalEvent 保存一次变化",
         "start": 25,
         "end": 28,
         "reading": "每条事件有 seq、固定 type 与 data。",
         "reason": "事件描述“发生了什么变化”，不复制整份可变 Goal 对象，历史因果更清楚。",
         "code": "class GoalEvent:\n    seq: int\n    type: str          # goal/change\n    data: dict[str, Any]"
        },
        {
         "title": "所有命令汇聚到 _append",
         "start": 31,
         "end": 47,
         "reading": "set_goal、block、complete 只构造不同 data，最终都追加 goal/change。",
         "reason": "单一写入口保证 seq 连续，也给持久化、校验和通知统一插入点。",
         "code": "class GoalDomain:\n    \"\"\"事件溯源的目标状态。真源是事件日志，状态靠折叠得到。\"\"\"\n\n    def __init__(self):\n        self._events: list[GoalEvent] = []\n\n    def _append(self, data: dict):\n        self._events.append(GoalEvent(len(self._events), \"goal/change\", data))\n\n    def set_goal(self, text: str):\n        self._append({\"phase\": \"active\", \"text\": text, \"reason\": \"created\"})\n\n    def block(self, code: str, message: str):\n        self._append({\"phase\": \"blocked\", \"block\": {\"code\": code, \"message\": message}})\n\n    def complete(self):\n        self._append({\"phase\": \"complete\", \"reason\": \"done\"})"
        },
        {
         "title": "snapshot 从空状态折叠",
         "start": 49,
         "end": 55,
         "reading": "依次 `state.update`，每条事件后把 revision 设为 seq+1。",
         "reason": "新事件只覆盖声明字段，text 可跨 phase 保留；revision 精确代表已应用变更数。",
         "code": "    def snapshot(self) -> dict:\n        \"\"\"把 goal/change 事件折叠成当前状态。revision = 变更次数。\"\"\"\n        state = {\"phase\": \"none\", \"text\": None, \"revision\": 0}\n        for ev in self._events:\n            state.update(ev.data)\n            state[\"revision\"] = ev.seq + 1\n        return state"
        },
        {
         "title": "events 返回副本",
         "start": 57,
         "end": 58,
         "reading": "外部读取拿到新列表。",
         "reason": "consumer 能审计历史，但不能绕过领域命令删除或重排真源。",
         "code": "    def events(self):\n        return list(self._events)"
        },
        {
         "title": "示例区分 phase 与 driver",
         "start": 61,
         "end": 80,
         "reading": "连续调用领域命令并打印快照，没有自动循环。",
         "reason": "Goal 负责状态转换；是否续跑属于下一课的调度职责。",
         "code": "if __name__ == \"__main__\":\n    goal = GoalDomain()\n\n    print(\"===== 挂一个目标 =====\")\n    goal.set_goal(\"把仓库里所有失败的测试修绿\")\n    print(f\"  当前: {goal.snapshot()}\")\n\n    print(\"\\n===== 中途遇到障碍 → blocked（带机器可路由的 code）=====\")\n    goal.block(code=\"needs-approval\", message=\"修改依赖需要人工批准\")\n    print(f\"  当前: {goal.snapshot()}\")\n\n    print(\"\\n===== 障碍解除，重新激活并完成 =====\")\n    goal.set_goal(\"把仓库里所有失败的测试修绿\")  # 重新 active\n    goal.complete()\n    print(f\"  当前: {goal.snapshot()}\")\n\n    print(\"\\n===== 目标的真源是事件日志（折叠得到状态）=====\")\n    for ev in goal.events():\n        print(f\"  #{ev.seq} goal/change {ev.data}\")\n    print(f\"  → revision={goal.snapshot()['revision']}：每次变更 +1，用于 compare-and-set\")"
        }
       ]
      }
     ]
    },
    {
     "name": "8. 相对上一课新增了什么",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "前面的会话没有\"跨多轮的显式目标\"。本课引入 **持久 Goal 领域**：用事件溯源记录\n目标状态（active/blocked/complete）与 revision，并强调它是\"状态而非调度器\"，\n为 L19 的续跑驱动打基础。"
      }
     ]
    },
    {
     "name": "9. 简化了什么 vs 真实 DeepSeek Harness",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| active/blocked/complete | 还有 **paused** 阶段 | 目标可被人工暂停而非阻塞 |\n| revision 简单 +1 | `GoalRef` compare-and-set，每次持久变更递增 | 并发变更要靠 revision 防冲突 |\n| 折叠成一个 dict | `GoalSnapshot` 完整字段 + goal-round 上限 | 续跑要有轮次上限防失控 |\n| 无激活状态 | 持久 phase 与**进程本地激活**分离 | resume/fork 后需人工重新授权才自动续跑 |\n| domain 独立 | goal 领域 + goal-round-driver 拆开（见 L19） | 状态与驱动是两层机制 |\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `GoalDomain` | `ctx.goals`（`goal/goal`，core service） |\n| `goal/change` | 同名事件 |\n| `snapshot()` | `GoalSnapshot` |\n| `block(code,message)` | `GoalBlockReason` |\n\n---\n[← 上一课 L17](../L17_jobs/README.zh.md) · [返回总览](../../README.md) · [下一课 L19 →](../L19_goal_driver/README.zh.md)"
      }
     ]
    }
   ],
   "code": "\"\"\"L18 持久 Goal 领域\n=====================\nMotto：给会话挂一个持久目标，它是状态不是调度器。\n\n有时一个会话有一个跨多轮的大目标（\"把测试全修绿\"）。Goal 领域给会话挂一个\n**持久的目标状态**：它记录目标是什么、现在处于哪个阶段、改过几次。\n\n关键认知（别搞错）：Goal 只是**状态**，不是调度器、不是另一条对话线。\n它的真源仍是会话日志（回顾 L04）——每次目标变更都追加一条 goal/change 事件，\n当前状态由日志折叠得到。真正\"驱动续跑\"的是另一层（L19 的 driver）。\n\n阶段（本课）：active → complete，或 active → blocked。\n（真实 dsh 还有 paused；每次变更递增 revision，用于 compare-and-set。）\n\n运行：  python lessons/L18_goal/main.py\n\"\"\"\n\nfrom __future__ import annotations\n\nfrom dataclasses import dataclass\nfrom typing import Any\n\n\n@dataclass\nclass GoalEvent:\n    seq: int\n    type: str          # goal/change\n    data: dict[str, Any]\n\n\nclass GoalDomain:\n    \"\"\"事件溯源的目标状态。真源是事件日志，状态靠折叠得到。\"\"\"\n\n    def __init__(self):\n        self._events: list[GoalEvent] = []\n\n    def _append(self, data: dict):\n        self._events.append(GoalEvent(len(self._events), \"goal/change\", data))\n\n    def set_goal(self, text: str):\n        self._append({\"phase\": \"active\", \"text\": text, \"reason\": \"created\"})\n\n    def block(self, code: str, message: str):\n        self._append({\"phase\": \"blocked\", \"block\": {\"code\": code, \"message\": message}})\n\n    def complete(self):\n        self._append({\"phase\": \"complete\", \"reason\": \"done\"})\n\n    def snapshot(self) -> dict:\n        \"\"\"把 goal/change 事件折叠成当前状态。revision = 变更次数。\"\"\"\n        state = {\"phase\": \"none\", \"text\": None, \"revision\": 0}\n        for ev in self._events:\n            state.update(ev.data)\n            state[\"revision\"] = ev.seq + 1\n        return state\n\n    def events(self):\n        return list(self._events)\n\n\nif __name__ == \"__main__\":\n    goal = GoalDomain()\n\n    print(\"===== 挂一个目标 =====\")\n    goal.set_goal(\"把仓库里所有失败的测试修绿\")\n    print(f\"  当前: {goal.snapshot()}\")\n\n    print(\"\\n===== 中途遇到障碍 → blocked（带机器可路由的 code）=====\")\n    goal.block(code=\"needs-approval\", message=\"修改依赖需要人工批准\")\n    print(f\"  当前: {goal.snapshot()}\")\n\n    print(\"\\n===== 障碍解除，重新激活并完成 =====\")\n    goal.set_goal(\"把仓库里所有失败的测试修绿\")  # 重新 active\n    goal.complete()\n    print(f\"  当前: {goal.snapshot()}\")\n\n    print(\"\\n===== 目标的真源是事件日志（折叠得到状态）=====\")\n    for ev in goal.events():\n        print(f\"  #{ev.seq} goal/change {ev.data}\")\n    print(f\"  → revision={goal.snapshot()['revision']}：每次变更 +1，用于 compare-and-set\")\n",
   "locPct": 37
  },
  {
   "id": "L19",
   "dir": "L19_goal_driver",
   "num": "19",
   "title": "Goal Round Driver：自动续跑",
   "fullTitle": "L19 Goal Round Driver：自动续跑",
   "subtitle": "turn-stopping + steer 续跑",
   "motto": "目标未完成就再开一轮，直到完成或阻塞。",
   "layer": "concurrency",
   "loc": 135,
   "hasCode": true,
   "sections": [
    {
     "name": "1. 30 秒运行",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "运行前先判断：turn-stopping listener 是返回 `continue=True`，还是通过 `agent.steer()` 写入\n真实输入？两个 listener 的执行顺序交换后，目标是否继续的结论应不应该改变？\n\n```powershell\npython lessons/L19_goal_driver/main.py\n```\n\n预期输出（节选）：\n\n```text\n===== 场景 A：目标需要 3 步完成，driver 通过 steer 自动续跑 =====\n  [round 1] agent 干活……剩余 2 步\n    [turn-stopping:budget] 预算充足，不干预（不 steer）\n    [turn-stopping:goal] 目标未完成 → agent.steer('继续推进目标：修绿所有测试')（写 steering，不返回决策）\n  → inbox 有 steering，loop 续跑下一 step\n  ...\n  [round 3] 目标达成 → complete\n    [turn-stopping:goal] 目标 complete → 不 steer，turn 将关闭\n  → inbox 为空，turn 关闭\n\n===== 场景 B：目标中途被阻塞 → 不再 steer，turn 关闭 =====\n  [round 2] 遇到需要人工批准的操作 → blocked\n  → inbox 为空，turn 关闭\n```"
      }
     ]
    },
    {
     "name": "2. 观察输出",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "场景 A 里，agent 每到停止边界，goal 监听器就**调 `agent.steer(...)` 写入一条续跑输入**\n（不是返回 `{stop:False}`），loop 因为 inbox 里有 steering 就再跑一步，直到目标 complete\n时不再 steer、inbox 为空、turn 关闭。场景 B 里目标一 blocked，监听器就不再 steer。"
      }
     ]
    },
    {
     "name": "3. 为什么需要这一层",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "L18 有了目标状态，但**状态自己不会动**。谁在目标没完成时把 agent\"再踹一轮\"？\n\n这就是 Goal Round Driver。它挂在 **`agent/turn-stopping`** 这个停止边界上。\n但要害是它的**真实机制**（此前版本讲错了，本次已修正）：`agent/turn-stopping` 虽然是\nserial 事件，**监听器却返回 `void`**——它不是\"对 stop 布尔值投票\"。想让 turn 继续的监听器\n调用 `agent.steer(...)` 写入真实 steering（一个副作用），loop 随后**重新读取 inbox**：\n有新 steering 就再跑一个 step，没有就关闭 turn。**数据（有没有 steering）决定结果，\n监听器顺序不改变结论。**"
      }
     ]
    },
    {
     "name": "4. 心智模型",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "turn-stopping 不是\"举手表决要不要停\"，而是\"**关门前的最后一声吆喝**\"："
      },
      {
       "type": "flow",
       "id": "turn-stopping-loop",
       "title": "steering 是续跑的数据，不是监听器的返回值",
       "nodes": [
        {
         "id": "step",
         "title": "执行当前 step",
         "detail": "agent 推进工作，然后到达准备关闭 turn 的边界。",
         "edges": [
          {
           "target": "stopping",
           "label": ""
          }
         ],
         "position": {
          "column": 1,
          "row": 1
         },
         "kind": ""
        },
        {
         "id": "stopping",
         "title": "通知 stopping listeners",
         "detail": "按顺序 await；监听器返回 void，只能产生副作用。",
         "edges": [
          {
           "target": "goal",
           "label": ""
          }
         ],
         "position": {
          "column": 2,
          "row": 1
         },
         "kind": "boundary"
        },
        {
         "id": "goal",
         "title": "Goal listener",
         "detail": "目标仍 active 且 armed 时调用 agent.steer。",
         "edges": [
          {
           "target": "inbox",
           "label": "写入 steering"
          }
         ],
         "position": {
          "column": 3,
          "row": 1
         },
         "kind": ""
        },
        {
         "id": "inbox",
         "title": "真实 inbox",
         "detail": "保存监听器留下的 steering，是决定是否续跑的数据。",
         "edges": [
          {
           "target": "inspect",
           "label": ""
          }
         ],
         "position": {
          "column": 4,
          "row": 1
         },
         "kind": "state"
        },
        {
         "id": "inspect",
         "title": "重读 inbox",
         "detail": "监听结束后由 loop 检查是否出现新消息。",
         "edges": [
          {
           "target": "step",
           "label": "有 steering：下一 step"
          },
          {
           "target": "close",
           "label": "没有 steering"
          }
         ],
         "position": {
          "column": 5,
          "row": 1
         },
         "kind": "decision"
        },
        {
         "id": "close",
         "title": "关闭 turn",
         "detail": "inbox 为空，说明没有新的工作事实。",
         "edges": [],
         "position": {
          "column": 6,
          "row": 1
         },
         "kind": "terminal"
        }
       ],
       "variant": "map"
      },
      {
       "type": "markdown",
       "markdown": "关键区别：监听器**不**返回\"别停\"，它**留下一张纸条**；是 loop 看到纸条才继续。"
      }
     ]
    },
    {
     "name": "5. 方案与图",
     "blocks": [
      {
       "type": "flow",
       "id": "goal-driver-flow",
       "title": "Goal Round Driver 的继续条件",
       "nodes": [
        {
         "id": "step",
         "title": "执行一步",
         "detail": "`agent.run_one_step()` 可能推进或完成目标",
         "edges": [
          {
           "target": "consume",
           "label": ""
          }
         ]
        },
        {
         "id": "consume",
         "title": "消费旧 steering",
         "detail": "清理上一轮已经使用的 inbox 内容",
         "edges": [
          {
           "target": "stopping",
           "label": ""
          }
         ]
        },
        {
         "id": "stopping",
         "title": "触发关停监听",
         "detail": "goal active 且 armed 时执行 `agent.steer(\"继续…\")`",
         "edges": [
          {
           "target": "inspect",
           "label": ""
          }
         ]
        },
        {
         "id": "inspect",
         "title": "重读 inbox",
         "detail": "是否出现新的 steering",
         "edges": [
          {
           "target": "step",
           "label": "有消息且未超上限"
          },
          {
           "target": "close",
           "label": "为空或达到上限"
          }
         ]
        },
        {
         "id": "close",
         "title": "关闭 turn",
         "detail": "没有新的工作事实需要继续",
         "edges": []
        }
       ]
      },
      {
       "type": "markdown",
       "markdown": "### 执行透视：续跑决定存在 inbox，不存在 listener 返回值"
      },
      {
       "type": "trace",
       "id": "l19-runtime-xray",
       "title": "目标从 active 到 complete 的三轮驱动",
       "panels": [
        "Goal phase / remaining",
        "Agent inbox",
        "Loop 下一动作"
       ],
       "steps": [
        {
         "title": "Round 1 工作",
         "location": "`run_one_step(1)`",
         "action": "remaining 从 3 减为 2。",
         "states": [
          "`active / 2`",
          "上轮输入消费后清空。",
          "进入 stopping。"
         ]
        },
        {
         "title": "Goal listener",
         "location": "`agent.steer`",
         "action": "active 且 armed，写 goal-round。",
         "states": [
          "`active / 2`",
          "`[继续推进目标]`",
          "重读后续跑。"
         ]
        },
        {
         "title": "Round 2 工作",
         "location": "`run_one_step(2)`",
         "action": "remaining 变 1。",
         "states": [
          "`active / 1`",
          "再次清空后写入。",
          "继续下一 step。"
         ]
        },
        {
         "title": "Round 3 工作",
         "location": "`run_one_step(3)`",
         "action": "remaining 归零，phase complete。",
         "states": [
          "`complete / 0`",
          "清空。",
          "进入 stopping。"
         ]
        },
        {
         "title": "不再 steer",
         "location": "`goal listener`",
         "action": "phase 非 active，只观察。",
         "states": [
          "`complete / 0`",
          "`[]`",
          "inbox 空，关闭 turn。"
         ]
        },
        {
         "title": "Blocked 场景",
         "location": "`phase=blocked`",
         "action": "第二轮外部状态转 blocked。",
         "states": [
          "`blocked / 97`",
          "listener 不写入。",
          "同样停止。"
         ]
        }
       ]
      }
     ]
    },
    {
     "name": "6. 代码拆解",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "- `Agent.steer(text)`：往 `inbox` 追加 steering（**副作用**）。这是续跑的真实机制。\n- `make_goal_listener()`：turn-stopping 监听器，**返回 `None`（void）**；目标 active 且 armed 时调 `agent.steer(...)`。\n- `make_budget_listener()`：只观察、不 steer、返回 void。\n- `dispatch_turn_stopping()`：按序 `await` 所有监听器（serial 语义），它们无返回值。\n- `drive()`：跑一步 → 清 inbox → 跑 turn-stopping → **重读 inbox** → 有 steering 续跑，否则关 turn。\n- `activation.armed`：进程本地激活——真实 dsh 里 resume/fork 后需人工重新授权才自动续跑。\n\n### 动手破坏一次\n\n让 goal listener 返回 `True`，但删除 `agent.steer()`。loop 重读 inbox 仍为空并关闭。这验证：\n**通知返回值不是调度输入；真正驱动下一 step 的是 steering 数据。**"
      }
     ]
    },
    {
     "name": "7. 代码解读：边界通知如何通过副作用转成下一轮输入",
     "blocks": [
      {
       "type": "code-walkthrough",
       "id": "l19-code-reading",
       "title": "stopping listener、inbox 与 loop 的职责链",
       "source": "main.py",
       "language": "python",
       "segments": [
        {
         "title": "steer 写数据而不返回决定",
         "start": 38,
         "end": 53,
         "reading": "Agent 持有 inbox；steer append 文本，run_one_step 推进工作并可能更新 goal。",
         "reason": "是否续跑变成可检查的数据，而不是监听者瞬时返回值，多个插件可共同注入。",
         "code": "class Agent:\n    goal: Goal\n    inbox: list = field(default_factory=list)\n    _remaining: int = 3\n\n    def steer(self, text: str):\n        \"\"\"写入 steering（副作用）。真实 dsh：agent.steer(...) 让 loop 重读 inbox 续跑。\"\"\"\n        self.inbox.append(text)\n        print(f\"    [turn-stopping:goal] 目标未完成 → agent.steer({text!r})（写 steering，不返回决策）\")\n\n    def run_one_step(self, round_no: int):\n        self._remaining -= 1\n        print(f\"  [round {round_no}] agent 干活……剩余 {self._remaining} 步\")\n        if self._remaining <= 0:\n            self.goal.phase = \"complete\"\n            print(f\"  [round {round_no}] 目标达成 → complete\")"
        },
        {
         "title": "Budget listener 只观察",
         "start": 60,
         "end": 65,
         "reading": "listener 打印后返回 None，也不 steer。",
         "reason": "turn-stopping 是通知点，不要求每个参与者投票；不干预就什么都不写。",
         "code": "def make_budget_listener():\n    async def on_stopping(agent: Agent):\n        # 只观察，不干预 → 什么都不做，也不 steer\n        print(f\"    [turn-stopping:budget] 预算充足，不干预（不 steer）\")\n        # 返回 None（void）\n    return on_stopping"
        },
        {
         "title": "Goal listener 翻译领域状态",
         "start": 68,
         "end": 76,
         "reading": "仅 active 且 armed 时 steer，其他 phase 不写 inbox。",
         "reason": "Goal 仍只是状态；driver consumer 把“未完成”转换成真实下一轮请求。",
         "code": "def make_goal_listener(activation: dict):\n    async def on_stopping(agent: Agent):\n        # 目标还 active 且激活 armed → steer 一条 goal-round 输入让 loop 续跑\n        if agent.goal.phase == \"active\" and activation[\"armed\"]:\n            agent.steer(f\"继续推进目标：{agent.goal.text}\")\n        else:\n            print(f\"    [turn-stopping:goal] 目标 {agent.goal.phase} → 不 steer，turn 将关闭\")\n        # 返回 None（void）——不返回 stop 决策\n    return on_stopping"
        },
        {
         "title": "serial 只按序 await",
         "start": 80,
         "end": 82,
         "reading": "dispatch 忽略 listener 返回值。",
         "reason": "顺序可影响副作用先后，但不能引入“首个布尔值胜出”的错误协议。",
         "code": "async def dispatch_turn_stopping(listeners, agent: Agent):\n    for fn in listeners:\n        await fn(agent)   # 监听器无返回值；续跑与否看它们有没有 steer"
        },
        {
         "title": "loop 在边界后重读 inbox",
         "start": 85,
         "end": 105,
         "reading": "每轮工作后清空已消费输入、分发 stopping，再按 inbox 是否为空 continue/break。",
         "reason": "数据面是唯一判定点；listener 数量与顺序不改变核心语义。",
         "code": "async def drive(goal: Goal, agent: Agent, max_rounds: int = 6):\n    \"\"\"loop：跑一个 step → 到停止边界跑 turn-stopping → 重读 inbox → 有 steering 就续跑。\"\"\"\n    activation = {\"armed\": True}   # 进程本地激活（真实 dsh：resume/fork 需重新授权）\n    listeners = [make_budget_listener(), make_goal_listener(activation)]\n\n    round_no = 0\n    while round_no < max_rounds:\n        round_no += 1\n        agent.run_one_step(round_no)\n\n        # ---- 到达停止边界：跑 turn-stopping（监听器可能 steer）----\n        agent.inbox.clear()  # 上一轮的 steering 已被消费\n        await dispatch_turn_stopping(listeners, agent)\n\n        # ---- loop 重读 inbox：有 steering → 续跑；没有 → 关闭 turn ----\n        if agent.inbox:\n            print(f\"  → inbox 有 steering，loop 续跑下一 step\")\n        else:\n            print(f\"  → inbox 为空，turn 关闭\")\n            break\n    return round_no"
        }
       ]
      }
     ]
    },
    {
     "name": "8. 相对上一课新增了什么",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "L18 的目标状态不会自己推进。本课加上 **Goal Round Driver**：它在 `agent/turn-stopping`\n边界上，通过 `agent.steer(...)` 写 steering 让 loop 续跑（而非返回 stop 决策），\n直到目标 complete/blocked。这里也是 **serial** 分发的承接点（回顾 L03），\n并特别演示了 turn-stopping \"监听器返回 void、靠 steer 续跑\" 的真实语义。"
      }
     ]
    },
    {
     "name": "9. 简化了什么 vs 真实 DeepSeek Harness",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| inbox 是个 list | 真实 inbox + `agent.steer(...)` 写入、loop 重读 | steering 要能与人类输入、注入上下文排队 |\n| 监听器返回 void，靠 steer | `agent/turn-stopping` 签名就是 `Promise<void>\\|void`，靠 steer 续跑 | \"数据决定、顺序无关\"，避免监听器顺序影响结论 |\n| 反向停止未演示 | 工具结果带 `concludesTurn` 可在其 step 提前结束 turn | 让工具也能主动收尾一轮 |\n| armed 布尔 | goal 激活 armed/disarmed，不进 durable replay | resume/fork 要人工重新授权，防意外自动跑 |\n| driver 与 domain 混在文件 | goal 领域（L18）与 goal-round-driver 是独立包 | 状态与驱动分层，各自可替换 |\n\n> **本次修订说明**：早期版本把 turn-stopping 写成\"监听器返回 `{stop: False}` 投票\"，\n> 这与真实签名不符。真实的 `agent/turn-stopping` 返回 `void`，续跑靠 `agent.steer(...)`\n> 的副作用 + loop 重读 inbox。依据见 `docs/subsystems/core.zh.md` 的 `agent/turn-stopping` 条目。\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `dispatch_turn_stopping` | `agent/turn-stopping` serial 事件（监听器返回 void） |\n| `agent.steer(text)` | `agent.steer(...)` 写入 steering |\n| `drive` 重读 inbox | loop 在停止边界后重读 inbox 决定续跑 |\n| `activation.armed` | goal 激活 armed/disarmed |\n\n---\n[← 上一课 L18](../L18_goal/README.zh.md) · [返回总览](../../README.md) · [下一课 L20 →](../L20_profile_bundle/README.zh.md)"
      }
     ]
    }
   ],
   "code": "\"\"\"L19 Goal Round Driver：自动续跑\n==================================\nMotto：目标未完成就再开一轮，直到完成或阻塞。\n\nL18 有了目标状态，但状态自己不会动。这一课加上**驱动器**。\n\n★ 本次修订：对齐真实 dsh 的 agent/turn-stopping 语义（此前讲错了）。\n  真实 agent/turn-stopping 是一个 **serial 事件，但监听器返回 void**——它不是\n  \"对 stop 布尔值投票\"。它是\"turn 即将关闭\"的**边界通知**：\n    · loop 按序 await 所有 stopping 监听器；\n    · 想让 turn 继续的监听器，调用 agent.steer(...) 写入真实 steering（副作用），\n      而不是返回 {stop: False}；\n    · loop 随后**重新读取 inbox**：有新 steering → 再跑一个 step；没有 → 关闭 turn。\n  所以\"数据决定结果\"（有没有 steering），监听器顺序不改变结论。\n\ngoal driver 就挂在这里：目标未完成时，它 steer 一条 goal-round 输入，loop 因此续跑。\n\n运行：  python lessons/L19_goal_driver/main.py\n\"\"\"\n\nfrom __future__ import annotations\n\nimport asyncio\nfrom dataclasses import dataclass, field\n\n\n# ---- L18 的极简目标领域 ----\n@dataclass\nclass Goal:\n    text: str\n    phase: str = \"active\"        # active / blocked / complete\n\n\n# ==========================================================================\n# Agent：持有一个 inbox。steer() 往 inbox 写入 steering（这是续跑的真实机制）。\n# ==========================================================================\n@dataclass\nclass Agent:\n    goal: Goal\n    inbox: list = field(default_factory=list)\n    _remaining: int = 3\n\n    def steer(self, text: str):\n        \"\"\"写入 steering（副作用）。真实 dsh：agent.steer(...) 让 loop 重读 inbox 续跑。\"\"\"\n        self.inbox.append(text)\n        print(f\"    [turn-stopping:goal] 目标未完成 → agent.steer({text!r})（写 steering，不返回决策）\")\n\n    def run_one_step(self, round_no: int):\n        self._remaining -= 1\n        print(f\"  [round {round_no}] agent 干活……剩余 {self._remaining} 步\")\n        if self._remaining <= 0:\n            self.goal.phase = \"complete\"\n            print(f\"  [round {round_no}] 目标达成 → complete\")\n\n\n# ==========================================================================\n# turn-stopping 监听器：返回 void（None）！想续跑就调 agent.steer(...)。\n# 真实签名：'agent/turn-stopping'(payload) => Promise<void> | void\n# ==========================================================================\ndef make_budget_listener():\n    async def on_stopping(agent: Agent):\n        # 只观察，不干预 → 什么都不做，也不 steer\n        print(f\"    [turn-stopping:budget] 预算充足，不干预（不 steer）\")\n        # 返回 None（void）\n    return on_stopping\n\n\ndef make_goal_listener(activation: dict):\n    async def on_stopping(agent: Agent):\n        # 目标还 active 且激活 armed → steer 一条 goal-round 输入让 loop 续跑\n        if agent.goal.phase == \"active\" and activation[\"armed\"]:\n            agent.steer(f\"继续推进目标：{agent.goal.text}\")\n        else:\n            print(f\"    [turn-stopping:goal] 目标 {agent.goal.phase} → 不 steer，turn 将关闭\")\n        # 返回 None（void）——不返回 stop 决策\n    return on_stopping\n\n\n# ---- serial 通知：按序 await 所有监听器（它们返回 void）----\nasync def dispatch_turn_stopping(listeners, agent: Agent):\n    for fn in listeners:\n        await fn(agent)   # 监听器无返回值；续跑与否看它们有没有 steer\n\n\nasync def drive(goal: Goal, agent: Agent, max_rounds: int = 6):\n    \"\"\"loop：跑一个 step → 到停止边界跑 turn-stopping → 重读 inbox → 有 steering 就续跑。\"\"\"\n    activation = {\"armed\": True}   # 进程本地激活（真实 dsh：resume/fork 需重新授权）\n    listeners = [make_budget_listener(), make_goal_listener(activation)]\n\n    round_no = 0\n    while round_no < max_rounds:\n        round_no += 1\n        agent.run_one_step(round_no)\n\n        # ---- 到达停止边界：跑 turn-stopping（监听器可能 steer）----\n        agent.inbox.clear()  # 上一轮的 steering 已被消费\n        await dispatch_turn_stopping(listeners, agent)\n\n        # ---- loop 重读 inbox：有 steering → 续跑；没有 → 关闭 turn ----\n        if agent.inbox:\n            print(f\"  → inbox 有 steering，loop 续跑下一 step\")\n        else:\n            print(f\"  → inbox 为空，turn 关闭\")\n            break\n    return round_no\n\n\nif __name__ == \"__main__\":\n    print(\"===== 场景 A：目标需要 3 步完成，driver 通过 steer 自动续跑 =====\")\n    goal_a = Goal(text=\"修绿所有测试\")\n    agent_a = Agent(goal=goal_a, _remaining=3)\n    rounds = asyncio.run(drive(goal_a, agent_a))\n    print(f\"  共跑了 {rounds} 步，最终目标: {goal_a.phase}\")\n\n    print(\"\\n===== 场景 B：目标中途被阻塞 → 不再 steer，turn 关闭 =====\")\n    goal_b = Goal(text=\"部署到生产\")\n    agent_b = Agent(goal=goal_b, _remaining=99)\n\n    async def drive_b():\n        activation = {\"armed\": True}\n        listeners = [make_goal_listener(activation)]\n        for round_no in range(1, 4):\n            agent_b.run_one_step(round_no)\n            if round_no == 2:\n                goal_b.phase = \"blocked\"\n                print(\"  [round 2] 遇到需要人工批准的操作 → blocked\")\n            agent_b.inbox.clear()\n            await dispatch_turn_stopping(listeners, agent_b)\n            if not agent_b.inbox:\n                print(\"  → inbox 为空，turn 关闭\")\n                break\n            print(\"  → inbox 有 steering，续跑\")\n\n    asyncio.run(drive_b())\n    print(f\"  最终目标: {goal_b.phase}（阻塞后不再 steer，等人工介入）\")\n",
   "locPct": 62
  },
  {
   "id": "L20",
   "dir": "L20_profile_bundle",
   "num": "20",
   "title": "Profile / Bundle：把插件树叠出来",
   "fullTitle": "L20 Profile / Bundle：把插件树叠出来",
   "subtitle": "配置行层叠与 patch",
   "motto": "产品 = 有序层叠的插件树，任意一行都能被 patch 替换。",
   "layer": "product",
   "loc": 104,
   "hasCode": true,
   "sections": [
    {
     "name": "1. 30 秒运行",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "运行前先猜：patch 一行 `llm` 时，是只合并 config 还是整行替换？两个 layer 使用相同 id、不同\nplugin 时谁胜出？如果想同时保留两个实例，应该复用 id 还是创建新 id？\n\n```powershell\npython lessons/L20_profile_bundle/main.py\n```\n\n预期输出（节选）：\n\n```text\n===== 组合 profile: headless =====\n  [dsh-base] 插入 行 id=llm → dsh-llm-deepseek\n  [headless] 插入 行 id=subagent → dsh-subagent-spawn-in-process\n  ...\n\n===== 用 --patch 覆盖 llm 行（换成 replay，用于测试）=====\n  [--patch] 替换 行 id=llm → dsh-llm-replay\n  ---- 最终插件树 ----\n    llm          dsh-llm-replay {'script': 'fixtures/demo.json'}\n    ...\n```"
      }
     ]
    },
    {
     "name": "2. 观察输出",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "同一份 `dsh-base`，`headless` 和 `web` 两个 profile 叠出两个不同的插件树（产品）。\n最后用 `--patch` 把 `llm` 那一行**整行替换**成 replay——`dsh-base` 其余行一个没动。"
      }
     ]
    },
    {
     "name": "3. 为什么需要这一层",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "前 19 课我们都手写启动代码（`ctx.provide(...)`）。但真实产品不能靠手写启动，\n需要**声明式、可组合、可覆盖**：同一套核心，headless 版和 web 版只是叠的东西不同；\n测试时想把真模型换成 replay，不该改代码。\n\n**dsh 的答案：profile 列出要叠哪些 bundle，bundle 贡献配置行，按序层叠成插件树，\n`--patch` 可覆盖任意一行。** 这让\"同一内核组合出不同产品\"成为配置问题而非编码问题。"
      }
     ]
    },
    {
     "name": "4. 心智模型",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "profile/bundle 就像**装修房子**："
      },
      {
       "type": "compare",
       "id": "profile-house",
       "title": "同一套基础能力可以装修成不同产品",
       "items": [
        {
         "title": "dsh-base · 毛坯",
         "detail": "提供水电和承重墙般的通用核心，每个 profile 都从这里开始。"
        },
        {
         "title": "headless bundle · 简装",
         "detail": "加入一次性运行器、subagent 与 goal 等无界面能力。"
        },
        {
         "title": "web bundle · 精装",
         "detail": "加入浏览器界面和服务器，形成交互式产品。"
        },
        {
         "title": "patch · 局部换装",
         "detail": "最后按 id 替换某一项能力，不扰动其他配置。"
        }
       ]
      }
     ]
    },
    {
     "name": "5. 方案与图",
     "blocks": [
      {
       "type": "stepper",
       "id": "profile-layering",
       "title": "配置树按层叠加，越后越具体",
       "steps": [
        {
         "title": "空树",
         "detail": "从没有任何实现选择的配置开始。"
        },
        {
         "title": "叠加 dsh-base",
         "detail": "放入 llm、tool-shell、persistence 等共同基础。"
        },
        {
         "title": "叠加 bundle",
         "detail": "根据 headless 或 web profile 加入产品能力组。"
        },
        {
         "title": "叠加 profile patch",
         "detail": "覆盖该产品形态的局部默认值。"
        },
        {
         "title": "叠加 home patch",
         "detail": "应用用户机器上的长期个性化配置。"
        },
        {
         "title": "叠加命令行 patch",
         "detail": "最后一次、最具体的覆盖；同 id 替换，否则插入。"
        }
       ]
      },
      {
       "type": "markdown",
       "markdown": "### 执行透视：同一个 llm id 如何被后层稳定替换"
      },
      {
       "type": "trace",
       "id": "l20-runtime-xray",
       "title": "headless profile 的层叠与 patch",
       "panels": [
        "当前 Layer",
        "Config Tree by id",
        "llm 行来源"
       ],
       "steps": [
        {
         "title": "初始化",
         "location": "`tree={}`",
         "action": "创建空的有序配置树。",
         "states": [
          "无。",
          "`{}`",
          "不存在。"
         ]
        },
        {
         "title": "应用 base",
         "location": "`apply_layer(dsh_base)`",
         "action": "llm、tools、session 插入。",
         "states": [
          "dsh-base",
          "`{llm, tools, session}`",
          "`dsh-llm-deepseek`"
         ]
        },
        {
         "title": "应用 profile",
         "location": "`headless_bundle`",
         "action": "runner、subagent、goal 插入新 id。",
         "states": [
          "headless",
          "base + 3 行。",
          "仍来自 base。"
         ]
        },
        {
         "title": "应用 patch",
         "location": "`id=llm, replay`",
         "action": "相同 id 整行覆盖。",
         "states": [
          "--patch",
          "key 顺序保留，value 替换。",
          "`dsh-llm-replay`"
         ]
        },
        {
         "title": "dump",
         "location": "`tree.values()`",
         "action": "disabled 行过滤，其余构成最终树。",
         "states": [
          "所有层已折叠。",
          "单一 llm winner。",
          "patch 获胜。"
         ]
        }
       ]
      }
     ]
    },
    {
     "name": "6. 代码拆解",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "- `ConfigRow`：一行配置 = id + plugin + config + disabled。\n- `apply_layer()`：按 `id` 定位——存在就**整行替换**，否则插入。这就是 patch 的核心机制。\n- `dsh_base` / `headless_bundle` / `web_bundle`：三个层，各贡献若干行。\n- `build_profile()`：按顺序叠 base → profile bundle →（可选）`--patch`。\n- main：headless、web 两个 profile，再演示 `--patch` 把 llm 换成 replay。\n\n### 动手破坏一次\n\n把 key 从 `row.id` 改成 `row.plugin`。replay patch 会插入第二行而非覆盖 deepseek。这验证：\n**稳定 id 表达配置槽位，plugin 名只是槽位当前选择的实现。**"
      }
     ]
    },
    {
     "name": "7. 代码解读：声明式层叠如何把产品差异变成数据",
     "blocks": [
      {
       "type": "code-walkthrough",
       "id": "l20-code-reading",
       "title": "Layer、稳定 id 与整行覆盖",
       "source": "main.py",
       "language": "python",
       "segments": [
        {
         "title": "ConfigRow 区分槽位与实现",
         "start": 25,
         "end": 29,
         "reading": "id、plugin、config、disabled 表达身份、选择、参数和启停。",
         "reason": "patch 需要稳定槽位；若把 plugin 名当身份，替换实现就无法覆盖原行。",
         "code": "class ConfigRow:\n    id: str\n    plugin: str\n    config: dict = field(default_factory=dict)\n    disabled: bool = False"
        },
        {
         "title": "apply_layer 只有一条规则",
         "start": 32,
         "end": 37,
         "reading": "每行执行 `tree[row.id] = row`，存在是替换，不存在是插入。",
         "reason": "所有 layer 共享确定语义；不做深合并可避免旧实现配置泄漏给新 provider。",
         "code": "def apply_layer(tree: dict[str, ConfigRow], layer: list[ConfigRow], layer_name: str):\n    \"\"\"应用一层：按 id 定位——已存在则整行替换，否则插入。\"\"\"\n    for row in layer:\n        action = \"替换\" if row.id in tree else \"插入\"\n        tree[row.id] = row\n        print(f\"  [{layer_name}] {action} 行 id={row.id} → {row.plugin} {row.config or ''}\")"
        },
        {
         "title": "Bundle 只贡献配置行",
         "start": 43,
         "end": 66,
         "reading": "base、headless、web 分别返回列表，不直接 new 插件。",
         "reason": "bundle 是可组合声明，不拥有启动副作用；同一 base 可形成不同产品。",
         "code": "def dsh_base() -> list[ConfigRow]:\n    \"\"\"每个 profile 的第一层：模型、工具、持久化。\"\"\"\n    return [\n        ConfigRow(\"llm\", \"dsh-llm-deepseek\", {\"model\": \"deepseek-chat\"}),\n        ConfigRow(\"tool-shell\", \"dsh-tool-bash\", {}),\n        ConfigRow(\"persistence\", \"dsh-persistence-jsonl\", {}),\n    ]\n\n\ndef headless_bundle() -> list[ConfigRow]:\n    \"\"\"headless profile 叠加：一次性运行器 + subagent + goal。\"\"\"\n    return [\n        ConfigRow(\"runner\", \"dsh-headless-runner\", {}),\n        ConfigRow(\"subagent\", \"dsh-subagent-spawn-in-process\", {}),\n        ConfigRow(\"goal\", \"dsh-goal\", {}),\n    ]\n\n\ndef web_bundle() -> list[ConfigRow]:\n    \"\"\"web profile 叠加：浏览器应用 + web 服务器。\"\"\"\n    return [\n        ConfigRow(\"web-app\", \"dsh-web-app\", {}),\n        ConfigRow(\"server\", \"dsh-web-server\", {\"port\": 8080}),\n    ]"
        },
        {
         "title": "build_profile 固化优先级",
         "start": 69,
         "end": 79,
         "reading": "base 先应用，profile 次之，patch 最后。",
         "reason": "优先级由单一组装点表达，不依赖文件加载顺序或插件互相覆盖。",
         "code": "def build_profile(name: str, patch: list[ConfigRow] | None = None) -> dict[str, ConfigRow]:\n    print(f\"\\n===== 组合 profile: {name} =====\")\n    tree: dict[str, ConfigRow] = {}\n    apply_layer(tree, dsh_base(), \"dsh-base\")\n    if name == \"headless\":\n        apply_layer(tree, headless_bundle(), \"headless\")\n    elif name == \"web\":\n        apply_layer(tree, web_bundle(), \"web\")\n    if patch:\n        apply_layer(tree, patch, \"--patch\")\n    return tree"
        },
        {
         "title": "dump 消费最终折叠视图",
         "start": 82,
         "end": 86,
         "reading": "tree.values 保留槽位顺序，并跳过 disabled。",
         "reason": "运行器只消费 winner，不需要理解每行来自哪一层。",
         "code": "def dump(tree: dict[str, ConfigRow]):\n    print(\"  ---- 最终插件树 ----\")\n    for row in tree.values():\n        if not row.disabled:\n            print(f\"    {row.id:<12} {row.plugin} {row.config or ''}\")"
        }
       ]
      }
     ]
    },
    {
     "name": "8. 相对上一课新增了什么",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "前 19 课都是手动 new 插件。本课引入 **profile/bundle 声明式层叠 + patch 覆盖**，\n把\"手写启动\"变成\"配置组合\"，让同一内核叠出不同产品、任意一行可被替换。"
      }
     ]
    },
    {
     "name": "9. 简化了什么 vs 真实 DeepSeek Harness",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| dict 存 config rows | Cordis loader + `cordis.patch.yml`，插件树真实挂载 | 配置驱动真实的插件生命周期 |\n| 手写三个 bundle | bundle 是分发格式，`package.json` 的 `dsh` 字段声明 | 可打包分发、跨仓库复用 |\n| 单一 patch | profile patch → home patch → `--patch` 多层覆盖 | 不同层级（团队/机器/命令行）各自覆盖 |\n| 整行替换 | patch 按 id 替换整个 config，或插入新行 | 精确定位、可组合 |\n| 无 dump | `dsh --profile web --dump-config` 打印真实树 | 可检查机器实际启动的树 |\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `ConfigRow` | Cordis config row |\n| `dsh_base()` | `dsh-base` bundle |\n| `headless_bundle` / `web_bundle` | `dsh-headless` / `dsh-web-app` |\n| `--patch` 覆盖 | `--patch` overlay / `cordis.patch.yml` |\n\n---\n[← 上一课 L19](../L19_goal_driver/README.zh.md) · [返回总览](../../README.md) · [下一课 L21 →](../L21_capstone/README.zh.md)"
      }
     ]
    }
   ],
   "code": "\"\"\"L20 Profile / Bundle：把插件树叠出来\n=======================================\nMotto：产品 = 有序层叠的插件树，任意一行都能被 patch 替换。\n\n前面 19 课我们手动 new 各种插件。但真实产品不是手写启动代码，而是**声明式组合**：\n一个 profile 列出它要叠哪些 bundle，每个 bundle 贡献若干配置行（config rows），\n按顺序层叠成最终的插件树。最后还能用 --patch 覆盖任意一行。\n\n层叠顺序（真实 dsh）：\n  dsh-base（模型/工具/持久化/...）→ profile 自己的 bundle → profile patch\n  → home 级 patch → --patch 覆盖\n后面的层能替换前面层的任意一行（按 id 定位）。\n\n本课用一组 dict（config rows）模拟这个层叠 + patch 覆盖。\n\n运行：  python lessons/L20_profile_bundle/main.py\n\"\"\"\n\nfrom __future__ import annotations\n\nfrom dataclasses import dataclass, field\n\n\n@dataclass\nclass ConfigRow:\n    id: str\n    plugin: str\n    config: dict = field(default_factory=dict)\n    disabled: bool = False\n\n\ndef apply_layer(tree: dict[str, ConfigRow], layer: list[ConfigRow], layer_name: str):\n    \"\"\"应用一层：按 id 定位——已存在则整行替换，否则插入。\"\"\"\n    for row in layer:\n        action = \"替换\" if row.id in tree else \"插入\"\n        tree[row.id] = row\n        print(f\"  [{layer_name}] {action} 行 id={row.id} → {row.plugin} {row.config or ''}\")\n\n\n# ==========================================================================\n# 各个 bundle / profile 层\n# ==========================================================================\ndef dsh_base() -> list[ConfigRow]:\n    \"\"\"每个 profile 的第一层：模型、工具、持久化。\"\"\"\n    return [\n        ConfigRow(\"llm\", \"dsh-llm-deepseek\", {\"model\": \"deepseek-chat\"}),\n        ConfigRow(\"tool-shell\", \"dsh-tool-bash\", {}),\n        ConfigRow(\"persistence\", \"dsh-persistence-jsonl\", {}),\n    ]\n\n\ndef headless_bundle() -> list[ConfigRow]:\n    \"\"\"headless profile 叠加：一次性运行器 + subagent + goal。\"\"\"\n    return [\n        ConfigRow(\"runner\", \"dsh-headless-runner\", {}),\n        ConfigRow(\"subagent\", \"dsh-subagent-spawn-in-process\", {}),\n        ConfigRow(\"goal\", \"dsh-goal\", {}),\n    ]\n\n\ndef web_bundle() -> list[ConfigRow]:\n    \"\"\"web profile 叠加：浏览器应用 + web 服务器。\"\"\"\n    return [\n        ConfigRow(\"web-app\", \"dsh-web-app\", {}),\n        ConfigRow(\"server\", \"dsh-web-server\", {\"port\": 8080}),\n    ]\n\n\ndef build_profile(name: str, patch: list[ConfigRow] | None = None) -> dict[str, ConfigRow]:\n    print(f\"\\n===== 组合 profile: {name} =====\")\n    tree: dict[str, ConfigRow] = {}\n    apply_layer(tree, dsh_base(), \"dsh-base\")\n    if name == \"headless\":\n        apply_layer(tree, headless_bundle(), \"headless\")\n    elif name == \"web\":\n        apply_layer(tree, web_bundle(), \"web\")\n    if patch:\n        apply_layer(tree, patch, \"--patch\")\n    return tree\n\n\ndef dump(tree: dict[str, ConfigRow]):\n    print(\"  ---- 最终插件树 ----\")\n    for row in tree.values():\n        if not row.disabled:\n            print(f\"    {row.id:<12} {row.plugin} {row.config or ''}\")\n\n\nif __name__ == \"__main__\":\n    # 同一套 base，两个 profile 叠出两个不同产品\n    headless = build_profile(\"headless\")\n    dump(headless)\n\n    web = build_profile(\"web\")\n    dump(web)\n\n    # --patch：把 llm 那一行整行换掉（比如换成 replay 做测试），base 一行没动\n    print(\"\\n===== 用 --patch 覆盖 llm 行（换成 replay，用于测试）=====\")\n    patched = build_profile(\"headless\", patch=[\n        ConfigRow(\"llm\", \"dsh-llm-replay\", {\"script\": \"fixtures/demo.json\"}),\n    ])\n    dump(patched)\n    print(\"\\n  → 同一份 base，profile 决定叠什么，--patch 覆盖任意一行。\")\n    print(\"    这就是'产品 = 有序层叠的插件树'。\")\n",
   "locPct": 48
  },
  {
   "id": "L21",
   "dir": "L21_capstone",
   "num": "21",
   "title": "Capstone：合成一个可跑的 mini-dsh",
   "fullTitle": "L21 Capstone：合成一个可跑的 mini-dsh",
   "subtitle": "八层机制合成 mini-dsh",
   "motto": "核心主干合一，对照真实 harness 看每层如何插在一起。",
   "layer": "product",
   "loc": 217,
   "hasCode": true,
   "sections": [
    {
     "name": "1. 30 秒运行",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "运行前先画出三条不会混在一起的状态线：root Session、child Session、`ctx` 服务表。shell 与\nsubagent 连续执行时，哪些数据回到 root，哪些只留在 child，哪些根本不是会话状态？\n\n```powershell\npython lessons/L21_capstone/main.py\n```\n\n预期输出（节选）：\n\n```text\n========== mini-dsh 启动（headless 缩影）==========\n  [assistant] 先本地跑一条命令。\n  [tool] shell → 'mini-dsh\\nalive'\n  [assistant] 再委派一个子任务隔离上下文。\n  [tool] subagent → '子任务完成：环境正常。（子会话内 11 条事件，未回传）'\n  [assistant] 全部完成。mini-dsh 跑通了 8 层机制。\n\n========== 唯一真源：root 会话日志 ==========\n  #0 turn/start ... #15 turn/end\n  共 16 条事件。模型历史随时可从这份日志重新派生（可回放）。\n```"
      }
     ]
    },
    {
     "name": "2. 观察输出",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "一个约 200 行的 mini-dsh 跑通了**完整流程**：pre-step 注入提醒 → 本地 shell →\n委派 subagent（子会话隔离）→ 收尾。整个过程只留下一份 16 条事件的 root 日志，\n子 agent 的中间过程留在它自己的会话——root 保持干净。"
      }
     ]
    },
    {
     "name": "3. 为什么需要这一层",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "前 20 课每课只看一层。但真正的理解，来自看清**这些层如何插在一起**。这一课把\n8 层核心机制装进一个文件，让你亲眼看到：一次 `loop.run()` 是怎么穿过 pre-step、\nturn/step、llm seam、工具管线、subagent，同时始终把一切追加进那份唯一真源的。"
      }
     ]
    },
    {
     "name": "4. 心智模型",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "回到最开始的锚点——**L01 那个循环从没变过**。这一课只是把 20 课的每一层\n都插到那个循环旁边："
      },
      {
       "type": "flow",
       "id": "capstone-layers",
       "title": "mini-dsh：所有机制围绕 Session 接成一个运行环",
       "nodes": [
        {
         "id": "input",
         "title": "用户任务",
         "detail": "root agent 接住一次 headless 任务。",
         "edges": [
          {
           "target": "pre",
           "label": ""
          }
         ],
         "position": {
          "column": 1,
          "row": 1
         },
         "kind": ""
        },
        {
         "id": "pre",
         "title": "pre-step waterfall",
         "detail": "插件可以注入提醒或拒绝输入。",
         "edges": [
          {
           "target": "user_event",
           "label": ""
          }
         ],
         "position": {
          "column": 2,
          "row": 1
         },
         "kind": ""
        },
        {
         "id": "user_event",
         "title": "追加 user/message",
         "detail": "处理后的输入先写入 root Session。",
         "edges": [
          {
           "target": "session",
           "label": ""
          }
         ],
         "position": {
          "column": 3,
          "row": 1
         },
         "kind": ""
        },
        {
         "id": "session",
         "title": "Root Session",
         "detail": "所有事实的唯一真源；模型历史随时从这里重建。",
         "edges": [
          {
           "target": "derive",
           "label": ""
          }
         ],
         "position": {
          "column": 4,
          "row": 1
         },
         "kind": "state"
        },
        {
         "id": "derive",
         "title": "derive_messages",
         "detail": "从日志投影出完整 user/assistant/tool 历史。",
         "edges": [
          {
           "target": "llm",
           "label": ""
          }
         ],
         "position": {
          "column": 5,
          "row": 1
         },
         "kind": ""
        },
        {
         "id": "llm",
         "title": "ctx.llm",
         "detail": "通过可替换 seam 请求模型。",
         "edges": [
          {
           "target": "decide",
           "label": ""
          }
         ],
         "position": {
          "column": 6,
          "row": 1
         },
         "kind": ""
        },
        {
         "id": "decide",
         "title": "有工具调用吗？",
         "detail": "无调用就结束；有调用交给工具注册表和策略管线。",
         "edges": [
          {
           "target": "dispatch",
           "label": "有"
          },
          {
           "target": "done",
           "label": "无"
          }
         ],
         "position": {
          "column": 7,
          "row": 1
         },
         "kind": "decision"
        },
        {
         "id": "done",
         "title": "最终答复",
         "detail": "关闭 step/turn，headless 任务完成。",
         "edges": [],
         "position": {
          "column": 8,
          "row": 1
         },
         "kind": "terminal"
        },
        {
         "id": "ctx",
         "title": "ctx 服务容器",
         "detail": "组装 llm 与 tools provider，不参与保存会话事实。",
         "edges": [
          {
           "target": "llm",
           "label": "提供模型"
          },
          {
           "target": "dispatch",
           "label": "提供工具"
          }
         ],
         "position": {
          "column": 6,
          "row": 2
         },
         "kind": "state"
        },
        {
         "id": "dispatch",
         "title": "tools.dispatch",
         "detail": "经过注册表与 pre 策略执行 shell 或 subagent。",
         "edges": [
          {
           "target": "result",
           "label": "普通工具"
          },
          {
           "target": "child",
           "label": "调用 subagent"
          }
         ],
         "position": {
          "column": 7,
          "row": 3
         },
         "kind": "decision"
        },
        {
         "id": "result",
         "title": "追加 tool/result",
         "detail": "权威工具结果写回 root Session，驱动下一 step。",
         "edges": [
          {
           "target": "session",
           "label": "回到真源"
          }
         ],
         "position": {
          "column": 4,
          "row": 3
         },
         "kind": ""
        },
        {
         "id": "child",
         "title": "Child AgentLoop",
         "detail": "subagent 在独立上下文中运行自己的完整循环。",
         "edges": [
          {
           "target": "child_session",
           "label": ""
          }
         ],
         "position": {
          "column": 7,
          "row": 4
         },
         "kind": ""
        },
        {
         "id": "child_session",
         "title": "Child Session",
         "detail": "子 agent 的中间事件只留在子会话。",
         "edges": [
          {
           "target": "child_result",
           "label": ""
          }
         ],
         "position": {
          "column": 5,
          "row": 4
         },
         "kind": "state"
        },
        {
         "id": "child_result",
         "title": "仅返回最终结论",
         "detail": "子会话 final result 作为 root 的一个工具结果。",
         "edges": [
          {
           "target": "result",
           "label": ""
          }
         ],
         "position": {
          "column": 4,
          "row": 4
         },
         "kind": ""
        }
       ],
       "variant": "map"
      }
     ]
    },
    {
     "name": "5. 方案与图",
     "blocks": [
      {
       "type": "stepper",
       "id": "capstone-assembly",
       "title": "从组装到运行 mini-dsh",
       "steps": [
        {
         "title": "提供模型",
         "detail": "`ctx.provide(\"llm\", ReplayLLM)` 接上 L08 provider。"
        },
        {
         "title": "提供工具管线",
         "detail": "把 registry 与执行策略挂到 ctx。"
        },
        {
         "title": "注册 subagent",
         "detail": "将隔离委派能力作为一种工具加入注册表。"
        },
        {
         "title": "创建 AgentLoop",
         "detail": "注入 root session 与 pre-step reminder。"
        },
        {
         "title": "运行任务",
         "detail": "每步执行“日志投影 → 模型 → 工具分派 → 追加事件”。"
        }
       ]
      },
      {
       "type": "markdown",
       "markdown": "### 执行透视：八层机制在一次 root turn 中如何交汇"
      },
      {
       "type": "trace",
       "id": "l21-runtime-xray",
       "title": "root loop、工具管线与 child loop 的状态分工",
       "panels": [
        "Root Session",
        "Child Session",
        "ctx / tools"
       ],
       "steps": [
        {
         "title": "组装产品",
         "location": "`ctx.provide`",
         "action": "root llm、tools、subagent 接入。",
         "states": [
          "尚无事件。",
          "不存在。",
          "`{llm, tools:{shell,subagent}}`"
         ]
        },
        {
         "title": "pre-step",
         "location": "`context_reminder`",
         "action": "输入被追加能力提醒。",
         "states": [
          "`turn/start; user(改写后)`",
          "不存在。",
          "服务表不变。"
         ]
        },
        {
         "title": "root shell",
         "location": "`dispatch(shell)`",
         "action": "policy 放行，结果写回。",
         "states": [
          "`step0; call c1; result c1`",
          "不存在。",
          "shell handler 执行。"
         ]
        },
        {
         "title": "root 委派",
         "location": "`dispatch(subagent)`",
         "action": "handler 创建 child ctx/session/loop。",
         "states": [
          "`step1; call c2`",
          "新建并开始 turn。",
          "child 有独立 llm/tools。"
         ]
        },
        {
         "title": "child 完成",
         "location": "`child loop.run`",
         "action": "child 调 shell 后收尾。",
         "states": [
          "等待一个结果。",
          "完整 11 条事件。",
          "child tools 完成。"
         ]
        },
        {
         "title": "边界回传",
         "location": "`return result+count`",
         "action": "child final 成为 root c2 result。",
         "states": [
          "新增一条 result。",
          "原日志保留。",
          "handler 返回。"
         ]
        },
        {
         "title": "root 收尾",
         "location": "`root llm s3`",
         "action": "模型读两次观察，关闭 turn。",
         "states": [
          "16 条权威事件。",
          "与 root 隔离。",
          "ctx 不保存会话事实。"
         ]
        }
       ]
      }
     ]
    },
    {
     "name": "6. 代码拆解",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "整个文件按课号标注了每一块的来源：\n\n- `Session` + `SessionEvent`（L04）、`derive_messages`（L05）：唯一真源与投影。\n- `Context`（L02）：极简 ctx，`llm`/`tools` 挂在上面。\n- `ToolRegistry` + `dispatch`（L10/L11）：工具注册 + pre 策略（拒绝 `rm -rf`）。\n- `run_waterfall`（L03）：pre-step 注入上下文提醒。\n- `AgentLoop.run`（L06）：turn/step 驱动，全程 append 事件。\n- `make_subagent_tool`（L16）：委派子任务到独立会话，只回传结果。\n- 底部组装对照真实 `headless` profile（L20）。\n\n### 动手破坏一次\n\n让 child AgentLoop 复用 root Session。root 日志会混入 child turn/step，投影也无法区分说话者。\n这验证：**组合机制可以复用，运行状态必须按 agent 隔离。**"
      }
     ]
    },
    {
     "name": "7. 代码解读：八层不是八个阶段，而是三条协作主线",
     "blocks": [
      {
       "type": "code-walkthrough",
       "id": "l21-code-reading",
       "title": "状态主线、能力主线与委派边界",
       "source": "main.py",
       "language": "python",
       "segments": [
        {
         "title": "Session 与投影组成状态主线",
         "start": 38,
         "end": 71,
         "reading": "Session 保存事实；derive_messages 投影 user、assistant、tool result 并保留 callId。",
         "reason": "后续能力只追加或读取这条主线，不各自维护对话副本。",
         "code": "class SessionEvent:\n    seq: int\n    type: str\n    data: dict\n\n\nclass Session:\n    def __init__(self, label=\"root\"):\n        self.label = label\n        self._events: list[SessionEvent] = []\n\n    def append(self, type, data):\n        self._events.append(SessionEvent(len(self._events), type, data))\n\n    def events(self):\n        return list(self._events)\n\n\n# ---------- L05：deriveMessages（保留完整 tool_calls，并按 callId 配对 tool 结果）----------\ndef derive_messages(events) -> list[dict]:\n    msgs = []\n    for ev in events:\n        if ev.type == \"user/message\":\n            msgs.append({\"role\": \"user\", \"content\": ev.data[\"content\"]})\n        elif ev.type == \"assistant/message\" and (ev.data.get(\"text\") or ev.data.get(\"tool_calls\")):\n            m = {\"role\": \"assistant\", \"content\": ev.data.get(\"text\", \"\")}\n            # 保留完整工具调用定义（换成真实模型也不会断链）\n            if ev.data.get(\"tool_calls\"):\n                m[\"tool_calls\"] = ev.data[\"tool_calls\"]\n            msgs.append(m)\n        elif ev.type == \"tool/result\":\n            # 按 callId 配对：真实 API 靠 tool_call_id 把 result 挂回对应的 call\n            msgs.append({\"role\": \"tool\", \"tool_call_id\": ev.data[\"callId\"], \"content\": ev.data[\"result\"]})\n    return msgs"
        },
        {
         "title": "Context 与 Registry 组成能力主线",
         "start": 75,
         "end": 103,
         "reading": "ctx 按 key 提供服务；registry 在 pre policy 后查 handler。",
         "reason": "会话事实与能力对象分开：ctx 可重组，Session 仍是同一历史。",
         "code": "class Context:\n    def __init__(self):\n        self._svc: dict[str, Any] = {}\n\n    def provide(self, key, svc):\n        self._svc[key] = svc\n\n    def __getattr__(self, key):\n        svc = self.__dict__.get(\"_svc\", {})\n        if key in svc:\n            return svc[key]\n        raise AttributeError(key)\n\n\n# ---------- L10/L11：工具注册表 + 管线 ----------\n@dataclass\nclass ToolRegistry:\n    tools: dict = field(default_factory=dict)\n    pre: list = field(default_factory=list)\n\n    def register(self, name, execute):\n        self.tools[name] = execute\n\n    def dispatch(self, name, args) -> str:\n        for policy in self.pre:                       # L11 pre-execute\n            if policy(name, args) == \"deny\":\n                return f\"[denied] {name}\"\n        fn = self.tools.get(name)\n        return str(fn(args)) if fn else f\"[未知工具] {name}\""
        },
        {
         "title": "AgentLoop 是两条主线交汇点",
         "start": 116,
         "end": 148,
         "reading": "pre-step 后落日志，每 step 重新投影、请求 llm、分派工具并写结果。",
         "reason": "循环不拥有能力，但保证每个观察回到真源后才进入下一请求。",
         "code": "class AgentLoop:\n    def __init__(self, ctx: Context, session: Session, pre_step=None):\n        self.ctx = ctx\n        self.session = session\n        self.pre_step = pre_step or []\n\n    def run(self, user_input: str, max_steps=8) -> str:\n        self.session.append(\"turn/start\", {\"turn\": 0})\n        # L03 pre-step 拦截\n        decision = run_waterfall(self.pre_step, {\"content\": user_input})\n        self.session.append(\"user/message\", {\"content\": decision[\"content\"], \"source\": \"human\"})\n\n        final = \"\"\n        for step in range(max_steps):\n            self.session.append(\"step/start\", {\"step\": step})\n            turn: AssistantTurn = self.ctx.llm.complete(derive_messages(self.session.events()))\n            # 记录完整工具调用定义（id+name+arguments），以便派生历史时不断链\n            tool_calls = [{\"id\": c.id, \"name\": c.name, \"arguments\": c.arguments} for c in turn.tool_calls]\n            self.session.append(\"assistant/message\", {\"text\": turn.text, \"tool_calls\": tool_calls})\n            if turn.text:\n                print(f\"  [assistant] {turn.text}\")\n            if not turn.wants_tools:\n                final = turn.text\n                self.session.append(\"step/end\", {\"step\": step})\n                break\n            for tc in turn.tool_calls:\n                self.session.append(\"tool/call\", {\"callId\": tc.id, \"name\": tc.name})\n                result = self.ctx.tools.dispatch(tc.name, tc.arguments)\n                self.session.append(\"tool/result\", {\"callId\": tc.id, \"result\": result})\n                print(f\"  [tool] {tc.name} → {result!r}\")\n            self.session.append(\"step/end\", {\"step\": step})\n        self.session.append(\"turn/end\", {\"turn\": 0, \"reason\": \"natural-stop\"})\n        return final"
        },
        {
         "title": "Subagent 建立第二套主线",
         "start": 152,
         "end": 161,
         "reading": "spawn 创建 child ctx、tools、Session 和 Loop，只返回 final + count。",
         "reason": "委派是实例化另一套相同机制，并限制边界输出。",
         "code": "def make_subagent_tool(child_llm_factory: Callable[[], Any]):\n    def spawn(args):\n        child_ctx = Context()\n        child_ctx.provide(\"llm\", child_llm_factory())\n        child_ctx.provide(\"tools\", _build_tools())\n        child = Session(label=\"child\")\n        loop = AgentLoop(child_ctx, child)\n        result = loop.run(args[\"prompt\"])\n        return f\"{result}（子会话内 {len(child.events())} 条事件，未回传）\"\n    return spawn"
        },
        {
         "title": "入口选择 root 产品形态",
         "start": 198,
         "end": 217,
         "reading": "提供 root llm、注册工具、创建 root session，并注入 reminder。",
         "reason": "profile 选择 provider/consumer，运行时 loop 无需知道为何这样组装。",
         "code": "if __name__ == \"__main__\":\n    # ---- 组装 mini-dsh（对照 headless profile）----\n    ctx = Context()\n    ctx.provide(\"llm\", build_root_llm())\n    tools = _build_tools()\n    tools.register(\"subagent\", make_subagent_tool(build_child_llm))\n    ctx.provide(\"tools\", tools)\n\n    root = Session(label=\"root\")\n    loop = AgentLoop(ctx, root, pre_step=[context_reminder])\n\n    print(\"========== mini-dsh 启动（headless 缩影）==========\")\n    final = loop.run(\"演示一下你的能力\")\n    print(f\"\\n[最终答复] {final}\")\n\n    print(f\"\\n========== 唯一真源：root 会话日志 ==========\")\n    for ev in root.events():\n        print(f\"  #{ev.seq:<2} {ev.type}\")\n    print(f\"\\n  共 {len(root.events())} 条事件。模型历史随时可从这份日志重新派生（可回放）。\")\n    print(\"  子 agent 的中间过程留在它自己的会话，root 日志保持干净。\")"
        }
       ]
      }
     ]
    },
    {
     "name": "8. 相对上一课新增了什么",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "不新增机制，而是**把 8 层机制整合**成一个可运行的整体，并用课号标注每块出处，\n让你看清各层如何协同。这是从\"逐层理解\"到\"整体贯通\"的收束。"
      }
     ]
    },
    {
     "name": "9. 简化了什么 vs 真实 DeepSeek Harness",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "| 教学版（本课） | 真实 dsh（examples/headless-agent） | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| 200 行单文件 | 数十个 package 组成的插件树 | 每层独立演进、可替换、可测试 |\n| 手动组装 ctx | `dsh --profile headless` 声明式启动 | 配置驱动，多产品复用（见 L20） |\n| 内存日志 | JSONL 持久化 + checkpoint policy | 崩溃恢复、跨进程存活（见附录 X） |\n| Replay LLM | DeepSeek V4 + 真实流式 | 生产级模型能力 |\n| 只集成 8 层 | 还有 compaction/goal/jobs/skills/scope 全都在线 | 完整产品需要全部能力协同 |\n\n> **对照真实入口**：`deepseek-harness/examples/headless-agent` 的 headless profile\n> 也是\"组合 agent 主干 + 一个 root agent + 持久化 + checkpoint\"，接一个任务、跑完、\n> 打印最终文本、退出。本课就是它的教学缩影——机制等价，规模不同。\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| 整个 mini-dsh | `examples/headless-agent` 的 headless 组合 |\n| `AgentLoop` | `ctx.agentLoop`（`core/agent-loop`） |\n| 组装段 | `dsh --profile headless` |\n| root/child Session | root agent + subagent 的独立会话 |\n\n---\n🎓 **恭喜你走完 21 课！** 你已经从最小循环一路叠到多 agent 协作，理解了 dsh 的完整骨架。\n\n[← 上一课 L20](../L20_profile_bundle/README.zh.md) · [返回总览](../../README.md) · [下一课 L22 →](../L22_session_trace/README.zh.md)"
      }
     ]
    }
   ],
   "code": "\"\"\"L21 Capstone：合成一个可跑的 mini-dsh\n=========================================\nMotto：所有机制合一，对照真实 harness 看每层如何插在一起。\n\n这是压轴课。它把前 20 课的核心机制装进一个约 200 行的 mini-dsh：\n\n  L02 Cordis ctx 插件      —— 一切经 ctx 组合\n  L03 事件（waterfall）     —— pre-step 拦截\n  L04 仅追加事件日志         —— 唯一真源\n  L05 deriveMessages       —— 从日志投影历史\n  L06 turn/step 生命周期     —— 驱动循环\n  L08 llm seam             —— 可换 provider（这里用 Replay）\n  L10/L11 工具注册表 + 管线   —— 工具经 pre/execute/post 分派\n  L16 subagent             —— 委派子任务，上下文隔离\n\n对照 deepseek-harness/examples/headless-agent：真实的 headless profile 也是把\n\"agent 主干 + 一个 root agent + 持久化 + checkpoint\" 组合起来，接一个任务、\n跑完、打印最终文本、退出。本课就是它的教学缩影。\n\n运行：  python lessons/L21_capstone/main.py\n\"\"\"\n\nfrom __future__ import annotations\n\nimport os\nimport sys\nfrom dataclasses import dataclass, field\nfrom typing import Any, Callable\n\nsys.path.insert(0, os.path.join(os.path.dirname(__file__), \"..\", \"..\"))\n\nfrom shared.llm import AssistantTurn, ToolCall, make_llm  # noqa: E402\nfrom shared.shell import run_shell  # noqa: E402\n\n\n# ---------- L04：仅追加事件日志 ----------\n@dataclass(frozen=True)\nclass SessionEvent:\n    seq: int\n    type: str\n    data: dict\n\n\nclass Session:\n    def __init__(self, label=\"root\"):\n        self.label = label\n        self._events: list[SessionEvent] = []\n\n    def append(self, type, data):\n        self._events.append(SessionEvent(len(self._events), type, data))\n\n    def events(self):\n        return list(self._events)\n\n\n# ---------- L05：deriveMessages（保留完整 tool_calls，并按 callId 配对 tool 结果）----------\ndef derive_messages(events) -> list[dict]:\n    msgs = []\n    for ev in events:\n        if ev.type == \"user/message\":\n            msgs.append({\"role\": \"user\", \"content\": ev.data[\"content\"]})\n        elif ev.type == \"assistant/message\" and (ev.data.get(\"text\") or ev.data.get(\"tool_calls\")):\n            m = {\"role\": \"assistant\", \"content\": ev.data.get(\"text\", \"\")}\n            # 保留完整工具调用定义（换成真实模型也不会断链）\n            if ev.data.get(\"tool_calls\"):\n                m[\"tool_calls\"] = ev.data[\"tool_calls\"]\n            msgs.append(m)\n        elif ev.type == \"tool/result\":\n            # 按 callId 配对：真实 API 靠 tool_call_id 把 result 挂回对应的 call\n            msgs.append({\"role\": \"tool\", \"tool_call_id\": ev.data[\"callId\"], \"content\": ev.data[\"result\"]})\n    return msgs\n\n\n# ---------- L02：迷你 ctx ----------\nclass Context:\n    def __init__(self):\n        self._svc: dict[str, Any] = {}\n\n    def provide(self, key, svc):\n        self._svc[key] = svc\n\n    def __getattr__(self, key):\n        svc = self.__dict__.get(\"_svc\", {})\n        if key in svc:\n            return svc[key]\n        raise AttributeError(key)\n\n\n# ---------- L10/L11：工具注册表 + 管线 ----------\n@dataclass\nclass ToolRegistry:\n    tools: dict = field(default_factory=dict)\n    pre: list = field(default_factory=list)\n\n    def register(self, name, execute):\n        self.tools[name] = execute\n\n    def dispatch(self, name, args) -> str:\n        for policy in self.pre:                       # L11 pre-execute\n            if policy(name, args) == \"deny\":\n                return f\"[denied] {name}\"\n        fn = self.tools.get(name)\n        return str(fn(args)) if fn else f\"[未知工具] {name}\"\n\n\n# ---------- L03：pre-step waterfall ----------\ndef run_waterfall(listeners, value):\n    def dispatch(i, v):\n        if i >= len(listeners):\n            return v\n        return listeners[i](v, lambda nv=None: dispatch(i + 1, nv if nv is not None else v))\n    return dispatch(0, value)\n\n\n# ---------- L06：turn/step 驱动器 ----------\nclass AgentLoop:\n    def __init__(self, ctx: Context, session: Session, pre_step=None):\n        self.ctx = ctx\n        self.session = session\n        self.pre_step = pre_step or []\n\n    def run(self, user_input: str, max_steps=8) -> str:\n        self.session.append(\"turn/start\", {\"turn\": 0})\n        # L03 pre-step 拦截\n        decision = run_waterfall(self.pre_step, {\"content\": user_input})\n        self.session.append(\"user/message\", {\"content\": decision[\"content\"], \"source\": \"human\"})\n\n        final = \"\"\n        for step in range(max_steps):\n            self.session.append(\"step/start\", {\"step\": step})\n            turn: AssistantTurn = self.ctx.llm.complete(derive_messages(self.session.events()))\n            # 记录完整工具调用定义（id+name+arguments），以便派生历史时不断链\n            tool_calls = [{\"id\": c.id, \"name\": c.name, \"arguments\": c.arguments} for c in turn.tool_calls]\n            self.session.append(\"assistant/message\", {\"text\": turn.text, \"tool_calls\": tool_calls})\n            if turn.text:\n                print(f\"  [assistant] {turn.text}\")\n            if not turn.wants_tools:\n                final = turn.text\n                self.session.append(\"step/end\", {\"step\": step})\n                break\n            for tc in turn.tool_calls:\n                self.session.append(\"tool/call\", {\"callId\": tc.id, \"name\": tc.name})\n                result = self.ctx.tools.dispatch(tc.name, tc.arguments)\n                self.session.append(\"tool/result\", {\"callId\": tc.id, \"result\": result})\n                print(f\"  [tool] {tc.name} → {result!r}\")\n            self.session.append(\"step/end\", {\"step\": step})\n        self.session.append(\"turn/end\", {\"turn\": 0, \"reason\": \"natural-stop\"})\n        return final\n\n\n# ---------- L16：subagent 工具 ----------\ndef make_subagent_tool(child_llm_factory: Callable[[], Any]):\n    def spawn(args):\n        child_ctx = Context()\n        child_ctx.provide(\"llm\", child_llm_factory())\n        child_ctx.provide(\"tools\", _build_tools())\n        child = Session(label=\"child\")\n        loop = AgentLoop(child_ctx, child)\n        result = loop.run(args[\"prompt\"])\n        return f\"{result}（子会话内 {len(child.events())} 条事件，未回传）\"\n    return spawn\n\n\n# ---------- 组装（L20 的手动缩影）----------\ndef _build_tools() -> ToolRegistry:\n    reg = ToolRegistry()\n    reg.pre.append(lambda name, args: \"deny\" if \"rm -rf\" in str(args.get(\"command\", \"\")) else \"allow\")\n    reg.register(\"shell\", lambda a: run_shell(a.get(\"command\", \"\")))\n    return reg\n\n\ndef build_child_llm():\n    def s1(_m):\n        return AssistantTurn(text=\"子任务：探测。\", tool_calls=[ToolCall(\"x1\", \"shell\", {\"command\": \"echo child probing\"})])\n\n    def s2(_m):\n        return AssistantTurn(text=\"子任务完成：环境正常。\")\n    return make_llm(script=[s1, s2])\n\n\ndef build_root_llm():\n    def s1(_m):\n        return AssistantTurn(text=\"先本地跑一条命令。\", tool_calls=[ToolCall(\"c1\", \"shell\", {\"command\": \"echo mini-dsh alive\"})])\n\n    def s2(_m):\n        return AssistantTurn(text=\"再委派一个子任务隔离上下文。\", tool_calls=[ToolCall(\"c2\", \"subagent\", {\"prompt\": \"探测环境\"})])\n\n    def s3(m):\n        return AssistantTurn(text=\"全部完成。mini-dsh 跑通了 8 层机制。\")\n    return make_llm(script=[s1, s2, s3])\n\n\ndef context_reminder(decision, next_):\n    \"\"\"L03/L14 风格：pre-step 注入一条上下文提醒。\"\"\"\n    return next_({**decision, \"content\": decision[\"content\"] + \"（提醒：可用 shell 与 subagent）\"})\n\n\nif __name__ == \"__main__\":\n    # ---- 组装 mini-dsh（对照 headless profile）----\n    ctx = Context()\n    ctx.provide(\"llm\", build_root_llm())\n    tools = _build_tools()\n    tools.register(\"subagent\", make_subagent_tool(build_child_llm))\n    ctx.provide(\"tools\", tools)\n\n    root = Session(label=\"root\")\n    loop = AgentLoop(ctx, root, pre_step=[context_reminder])\n\n    print(\"========== mini-dsh 启动（headless 缩影）==========\")\n    final = loop.run(\"演示一下你的能力\")\n    print(f\"\\n[最终答复] {final}\")\n\n    print(f\"\\n========== 唯一真源：root 会话日志 ==========\")\n    for ev in root.events():\n        print(f\"  #{ev.seq:<2} {ev.type}\")\n    print(f\"\\n  共 {len(root.events())} 条事件。模型历史随时可从这份日志重新派生（可回放）。\")\n    print(\"  子 agent 的中间过程留在它自己的会话，root 日志保持干净。\")\n",
   "locPct": 100
  },
  {
   "id": "L22",
   "dir": "L22_session_trace",
   "num": "22",
   "title": "显式 Trace：把事件日志查出来",
   "fullTitle": "L22 显式 Trace：把事件日志查出来",
   "subtitle": "read / search / trace 读侧",
   "motto": "一切皆事件，所以一切皆可显式回溯。",
   "layer": "product",
   "loc": 201,
   "hasCode": true,
   "sections": [
    {
     "name": "1. 30 秒运行",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "运行前先猜：trace 一条 shadowed tool/result 时，应该只告诉你“当前不可见”，还是继续指出哪条\n摘要替换了它？assistant/message 引用 chunks 的关系，应从 message 反查还是写入时记录？\n\n```powershell\npython lessons/L22_session_trace/main.py\n```\n\n预期输出（节选）：\n\n```text\n===== read：读全部事件 + surface 三态 =====\n  #1  user/message         [shadowed ] ○被压缩遮蔽\n  #4  assistant/message    [shadowed ] ○被压缩遮蔽\n  #5  tool/call            [log-only ] ·记账事件\n  #9  user/message         [current  ] ●在模型上下文\n\n===== trace #6（一条被压缩遮蔽的 tool/result）：谁替换了它 =====\n  被替换 (replacedBy): 9  ← 摘要事件 #9\n  替换链 (replacementChain): [9]\n\n===== trace #9（那条压缩摘要）：它遮蔽了哪些事件 =====\n  它替换掉的事件 (replacedEventSeqs): [1, 2, 3, 4, 5, 6, 7]  ← 旧的 1..7\n```"
      }
     ]
    },
    {
     "name": "2. 观察输出",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "`read` 给每条事件标了 **surface 三态**：`current`（在模型上下文）、`shadowed`（被压缩遮蔽）、\n`log-only`（记账）。`trace #4` 追出它引用的两条 chunk；`trace #6` 追出它被摘要 #9 替换；\n`trace #9` 反过来列出它遮蔽掉的旧范围 1..7。被遮蔽的事件**一条没删**，因果链随时可查。"
      }
     ]
    },
    {
     "name": "3. 为什么需要这一层",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "前 21 课一路在讲**写侧**：往日志追加事件（L04）、投影给模型看（L05）、用压缩遮蔽旧范围（L15）。\n但从没讲**读侧**——怎么反过来查询、追溯、搜索这份日志。\n\n这正是 dsh 事件溯源设计**最受称赞**的兑现点：因为一切皆事件、日志是唯一真源，\n所以任意一条事件的因果关系都能被**显式追出来**——它从哪来（引用了哪些来源）、\n到哪去（被谁引用/替换）、现在处于什么状态。debug、审计、agent 自查历史，全靠它。"
      }
     ]
    },
    {
     "name": "4. 心智模型",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "trace 就是给事件日志装了一套**监控回放 + 关系图谱**："
      },
      {
       "type": "compare",
       "id": "trace-read-write",
       "title": "同一份事件日志的写侧与读侧",
       "items": [
        {
         "title": "写侧：形成事实",
         "detail": "append 事件、deriveMessages 投影、compaction 遮蔽共同维护会话真源。"
        },
        {
         "title": "读侧：理解事实",
         "detail": "read 倒带每一帧，search 按关键词跳转，trace 追踪前因后果。"
        }
       ]
      },
      {
       "type": "markdown",
       "markdown": "每条事件像监控录像里的一帧：既能顺序回放，也能点开某一帧问\"它是谁触发的、后来被什么覆盖了\"。"
      }
     ]
    },
    {
     "name": "5. 方案与图",
     "blocks": [
      {
       "type": "flow",
       "id": "trace-analysis",
       "title": "以目标事件为中心，向四个方向追溯关系",
       "nodes": [
        {
         "id": "read",
         "title": "read(seq)",
         "detail": "按序读取事件并附上当前 surface 状态。",
         "edges": [
          {
           "target": "target",
           "label": ""
          }
         ],
         "position": {
          "column": 1,
          "row": 2
         },
         "kind": ""
        },
        {
         "id": "search",
         "title": "search(query)",
         "detail": "先定位可能相关的事件，再选择一条深入 trace。",
         "edges": [
          {
           "target": "target",
           "label": ""
          }
         ],
         "position": {
          "column": 1,
          "row": 3
         },
         "kind": ""
        },
        {
         "id": "fold",
         "title": "foldSurface",
         "detail": "用完整日志判断目标是 current、shadowed 还是 log-only。",
         "edges": [
          {
           "target": "target",
           "label": "标注状态"
          }
         ],
         "position": {
          "column": 2,
          "row": 1
         },
         "kind": ""
        },
        {
         "id": "target",
         "title": "目标事件",
         "detail": "trace 的中心观察点，所有关系都围绕它展开。",
         "edges": [
          {
           "target": "sources",
           "label": "sourceEventSeqs"
          },
          {
           "target": "derived",
           "label": "derivedEventSeqs"
          },
          {
           "target": "replaced",
           "label": "replacedEventSeqs"
          },
          {
           "target": "replacer",
           "label": "replacedBy"
          }
         ],
         "position": {
          "column": 3,
          "row": 2
         },
         "kind": "state"
        },
        {
         "id": "sources",
         "title": "上游来源事件",
         "detail": "目标事件直接引用了哪些事实。",
         "edges": [],
         "position": {
          "column": 5,
          "row": 1
         },
         "kind": ""
        },
        {
         "id": "derived",
         "title": "下游派生事件",
         "detail": "哪些后续事件把目标 seq 当作来源。",
         "edges": [],
         "position": {
          "column": 5,
          "row": 2
         },
         "kind": ""
        },
        {
         "id": "replaced",
         "title": "被目标替换的范围",
         "detail": "当目标带 replace 时，它遮蔽了哪些旧事件。",
         "edges": [],
         "position": {
          "column": 5,
          "row": 3
         },
         "kind": ""
        },
        {
         "id": "replacer",
         "title": "替换目标的事件链",
         "detail": "从 replacedBy 继续追到最终 replacementChain。",
         "edges": [],
         "position": {
          "column": 3,
          "row": 4
         },
         "kind": "terminal"
        }
       ],
       "variant": "map"
      },
      {
       "type": "markdown",
       "markdown": "### 执行透视：trace #6 如何恢复一条被遮蔽结果的因果位置"
      },
      {
       "type": "trace",
       "id": "l22-runtime-xray",
       "title": "surface 状态与因果边是两个独立索引",
       "panels": [
        "Target #6",
        "Surface 索引",
        "Causal / replacement 关系"
       ],
       "steps": [
        {
         "title": "构建查询快照",
         "location": "`SessionQuery.__init__`",
         "action": "复制事件并计算三态。",
         "states": [
          "`tool/result c1`",
          "`#6=shadowed`",
          "尚未追踪。"
         ]
        },
        {
         "title": "初始化结果",
         "location": "`trace(6)`",
         "action": "创建固定结构 result。",
         "states": [
          "type 与 surface 已填。",
          "只读。",
          "关系字段为空。"
         ]
        },
        {
         "title": "扫来源引用",
         "location": "`source_event_seqs`",
         "action": "查找谁直接引用 #6。",
         "states": [
          "无直接 derived。",
          "不变。",
          "`derived=[]`"
         ]
        },
        {
         "title": "检查自身 replace",
         "location": "`target.surface_op`",
         "action": "#6 是普通 append。",
         "states": [
          "不替换别人。",
          "shadowed。",
          "`replacedEventSeqs=[]`"
         ]
        },
        {
         "title": "查找替换者",
         "location": "`start <= cur <= end`",
         "action": "摘要 #9 覆盖 #6。",
         "states": [
          "原始 result 仍在。",
          "状态得到解释。",
          "`replacedBy=9; chain=[9]`"
         ]
        },
        {
         "title": "返回 trace",
         "location": "`return result`",
         "action": "同时得到事实、可见性与因果位置。",
         "states": [
          "原事件未删除。",
          "shadowed。",
          "可继续 trace #9。"
         ]
        }
       ]
      }
     ]
    },
    {
     "name": "6. 代码拆解",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "- `fold_surface()`：给每条事件算 `current/shadowed/log-only`——和 L05/L15 同一套 surface 概念的读侧复用。\n- `SessionQuery.read()`：按 seq 范围读，附 surface 态。\n- `SessionQuery.search()`：字面量全文搜（忽略大小写），返回命中事件及其 surface 态。\n- `SessionQuery.trace()`：四条关系——`sourceEventSeqs`（引用的来源）、`derivedEventSeqs`（被谁引用）、\n  `replacedEventSeqs`（自己遮蔽了谁）、`replacedBy`+`replacementChain`（被谁一路替换）。\n- `build_session()`：造一段含 chunk→message 引用 + 一次压缩遮蔽的真实日志。\n\n### 动手破坏一次\n\n删除 assistant/message 的 `source_event_seqs=[2,3]`，再 trace #4。文本仍存在，但无法证明它由\n哪些 chunks 合成。这验证：**因果边必须在事实产生时记录，读侧无法可靠猜回来源。**"
      }
     ]
    },
    {
     "name": "7. 代码解读：显式 Trace 如何由两类关系拼成",
     "blocks": [
      {
       "type": "code-walkthrough",
       "id": "l22-code-reading",
       "title": "surface 折叠、反向引用与替换链",
       "source": "main.py",
       "language": "python",
       "segments": [
        {
         "title": "append 校验关系所属事件",
         "start": 48,
         "end": 64,
         "reading": "只有 surface event 可带 surface_op/source_event_seqs，其他类型携带即 assert。",
         "reason": "因果元数据与 surface 语义绑定在写入边界，避免记账事件伪装成模型内容来源。",
         "code": "class Session:\n    def __init__(self):\n        self._events: list[SessionEvent] = []\n\n    def append(self, type, data, surface_op=None, source_event_seqs=()) -> SessionEvent:\n        if type in SURFACE_TYPES:\n            if surface_op is None:\n                surface_op = {\"op\": \"append\"}\n        else:\n            assert surface_op is None and not source_event_seqs, \\\n                f\"非 surface 事件 {type} 不应带 surfaceOp/sourceEventSeqs\"\n        ev = SessionEvent(len(self._events), type, data, surface_op, tuple(source_event_seqs))\n        self._events.append(ev)\n        return ev\n\n    def events(self):\n        return list(self._events)"
        },
        {
         "title": "fold_surface 独立算可见性",
         "start": 70,
         "end": 86,
         "reading": "第一遍收集 replace 范围，第二遍标 current、shadowed 或 log-only。",
         "reason": "当前是否可见是投影关系，不等于事件是否存在，也不等于因果引用。",
         "code": "def fold_surface(events: list[SessionEvent]) -> dict[int, str]:\n    \"\"\"返回 {seq: 'current'|'shadowed'|'log-only'}。\"\"\"\n    shadowed: set[int] = set()\n    for ev in events:\n        op = ev.surface_op\n        if op and op[\"op\"] == \"replace\":\n            shadowed.update(range(op[\"start\"], op[\"end\"] + 1))\n\n    state: dict[int, str] = {}\n    for ev in events:\n        if ev.type not in SURFACE_TYPES:\n            state[ev.seq] = \"log-only\"\n        elif ev.seq in shadowed:\n            state[ev.seq] = \"shadowed\"\n        else:\n            state[ev.seq] = \"current\"\n    return state"
        },
        {
         "title": "read/search 复用同一索引",
         "start": 92,
         "end": 107,
         "reading": "Query 冻结事件快照；范围读取与搜索都附预计算状态。",
         "reason": "不同读 API 对同一事件必须报告一致可见性，集中索引防止规则漂移。",
         "code": "class SessionQuery:\n    def __init__(self, session: Session):\n        self._events = session.events()\n        self._surface = fold_surface(self._events)\n\n    # ---- read：按 seq 范围读，附 surface 状态 ----\n    def read(self, start: int = 0, end: int | None = None) -> list[dict]:\n        end = len(self._events) - 1 if end is None else end\n        return [{\"seq\": ev.seq, \"type\": ev.type, \"surface\": self._surface[ev.seq]}\n                for ev in self._events if start <= ev.seq <= end]\n\n    # ---- search：全文关键词（字面量，忽略大小写）----\n    def search(self, query: str) -> list[dict]:\n        pat = re.compile(re.escape(query), re.IGNORECASE)\n        return [{\"seq\": ev.seq, \"type\": ev.type, \"surface\": self._surface[ev.seq]}\n                for ev in self._events if pat.search(str(ev.data))]"
        },
        {
         "title": "trace 构造正向与反向边",
         "start": 110,
         "end": 132,
         "reading": "target 自带 sources；扫描全部事件得到 derived；replace target 还展开范围。",
         "reason": "日志保存正向引用，反向引用可确定性派生，不维护第二份易失同步的图。",
         "code": "    def trace(self, seq: int) -> dict:\n        target = self._events[seq]\n        result: dict[str, Any] = {\n            \"target\": {\"seq\": seq, \"type\": target.type, \"surface\": self._surface[seq]},\n            \"sourceEventSeqs\": list(target.source_event_seqs),  # 目标直接引用的来源（顶层字段）\n            \"derivedEventSeqs\": [],      # 直接引用目标为来源的后续事件\n            \"replacedBy\": None,          # 目标被哪条事件位置替换\n            \"replacementChain\": [],      # 从直接替换者到最终替换者\n            \"replacedEventSeqs\": [],     # 目标自己替换掉了哪些事件\n        }\n\n        # 谁引用目标为来源（读顶层 source_event_seqs）\n        for ev in self._events:\n            if seq in ev.source_event_seqs:\n                result[\"derivedEventSeqs\"].append(ev.seq)\n\n        # 目标若是替换者：它遮蔽了哪些 seq\n        op = target.surface_op\n        if op and op[\"op\"] == \"replace\":\n            result[\"replacedEventSeqs\"] = list(range(op[\"start\"], op[\"end\"] + 1))\n\n        # 目标是否被替换：追替换链\n        chain = []"
        },
        {
         "title": "replacementChain 逐级追踪",
         "start": 134,
         "end": 149,
         "reading": "从 target 寻找覆盖当前节点的 replace，再把 replacer 作为新 cur。",
         "reason": "摘要可能再次被摘要；只返回直接 replacer 会丢失最终 surface 来源。",
         "code": "        while True:\n            replacer = None\n            for ev in self._events:\n                o = ev.surface_op\n                if o and o[\"op\"] == \"replace\" and o[\"start\"] <= cur <= o[\"end\"] and ev.seq != cur:\n                    replacer = ev.seq\n                    break\n            if replacer is None:\n                break\n            chain.append(replacer)\n            cur = replacer\n        if chain:\n            result[\"replacedBy\"] = chain[0]\n            result[\"replacementChain\"] = chain\n\n        return result"
        },
        {
         "title": "build_session 写入因果证据",
         "start": 152,
         "end": 170,
         "reading": "message 引用 chunks，摘要 replace 1…7。",
         "reason": "Trace 不是读侧魔法，它依赖写侧保存 lossless 事实与关系。",
         "code": "def build_session() -> Session:\n    \"\"\"造一段真实会话：含 chunk→message 引用，以及一次压缩遮蔽。\"\"\"\n    s = Session()\n    s.append(\"turn/start\", {\"turn\": 0})                                   # 0 log-only\n    s.append(\"user/message\", {\"content\": \"帮我修复失败的测试\"})              # 1 append，会被遮蔽\n    s.append(\"assistant/chunk\", {\"text\": \"我\"})                            # 2 log-only\n    s.append(\"assistant/chunk\", {\"text\": \"先看看\"})                         # 3 log-only\n    # assistant/message 顶层 source_event_seqs 引用它的 chunk 2,3\n    s.append(\"assistant/message\", {\"text\": \"我先看看\"}, source_event_seqs=[2, 3])  # 4\n    s.append(\"tool/call\", {\"callId\": \"c1\", \"name\": \"shell\"})               # 5 log-only\n    s.append(\"tool/result\", {\"callId\": \"c1\", \"result\": \"3 tests failed\"})  # 6 append，会被遮蔽\n    s.append(\"assistant/message\", {\"text\": \"找到 3 个失败的测试。\"})          # 7 append，会被遮蔽\n    # ---- 一次压缩：把 seq 1..7 里的 surface 事件摘要遮蔽 ----\n    s.append(\"compaction/start\", {\"turn\": 0})                             # 8 log-only\n    s.append(\"user/message\", {\"content\": \"（摘要：用户要求修测试，已定位 3 个失败）\", \"source\": \"compaction\"},\n             surface_op={\"op\": \"replace\", \"start\": 1, \"end\": 7})           # 9 摘要（替换者）\n    s.append(\"compaction/end\", {\"turn\": 0})                               # 10 log-only\n    s.append(\"user/message\", {\"content\": \"继续修\"})                         # 11 append，current\n    return s"
        }
       ]
      }
     ]
    },
    {
     "name": "8. 相对上一课新增了什么",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "前面所有课都是\"写日志 + 投影给模型\"。本课补上**读侧对称面**：一个迷你 `sessionQuery`，\n能 read / search / trace，并显式标注 surface 三态、追出事件间的引用与替换因果链。\n它是 L04（真源）+ L05（投影规则）+ L15（shadow）三条线的读侧收束。"
      }
     ]
    },
    {
     "name": "9. 简化了什么 vs 真实 DeepSeek Harness",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| 内存扫全表搜索 | `ctx.sessionQuery` seam + SQLite provider 全文索引 | 海量历史要快速全文检索 |\n| 单个会话 | 逻辑会话语料库，跨会话、live 优先于 persisted | fork/resume 后要跨会话追溯 |\n| 三态直接算 | `foldSurface()` 与 `deriveMessages` 同一状态机，原子观测快照 | 读一致性：trace 与模型看到的必须一致 |\n| trace 直接返回 seq | `SessionEventTrace` 完整字段 + `SessionEventTraceObservation` 绑定 header | 追溯要绑定确切的会话观测版本 |\n| 无授权 | trace/search 有授权校验、封闭错误 code 分类 | 一个 agent 不能随意查别人的会话 |\n| 无面向模型工具 | 5 个工具：`session_event_read/search/trace`、`session_search`、`session_trace` | agent 能主动回查自己和历史会话 |\n\n> **对照点**：真实 dsh 里 subagent 之间不自动共享 transcript（L16），正是靠 `sessionQuery`\n> 显式追溯——父 agent 想看子会话发生了什么，用 trace 工具查，而非把子会话塞进上下文。\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `SessionQuery` | `ctx.sessionQuery`（`session-query/session-query`） |\n| `fold_surface` | `foldSurface()`（与 `deriveMessages` 共用状态机） |\n| `read` / `search` / `trace` | `session_event_read` / `session_event_search` / `session_event_trace` |\n| surface 三态 | `SessionEventSurface`：`current`/`shadowed`/`log-only` |\n| `trace` 的 chain/source | `SessionEventTrace.replacementChain` / `sourceEventSeqs` / `derivedEventSeqs` |\n\n---\n[← 上一课 L21](../L21_capstone/README.zh.md) · [返回总览](../../README.md) · [附录 X →](../X_persistence/README.zh.md)"
      }
     ]
    }
   ],
   "code": "\"\"\"L22 显式 Trace：把事件日志查出来\n====================================\nMotto：一切皆事件，所以一切皆可显式回溯。\n\n前面 21 课一路在讲\"写\"侧：怎么往日志追加事件（L04）、怎么投影给模型看（L05）、\n怎么用压缩遮蔽旧范围（L15）。这一课补上**读**侧的对称面——dsh 最受称赞的能力：\n**显式 trace 查看**。\n\n因为一切皆事件、日志是唯一真源，所以任意一条事件都能被显式回查：\n  - read   ：按 seq 范围读原始事件（附带每条的 surface 状态）。\n  - search ：全文关键词搜历史事件。\n  - trace  ：给定一条事件，追出它的因果关系——\n             · 它引用了哪些来源事件（sourceEventSeqs，如 message 引用了哪些 chunk）\n             · 它被谁位置替换（replacedBy + replacementChain，如被压缩摘要遮蔽）\n             · 哪些后续事件引用它为来源（derivedEventSeqs）\n\n每条事件都标注 surface 三态（和 L05 的投影规则同一套）：\n  current   ：当前模型上下文里\n  shadowed  ：被压缩替换遮蔽（旧范围，仍在日志）\n  log-only  ：记账事件，从不进模型（turn/step、tool/call、compaction/* ...）\n\n★ 与 L15 对齐：surfaceOp 和 sourceEventSeqs 都是 SessionEvent 的**顶层字段**\n  （与 data 平级），且仅出现在三种 surface event（user/assistant/tool）上。\n\n运行：  python lessons/L22_session_trace/main.py\n\"\"\"\n\nfrom __future__ import annotations\n\nimport re\nfrom dataclasses import dataclass, field\nfrom typing import Any\n\n# 只有这三种是 surface event，可携带 surfaceOp / sourceEventSeqs\nSURFACE_TYPES = {\"user/message\", \"assistant/message\", \"tool/result\"}\n\n\n@dataclass(frozen=True)\nclass SessionEvent:\n    seq: int\n    type: str\n    data: dict[str, Any]\n    # ★ 顶层字段，仅 surface 事件携带\n    surface_op: dict | None = None\n    source_event_seqs: tuple[int, ...] = ()\n\n\nclass Session:\n    def __init__(self):\n        self._events: list[SessionEvent] = []\n\n    def append(self, type, data, surface_op=None, source_event_seqs=()) -> SessionEvent:\n        if type in SURFACE_TYPES:\n            if surface_op is None:\n                surface_op = {\"op\": \"append\"}\n        else:\n            assert surface_op is None and not source_event_seqs, \\\n                f\"非 surface 事件 {type} 不应带 surfaceOp/sourceEventSeqs\"\n        ev = SessionEvent(len(self._events), type, data, surface_op, tuple(source_event_seqs))\n        self._events.append(ev)\n        return ev\n\n    def events(self):\n        return list(self._events)\n\n\n# ==========================================================================\n# foldSurface：给每条事件算出 surface 三态（和 L05/L15 同一套概念）\n# ==========================================================================\ndef fold_surface(events: list[SessionEvent]) -> dict[int, str]:\n    \"\"\"返回 {seq: 'current'|'shadowed'|'log-only'}。\"\"\"\n    shadowed: set[int] = set()\n    for ev in events:\n        op = ev.surface_op\n        if op and op[\"op\"] == \"replace\":\n            shadowed.update(range(op[\"start\"], op[\"end\"] + 1))\n\n    state: dict[int, str] = {}\n    for ev in events:\n        if ev.type not in SURFACE_TYPES:\n            state[ev.seq] = \"log-only\"\n        elif ev.seq in shadowed:\n            state[ev.seq] = \"shadowed\"\n        else:\n            state[ev.seq] = \"current\"\n    return state\n\n\n# ==========================================================================\n# 迷你 sessionQuery：read / search / trace\n# ==========================================================================\nclass SessionQuery:\n    def __init__(self, session: Session):\n        self._events = session.events()\n        self._surface = fold_surface(self._events)\n\n    # ---- read：按 seq 范围读，附 surface 状态 ----\n    def read(self, start: int = 0, end: int | None = None) -> list[dict]:\n        end = len(self._events) - 1 if end is None else end\n        return [{\"seq\": ev.seq, \"type\": ev.type, \"surface\": self._surface[ev.seq]}\n                for ev in self._events if start <= ev.seq <= end]\n\n    # ---- search：全文关键词（字面量，忽略大小写）----\n    def search(self, query: str) -> list[dict]:\n        pat = re.compile(re.escape(query), re.IGNORECASE)\n        return [{\"seq\": ev.seq, \"type\": ev.type, \"surface\": self._surface[ev.seq]}\n                for ev in self._events if pat.search(str(ev.data))]\n\n    # ---- trace：追一条事件的因果关系 ----\n    def trace(self, seq: int) -> dict:\n        target = self._events[seq]\n        result: dict[str, Any] = {\n            \"target\": {\"seq\": seq, \"type\": target.type, \"surface\": self._surface[seq]},\n            \"sourceEventSeqs\": list(target.source_event_seqs),  # 目标直接引用的来源（顶层字段）\n            \"derivedEventSeqs\": [],      # 直接引用目标为来源的后续事件\n            \"replacedBy\": None,          # 目标被哪条事件位置替换\n            \"replacementChain\": [],      # 从直接替换者到最终替换者\n            \"replacedEventSeqs\": [],     # 目标自己替换掉了哪些事件\n        }\n\n        # 谁引用目标为来源（读顶层 source_event_seqs）\n        for ev in self._events:\n            if seq in ev.source_event_seqs:\n                result[\"derivedEventSeqs\"].append(ev.seq)\n\n        # 目标若是替换者：它遮蔽了哪些 seq\n        op = target.surface_op\n        if op and op[\"op\"] == \"replace\":\n            result[\"replacedEventSeqs\"] = list(range(op[\"start\"], op[\"end\"] + 1))\n\n        # 目标是否被替换：追替换链\n        chain = []\n        cur = seq\n        while True:\n            replacer = None\n            for ev in self._events:\n                o = ev.surface_op\n                if o and o[\"op\"] == \"replace\" and o[\"start\"] <= cur <= o[\"end\"] and ev.seq != cur:\n                    replacer = ev.seq\n                    break\n            if replacer is None:\n                break\n            chain.append(replacer)\n            cur = replacer\n        if chain:\n            result[\"replacedBy\"] = chain[0]\n            result[\"replacementChain\"] = chain\n\n        return result\n\n\ndef build_session() -> Session:\n    \"\"\"造一段真实会话：含 chunk→message 引用，以及一次压缩遮蔽。\"\"\"\n    s = Session()\n    s.append(\"turn/start\", {\"turn\": 0})                                   # 0 log-only\n    s.append(\"user/message\", {\"content\": \"帮我修复失败的测试\"})              # 1 append，会被遮蔽\n    s.append(\"assistant/chunk\", {\"text\": \"我\"})                            # 2 log-only\n    s.append(\"assistant/chunk\", {\"text\": \"先看看\"})                         # 3 log-only\n    # assistant/message 顶层 source_event_seqs 引用它的 chunk 2,3\n    s.append(\"assistant/message\", {\"text\": \"我先看看\"}, source_event_seqs=[2, 3])  # 4\n    s.append(\"tool/call\", {\"callId\": \"c1\", \"name\": \"shell\"})               # 5 log-only\n    s.append(\"tool/result\", {\"callId\": \"c1\", \"result\": \"3 tests failed\"})  # 6 append，会被遮蔽\n    s.append(\"assistant/message\", {\"text\": \"找到 3 个失败的测试。\"})          # 7 append，会被遮蔽\n    # ---- 一次压缩：把 seq 1..7 里的 surface 事件摘要遮蔽 ----\n    s.append(\"compaction/start\", {\"turn\": 0})                             # 8 log-only\n    s.append(\"user/message\", {\"content\": \"（摘要：用户要求修测试，已定位 3 个失败）\", \"source\": \"compaction\"},\n             surface_op={\"op\": \"replace\", \"start\": 1, \"end\": 7})           # 9 摘要（替换者）\n    s.append(\"compaction/end\", {\"turn\": 0})                               # 10 log-only\n    s.append(\"user/message\", {\"content\": \"继续修\"})                         # 11 append，current\n    return s\n\n\nif __name__ == \"__main__\":\n    s = build_session()\n    q = SessionQuery(s)\n\n    print(\"===== read：读全部事件 + surface 三态 =====\")\n    for r in q.read():\n        mark = {\"current\": \"●在模型上下文\", \"shadowed\": \"○被压缩遮蔽\", \"log-only\": \"·记账事件\"}[r[\"surface\"]]\n        print(f\"  #{r['seq']:<2} {r['type']:<20} [{r['surface']:<9}] {mark}\")\n\n    print(\"\\n===== search：搜 '失败' =====\")\n    for r in q.search(\"失败\"):\n        print(f\"  命中 #{r['seq']} {r['type']} [{r['surface']}]\")\n\n    print(\"\\n===== trace #4（一条 assistant/message）：它引用了哪些 chunk，被谁引用 =====\")\n    t4 = q.trace(4)\n    print(f\"  目标: {t4['target']}\")\n    print(f\"  引用的来源事件 (sourceEventSeqs): {t4['sourceEventSeqs']}  ← 就是那两条 chunk（顶层字段）\")\n\n    print(\"\\n===== trace #6（一条被压缩遮蔽的 tool/result）：谁替换了它 =====\")\n    t6 = q.trace(6)\n    print(f\"  目标: {t6['target']}\")\n    print(f\"  被替换 (replacedBy): {t6['replacedBy']}  ← 摘要事件 #9\")\n    print(f\"  替换链 (replacementChain): {t6['replacementChain']}\")\n\n    print(\"\\n===== trace #9（那条压缩摘要）：它遮蔽了哪些事件 =====\")\n    t9 = q.trace(9)\n    print(f\"  目标: {t9['target']}\")\n    print(f\"  它替换掉的事件 (replacedEventSeqs): {t9['replacedEventSeqs']}  ← 旧的 1..7\")\n    print(\"\\n  → 关键：被遮蔽的事件一条没删，trace 随时能把因果链显式追出来。\")\n",
   "locPct": 93
  },
  {
   "id": "X",
   "dir": "X_persistence",
   "num": "X",
   "title": "持久化 / flush / 崩溃恢复",
   "fullTitle": "附录 X：持久化 / flush / 崩溃恢复",
   "subtitle": "flush / 崩溃恢复（仅讲义）",
   "motto": "",
   "layer": "product",
   "loc": 0,
   "hasCode": false,
   "sections": [
    {
     "name": "为什么主线里没有它",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "L04 确立了\"仅追加事件日志是唯一真源\"。持久化回答的是一个**正交问题**：\n这份日志**如何落盘、何时落盘、崩溃后如何恢复**。把它塞进主线会分散对\"事件溯源\"\n本身的注意力，所以我们把它单独拎出来。\n\n好消息是：正因为 L04 把\"真源\"设计成一份仅追加日志，持久化才变得简单——\n**只要把这份日志逐字节存下来，恢复时重新加载 + `deriveMessages`（L05）即可。**\n持久化不需要理解业务语义，它只搬运事件。"
      }
     ]
    },
    {
     "name": "三个核心问题",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "**① 存什么**\n\n存那份仅追加的 `SessionEvent` 日志本身，逐字节、无损。因为每条事件都是 lossless JSON、\n`seq` 连续，所以可以直接序列化成 JSONL（一行一个事件），无需额外结构。\n\n```text\nsession-abc.jsonl\n  {\"seq\":0,\"type\":\"turn/start\",\"data\":{\"turn\":0}}\n  {\"seq\":1,\"type\":\"user/message\",\"data\":{\"content\":\"...\"}}\n  {\"seq\":2,\"type\":\"assistant/message\",\"data\":{...}}\n  ...\n```\n\n**② 何时 flush**\n\n不是每条事件都立刻落盘（太慢），也不能攒太久（崩溃丢太多）。真实 dsh 由\n`dsh-session-checkpoint-policy` 拥有\"每请求的持久化检查点\"——在合适的边界\n（如一次模型请求完成）把新事件刷盘。agent loop **不**在 turn 边界等待 flush；\n需要读存储的消费方在 `whenIdle()` 后自己 flush。\n\n**③ 崩溃后如何恢复**\n\n重新加载 JSONL → 得到事件列表 → `deriveMessages`（L05）投影出模型历史 → 继续。\n因为日志是唯一真源且仅追加，恢复不需要\"重放业务逻辑\"，只需重新加载事件。"
      },
      {
       "type": "stepper",
       "id": "crash-recovery",
       "title": "崩溃恢复只需重建日志视图",
       "steps": [
        {
         "title": "进程崩溃",
         "detail": "内存状态消失，但已经 flush 的 JSONL 仍在。"
        },
        {
         "title": "重新启动",
         "detail": "打开对应 session 文件。"
        },
        {
         "title": "校验并加载",
         "detail": "检查 seq 连续性，确保事件日志没有缺页。"
        },
        {
         "title": "重新投影",
         "detail": "用 deriveMessages 从事件列表重建模型历史。"
        },
        {
         "title": "继续对话",
         "detail": "不重放业务副作用，直接从恢复后的上下文继续。"
        }
       ]
      }
     ]
    },
    {
     "name": "与主线各课的关系",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "| 主线机制 | 持久化如何依赖它 |\n|---|---|\n| L04 仅追加日志 | 持久化只需搬运这份日志；仅追加保证可逐字节存储 |\n| L05 deriveMessages | 恢复时用它从加载的事件重建模型历史 |\n| L15 compaction | 压缩是\"追加 replace 事件\"，持久化照样存；恢复后 shadow 仍生效 |\n| L02 可逆注册 | 持久化后端是一个 provider，可换（本地 JSONL / 数据库 / 远程） |"
      }
     ]
    },
    {
     "name": "简化了什么 vs 真实 DeepSeek Harness",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "| 概念对照 | 真实 dsh | 为什么需要 |\n|---|---|---|\n| 逐字节存日志 | 持久化 seam + 多后端（JSONL / 其他） | 后端可换，测试用内存、生产用磁盘 |\n| 每请求 checkpoint | `dsh-session-checkpoint-policy` | 平衡\"落盘频率\"与\"崩溃丢失量\" |\n| seq 连续性 | 运行时不变式断言 + `session/end-seed` 标记 | 区分 seed 历史（resume/fork）与本次 live 事件 |\n| 简单重载 | fork / resume 从存储重建，冷恢复子 agent | 会话可分叉、可跨会话恢复 |"
      }
     ]
    },
    {
     "name": "想深入？",
     "blocks": [
      {
       "type": "markdown",
       "markdown": "阅读官方文档（以源码为准）：\n\n- `deepseek-harness/docs/subsystems/persistence.md` — 持久化 seam 与后端\n- `deepseek-harness/docs/subsystems/session.md` — 日志与 `firstLiveSeq`/`session/end-seed`\n- `deepseek-harness/docs/subsystems/storage.md` — 存储抽象\n\n---\n[← 上一课 L21](../L21_capstone/README.zh.md) · [返回总览](../../README.md)"
      }
     ]
    }
   ],
   "code": "",
   "locPct": 0
  }
 ],
 "readme": "# learn-dsh：拆解 DeepSeek Harness\n\n> 仿照 [learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) 的渐进式教学风格，\n> 但**主线来自 DeepSeek Harness 自己的架构分层**，而不是照搬。\n\n> 温馨提醒，由于当前dsh暂时是 v0.1 开发者预览版，很多设计不一定完善，但我这个教程会持续跟随dsh的更新而更新的，其次是对于怎么讲清楚我自己也还在探索，其实可以不着急看，等待孵化\n\n## 这门课教什么\n\nDeepSeek Harness（下称 **dsh**）的世界观和\"一个 while 循环里不断加东西\"截然不同。\n它的骨架只有几条：\n\n- **一切皆插件（Cordis）**：没有可打补丁的\"特权核心\"。模型适配器、工具注册表、\n  会话日志、甚至 agent loop 本身都是插件，向共享的 `ctx` 贡献服务、类型化事件和可回退副作用。\n- **仅追加的 SessionEvent 日志是唯一真源**：模型看到的历史不是单独存的，\n  而是用 `deriveMessages()` 从事件日志**投影**出来的。\"模型可见即已记录\"。\n- **Turn / Step 轮次**：`step` = 一次模型请求 + 它触发的工具调用；`turn` = 零或多个 step。\n- **能力 seam**：一个可替换能力 = interface + implementation + consumer 三角色。\n  换一个 provider 就能整体换掉产品的一块能力。\n- **可选能力挂在 seam 上，不进 loop 主干**：subagent、compaction、skills、jobs、goal\n  都是可选能力，各自是独立机制，不属于 agent loop 核心。\n\n**和 learn-claude-code 最本质的区别**：原版是\"循环不变、能力层层叠加\"；\ndsh 是\"**内核极薄、一切经由插件树 + 事件 + seam 组合**\"。\n所以本课主线不是\"往循环里塞功能\"，而是\"**先立起 Cordis 插件/事件/seam 这套骨架，\n再逐层把每个能力作为插件挂上去**\"。\n\n## 课程地图（七主题 · 一条主线）\n\n编号 L01–L22 是**一条连续的阅读主线**，下面七个主题只是给这条主线分段贴标签。\n个别课（如 L22）编号靠后但概念归属较早的主题，已在括号里标注——按编号顺序读即可。\n\n```text\n主题 A · 内核骨架\n  ├ L01  最小 Agent Loop\n  ├ L02  Cordis 插件 + 可逆注册\n  └ L03  四种事件分发\n  ▼\n主题 B · 会话即真源\n  ├ L04  仅追加事件日志\n  ├ L05  deriveMessages 投影\n  └ L22  显式 Trace 查看   （扩展课·读侧对称面，依赖 L04/L05/L15）\n  ▼\n主题 C · 轮次与模型边界\n  ├ L06  Turn / Step 生命周期\n  ├ L07  pre-step 拦截\n  └ L08  LLM 适配器与流式\n  ▼\n主题 D · 作用域与工具\n  ├ L09  Scope 与 shadowing\n  ├ L10  工具注册表\n  ├ L11  工具执行管线与策略\n  ├ L12  能力 seam\n  └ L13  System Prompt 装配\n  ▼\n主题 E · 上下文的可持续性\n  ├ L14  Skills 按需加载\n  └ L15  Compaction 压缩\n  ▼\n主题 F · 委派与并发\n  ├ L16  Subagent 上下文隔离\n  ├ L17  Jobs 后台任务\n  ├ L18  持久 Goal 领域\n  └ L19  Goal Round Driver\n  ▼\n主题 G · 组装成产品\n  ├ L20  Profile / Bundle\n  ├ L21  Capstone 合成 mini-dsh\n  └ 附录 X  持久化 / flush / 崩溃恢复   （仅讲义，无代码）\n```\n\n> **关于 L22 的编号**：它排在末尾，但概念上是主题 B（会话即真源）的**读侧对称面**，\n> 依赖 L04 / L05 / L15。可以学完这三课后跳看，或按主线读到最后自然抵达。\n\n## 22 课 motto 一览\n\n| 课 | 主题 | Motto |\n|---|---|---|\n| L01 | 最小 Agent Loop | 一个循环 + 一次模型调用 + 一个工具，就是 agent 的胚胎 |\n| L02 | Cordis 插件 + 可逆注册 | 不改核心，只在旁边挂插件；每个注册都能被回退 |\n| L03 | 四种事件分发 | 能力调用走 `ctx.<service>`，观察/拦截/策略走事件 |\n| L04 | 仅追加事件日志 | 不存消息历史，只存事件；一切皆可回放 |\n| L05 | deriveMessages 投影 | 模型看到的是投影，不是存储；模型可见即已记录 |\n| L06 | Turn/Step 生命周期 | step=一次请求+其工具；turn=零或多个 step，跑完才关 |\n| L07 | pre-step 拦截 | 用 waterfall 在请求前改写或拒绝要进模型的消息 |\n| L08 | LLM 适配器与流式 | 模型本身也是可替换的 provider |\n| L09 | Scope 与 shadowing | 同名最具体者胜；作用域是 per-agent 人格的根 |\n| L10 | 工具注册表 | 加一个工具，只加一个定义，循环不用动 |\n| L11 | 工具执行管线与策略 | pre→guard→execute→post→result，策略挂在管线上而非工具里 |\n| L12 | 能力 seam | 换一个 provider，就换掉产品的一整块能力 |\n| L13 | System Prompt 装配 | 提示词不是一段字符串，是各插件贡献的段落 + 工具 schema |\n| L14 | Skills 按需加载 | 用到什么知识再加载什么 |\n| L15 | Compaction 压缩 | 日志从不删除，只追加一条 replace 事件把旧范围移出 surface |\n| L16 | Subagent 隔离 | 每个子任务一份干净的上下文，只回传结果 |\n| L17 | Jobs 后台任务 | Jobs 管生命周期，控制器负责把完成事实重新交回 Agent |\n| L18 | 持久 Goal 领域 | 给会话挂一个持久目标，它是状态不是调度器 |\n| L19 | Goal Round Driver | 目标未完成就再开一轮，直到完成或阻塞 |\n| L20 | Profile / Bundle | 产品 = 有序层叠的插件树，任意一行都能被 patch 替换 |\n| L21 | Capstone | 所有机制合一，对照真实 harness 看每层如何插在一起 |\n| L22 | 显式 Trace 查看 | 一切皆事件，所以一切皆可显式回溯 |\n\n## 怎么跑\n\n需要 Python 3.10+，**无需 API key、无需联网**：每课内置一个确定性的 Replay LLM。\n\n```powershell\n# 从任意一课开始，每个文件都能独立运行\npython lessons/L01_agent_loop/main.py\npython lessons/L05_derive_messages/main.py\npython lessons/L21_capstone/main.py\npython lessons/L22_session_trace/main.py\n```\n\n## 网页版（推荐阅读方式）\n\n讲义 + 源码另有一个**纯静态**网页版，形式类似 learn.shareai.run：\n左侧按阶段分组导航，右侧课程时间线，点进去可切\"讲义 / 源码\"双标签。\n\n```powershell\npython site/build_site.py          # 改过讲义后重新生成数据\nstart site/index.html              # 双击也行，file:// 就能跑\n```\n\n零依赖、不需要 Node/npm、不需要联网。详见 [site/README.md](site/README.md)。\n\n想接真实模型？需要**显式**开启（默认永远走 Replay，避免测试意外联网）：\n\n```powershell\n$env:DSH_LIVE = \"1\"                                   # 必须显式开启；缺 key 会直接报错\n$env:DEEPSEEK_API_KEY = \"sk-...\"\n$env:DEEPSEEK_BASE_URL = \"https://api.deepseek.com\"   # 可选\n$env:DEEPSEEK_MODEL = \"deepseek-chat\"                 # 可选，默认 deepseek-chat\npip install requests                                   # 真实模型路径依赖\n# 开启后任意\"会调模型\"的课都会走真实 API（缺 key 会直接报错）。\n# 但请注意下面的局限：工具型 agent 课（L01/L21 等）不保证复现工具流程。\npython lessons/L01_agent_loop/main.py\n```\n\n> **真实模型路径是可选彩蛋，定位有限，别期望它端到端跑工具**：\n> - 它只证明\"Replay 与真实 DeepSeek 是同一个 seam 的两个 provider\"，并能做**纯文本**对话。\n> - 本课的工具调用用的是**教学格式**（`{id,name,arguments}`），不是 DeepSeek/OpenAI 的\n>   wire-format；各课也没把工具 schema 传给真实模型。所以像 L01/L21 这类工具型 agent，\n>   真实模型**不保证**复现 Replay 的工具流程。把这条链路做成 API 兼容会引入大量适配复杂度，\n>   偏离\"离线教学\"的初衷，故有意不做。**要完整体验工具型 agent，请用默认的 Replay。**\n> - `DeepSeekLLM.stream()` 是\"先 complete 再切片\"的**模拟流式**，不是真 SSE。\n\n## 课程定位（重要）\n\n本课分两种形态，别用同一把尺子衡量：\n\n- **L01–L13 是\"渐进式主干\"**：概念上后一课在前一课基础上叠一层，主线连续。\n- **L14–L22 是\"能力实验室\"**：每课聚焦一个可选能力（Skills / Compaction / Subagent /\n  Jobs / Goal / Trace 等），为了让单课能独立读懂、独立运行，各自搭建该机制的最小上下文，\n  **不强求与上一课代码逐行 diff**。真实 dsh 里这些能力也是各自独立的 seam/包。\n- **L21 Capstone** 整合的是\"核心主干\"那 8 层（ctx / 事件 / 日志 / 投影 / turn-step /\n  llm seam / 工具管线 / subagent），不是全部 22 层——它是 headless profile 的教学缩影。\n\n## 每课讲义结构\n\n每课 `README.zh.md` 固定九段，**先跑再讲**。每课都在“代码拆解”后提供独立的\n**代码解读**：沿该课自己的执行路径带读 `main.py`，解释控制流、状态变化和设计原因。\n\n1. **Motto** — 一句话主旨\n2. **30 秒运行** — 命令 + 预期输出\n3. **观察输出** — 你刚才看到了什么\n4. **问题** — 为什么需要这一层\n5. **心智模型** — 用一个比喻建立直觉\n6. **方案与图** — 网页端渲染为流程、结构、对照或步骤式教学组件\n7. **代码拆解** — 最小实现的快速索引\n8. **代码解读** — 从真实源码行出发，解释本课设计如何落到控制流和不变量\n9. **相对上一课新增 + 简化了什么 vs 真实 dsh** — 附\"教学类名 → 真实 `ctx` 服务/事件/包\"映射表\n\n“代码拆解”是快速索引；“代码解读”则回答代码如何真正把本课设计跑起来。网站中的源码\n片段直接按行号取自同课 `main.py`，构建时会校验范围，避免讲义与源码复制后漂移。\n\n## 重要免责声明\n\n**本课的教学代码是玩具！！！！！，不是 dsh 的真实实现！！！！！。** dsh 本体用 TypeScript + Cordis 编写；\n本课用 Python 让机制短小易读。每课第 9 段都会明确标出：本课简化了什么、真实工程里\n那一层复杂度为什么必要。**一切以官方文档和源码为准**（见 `deepseek-harness/docs/`）。\n"
};
