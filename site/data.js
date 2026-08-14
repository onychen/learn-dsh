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
     "body": "```powershell\npython lessons/L01_agent_loop/main.py\n```\n\n预期输出（Windows / PowerShell）：\n\n```text\n--- step 1 ---\n[assistant] 我先看看当前目录里有什么。\n[tool_call] shell({'command': 'echo hello from dsh lesson 01'})\n[tool_result] hello\nfrom\ndsh\nlesson\n01\n\n--- step 2 ---\n[assistant] 命令执行完毕，输出是：'hello\\nfrom\\ndsh\\nlesson\\n01'。任务完成。\n\n==============================\n[最终答复] 命令执行完毕，输出是：'hello\\nfrom\\ndsh\\nlesson\\n01'。任务完成。\n```"
    },
    {
     "name": "2. 观察输出",
     "body": "你看到了一个 agent 的完整生命周期：它先**思考**（决定调工具）、**行动**（执行 shell）、\n**观察**（看到工具结果）、再**总结**（给出最终答复）。整个过程跑了两个 step 就停了——\n因为第二次模型不再想调工具。\n\n（顺带：`echo` 的输出被拆成多行，是因为 Windows 上我们走的是 PowerShell。\n这不是 bug，而是\"shell 是平台相关的\"的第一个信号——记住它，L12 会把它变成一个 seam。）"
    },
    {
     "name": "3. 为什么需要这一层",
     "body": "没有循环，模型只能\"说一句话\"就结束。但真实任务需要\"做一步、看结果、再做下一步\"。\n**agent 的本质就是：把模型放进一个循环里，让它能反复调用工具直到任务完成。**\n\n这一层是所有 agent 的地基。你会发现后面 21 课**从不修改这个循环的本质**——\n它们只是往循环旁边挂插件、挂事件、挂 seam。这正是 dsh 和\"不断改 while 循环\"的\n教学项目最大的区别。"
    },
    {
     "name": "4. 心智模型",
     "body": "把 agent 想成一个**反复问答的对话**：\n\n```text\n你：看看当前环境，然后告诉我结果\n     │\n     ▼\n┌─────────────────────────────────────────────┐\n│  while 模型还想调工具:                          │\n│    ① 把历史喂给模型  → 模型返回\"我要调 shell\"     │\n│    ② 执行 shell     → 得到输出                  │\n│    ③ 把输出塞回历史                             │\n│    ④ 再问模型       → 模型说\"够了，这是答复\"       │\n└─────────────────────────────────────────────┘\n     │\n     ▼\n最终答复\n```\n\n`messages` 列表是这一课**唯一的状态**。模型每次都读它、我们每次都往里追加。"
    },
    {
     "name": "5. 方案与图",
     "body": "```text\n  user_input\n      │\n      ▼\n  messages = [user]\n      │\n      ▼\n  ┌──────────┐   turn.wants_tools?\n  │ llm.     │──────── no ──────▶ return turn.text  (最终答复)\n  │ complete │\n  └──────────┘\n      │ yes\n      ▼\n  执行每个 tool_call，把 tool_result 追加进 messages\n      │\n      └───────────── 回到 llm.complete\n```"
    },
    {
     "name": "6. 代码拆解",
     "body": "核心就是 `agent_loop()` 这 15 行：\n\n- `messages` 初始只有一条 user 消息。\n- 每轮调 `llm.complete(messages)` 拿到一个 `AssistantTurn`。\n- 若 `turn.wants_tools` 为假 → 返回文本，循环结束。\n- 否则：把 assistant 消息追加进历史，逐个执行工具，把每个 `tool_result` 也追加进历史，再循环。\n- `call_tool()` 是一个**硬编码的 if 分支**——目前只认 `shell` 一个工具。\n\n`ReplayLLM` 用一段脚本模拟模型：step1 决定调 shell，step2 看到结果后收尾。\n真实模型与 Replay **共用同一个 seam 接口**（说同一套消息词汇）；但要接真实模型需显式\n设 `DSH_LIVE=1`（+ `DEEPSEEK_API_KEY`），且真实路径仅演示纯文本对话——工具调用用的是\n教学格式、也没把 shell schema 传给模型，所以不保证复现这里的工具流程。想完整跑通\n工具型 agent，用默认的 Replay。"
    },
    {
     "name": "7. 相对上一课新增了什么",
     "body": "这是第一课，一切都是新的。建立了三样最小的东西：**循环、模型调用、一个工具**。"
    },
    {
     "name": "8. 简化了什么 vs 真实 DeepSeek Harness",
     "body": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| 裸 `while` 循环，写死在一个函数里 | agent loop 本身是插件 `core/agent-loop`，实现 `ctx.agentLoop` 接口 | 循环可被替换（比如 Ralph 迭代、goal 续跑用不同 driver） |\n| `messages` 列表就是状态 | 唯一真源是**仅追加的 SessionEvent 日志**，`messages` 由 `deriveMessages()` 投影 | 回放、fork、持久化、遥测全都从日志派生（见 L04/L05） |\n| `call_tool` 是 if 分支 | 工具是注册进 `ctx.tools` 的 `ToolDefinition`，经 pre/execute/post 管线分派 | 权限、超时、沙箱、并发都挂在管线上（见 L10/L11） |\n| 直接 `llm.complete(messages)` | 模型是 `ctx.llm` seam 背后的 provider | 可换 DeepSeek / Pi-AI / Replay，测试与生产同一接口（见 L08） |\n| `shell` 直接 subprocess | shell 是 `ctx.shell` seam，本地/沙箱是不同 provider | 换 provider 就能把命令送去远程沙箱（见 L12） |\n\n> **一句话**：这一课的每一个\"简化点\"，都对应后面某一课要展开的一层。\n> 记住这个循环的样子——它是你理解整套 dsh 的锚点。\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `agent_loop()` | `ctx.agentLoop`（`core/agent-loop`） |\n| `messages` | `Session` 事件日志 + `deriveMessages()`（`core/session`） |\n| `llm.complete()` | `ctx.llm.stream()`（`llm/llm` seam） |\n| `call_tool()` | `ctx.tools` 注册表 + 执行管线（`core/tools`） |\n| `run_shell()` | `ctx.shell` provider（`packages/shell`） |\n\n---\n[返回总览](../../README.md) · [下一课 L02 →](../L02_cordis_plugins/README.zh.md)"
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
     "body": "```powershell\npython lessons/L02_cordis_plugins/main.py\n```\n\n预期输出（节选）：\n\n```text\n[boot] 挂载插件 llm\n  [ctx] 提供服务 ctx.llm\n[boot] 挂载插件 shell\n  [ctx] 提供服务 ctx.shell\n[boot] 挂载插件 tools\n  [ctx] 提供服务 ctx.tools\n  [tools] 注册工具 shell\n[boot] 挂载插件 agent-loop\n  [ctx] 提供服务 ctx.agent_loop\n\n[boot] 插件树就绪，运行 agent\n...\n[boot] 卸载所有插件（逆序）\n  [ctx] 卸载服务 ctx.agent_loop\n  [tools] 注销工具 shell\n  [ctx] 卸载服务 ctx.tools\n  [ctx] 卸载服务 ctx.shell\n  [ctx] 卸载服务 ctx.llm\n```"
    },
    {
     "name": "2. 观察输出",
     "body": "agent 干的活和 L01 一模一样。但**启动方式变了**：不再是调一个函数，\n而是往 `ctx` 上依次挂 4 个插件，每个插件认领一个服务。结尾还演示了\n**逆序卸载**——每个注册都被干净回退了。"
    },
    {
     "name": "3. 为什么需要这一层",
     "body": "L01 的循环把 llm、tools、shell 全焊死在一起。想换模型？改函数。想加权限？改函数。\n**一切改动都得动核心。**\n\ndsh 的答案是：**没有核心可动。** 每一块都是插件，向共享 `ctx` 贡献服务；\n要扩展，就在旁边挂一个新插件。而且每个注册都是**可逆副作用**——\n插件卸载时，它装的东西（服务、工具、监听器）都能预测地回退。"
    },
    {
     "name": "4. 心智模型",
     "body": "把 `ctx` 想成一块**公告板 + 一个仓库**：\n\n```text\n        ┌──────────────── ctx（服务仓库）────────────────┐\n        │  ctx.llm    ctx.shell   ctx.tools   ctx.agent_loop │\n        └───▲──────────▲───────────▲──────────────▲─────────┘\n            │          │           │              │\n        llm插件     shell插件    tools插件      agent-loop插件\n                                 (inject shell)  (inject llm,tools)\n```\n\n插件不互相 import，而是**按 key 找服务**。谁依赖谁，用 `inject` 声明，\n`ctx` 保证依赖就绪后才 `apply`。"
    },
    {
     "name": "5. 方案与图",
     "body": "```text\nctx.plugin(P)  ──▶ 检查 P.inject 里的服务都在？\n                     │ 否 → 报错（依赖未就绪）\n                     │ 是\n                     ▼\n                   P.apply(ctx)  ──▶ ctx.provide(key, svc)  → 返回 disposer\n                                      ctx.effect(setup)      → 登记 disposer\n                                            │\nctx.unload_all() ──▶ 逆序调用所有 disposer（干净回退）\n```"
    },
    {
     "name": "6. 代码拆解",
     "body": "- `Context.provide(key, svc)`：认领一个 `ctx.<key>`，返回 disposer。这是\"可逆注册\"的最小形态。\n- `Context.effect(setup)`：执行 setup、登记它返回的 disposer。对应真实 `ctx.effect()`。\n- `Context.plugin(plug)`：挂载前检查 `inject` 依赖是否就绪，再 `apply`。\n- `Context.unload_all()`：**逆序**调用所有 disposer——保证 teardown 顺序正确。\n\n4 个插件把 L01 拆开：`llm_plugin`、`shell_plugin`、`tools_plugin`（`inject=[\"shell\"]`）、\n`agent_loop_plugin`（`inject=[\"llm\",\"tools\"]`）。循环逻辑没变，只是改成通过 `ctx` 找服务。"
    },
    {
     "name": "7. 相对上一课新增了什么",
     "body": "L01 的三块（循环/工具/模型）从\"写死在一个函数\"变成了\"**四个向 ctx 贡献服务的插件**\"。\n新增了三个 Cordis 核心概念：**服务（`ctx.<key>`）、依赖声明（`inject`）、可逆注册（`effect`/disposer）**。"
    },
    {
     "name": "8. 简化了什么 vs 真实 DeepSeek Harness",
     "body": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| 手写 40 行 `Context` | 完整的 Cordis 框架（vendored） | 类型化服务、生命周期、reload、隔离 realm 都要框架支撑 |\n| `provide` + 属性访问 | `Service` 子类 / 带 `inject` 的函数插件，Cordis 挂载其生命周期 | 服务有 start/stop、依赖图、热重载 |\n| `inject` 只查存在性 | `inject` 驱动加载顺序，服务未就绪则插件挂起等待 | 大插件树的启动顺序由依赖表达，而非手工排序 |\n| `effect` 就是登记 disposer | `ctx.effect()` + Cordis helper，按 scope 生命周期自动回退 | 卸载/reload 要精确 unwind 大量注册 |\n| 事件？本课还没有 | 插件间还靠**类型化事件**通信（emit/waterfall/parallel/serial） | 观察、拦截、策略组合都走事件（见 L03） |\n\n> **关键澄清**（两位审查者都强调）：插件间**不是**\"只能通过事件通信\"。正确原则是——\n> **直接能力调用走 `ctx.<service>`，观察/拦截/策略组合才走事件**。本课演示的是前者（服务调用），\n> L03 演示后者（事件）。\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `Context` | Cordis `Context`（`vendor/cordis`） |\n| `ctx.provide(key, svc)` | 服务认领 `ctx.<key>` |\n| `Plugin.inject` | 插件 `inject` 字段 |\n| `ctx.effect(setup)` | `ctx.effect()` 可逆副作用 |\n| `unload_all()` 逆序回退 | 插件卸载/reload 的 disposer unwind |\n\n---\n[← 上一课 L01](../L01_agent_loop/README.zh.md) · [返回总览](../../README.md) · [下一课 L03 →](../L03_event_dispatch/README.zh.md)"
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
     "body": "```powershell\npython lessons/L03_event_dispatch/main.py\n```\n\n预期输出（节选）：\n\n```text\n=== emit（观察，无返回）===\n  [日志] 工具被调用: shell\n  [遥测] 计数 +1: shell\n\n=== waterfall（环绕中间件，next() 委派）===\n-- 危险请求 --\n  [A] 看到请求: {'command': 'rm -rf /'}，加个标记后委派\n  [B] 危险命令，短路拒绝（不调 next）\n  结果: {'denied': True}\n\n=== parallel（并行 await，无返回）===\n  [并发] 工具 B 完成（更快先完成）\n  [并发] 工具 A 完成\n\n=== serial（按序 await，第一个 bail 值胜出并停止）===\n  [预算检查] 预算充足，不干预（返回 None，不 bail）\n  [目标检查] 目标未完成 → bail，要求继续（后续监听者不再执行）\n  第一个 bail 值（胜出）: {'action': 'continue', 'reason': 'goal-not-done'}\n```"
    },
    {
     "name": "2. 观察输出",
     "body": "四段演示对应四种分发模式。注意三个关键现象：\n**waterfall 里 B 不调 `next()` 就短路了**（C 根本没执行）；\n**parallel 里 B 比 A 先完成**（真并发，谁快谁先）；\n**serial 里 check_goal 一 bail，第三个监听者 `never_runs` 就再也没机会执行**\n（第一个非空返回值胜出并停止，这是 serial 的真实语义，不是 reducer）。"
    },
    {
     "name": "3. 为什么需要这一层",
     "body": "L02 解决了\"插件怎么直接用别人的能力\"（调 `ctx.<service>`）。但还有一类需求：\n我想**观察**工具调用、**拦截**并改写请求、**组合**多个策略——而且不想让被观察方\n知道我的存在。如果都用直接调用，就得让每个工具去 import 每个策略，耦合爆炸。\n\n**事件是解耦的拦截点。** 而\"选哪种分发模式\"是设计一个事件时的**第一决策**，\n因为它决定了监听者是\"只看\"、\"能改\"、\"并发跑\"还是\"投票\"。"
    },
    {
     "name": "4. 心智模型",
     "body": "四种模式，四种社交场合：\n\n```text\nemit      →  广播通知：我喊一声，谁想听谁听，我不等回复\nwaterfall →  流水线审批：文件一个个传下去，每人可改可盖章可打回\nparallel  →  同时开工：一声令下大家一起干，干完各自散\nserial    →  依次表决直到有人拍板：一个个过，谁先给出非空结论（bail）谁说了算，后面的人不再表决\n```"
    },
    {
     "name": "5. 方案与图",
     "body": "waterfall 是四者里最重要、也最烧脑的一个。它是**环绕中间件（around middleware）**：\n\n```text\nwaterfall(\"agent/pre-step\", req)\n\n  A(req, next) ──调 next(改写后的req)──▶ B(req, next) ──调 next──▶ C(req, next) ──▶ 链尾返回值\n     │                                    │\n     │                                    └─ 不调 next() → 短路，直接返回 B 的结果\n     └─ 值通过 next() 的返回值一层层传回来\n```\n\n- **调 `next()`**：把（可能改写过的）值委派给下一个监听者。\n- **不调 `next()`**：短路——我拥有这个决定，下游不再参与。\n- 权限、压缩触发、请求构造都靠它。真实的 `agent/pre-step`、`agent/request`、\n  `llm/stream`、`tools/*` 三件套全是 waterfall。"
    },
    {
     "name": "6. 代码拆解",
     "body": "- `emit`：一个 for 循环挨个调，无返回。\n- `waterfall`：`dispatch(index, v)` 递归——给监听者传 `(v, next_)`，\n  `next_` 会带着（可能被替换的）值走到 `index+1`。链尾返回当前值。\n- `parallel`：`asyncio.gather` 并发所有监听者。\n- `serial`：for 循环挨个 `await`，谁先返回非 `None`/`False` 的值就 **bail**——立即返回该值并停止后续监听者（不是把 value 一路 reduce）。\n- `prepend=True`：让某监听者插到最前（真实里\"必须先跑\"的策略用它）。\n\n四段 demo 分别把四种模式映射到 dsh 真实事件：`tool/call`(emit)、\n`agent/pre-step`(waterfall)、`tools/execute`(parallel)、`agent/turn-stopping`(serial)。"
    },
    {
     "name": "7. 相对上一课新增了什么",
     "body": "L02 只有\"服务调用\"这一条插件间通路。本课加上第二条：**类型化事件 + 四种分发**。\n至此 Cordis 五大思想里的\"服务、inject、可逆 effect、事件\"都齐了。"
    },
    {
     "name": "8. 简化了什么 vs 真实 DeepSeek Harness",
     "body": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| 字符串事件名，无类型 | TypeScript **声明合并**扩展 `SessionEventMap` 等，编译期检查 | 事件是公开契约，误用要在编译期挡住 |\n| 分发模式靠调对方法 | 每个事件用 `@mode` 标注，生成的目录校验声明与分发点一致 | 防止\"声明是 waterfall 却用 emit 分发\"这类错误 |\n| `next()` 简化处理 None | waterfall 是严格的 around 语义，值通过 `next()` 返回值传播 | 协作式监听可改写或替换结果，顺序敏感 |\n| `serial` bail 用非 None/False | 真实 `serial` 返回第一个 non-null/non-false/non-undefined 的 bail 值并停止 | 单决策事件靠第一个拍板者短路 |\n| 事件不带 scope | 事件按 agent scope 过滤分发（scope carrier） | 一个 agent 的事件不该惊动别的 agent（见 L09） |\n\n> **parallel / serial 的承接点**（呼应审查意见）：本课先建立四种模式的直觉。\n> `parallel` 会在 **L11 工具执行管线**再现（真实的 `ordered pre → concurrent execute → ordered post`）；\n> `serial` 会在 **L19 Goal Round Driver** 再现。注意一个重要特例：真实的\n> `agent/turn-stopping` 虽然是 serial 事件，但它的监听器**返回 `void`**——想让 turn 继续的\n> 监听器通过 `agent.steer(...)` 写入 steering（副作用），loop 再重读 inbox 决定续跑，\n> 而不是\"返回一个 stop 决策\"。L19 会专门演示这一点。\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `bus.emit` | `ctx.emit`（如 `tool/call`、`session/event`） |\n| `bus.waterfall` | `ctx.waterfall`（`agent/pre-step`、`agent/request`、`tools/*`） |\n| `bus.parallel` | `ctx.parallel` |\n| `bus.serial` | `ctx.serial`（`agent/turn-stopping`） |\n| `next()` 委派 | Cordis waterfall 的 `next()` around 语义 |\n\n---\n[← 上一课 L02](../L02_cordis_plugins/README.zh.md) · [返回总览](../../README.md) · [下一课 L04 →](../L04_session_log/README.zh.md)"
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
     "body": "```powershell\npython lessons/L04_session_log/main.py\n```\n\n预期输出（节选）：\n\n```text\n===== 会话日志（仅追加，seq 连续）=====\n  #0  user/message       {'content': '演示事件日志', 'source': 'human'}\n  #1  assistant/message  {'text': '先执行一条命令。'}\n  #2  tool/call          {'callId': 'c1', 'name': 'shell', ...}\n  #3  tool/result        {'callId': 'c1', 'result': 'event\\nsourcing'}\n  #4  assistant/message  {'text': '任务完成。'}\n\n===== 回放：从日志重新派生模型历史 =====\n  user       '演示事件日志'\n  assistant  '先执行一条命令。'\n  tool       'event\\nsourcing'\n  assistant  '任务完成。'\n```"
    },
    {
     "name": "2. 观察输出",
     "body": "agent 干的活还是没变。但状态的形态彻底变了：不再是一个会被覆盖的 `messages` 列表，\n而是一条**只增不改的事件流**。每件发生过的事（说话、调工具、拿结果）都是日志里一条带\n`seq` 的事件。最后我们用同一份日志重新\"回放\"出模型历史。\n\n> 注意：本课**故意不引入 `turn`/`step` 事件**——那是 L06 的主题。这里只追加最基本的\n> 四类事件（user/message、assistant/message、tool/call、tool/result），先把\"仅追加日志\"\n> 这一件事讲透，避免过早引入尚未定义的轮次语义。"
    },
    {
     "name": "3. 为什么需要这一层",
     "body": "前三课的 `messages` 有个致命问题：它**既是给模型看的历史，又是唯一的状态**。\n一旦你想 fork 会话、崩溃恢复、生成遥测、或者事后审计\"当时到底发生了什么\"，\n一个可变列表根本扛不住。\n\ndsh 的答案：**把\"发生了什么\"和\"模型该看什么\"彻底分开。** 前者是仅追加日志（本课），\n后者是从日志派生出的投影（下一课 L05）。\n\n**为什么先立日志、再讲 turn/step（L06）？** 因为一旦\"唯一真源\"确立，\n后面每一层（轮次、压缩、fork、持久化）都只是\"往日志追加事件\"或\"从日志派生\"，\n不必各自维护一份状态。日志是所有后续机制的地基。"
    },
    {
     "name": "4. 心智模型",
     "body": "把会话想成**银行账本**，而不是**账户余额**：\n\n```text\n账户余额（可变）           账本（仅追加）\n  balance = 100     vs      +100 存入\n  balance = 80              -20  取出\n  （改完就没了历史）          （每笔都在，余额靠算）\n```\n\n模型历史 = 账本上算出来的\"当前余额\"。账本本身永不修改。"
    },
    {
     "name": "5. 方案与图",
     "body": "```text\n        run(session, ...)\n             │\n             ▼\n   session.append(\"user/message\", ...)   ← 只追加\n   session.append(\"assistant/message\",...)\n   session.append(\"tool/call\", ...)\n   session.append(\"tool/result\", ...)\n             │\n   naive_derive(session)  ── 从事件拼出模型要的 messages（L05 会做正规版）\n             │\n             ▼\n        llm.complete(messages)\n```"
    },
    {
     "name": "6. 代码拆解",
     "body": "- `SessionEvent` 用 `frozen=True`：事件不可变，写入即定。\n- `Session.append(type, data)`：`seq = len(events)`，保证连续且单调。**只有 append，没有 update/delete。**\n- `run()`：把 L01 的\"追加消息\"全换成\"追加事件\"——`user/message`、\n  `assistant/message`、`tool/call`、`tool/result`（本课故意不含 turn/step，见 L06）。\n- `naive_derive()`：本课临时的粗糙投影，L05 升级为正规 `deriveMessages`。"
    },
    {
     "name": "7. 相对上一课新增了什么",
     "body": "L01-L03 的状态是可变 `messages` 列表。本课把它替换成**仅追加的 `SessionEvent` 日志**，\n并证明\"同一份日志可重复回放出相同历史\"。这是全套课程最有辨识度的转折点。"
    },
    {
     "name": "8. 简化了什么 vs 真实 DeepSeek Harness",
     "body": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| 内存 list，进程退出就没了 | `ctx.sessions` + 持久化 seam（JSONL/后端），崩溃可恢复 | 会话要跨进程存活、可恢复（见附录 X） |\n| 事件类型 5~6 种 | `SessionEventMap`，可用**声明合并**扩展（compaction、hook 等各自加事件） | 新的模型可见输入必须先加事件类型，不能塞临时变量 |\n| `data` 是任意 dict | 每条事件是 lossless JSON，`append` 运行时校验 `isJsonValue` | 日志要能逐字节存储与回放，非法数据在源头被拒 |\n| `naive_derive` 内联 | `deriveMessages()` 独立纯函数（L05） | 投影逻辑要被回放、fork、遥测复用 |\n| 无 surface/记账区分 | 事件分 surface（进模型）与 log-only（记账），`assistant/chunk` 保留 token 级回放 | UI 保真、usage 记账、compaction 的 shadow 都靠这个区分 |\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `Session` | `ctx.sessions` 里的 `Session`（`core/session`） |\n| `SessionEvent` | `SessionEvent` / `SessionEventMap` |\n| `append` | `Session.append`（仅追加不变式） |\n| `naive_derive` | `deriveMessages()`（见 L05） |\n\n---\n[← 返回总览](../../README.md) · [下一课 L05 →](../L05_derive_messages/README.zh.md)"
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
     "body": "```powershell\npython lessons/L05_derive_messages/main.py\n```\n\n预期输出（节选）：\n\n```text\n===== 原始事件日志（8 条，含记账事件与一条空消息）=====\n  #0 turn/start\n  #1 user/message\n  #2 assistant/message\n  #3 tool/call\n  #4 tool/result\n  #5 assistant/message      ← 空内容消息\n  #6 assistant/message\n  #7 turn/end\n\n===== deriveMessages 投影出的模型历史 =====\n  {'role': 'user', 'content': '看看环境'}\n  {'role': 'assistant', 'content': '我调一下工具', 'tool_calls': [...]}\n  {'role': 'tool', 'tool_call_id': 'c1', 'content': 'hi'}\n  {'role': 'assistant', 'content': '环境正常，任务完成。'}\n\n===== 关键：同一日志再投影一次，结果完全一致（可回放）=====\n  两次投影相等: True\n  投影出 4 条消息，但日志有 8 条事件\n\n===== callId 配对校验：每条 tool 消息都回溯到了对应的 tool/call =====\n  1 条 tool 结果全部配对成功（无孤儿）: True\n```"
    },
    {
     "name": "2. 观察输出",
     "body": "**8 条事件，投影出 4 条消息。** 差额来自三类不进模型历史的东西：\n记账事件（`turn/start`、`turn/end`、`tool/call`）、以及一条空的 `assistant/message`。\n最关键的一行：**同一日志投影两次，结果完全相等**——这就是\"可回放\"的数学保证。"
    },
    {
     "name": "3. 为什么需要这一层",
     "body": "L04 已经把状态变成日志了，但日志里\"什么该给模型看、什么只是记账\"是混在一起的。\n如果每个用到历史的地方（主循环、压缩、fork、遥测）都自己写一遍\"从事件拼消息\"，\n逻辑会漂移、会出 bug。\n\n**答案是一个纯函数 `deriveMessages`：日志进、消息出，无副作用、结果确定。**\n它是唯一一处定义\"模型到底看到什么\"的地方。由此得到 dsh 的铁律——\n**\"模型可见即已记录\"**：任何进入模型请求的东西，都必须能从日志重建。\n所以想给模型加一种新输入，就必须先加一种新事件类型。"
    },
    {
     "name": "4. 心智模型",
     "body": "`deriveMessages` 就是数据库里的**视图（VIEW）**：\n\n```text\n  事件日志（表，全部原始行）\n        │  deriveMessages() = SELECT ... WHERE 进入模型\n        ▼\n  模型历史（视图，只读投影）\n```\n\n你永远不 UPDATE 视图，你只改底层的表（追加事件），视图自动反映最新状态。"
    },
    {
     "name": "5. 方案与图",
     "body": "```text\nevents ──▶ deriveMessages ──▶ messages\n\n  user/message        →  {role: user}\n  assistant/message   →  {role: assistant}   （空内容且无 tool_calls → 跳过）\n  tool/result         →  {role: tool, tool_call_id}   （按 callId 配对）\n  turn/start,end      →  （记账，跳过）\n  tool/call           →  （已并入对应 assistant 消息，跳过）\n  assistant/chunk     →  （token 级回放，跳过）\n```"
    },
    {
     "name": "6. 代码拆解",
     "body": "`derive_messages(events)` 就是一个 for 循环 + 分类：\n\n- `user/message` → user 消息。\n- `assistant/message` → **规则 1**：`text` 为空且无 `tool_calls` 就 `continue`（不进历史，\n  但事件仍在日志里，保留 usage 与回放）。有 `tool_calls` 就带上。\n- `tool/result` → **规则 2**：先收集所有 `tool/call` 的 `callId` 成集合，再校验这条 result\n  的 `callId` 确实回溯得到某条 call（否则标记为孤儿），然后挂成带 `tool_call_id` 的 tool 消息。\n- 其余（`turn/*`、`tool/call`）是记账事件，全部跳过。\n\n`demo()` 手工构造一段含\"空 assistant 消息\"的事件序列，然后证明**两次投影相等**。"
    },
    {
     "name": "7. 相对上一课新增了什么",
     "body": "L04 用的是临时粗糙的 `naive_derive`。本课把它升级为正规的 `deriveMessages` 纯函数，\n并明确三条投影规则（空消息跳过、callId 配对、记账事件排除），把\"可回放\"从口号变成可验证的等式。"
    },
    {
     "name": "8. 简化了什么 vs 真实 DeepSeek Harness",
     "body": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| 一个 for 循环分类 | `deriveMessages()` 处理 surface 顺序、compaction 替换、附加上下文注入 | 压缩后的 surface 要正确遮蔽旧范围（见 L15） |\n| 空消息简单跳过 | 保留 `usage`、`sourceEventSeqs`（精确列出源 chunk），空内容仍记账 | token 计费、遥测、回放保真都依赖它 |\n| callId 直接配对 | surface 投影 + `surfaceOp`（replace 等）参与折叠 | 压缩摘要就是一条带 `surfaceOp:replace` 的 user/message |\n| 无不变式断言 | 运行时不变式断言\"模型可见必可从日志重建\" | 防止有人偷偷塞未记录的输入进模型 |\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `derive_messages()` | `deriveMessages()`（`core/session`，见 session-projection.md） |\n| \"空消息跳过\" | 空内容不进派生历史，但 `assistant/message` 事件保留 usage |\n| \"模型可见即已记录\" | session.md 的核心不变式 |\n\n---\n[← 上一课 L04](../L04_session_log/README.zh.md) · [返回总览](../../README.md) · [下一课 L06 →](../L06_turn_step/README.zh.md)"
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
     "body": "```powershell\npython lessons/L06_turn_step/main.py\n```\n\n预期输出（节选）：\n\n```text\n╔══ turn/start turn=0 ══\n║  ┌─ step/start step=0\n║  │  [assistant] 第一步：调工具。\n║  │  [tool] shell → 'step\\none'\n║  └─ step/end（工具已跑，仍欠一次请求 → 再开一 step）\n║  ┌─ step/start step=1\n║  │  ...\n║  ┌─ step/start step=2\n║  │  [assistant] 第三步：够了，收尾。\n║  └─ step/end（自然停止，本 turn 不再欠账）\n╚══ turn/end turn=0 ══\n[统计] 这个 turn 里跑了 3 个 step\n```"
    },
    {
     "name": "2. 观察输出",
     "body": "一个 turn 里嵌了**三个 step**。前两个 step 因为\"调了工具、还欠模型一次请求\"\n而继续，第三个 step 模型不再调工具（自然停止），turn 才关闭。这就是\nturn 与 step 的嵌套关系。"
    },
    {
     "name": "3. 为什么需要这一层",
     "body": "L04/L05 里我们已经在追加 `turn/start`、`step/start` 了，但那只是记账，\n没人真正解释\"一个 turn 什么时候该继续、什么时候该关\"。\n\n**turn/step 是 agent loop 的节奏器。** 它回答一个核心问题：模型调完工具后，\n要不要再问它一次？答案是\"要\"（得把工具结果给它看）。所以一个 turn 会自然地\n展开成多个 step，直到模型说\"够了\"或没有新输入。"
    },
    {
     "name": "4. 心智模型",
     "body": "```text\nturn  =  一整轮对话交锋（从你开口，到 agent 彻底停下）\nstep  =  这轮里的一个回合（模型说一次话 + 它引发的工具）\n\n  一个 turn ┌─ step 0：模型调 shell   → 欠一次请求 → 继续\n            ├─ step 1：模型再调 shell → 欠一次请求 → 继续\n            └─ step 2：模型收尾       → 不欠了 → turn 关闭\n```"
    },
    {
     "name": "5. 方案与图",
     "body": "```text\nrun_turn(input):\n  append turn/start\n  append user/message\n  tools_owed = True\n  while tools_owed:\n      append step/start\n      turn = llm.complete(derive_messages(log))\n      append assistant/message\n      if 没有工具调用:\n          tools_owed = False        # 自然停止\n      else:\n          执行工具, append tool/call + tool/result\n          tools_owed = True         # 还欠一次请求\n      append step/end\n  append turn/end\n```"
    },
    {
     "name": "6. 代码拆解",
     "body": "`Driver.run_turn()`：\n\n- turn 开始：`turn/start` + `user/message`，`tools_owed=True`（至少跑一个 step）。\n- `while tools_owed`：每轮就是一个 step。`step/start` → 调模型 → `assistant/message`。\n- 无工具 → `tools_owed=False`，记 `step/end`，跳出。\n- 有工具 → 执行、记 `tool/call`+`tool/result`，`tools_owed=True`，继续。\n- 收尾：`turn/end`，reason 记 `natural-stop` 或 `max-steps`。"
    },
    {
     "name": "7. 相对上一课新增了什么",
     "body": "L04/L05 把 turn/step 当记账事件写进日志。本课把它们变成**驱动循环的正规语义**：\n用 `tools_owed` 判定 turn 何时继续、何时关闭，让\"一个 turn 含多个 step\"真正跑起来。"
    },
    {
     "name": "8. 简化了什么 vs 真实 DeepSeek Harness",
     "body": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| 单条输入直入 | 一个 **inbox** 队列，认领 next-step 输入 + 一条排队消息 | 注入的上下文要排队等待，直到有消息唤醒 driver |\n| `tools_owed` 布尔 | 完整的 turn 流：`agent/pre-step` → `step/start` → `agent/request` → `llm/stream` → tools → `agent/turn-stopping` | 每个阶段都是可拦截的扩展点 |\n| 无终止检查点 | `agent/turn-stopping` 是 serial 终止检查点（见 L19） | goal 续跑、预算控制在这里决定要不要真停 |\n| 无取消/错误恢复 | 取消信号、`agent/request-error` 恢复分支 | 长任务要能中断、瞬时错误要能重试（见 L08） |\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `Driver.run_turn` | `ctx.agentLoop` 的 turn 驱动（`core/agent-loop`） |\n| `tools_owed` | \"工具欠一次请求\"的继续判定 |\n| `turn/start`,`step/start`,... | 同名 SessionEvent（durable） |\n\n---\n[← 上一课 L05](../L05_derive_messages/README.zh.md) · [返回总览](../../README.md) · [下一课 L07 →](../L07_pre_step/README.zh.md)"
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
     "body": "```powershell\npython lessons/L07_pre_step/main.py\n```\n\n预期输出（节选）：\n\n```text\n### 场景 1：正常输入（会被注入器改写，然后跑一个 step）\n╔══ turn/start turn=0（输入='看看环境'）\n  [pre-step:注入器] 给 1 条输入追加上下文提醒\n  [pre-step:守卫] 输入非空 → 委派\n║  [assistant] 我收到的输入是：'看看环境（提醒：优先用 shell 工具）'\n╚══ turn/end\n\n### 场景 2：空输入（被守卫拒绝，turn 关闭但不花 step）\n  [pre-step:守卫] 空输入 → 拒绝（短路，不调 next），本 turn 不花 step\n\n===== 日志证明：场景 2 也留下了 turn/start + turn/end =====\n  #6 turn/start\n  #7 turn/end rejected-no-step\n```"
    },
    {
     "name": "2. 观察输出",
     "body": "场景 1 里，模型看到的输入被**注入器改写**了（多了一段提醒）。场景 2 里，空输入被\n**守卫短路拒绝**，这个 turn 没花任何 step——但日志里仍留下了 `turn/start`+`turn/end`，\n记录了\"曾经尝试过\"。"
    },
    {
     "name": "3. 为什么需要这一层",
     "body": "L06 的 driver 直接把输入喂给模型。但很多需求要在\"进模型之前\"动手脚：注入项目上下文、\n脱敏、加系统提醒、检测上下文是否该压缩、甚至直接拒绝某些输入。\n\n如果把这些都写进 driver，driver 会变成一个巨型 if 堆。**dsh 的做法是开一个\n`agent/pre-step` waterfall（回顾 L03）**：谁想拦截就挂个监听者，driver 本身不认识它们。\n压缩（L15）就是挂在这里做上下文压力检测的。"
    },
    {
     "name": "4. 心智模型",
     "body": "pre-step 是模型的**门卫 + 化妆师**：\n\n```text\n认领到的输入  ──▶ [注入器：补妆]  ──▶ [守卫：查证件]  ──▶ 进入模型\n                     │                    │\n                     改写 messages         空/违规 → 拒之门外（turn 不花 step）\n```"
    },
    {
     "name": "5. 方案与图",
     "body": "```text\nclaimed = 认领的输入\ndecision = waterfall(\"agent/pre-step\", {messages: claimed, rejected: False})\n\n  injector(d, next) ── 改写 messages ──▶ next(d')\n  empty_guard(d, next) ── messages 空? ── 是 ─▶ return {rejected:True}  # 短路\n                                        └ 否 ─▶ next(d)\n\nif decision.rejected or 无 messages:\n    append turn/end (rejected-no-step)   # 关闭 turn，不花 step，但记录尝试\nelse:\n    正常跑 step\n```"
    },
    {
     "name": "6. 代码拆解",
     "body": "- `injector(decision, next_)`：给每条 user 消息 `content` 追加提醒，然后 `next_(改写后)`。\n- `empty_guard(decision, next_)`：`messages` 为空就返回 `{rejected:True}` 且**不调 next_**（短路）；否则委派。\n- `Driver.run_turn()`：认领输入 → 跑 pre-step waterfall → 若被拒/空，只写 `turn/start`+`turn/end`；否则正常跑 step。\n\n关键点：**被拒的 turn 也是一个 durable turn**，日志记录了这次尝试（reason=`rejected-no-step`）。"
    },
    {
     "name": "7. 相对上一课新增了什么",
     "body": "L06 的 driver 无脑把输入送进模型。本课在 step 之前插入 `agent/pre-step` waterfall，\n让插件能改写或拒绝输入，并明确\"被拒的 turn 不花 step 但仍留痕\"。"
    },
    {
     "name": "8. 简化了什么 vs 真实 DeepSeek Harness",
     "body": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| 两个内联监听者 | `agent/pre-step` 是权威 waterfall，多插件协作 | 压缩、steering、注入上下文都挂在这里 |\n| 拒绝 = 返回 rejected | 返回的决定是权威的；包裹 `next()` 的监听者默认保留下游消息 | 除非有意替换，否则不能吞掉别人的改写 |\n| 改写 content 字符串 | 改写的是结构化 `Message`，注入是 `agent.inject()` 落到下一次请求 | 注入内容也要成为可记录的 `user/message`（模型可见即已记录） |\n| 无压缩联动 | `dsh-compaction-basic` 用 pre-step 做请求前的上下文压力检测 | 上下文快满时要先压缩再请求（见 L15） |\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `waterfall(pre_step, ...)` | `agent/pre-step` waterfall |\n| `injector` | `agent.inject()` / steering 监听者 |\n| `empty_guard` 短路 | pre-step 的 reject（权威决定） |\n| `rejected-no-step` | \"被拒的 turn 无 step，日志仍记录尝试\" |\n\n---\n[← 上一课 L06](../L06_turn_step/README.zh.md) · [返回总览](../../README.md) · [下一课 L08 →](../L08_llm_seam/README.zh.md)"
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
     "body": "```powershell\npython lessons/L08_llm_seam/main.py\n```\n\n预期输出（节选）：\n\n```text\n--- provider = scripted ---\n  [scripted] 流式输出: 你好，我是脚本 provider。\n  日志里有 17 个 assistant/chunk（token 级回放）\n\n--- provider = uppercase（换 provider，行为立刻不同）---\n  [uppercase] 流式输出: ECHO: CHANGE ME\n\n--- provider = scripted，第一次故意失败（演示错误恢复）---\n  [scripted] 流式输出:\n  [恢复] 捕获错误 RuntimeError('模拟的瞬时网络错误')，重试第 1 次\n  [scripted] 流式输出: 重试后成功了。\n```"
    },
    {
     "name": "2. 观察输出",
     "body": "同一个 `run_step` driver，喂进三个不同 provider，行为立刻不同——因为它们都实现同一个\n`stream` 接口。流式输出被切成一个个 chunk，每个 chunk 都记成一条 `assistant/chunk`\n事件（token 级回放）。第三个 provider 第一次故意失败，driver 重试后成功。"
    },
    {
     "name": "3. 为什么需要这一层",
     "body": "回想 **L01**：我们直接 `llm.complete(messages)`。那其实偷偷省略了一整层——\n真实 dsh 里模型不是一个函数，而是 `ctx.llm` 这个 **seam** 背后的 provider。\n\n为什么要抽成 seam？因为你要能：换模型厂商（DeepSeek / Pi-AI）、在测试里换成\n确定性 Replay、在不同 profile 里挂不同模型——而 driver 一行都不用改。\n这就是 L01 的\"直接调模型\"到这里被补全的那一层。"
    },
    {
     "name": "4. 心智模型",
     "body": "llm seam 就是**电源插座标准**：\n\n```text\n        ┌─────────── ctx.llm（插座，接口约定）───────────┐\n        │             stream(messages) -> chunks         │\n        └───▲──────────────▲───────────────▲─────────────┘\n            │              │               │\n      llm-deepseek   llm-pi-ai        llm-replay\n      （真模型）      （另一家）        （测试/教学）\n```\n\n任何 provider 插上去都能用，因为它们符合同一个\"插座标准\"。"
    },
    {
     "name": "5. 方案与图",
     "body": "```text\nrun_step(provider, messages):\n  append step/start\n  for chunk in provider.stream(messages):     ← 流式：一个个 chunk\n      append assistant/chunk (chunk)           ← token 级回放\n      if text_delta: 累积文本\n  append assistant/message (合成的完整文本)      ← 派生历史用这条\n  append step/end\n\n  try/except:\n     provider 抛错 → attempt < max_retries ? 重试 : 保留原错误   ← 错误恢复边界\n```"
    },
    {
     "name": "6. 代码拆解",
     "body": "- `LLMProvider`：接口（Service Definition），只约定一个 `stream(messages)`。\n- `ScriptedProvider` / `UpperCaseProvider`：两个可互换实现。`fail_first` 演示瞬时错误。\n- `run_step()`：消费流 → 每个 chunk 记 `assistant/chunk` → 流结束合成 `assistant/message`\n  （**chunk 用于回放，message 用于派生历史**，二者分工）→ `try/except` 里实现重试/保留原错误的**恢复边界**。"
    },
    {
     "name": "7. 相对上一课新增了什么",
     "body": "前 7 课都把模型当成一个直接可调的函数。本课把它抽成 **llm seam + 可互换 provider**，\n并引入两样新东西：**流式 chunk（token 级回放）** 和 **错误恢复边界**，回扣 L01 的简化点。"
    },
    {
     "name": "8. 简化了什么 vs 真实 DeepSeek Harness",
     "body": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| `stream` 返回 dict chunk | 完整的 `StreamChunk` 词汇 + `agent/request`/`llm/stream` waterfall | 请求构造、流处理都是可拦截扩展点 |\n| 文本 chunk | text、tool_call、usage、reasoning 等多种 chunk | 工具调用、推理、token 计费都在流里 |\n| try/except 重试 | `agent/request-error` waterfall，区分瞬时错误与上下文溢出 | 上下文溢出要触发压缩而非重试（见 L15） |\n| `assistant/message` 存文本 | 带 `usage` 和 `sourceEventSeqs`（精确列出源 chunk），空内容也记账 | 回放保真、计费、遥测 |\n| if/else 选 provider | profile/bundle 组合决定挂哪个 provider | 生产/测试/多厂商用配置切换（见 L20） |\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `LLMProvider.stream` | `ctx.llm.stream()`（`llm/llm` seam） |\n| `ScriptedProvider` | `dsh-llm-replay` |\n| `UpperCaseProvider` / 真模型 | `dsh-llm-deepseek` / `dsh-llm-pi-ai` |\n| `assistant/chunk` | 同名事件（token 级回放） |\n| 重试分支 | `agent/request-error` 恢复 |\n\n---\n[← 上一课 L07](../L07_pre_step/README.zh.md) · [返回总览](../../README.md) · [下一课 L09 →](../L09_scope/README.zh.md)"
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
     "body": "```powershell\npython lessons/L09_scope/main.py\n```\n\n预期输出（节选）：\n\n```text\n===== translator agent 看到的工具（shell 被遮蔽 + 多了 translate）=====\n  shell      翻译官专用 shell：只允许 echo 翻译结果  ← 遮蔽了全局同名\n  translate  翻译官私有工具：翻译文本  ← scope 私有\n\n===== readonly agent 看到的工具（write 被 restrict 过滤掉）=====\n  shell      全局 shell：执行任意命令\n  read       全局 read：读文件\n  （注意：write 不在列表里——被过滤的工具，和不存在没有区别）\n```"
    },
    {
     "name": "2. 观察输出",
     "body": "三个 agent 看到三份不同的工具集。translator 的 `shell` 被它自己的同名工具**遮蔽**了，\n还多了私有的 `translate`；readonly 的 `write` 被 **restrict 过滤**掉，\n从它的视角看 `write` 根本不存在。"
    },
    {
     "name": "3. 为什么需要这一层",
     "body": "**为什么 Scope 排在工具（L10/L11）之前？** 因为工具、提示段落、skill、事件分发\n全都建立在\"注册是全局还是 scoped\"这个模型之上。如果先讲一个纯全局的工具注册表，\n后面讲 per-agent 差异化时就得推翻它。所以先立起 scope，再讲挂在 scope 上的东西。\n\n真实产品里，一个只读子 agent 不该有 `write`；一个\"翻译官\"人格需要一个和全局同名\n但行为不同的工具。Scope 就是实现\"per-agent 人格\"的根机制。"
    },
    {
     "name": "4. 心智模型",
     "body": "Scope 就像**编程语言的变量作用域**：\n\n```text\nglobal 层：  shell, write, read        （全局变量）\ntranslator： shell(私有), translate     （局部变量，同名遮蔽全局）\n    → 在 translator 里写 shell，指的是局部那个\nreadonly：   restrict 到 {read, shell}  （只能访问白名单）\n```\n\n\"最具体者胜\"（most-specific-wins）就是 shadowing。"
    },
    {
     "name": "5. 方案与图",
     "body": "```text\nresolve(scope_key):\n  base = { 全局工具 里通过 restriction 白名单的 }\n  if scope_key:\n      for 工具 in scope 层:\n          base[name] = scope 工具   ← 同名直接覆盖（shadow）\n  return base\n```"
    },
    {
     "name": "6. 代码拆解",
     "body": "- `register_global` / `register_scoped`：分别往全局层和某个 scope 层注册。\n- `restrict(scope, allowed)`：给某 scope 设白名单。\n- `resolve(scope)`：先按 restriction 过滤全局层，再用 scope 层同名覆盖。\n- scope key 用 `object()`：对应真实 dsh\"live agent 就是自己 scope 的 key\"（对象身份比较）。"
    },
    {
     "name": "7. 相对上一课新增了什么",
     "body": "前 8 课的注册都是隐式全局的。本课引入 **scope 两层结构 + shadowing + restriction**，\n让不同 agent 能看到不同的能力集，为后面工具、提示、skill 的 per-agent 差异化打地基。"
    },
    {
     "name": "8. 简化了什么 vs 真实 DeepSeek Harness",
     "body": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| 一个 dict 存 scope 层 | `core/scope` 的 scoped-registration 原语，`agent.ctx` 承载 | 注册的可见性与生命周期由一个事实驱动 |\n| scope key 是裸 object | scope key 按对象身份比较，live agent 是自己的 key | 稳定身份，subagent 不向下继承 |\n| 只有工具 | 工具、提示段落、变量、监听器、restriction 都可 scoped | per-agent 人格是多维度的 |\n| 两层，无 setup window | 有 setup window：创建时组合 agent 的 scoped 世界 | 在 agent 发布前把人格装好 |\n| 事件不过滤 | scoped dispatch：一个 agent 的事件带它的 scope carrier | 一个 agent 的活动不惊动别的 agent |\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `ScopedRegistry` | `core/scope` + 工具/提示注册表的分层 |\n| `register_scoped` | 通过 `agent.ctx` 的 scoped 注册 |\n| `resolve` shadowing | most-specific-wins 名称解析 |\n| `restrict` | `tools.restrict`（按交集组合） |\n\n---\n[← 上一课 L08](../L08_llm_seam/README.zh.md) · [返回总览](../../README.md) · [下一课 L10 →](../L10_tool_registry/README.zh.md)"
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
     "body": "```powershell\npython lessons/L10_tool_registry/main.py\n```\n\n预期输出（节选）：\n\n```text\n===== 发给模型的 schema（注意：没有 execute / timeout_ms）=====\n[ { \"name\": \"shell\", \"description\": \"...\", \"parameters\": {...} }, ... ]\n\n===== 循环通过注册表分派调用（loop 不认识具体工具）=====\n  add({'a': 2, 'b': 3}) → 5\n  echo({'text': 'hello'}) → 'hello'\n  shell({'command': 'echo via registry'}) → 'via\\nregistry'\n  nope({}) → '[未知工具] nope'\n```"
    },
    {
     "name": "2. 观察输出",
     "body": "三个工具注册进一张表。发给模型的 schema **只有** name/description/parameters——\n`execute` 和 `timeout_ms` 这些宿主字段没泄漏。循环用 `dispatch(name, args)`\n统一分派，它根本不认识 `add`/`echo`/`shell` 具体是什么。"
    },
    {
     "name": "3. 为什么需要这一层",
     "body": "L01 的 `call_tool` 是一堆 `if name == ...`。每加一个工具就得改这个函数、改循环。\n这违背了 dsh\"不改核心\"的原则。\n\n**工具注册表把\"工具\"变成数据（一条 `ToolDefinition`）。** 加工具 = 往表里加一条，\n循环通过表分派，永远不用改。而且注册表守着一条边界：**只有面向模型的字段能进\n模型请求**，handler/超时等宿主元数据严禁泄漏给模型。"
    },
    {
     "name": "4. 心智模型",
     "body": "注册表就是**餐厅菜单 vs 后厨**：\n\n```text\n菜单（schemas()）        →  给顾客（模型）看：菜名、描述、要哪些配料\n后厨（execute）          →  顾客看不到：怎么做、火候、超时几分钟\n点单（dispatch）         →  报菜名 → 后厨照做 → 上菜\n```"
    },
    {
     "name": "5. 方案与图",
     "body": "```text\nToolDefinition = { name, description, parameters | execute, timeout_ms }\n                   └──── 给模型 ────┘   └──── 宿主私有 ────┘\n\nregistry.schemas()  → 只投影前半段给模型\nregistry.dispatch(name, args)  → 查表 → 调 execute\n```"
    },
    {
     "name": "6. 代码拆解",
     "body": "- `ToolDefinition`：一个工具的全部。前三个字段面向模型，后两个（`execute`/`timeout_ms`）宿主私有。\n- `register()`：存入表，返回 disposer（可逆注册，呼应 L02）。\n- `schemas()`：**只**投影 name/description/parameters。这是防泄漏的关键。\n- `dispatch()`：查表、调 handler，未知工具返回错误。"
    },
    {
     "name": "7. 相对上一课新增了什么",
     "body": "L01 的工具是 if 分支。本课把工具变成注册表里的 **`ToolDefinition` 数据**，\n让\"加工具不用改循环\"成立，并明确\"模型可见字段 vs 宿主私有字段\"的边界。"
    },
    {
     "name": "8. 简化了什么 vs 真实 DeepSeek Harness",
     "body": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| `dispatch` 直接调 execute | 一整条 pre/guard/execute/post 管线（见 L11） | 权限、超时、沙箱、结果改写都要能介入 |\n| `parameters` 手写 dict | `defineTool` + 类型化 schema DSL，自动校验/收窄 | 编译期类型安全，运行时校验模型输入 |\n| 返回值随意 | 强制 `output.schema` + `render()` 规范输出 | 结果必须是 lossless JSON，可回放 |\n| 无 UI 投影 | `presentCall` / `presentResult` 纯投影 | UI 在流式和回放时都能渲染卡片 |\n| 全局注册 | 注册落到 scope 层（见 L09） | per-agent 工具集差异化 |\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `ToolDefinition` | `ToolDefinition`（`core/tools`） |\n| `schemas()` | 注册表 `schemas()`（只白名单模型字段） |\n| `dispatch` | 执行管线的入口（见 L11） |\n| `execute` | `ToolDefinition.execute(args, exec)` |\n\n---\n[← 上一课 L09](../L09_scope/README.zh.md) · [返回总览](../../README.md) · [下一课 L11 →](../L11_tool_pipeline/README.zh.md)"
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
     "body": "```powershell\npython lessons/L11_tool_pipeline/main.py\n```\n\n预期输出（节选）：\n\n```text\n### 单个工具穿过管线\n    tool/call echo({'text': 'the secret is 42'})\n    tool/result echo → 'the *** is 42'          ← post 改写脱敏\n    tool/call shell({'command': 'rm -rf /'})\n      pre-execute: 拒绝 shell                     ← pre 权限拒绝\n    tool/call sleep(...)  execute: sleep 超时       ← 超时策略\n\n### 一批工具：并发安全的用 parallel 同时执行\n  [并发批] 2 个并发安全工具用 parallel 同时执行\n    tool/result fetchB → 'fetched:B'             ← B 更快先完成\n    tool/result fetchA → 'fetched:A'\n  [顺序] write 非并发安全，单独执行\n```"
    },
    {
     "name": "2. 观察输出",
     "body": "同一条管线处理了四种情况：结果被 post 钩子**脱敏**、危险命令被 pre **拒绝**、\n慢工具**超时**、两个并发安全工具用 **parallel 同时执行**（B 比 A 先完成）而\n非并发安全的 write 单独跑。工具本身对这些策略**一无所知**。"
    },
    {
     "name": "3. 为什么需要这一层",
     "body": "L10 的 `dispatch` 是裸执行。但真实世界里，一次工具调用要经过权限审批、\n沙箱包裹、超时控制、结果脱敏……如果把这些塞进每个工具，工具会变得又长又耦合，\n而且每个工具都得重复实现一遍。\n\n**dsh 把策略从工具里剥离，挂到执行管线上。** 工具只管\"做事\"，管线管\"能不能做、\n做多久、结果怎么处理\"。这就是 pre/guard/execute/post 四段的意义。"
    },
    {
     "name": "4. 心智模型",
     "body": "管线就是**机场安检 + 登机 + 行李处理**：\n\n```text\ntool/call         →  值机（记录这次调用）\ntools/pre-execute →  安检（权限/沙箱：放行 / 拒绝 / 需人工确认）\nguard             →  最后一道闸机（单调守卫，不可绕过）\ntools/execute     →  登机飞行（超时、重试；多人可同机 = parallel）\ntools/post-execute→  行李分拣（改写/拦截/补充结果）\ntool/result       →  取到行李（冻结的权威结果）\n```"
    },
    {
     "name": "5. 方案与图",
     "body": "```text\nexecute_one(tool, call):\n  记 tool/call\n  for policy in pre:  policy(tool,call) == \"deny\" ? 短路返回 isError\n  try: result = execute (可选 timeout 包裹)\n  except Timeout: 返回 isError\n  for hook in post:  outcome = hook(call, outcome)   ← 可改写\n  记 tool/result（冻结）\n\nexecute_batch(calls):\n  并发安全的 → asyncio.gather 一起跑（parallel）\n  非并发安全 → 逐个跑\n```"
    },
    {
     "name": "6. 代码拆解",
     "body": "- `Pipeline.execute_one()`：把一次调用穿过 pre → execute(+timeout) → post → result。\n- `permission_policy`：pre 阶段，`rm` 命令返回 `\"deny\"` 短路。\n- `redact_post`：post 阶段，把 `secret` 替换成 `***`。\n- `execute_batch()`：`concurrency_safe=True` 的工具用 `asyncio.gather` **并发**（呼应 L03 的 parallel），其余顺序执行。\n- 超时用 `asyncio.wait_for` 包裹（around-dispatch 关注点）。"
    },
    {
     "name": "7. 相对上一课新增了什么",
     "body": "L10 只有裸 `dispatch`。本课在它外面套上 **pre/guard/execute/post 四段管线**，\n让权限、超时、脱敏等策略挂到管线上；并用 `execute_batch` 补讲 **parallel**\n（真实的 `ordered pre → concurrent execute → ordered post`）。"
    },
    {
     "name": "8. 简化了什么 vs 真实 DeepSeek Harness",
     "body": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| pre 返回字符串 | `tools/pre-execute` waterfall + `ctx.approval` 一次性询问 + 单调 guard | 权限有 allow/deny/ask 三态，guard 不可重排 |\n| post 改 dict | `tools/post-execute` waterfall（accept/block/replace/补充上下文） | 钩子可跨工具族，结果可注入后续上下文 |\n| 简单 timeout | `tools/execute` around 包裹 + 协作式取消信号 | 超时要能让工具优雅退出，不能硬杀进程 |\n| concurrency_safe 布尔 | `isConcurrencySafe` + barrier + 有界滚动池，执行前重分类 | 并发要保证不改父状态、共享状态可交换 |\n| 无 finalize/归一化 | `finalizeContent` + 注册表无损归一化 + `tool/result` 冻结 | 内容不变式、失败也走同一出口、结果不可变 |\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `pre` | `tools/pre-execute` waterfall + guard + `ctx.approval` |\n| `execute`(+timeout) | `tools/execute` around 分发 |\n| `post` | `tools/post-execute` waterfall |\n| `execute_batch` 并发 | 并发安全工具的 concurrent execute（parallel） |\n| `tool/result` | 冻结的权威 `tool/result` 事件 |\n\n---\n[← 上一课 L10](../L10_tool_registry/README.zh.md) · [返回总览](../../README.md) · [下一课 L12 →](../L12_capability_seam/README.zh.md)"
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
     "body": "```powershell\npython lessons/L12_capability_seam/main.py\n```\n\n预期输出（节选）：\n\n```text\n--- provider = local（真执行）---\n  结果: 'capability\\nseam\\ndemo'\n\n--- provider = sandbox（假远程沙箱，consumer 一行没改）---\n  结果: \"[sandbox] 已在远程隔离环境模拟执行: 'echo capability seam demo'（宿主机未受影响）\"\n  沙箱审计日志: ['echo capability seam demo']\n\n→ 换 provider 就换掉了整块 shell 能力，ShellTool 代码完全没动。\n```"
    },
    {
     "name": "2. 观察输出",
     "body": "同一个 `ShellTool`（consumer），先接本地执行器，再接假沙箱执行器——**代码一行没改**，\n行为却从\"真在本机跑\"变成\"送去远程隔离环境\"。这就是 seam 的威力。"
    },
    {
     "name": "3. 为什么需要这一层",
     "body": "其实 L08 的 `ctx.llm` 就是一个 seam，我们只是没点破。这一课正式把这个模式讲清楚，\n因为它是 dsh\"一切皆可替换\"的核心机制。\n\n真实产品需要：本地开发用本机 shell、云端部署用远程沙箱、测试用假执行器——\n如果 shell 工具直接写死 `subprocess.run`，这些切换就得改工具代码。\n**seam 把\"接口\"和\"实现\"分开，consumer 只依赖接口，换实现就换能力。**"
    },
    {
     "name": "4. 心智模型",
     "body": "seam 就是 **USB 接口标准**：\n\n```text\n        interface（USB 口规范）：ShellExecutor.run(cmd)\n              ▲                    ▲                ▲\n       LocalExecutor       SandboxExecutor    (未来的其他实现)\n       （本机 U 盘）        （网盘映射）\n              \n       consumer（电脑）：ShellTool —— 只认 USB 口，插什么都能用\n```"
    },
    {
     "name": "5. 方案与图",
     "body": "```text\n       ① interface: ShellExecutor.run(command) -> str\n              │ 被这些实现\n       ┌──────┴───────────┐\n   ② LocalShellExecutor   FakeSandboxExecutor\n       │真 subprocess      │记录 + 模拟\n       └──────┬───────────┘\n              │ 被这个消费\n       ③ ShellTool(executor)   ← 只注入 interface，不知道是哪个实现\n```"
    },
    {
     "name": "6. 代码拆解",
     "body": "- `ShellExecutor`：**interface**（Service Definition），只约定 `run(command)`。\n- `LocalShellExecutor` / `FakeSandboxExecutor`：两个 **implementation**（Provider）。后者带审计日志，模拟远程隔离。\n- `ShellTool`：**consumer**，构造时注入一个 `ShellExecutor`，只调 `.run()`，不关心具体实现。\n- main 里换一个 provider，`ShellTool` 行为立变——代码零改动。"
    },
    {
     "name": "7. 相对上一课新增了什么",
     "body": "前面的能力（llm、shell）都是\"用着但没点破\"。本课把 **seam 三角色\n（interface / implementation / consumer）** 正式讲清，并做一个可切换的 provider demo，\n把\"换 provider 就换能力\"从概念变成可运行的证据。"
    },
    {
     "name": "8. 简化了什么 vs 真实 DeepSeek Harness",
     "body": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| Python 抽象类 | Cordis `Service`（abstract class），认领 `ctx.<key>` | 服务有生命周期、类型词汇、依赖注入 |\n| 手动 new + 注入 | provider 注册进 `ctx`，consumer 用 `inject` 找 | 组合由 profile/bundle 决定（见 L20） |\n| 只有 shell | fs / subprocess / llm / subagent / compaction 都是 seam | 每块能力独立可换 |\n| 单一实现选一个 | subagent 允许**多个**同类 provider 按名注册 | 一个 agent 可同时用 spawn/fork/codex 等 |\n| 假沙箱 | fs + subprocess 共享执行世界，一起换成 E2B 远程沙箱 | 换一处，Bash/PTY/LSP 全跟着搬，无需 fork provider |\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `ShellExecutor` | `ShellExecutor`（`dsh-shell` Service Definition，`ctx.shell`） |\n| `LocalShellExecutor` | `dsh-bash-local` |\n| `FakeSandboxExecutor` | `dsh-bash-sandbox` / E2B provider |\n| `ShellTool` | `dsh-tool-bash`（consumer） |\n\n---\n[← 上一课 L11](../L11_tool_pipeline/README.zh.md) · [返回总览](../../README.md) · [下一课 L13 →](../L13_system_prompt/README.zh.md)"
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
     "body": "```powershell\npython lessons/L13_system_prompt/main.py\n```\n\n预期输出（节选）：\n\n```text\n===== 全局 agent 的 system prompt ====="
    },
    {
     "name": "身份",
     "body": "你是 DeepSeek Harness 教学助手。"
    },
    {
     "name": "环境",
     "body": "当前工作目录：D:/ds harness；平台：Windows。"
    },
    {
     "name": "时间",
     "body": "当前时间：2026-08-14。"
    },
    {
     "name": "可用工具",
     "body": "shell, read\n\n===== translator agent 的 system prompt（多了'人格'段落）====="
    },
    {
     "name": "身份 ...",
     "body": ""
    },
    {
     "name": "人格",
     "body": "你现在是翻译官，只做翻译。\n..."
    },
    {
     "name": "可用工具",
     "body": "translate\n```"
    },
    {
     "name": "2. 观察输出",
     "body": "system prompt 是**拼**出来的：三个插件各贡献一个段落（身份/环境/时间），\n按 order 排序，末尾加上当前可见的工具名。translator scope 下多出一个\"人格\"段落，\n可用工具也换成了 `translate`——scope 决定了组装内容（呼应 L09）。"
    },
    {
     "name": "3. 为什么需要这一层",
     "body": "新手常把 system prompt 当成一个写死的大字符串。但真实 harness 里，\n\"身份\"来自核心、\"环境信息\"来自 fs 插件、\"可用工具\"来自工具注册表、\n\"skill 提醒\"来自 skill 插件（见 L14）……如果全塞一个字符串，谁都没法独立维护。\n\n**dsh 让每个插件贡献自己的 `PromptSection`**，组装时按顺序拼起来。加一段提示 =\n挂一个 section（可逆，呼应 L02）；段落还能动态生成（插入当前时间/cwd）。"
    },
    {
     "name": "4. 心智模型",
     "body": "system prompt 就像**杂志的拼版**：\n\n```text\n每个栏目组（插件）交自己的稿件（PromptSection）\n     │  按版面顺序（order）排好\n     ▼\n  组装成一整期杂志（system prompt）\n     +  附录：本期可用工具清单（来自注册表 + scope）\n```"
    },
    {
     "name": "5. 方案与图",
     "body": "```text\nassemble(ctx, scope, tool_schemas):\n  chosen = 全局 section + 匹配 scope 的 section\n  chosen.sort(order)\n  for s in chosen:\n      body = s.text(ctx) if 可调用 else s.text   ← 静态或动态\n      拼接 \"## name\\n body\"\n  追加 \"## 可用工具\\n <tool 名单>\"\n```"
    },
    {
     "name": "6. 代码拆解",
     "body": "- `PromptSection`：一个段落 = name + order + text（静态字符串或 `ctx -> str` 函数）+ 可选 scope。\n- `register()`：挂一个 section，返回 disposer（可逆注册）。\n- `assemble()`：选段落（全局 + 匹配 scope）→ 按 order 排序 → 渲染（静态/动态）→ 附工具名单。\n- main：三个全局段落 + 一个只在 translator scope 的\"人格\"段落，展示两种组装结果。"
    },
    {
     "name": "7. 相对上一课新增了什么",
     "body": "前面 12 课从没管过 system prompt。本课把它从\"一段死字符串\"变成\n**多插件贡献的 `PromptSection` + 工具 schema 的协作组装**，并让 scope 决定组装内容。"
    },
    {
     "name": "8. 简化了什么 vs 真实 DeepSeek Harness",
     "body": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| 字符串拼接 | `system-prompt/assemble` waterfall，协作式组装 | 段落间可互相感知、可拦截改写 |\n| order 整数排序 | 注册顺序 + scope 链 + `complete` 段落语义 | 复杂的段落优先级与替换规则 |\n| scope 简单匹配 | scope 决定 section、工具 schema、shadowing | per-agent 人格（见 L09） |\n| 工具名单直接列 | `ToolProviderResult`（schemas + knownNames） | 区分\"拼错名\"与\"被 scope 隐藏\" |\n| 无信号 | `AssembleContext` 带 agent 实例与取消信号 | 动态段落可能需要 async 解析 |\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `SystemPromptService` | `ctx.systemPrompt`（`core/system-prompt`） |\n| `PromptSection` | `PromptSection` 注册约定 |\n| `assemble()` | `system-prompt/assemble` waterfall |\n| 工具名单 | `ToolProviderResult.schemas`（来自 L10 + L09） |\n\n---\n[← 上一课 L12](../L12_capability_seam/README.zh.md) · [返回总览](../../README.md) · [下一课 L14 →](../L14_skills/README.zh.md)"
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
     "body": "```powershell\npython lessons/L14_skills/main.py\n```\n\n预期输出（节选）：\n\n```text\n===== 第一段：模型平时只看到目录（省 token）=====\n[可用技能目录 — 需要时用 skill 工具按名加载]\n  - pdf: 处理 PDF：拆分/合并/提取文本\n  - code-review: 结构化代码审查清单\n  - git: 常见 git 工作流\n\n===== 模型决定：'我要做代码审查'，于是调 skill 工具 =====\n  [tool_call] skill({'name': 'code-review'})\n  [tool_result] [skill:code-review 正文已加载] 代码审查步骤：1) ...\n```"
    },
    {
     "name": "2. 观察输出",
     "body": "模型平时只看到一个约 100 字符的**目录**（每个 skill 一句话）。当它决定要做代码审查，\n才调 `skill` 工具把 `code-review` 的**完整正文**作为 tool result 拉进来。其余 skill 的\n正文始终没进上下文。"
    },
    {
     "name": "3. 为什么需要这一层",
     "body": "上下文 token 很贵。把所有领域知识（PDF 操作、代码审查清单、git 工作流……）\n全塞进 system prompt，既烧 token 又让模型分心。\n\n**Skills 用\"渐进披露\"解决：知识分两段。** 目录（名字+摘要）always-on 但极小；\n正文 on-demand，用到才加载。这样模型既\"知道有哪些本事可用\"，又不必一直背着全部细节。"
    },
    {
     "name": "4. 心智模型",
     "body": "Skills 就像**图书馆**：\n\n```text\n书架索引卡（目录）     →  always-on：书名 + 一句简介，占地极小\n借书（skill 工具）     →  on-demand：真要读了，才把整本书借到手边\n```\n\n你不会把整个图书馆搬回家，只借当下要看的那本。"
    },
    {
     "name": "5. 方案与图",
     "body": "```text\n第一段（目录）：build_skill_reminder(provider)\n    → 作为持久 reminder 注入（真实 dsh：agent/pre-step 的 user-role reminder）\n    → 模型每轮都看得到\"有哪些 skill\"\n\n第二段（正文）：模型调 skill({name})\n    → skill_tool 加载正文\n    → 作为 tool result 返回，进入本轮上下文\n```"
    },
    {
     "name": "6. 代码拆解",
     "body": "- `Skill`：name + summary（进目录）+ body（按需加载）。\n- `SkillProvider`：`list_summaries()` 给目录，`load(name)` 给正文。真实 dsh 有多种 provider（本地目录/远程）。\n- `build_skill_reminder()`：**第一段**——把目录拼成一段提醒文本。\n- `skill_tool()`：**第二段**——按名加载正文，作为 tool result 返回。"
    },
    {
     "name": "7. 相对上一课新增了什么",
     "body": "L13 让 system prompt 由段落组装。本课引入 **Skills 的两段注入**：\n目录作为持久 reminder（第一段）、正文作为 tool result 按需加载（第二段），\n实现\"知道有什么\"和\"用到才加载\"的分离。"
    },
    {
     "name": "8. 简化了什么 vs 真实 DeepSeek Harness",
     "body": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| 目录 = 拼字符串 | 目录经 `agent/pre-step` 作为持久 **user-role reminder** 注入 | 提醒要成为可记录的消息（模型可见即已记录） |\n| 内存 provider | `ctx.skills` 组合本地/内嵌/远程多 provider，分层 + 缓存 | 多来源、失效通知、发现缓存 |\n| load 直接返回 | 正文由 `skill` 工具加载，作为 tool result 进上下文 | 走工具管线（权限/记录/回放） |\n| 无 scope | 注册落 scope 层，同名 most-specific-wins | per-agent 技能集差异化（见 L09） |\n| 无失效 | `skills/change` 事件 + `snapshot()` 重取 | provider 目录变化要通知消费方 |\n\n> **精确表述**（呼应审查意见）：**不是**\"所有 skill 都只通过 tool result 注入\"。\n> 正确的是——**目录靠 reminder 注入（第一段），完整正文才靠 `skill` 工具作为 tool result 加载（第二段）**。\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `SkillProvider` | `ctx.skills` + `dsh-skill-filesystem` |\n| `build_skill_reminder` | `agent/pre-step` 注入的 skill 目录 reminder |\n| `skill_tool` | `dsh-tool-skill` 的 `skill` 工具 |\n| `Skill.summary` / `.body` | `SkillCandidate` 摘要 / `SkillDefinition` 正文 |\n\n---\n[← 上一课 L13](../L13_system_prompt/README.zh.md) · [返回总览](../../README.md) · [下一课 L15 →](../L15_compaction/README.zh.md)"
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
     "body": "```powershell\npython lessons/L15_compaction/main.py\n```\n\n预期输出（节选）：\n\n```text\n===== 压缩前：日志 10 条事件 =====\n  deriveMessages → 10 条模型消息\n\n===== 执行压缩（保留最近 2 条 surface 事件）=====\n  [compaction] 已把 seq 0..7（8 条）摘要遮蔽\n\n===== 压缩后：日志变成 14 条事件（更多了，不是更少！）=====\n  deriveMessages → 3 条模型消息（surface 变短了）\n    user       用户消息 4\n    assistant  助手回复 4\n    user       [摘要]（此前 8 条消息的摘要：...）\n\n===== 关键：旧事件仍在日志里，可回放 =====\n  日志总事件数 14，其中被遮蔽的旧事件一条没删\n```"
    },
    {
     "name": "2. 观察输出",
     "body": "请盯住这个**反直觉**的现象：压缩后日志**从 10 条变成 14 条**（更多，不是更少！），\n但 `deriveMessages` 投影出的模型消息**从 10 条缩到 3 条**。旧事件一条都没删——\n它们只是被一条\"摘要\"消息在 surface 上遮蔽了。"
    },
    {
     "name": "3. 为什么需要这一层",
     "body": "会话越长，事件越多，模型请求的 token 迟早撑爆。直觉做法是\"删掉旧消息\"——但这会\n**违背 L04 的仅追加铁律**，也毁掉回放和审计能力。\n\n**dsh 的做法：不删，只遮蔽。** 追加一条带 `surfaceOp=replace` 的摘要消息，\n让它在 surface 上盖住旧范围。旧事件仍在日志里、仍可回放，只是不再进入当前模型请求。\n这样既腾出了 token，又没破坏\"唯一真源\"。"
    },
    {
     "name": "4. 心智模型",
     "body": "压缩就像**在长文档上贴便利贴**，而不是**撕掉旧页**：\n\n```text\n撕页（错）          贴便利贴遮住（对，dsh 的做法）\n  删掉 seq 0..7  vs   追加一条摘要，surfaceOp:replace 0..7\n  历史没了            原页还在，只是当前视图看不到\n  无法回放            shadowedSeqs 记着被盖住的页，随时能揭开\n```"
    },
    {
     "name": "5. 方案与图",
     "body": "```text\ncompact(session):\n  ① append compaction/start        ← log-only 记账（加锁）\n  ② append user/message {           ← surface 替换（这条是摘要）\n        content: \"摘要...\",\n        surfaceOp: {op:replace, start, end}\n     }\n  ③ append compaction/summary {shadowedSeqs, shadowedRange}   ← log-only 记账\n     append compaction/end          ← log-only 记账（解锁）\n\nderiveMessages(events):\n  shadowed = 所有 replace 覆盖的 seq\n  跳过 shadowed 里的事件，但摘要消息本身进 surface\n```"
    },
    {
     "name": "6. 代码拆解",
     "body": "- `compact()`：实现 **shadow 三件套**——① `compaction/start`（log-only 加锁）\n  ② 一条带 `surfaceOp:replace` 的 `user/message`（假摘要，真正的 surface 变更）\n  ③ `compaction/summary` 记 `shadowedSeqs` + `compaction/end`（log-only 解锁）。\n- `derive_messages()`：先收集所有被 replace 覆盖的 seq，投影时跳过它们，但摘要消息进 surface。\n- 触发条件：本课用\"surface 超过 keep_last 条\"，真实 dsh 用 token 压力检测。\n- ★ **surfaceOp 是 `SessionEvent` 的顶层字段**（与 `data` 平级），不是塞进 `data`。\n  而且它对每个 surface 事件（user/assistant/tool）**必填**：普通消息声明 `{op:'append'}`，\n  压缩摘要声明 `{op:'replace', start, end}`；非 surface 事件（turn/step、compaction/*）绝不携带它。\n  本课 `Session.append()` 已按此约定强制。"
    },
    {
     "name": "7. 相对上一课新增了什么",
     "body": "前面 14 课日志只增不减、surface 等于全部 surface 事件。本课引入 **compaction**：\n在不删日志的前提下，用一条 replace 摘要遮蔽旧范围，让 surface 变短、token 腾出，\n并讲清 **shadow 三件套** 与\"日志仍仅追加\"的关系。"
    },
    {
     "name": "8. 简化了什么 vs 真实 DeepSeek Harness",
     "body": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| 按条数触发 | `dsh-compaction-basic` 用 `agent/pre-step` 检测 token 压力，`agent/request-error` 处理上下文溢出 | 要在真正撑爆前压缩，溢出时还能恢复 |\n| 假摘要字符串 | 真调 `ctx.llm.stream()` 生成摘要，`llmStreamCall` 标记 + `rawOutput` 可重建 | 摘要质量决定后续对话，需可重建审计 |\n| shadowedSeqs 简单记录 | `shadowedRange`（surface 位置对，可 start>end）+ 按 surface 顺序的 `shadowedSeqs` | 多次压缩后位置关系复杂，需精确 |\n| 无锁 | `compaction/start`..`end` 括住整个操作，崩溃留可检测的遗留锁 | 中途崩溃不能伪报\"已完成\" |\n| compaction 是内联函数 | compaction 是**能力 seam**（Definition/Provider/Consumer） | 可换 tokenizer/模板后端（见 L12） |\n| surfaceOp 在事件顶层、surface 事件必填（本课已对齐） | 同左：`SessionEvent` 顶层字段，仅三种 surface 事件携带，编译器在 `append` 处强制 | 派生历史的唯一依据，必须严格且类型安全 |\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `compact()` | `ctx.compaction`（`compaction/compaction`） |\n| `surfaceOp:replace` | 摘要承载在带 `surfaceOp:{op:replace}` 的 `user/message` |\n| `shadowedSeqs` | `CompactionResult.shadowedSeqs`（按 surface 顺序） |\n| `compaction/start`,`summary`,`end` | 同名 log-only 事件 |\n\n---\n[← 上一课 L14](../L14_skills/README.zh.md) · [返回总览](../../README.md) · [下一课 L16 →](../L16_subagent/README.zh.md)"
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
     "body": "```powershell\npython lessons/L16_subagent/main.py\n```\n\n预期输出（节选）：\n\n```text\n[父 assistant] 这个子任务过程会很啰嗦，我委派给子 agent。\n  [spawn] 启动子 agent: '环境探测'（全新独立会话）\n  [spawn] 子 agent 完成，子会话内部有 4 条事件（留在子会话，不回传）\n[父 assistant] 子 agent 回传了结果，我据此收尾：环境探测完毕：一切正常...\n\n===== 上下文隔离证明 =====\n  父会话事件数: 3（干净——子 agent 的中间过程没进来）\n```"
    },
    {
     "name": "2. 观察输出",
     "body": "父 agent 把一个\"啰嗦\"的子任务委派出去。子 agent 在**自己的独立会话**里跑了 4 条事件，\n但父会话只有 3 条——子 agent 的中间过程一条都没污染父上下文。父只拿到最终结论。"
    },
    {
     "name": "3. 为什么需要这一层",
     "body": "主 agent 的上下文很宝贵。有些子任务（\"读完 20 个文件总结架构\"）会产生大量中间噪音。\n如果都堆进主对话，主 agent 很快被淹没、token 也爆。\n\n**Subagent 用\"全新会话 + 只回传结果\"隔离上下文。** 子 agent 有自己独立的事件日志\n（回顾 L04），中间过程留在子会话，父只接收最终结果。这就是\"大任务拆小、上下文隔离\"。"
    },
    {
     "name": "4. 心智模型",
     "body": "Subagent 就像**把活外包**：\n\n```text\n父 agent（项目经理）\n   │  委派 \"环境探测\" 给\n   ▼\n子 agent（外包团队，自己的办公室 = 独立会话）\n   │  内部开了一堆会（中间事件），但不汇报流水账\n   ▼\n只交回一份结论 → 父 agent 据此推进\n```"
    },
    {
     "name": "5. 方案与图",
     "body": "```text\n父会话                        子会话（隔离）\n  user/message                  user/message: 子任务 prompt\n  assistant: 委派 subagent  ──▶  assistant + tool + assistant...（啰嗦过程）\n  tool_result: 子agent结论  ◀──  final result（只回传这一条）\n  assistant: 收尾\n       （父会话干净）              （中间过程全留这里）\n```"
    },
    {
     "name": "6. 代码拆解",
     "body": "- `spawn_subagent()`：**one-shot** provider——建一个全新 `Session`，跑 `run_agent`，只返回 `result`。\n- `run_agent()`：就是 L06 的精简 agent loop，跑在子会话上。\n- 父循环：模型调 `subagent` 工具 → spawn → 把子 agent 的 `result` 作为 tool_result 塞回父历史。\n- 末尾对比父/子会话事件数，证明上下文隔离。"
    },
    {
     "name": "7. 相对上一课新增了什么",
     "body": "前面所有 agent 都是单个。本课引入 **subagent 委派**：把子任务丢进一个独立会话的子 agent，\n用\"全新上下文 + 只回传结果\"实现隔离。"
    },
    {
     "name": "8. 简化了什么 vs 真实 DeepSeek Harness",
     "body": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| 只有 one-shot spawn | spawn **和** fork（从父会话分叉）两条启动路径 | fork 能带上父上下文的一部分 |\n| 一个进程内 provider | 六种 provider：spawn-in-process / fork / acp / codex / claude-code / dsh-sdk | 子 agent 可以是另一个产品/远程进程 |\n| 跑完即结束 | continuable（可继续）子 agent + followup + report 返回通道 | 父可与子多轮交互、子可中途汇报 |\n| 无能力校验 | `SubagentCapabilities`（outputSchema/depthLimit/toolFilter/persona）启动前校验 | 请求不支持的能力要\"fail loud\"而非静默降级 |\n| 结果是字符串 | 结构化 `SubagentResult.structured`（按 output schema）+ 冷恢复 | 类型化结果、崩溃后可从存储恢复 |\n\n> **限定说明**（呼应审查意见）：本课只实现 one-shot，标题已限定。真实 subagent seam\n> 是 dsh 里最丰富的能力之一，切勿把这个教学玩具当成它的全部语义。\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `spawn_subagent` | `ctx.subagents` + `dsh-subagent-spawn-in-process` |\n| `subagent` 工具 | `dsh-tool-subagent`（consumer） |\n| 独立 `Session` | 子 agent 的独立会话日志 |\n| `result` 回传 | `SubagentResult`（含 structured） |\n\n---\n[← 上一课 L15](../L15_compaction/README.zh.md) · [返回总览](../../README.md) · [下一课 L17 →](../L17_jobs/README.zh.md)"
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
     "body": "```powershell\npython lessons/L17_jobs/main.py\n```\n\n预期输出（节选）：\n\n```text\n===== agent 把慢操作丢后台，立刻继续 =====\n  agent 拿到 bash-1，不等它，继续想下一步...\n  [agent] 我先去分析别的文件（后台任务并行跑着）\n\n===== agent 忙完停下，变为空闲 =====\n    [控制器→followup] 唤醒 agent 新一轮处理: '[后台任务 bash-1 完成] npm run build → 构建成功，0 error'\n\n===== agent 的 inbox（完成事实已由控制器交回）=====\n  [后台任务 bash-1 完成] npm run build → 构建成功，0 error\n```"
    },
    {
     "name": "2. 观察输出",
     "body": "agent 把 `npm run build` 丢后台，立刻拿到 `bash-1` 继续干别的（不傻等）。\n后台任务完成后，**控制器**（不是 jobs 注册表自己）根据 agent 当时的状态，\n选择 `followup` 唤醒它处理这个完成事实。"
    },
    {
     "name": "3. 为什么需要这一层",
     "body": "编译、跑测试、下载都很慢。agent 傻等就浪费了\"继续想下一步\"的时间。\n\n**Jobs 把慢操作丢后台**：agent 立刻拿 job id 继续，任务完成后再把结果送回。\n但这里有个常见误解要纠正——**不是 jobs 注册表自己把结果写回会话**。\n职责是分离的：Jobs 管生命周期与身份；**控制器（consumer）** 监听完成事件，\n再根据 owner agent 的状态决定用 `inject`（塞下一次请求）还是 `followup`（唤醒新一轮）。"
    },
    {
     "name": "4. 心智模型",
     "body": "Jobs 就像**餐厅的取餐器**：\n\n```text\n点餐（start job）  →  拿到取餐器（job id），你先回座位聊天（agent 继续想）\n后厨做好           →  取餐器震动（onJobDone）\n服务员（控制器）    →  看你在忙还是有空，决定\"端过来\"还是\"喊你自取\"\n```\n\n后厨（jobs）不管你坐哪桌；服务员（控制器）才负责把餐送到对的人。"
    },
    {
     "name": "5. 方案与图",
     "body": "```text\nJobRegistry（只管生命周期/身份）        控制器（consumer，管交付）\n  start(kind,label,work) → job id         on_done 订阅\n  后台线程跑 work                          ┌── job 完成 ──┐\n  完成 → 通知所有 on_done 订阅者  ─────────▶│ agent 空闲? │\n  （注册表绝不碰会话）                       │  是 → followup（唤醒）\n                                          │  否 → inject（等下轮）\n                                          └─────────────┘\n```"
    },
    {
     "name": "6. 代码拆解",
     "body": "- `JobRegistry.start()`：登记 job，起后台线程跑 `work`，完成后**只通知订阅者**——它不碰会话。\n- `JobRegistry.on_done()`：控制器在这里订阅。\n- `Agent.inject()` / `followup()`：两种把完成事实交回 agent 的方式。\n- `make_controller()`：**控制器**——按 `agent.idle` 选择 `followup`（已停下）或 `inject`（还在忙）。"
    },
    {
     "name": "7. 相对上一课新增了什么",
     "body": "前面的工具都是同步跑完才返回。本课引入 **Jobs 后台运行时**：慢操作丢后台、\nagent 不阻塞，并明确 **Jobs（生命周期）与控制器（交付）的职责分离**。"
    },
    {
     "name": "8. 简化了什么 vs 真实 DeepSeek Harness",
     "body": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| Python 线程 | `ctx.jobs` 运行时，生产方拥有执行资源 | bash/subagent 等多种 job kind 统一管理 |\n| `on_done` 回调 | consumer 监听 `onJobDone`，按 owner 状态 inject/followup | 交付方式取决于 agent 实时状态 |\n| 无访问控制 | job 访问按 owner session id 围栏，agent 释放时取消并 await | 一个 agent 不能碰别人的 job |\n| status 三态 | running/stopping/completed/killed/failed + `detail` | 精细的生命周期与停止语义 |\n| 无 job 工具 | `job_*` 工具收集/停止后台任务 | 模型能主动查询和终止后台任务 |\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `JobRegistry` | `ctx.jobs`（`jobs/jobs`） |\n| `make_controller` | `tool-jobs` consumer / 控制器 |\n| `inject` / `followup` | `agent.inject()` / `agent.followup()` |\n| `Job.id` = `kind-N` | `JobId`（`<kind>-N` 品牌化 id） |\n\n---\n[← 上一课 L16](../L16_subagent/README.zh.md) · [返回总览](../../README.md) · [下一课 L18 →](../L18_goal/README.zh.md)"
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
     "body": "```powershell\npython lessons/L18_goal/main.py\n```\n\n预期输出（节选）：\n\n```text\n===== 挂一个目标 =====\n  当前: {'phase': 'active', 'text': '把仓库里所有失败的测试修绿', 'revision': 1, ...}\n\n===== 中途遇到障碍 → blocked（带机器可路由的 code）=====\n  当前: {'phase': 'blocked', ..., 'block': {'code': 'needs-approval', ...}}\n\n===== 目标的真源是事件日志（折叠得到状态）=====\n  #0 goal/change {'phase': 'active', ...}\n  #1 goal/change {'phase': 'blocked', ...}\n  #3 goal/change {'phase': 'complete', ...}\n  → revision=4：每次变更 +1，用于 compare-and-set\n```"
    },
    {
     "name": "2. 观察输出",
     "body": "一个目标经历 active → blocked → active → complete。每次变更都追加一条 `goal/change`\n事件，当前状态由这些事件**折叠**得到；`revision` 每次变更 +1。阻塞时带一个\n机器可路由的 `code`。"
    },
    {
     "name": "3. 为什么需要这一层",
     "body": "有些会话有一个跨多轮的大目标（\"把测试全修绿\"）。需要一个地方记录：目标是什么、\n现在什么阶段、改了几次、为什么阻塞。\n\n**但要害是：Goal 只是状态，不是调度器、不是另一条对话线。** 它复用 L04 的事件溯源——\n真源仍是日志，状态靠折叠。这一课只讲\"状态怎么记\"；\"谁来驱动续跑\"是下一课 L19 的事。\n把这两层分开，是理解 goal 的关键。"
    },
    {
     "name": "4. 心智模型",
     "body": "Goal 就像项目的**里程碑状态牌**，不是**催办的人**：\n\n```text\n状态牌（Goal 领域，本课）：   目标=X  阶段=active  改过 3 次\n催办的人（Driver，L19）：     看到还没完成 → 去催\"再干一轮\"\n```\n\n状态牌只记录，不催办。两者分工。"
    },
    {
     "name": "5. 方案与图",
     "body": "```text\nGoalDomain（事件溯源）\n  set_goal(text)  → append goal/change {phase:active}\n  block(code,msg) → append goal/change {phase:blocked, block}\n  complete()      → append goal/change {phase:complete}\n\n  snapshot() = 折叠所有 goal/change → 当前 {phase, text, revision}\n               revision = 变更次数（compare-and-set 用）\n```"
    },
    {
     "name": "6. 代码拆解",
     "body": "- `GoalDomain._append()`：每次变更追加一条 `goal/change` 事件（仅追加，同 L04）。\n- `set_goal` / `block` / `complete`：三种变更，写入不同 phase。\n- `snapshot()`：把所有事件**折叠**成当前状态，`revision = seq + 1`。\n- `block` 带 `code`（机器可路由）+ `message`（给人看）。"
    },
    {
     "name": "7. 相对上一课新增了什么",
     "body": "前面的会话没有\"跨多轮的显式目标\"。本课引入 **持久 Goal 领域**：用事件溯源记录\n目标状态（active/blocked/complete）与 revision，并强调它是\"状态而非调度器\"，\n为 L19 的续跑驱动打基础。"
    },
    {
     "name": "8. 简化了什么 vs 真实 DeepSeek Harness",
     "body": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| active/blocked/complete | 还有 **paused** 阶段 | 目标可被人工暂停而非阻塞 |\n| revision 简单 +1 | `GoalRef` compare-and-set，每次持久变更递增 | 并发变更要靠 revision 防冲突 |\n| 折叠成一个 dict | `GoalSnapshot` 完整字段 + goal-round 上限 | 续跑要有轮次上限防失控 |\n| 无激活状态 | 持久 phase 与**进程本地激活**分离 | resume/fork 后需人工重新授权才自动续跑 |\n| domain 独立 | goal 领域 + goal-round-driver 拆开（见 L19） | 状态与驱动是两层机制 |\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `GoalDomain` | `ctx.goals`（`goal/goal`，core service） |\n| `goal/change` | 同名事件 |\n| `snapshot()` | `GoalSnapshot` |\n| `block(code,message)` | `GoalBlockReason` |\n\n---\n[← 上一课 L17](../L17_jobs/README.zh.md) · [返回总览](../../README.md) · [下一课 L19 →](../L19_goal_driver/README.zh.md)"
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
     "body": "```powershell\npython lessons/L19_goal_driver/main.py\n```\n\n预期输出（节选）：\n\n```text\n===== 场景 A：目标需要 3 步完成，driver 通过 steer 自动续跑 =====\n  [round 1] agent 干活……剩余 2 步\n    [turn-stopping:budget] 预算充足，不干预（不 steer）\n    [turn-stopping:goal] 目标未完成 → agent.steer('继续推进目标：修绿所有测试')（写 steering，不返回决策）\n  → inbox 有 steering，loop 续跑下一 step\n  ...\n  [round 3] 目标达成 → complete\n    [turn-stopping:goal] 目标 complete → 不 steer，turn 将关闭\n  → inbox 为空，turn 关闭\n\n===== 场景 B：目标中途被阻塞 → 不再 steer，turn 关闭 =====\n  [round 2] 遇到需要人工批准的操作 → blocked\n  → inbox 为空，turn 关闭\n```"
    },
    {
     "name": "2. 观察输出",
     "body": "场景 A 里，agent 每到停止边界，goal 监听器就**调 `agent.steer(...)` 写入一条续跑输入**\n（不是返回 `{stop:False}`），loop 因为 inbox 里有 steering 就再跑一步，直到目标 complete\n时不再 steer、inbox 为空、turn 关闭。场景 B 里目标一 blocked，监听器就不再 steer。"
    },
    {
     "name": "3. 为什么需要这一层",
     "body": "L18 有了目标状态，但**状态自己不会动**。谁在目标没完成时把 agent\"再踹一轮\"？\n\n这就是 Goal Round Driver。它挂在 **`agent/turn-stopping`** 这个停止边界上。\n但要害是它的**真实机制**（此前版本讲错了，本次已修正）：`agent/turn-stopping` 虽然是\nserial 事件，**监听器却返回 `void`**——它不是\"对 stop 布尔值投票\"。想让 turn 继续的监听器\n调用 `agent.steer(...)` 写入真实 steering（一个副作用），loop 随后**重新读取 inbox**：\n有新 steering 就再跑一个 step，没有就关闭 turn。**数据（有没有 steering）决定结果，\n监听器顺序不改变结论。**"
    },
    {
     "name": "4. 心智模型",
     "body": "turn-stopping 不是\"举手表决要不要停\"，而是\"**关门前的最后一声吆喝**\"：\n\n```text\nloop 说：\"我准备关 turn 了\"\n     │  按序通知每个 stopping 监听器（它们返回 void）：\n     ├─ 预算监听器：没意见（什么也不做）\n     └─ goal 监听器：目标没完成 → 往 inbox 塞一张\"继续干\"的纸条（steer）\n     ▼\nloop 回头看 inbox：\n     有纸条（steering）→ 再跑一个 step\n     空的           → 真关 turn\n```\n\n关键区别：监听器**不**返回\"别停\"，它**留下一张纸条**；是 loop 看到纸条才继续。"
    },
    {
     "name": "5. 方案与图",
     "body": "```text\ndrive(goal, agent):\n  while 未超轮次上限:\n      agent.run_one_step()               ← 干活，可能推进/完成目标\n      agent.inbox.clear()                ← 上一轮 steering 已消费\n      dispatch_turn_stopping(listeners)  ← serial 通知，监听器返回 void\n          goal 监听器: goal.active 且 armed → agent.steer(\"继续…\")  ← 副作用\n          否则                            → 不 steer\n      if agent.inbox 非空:  继续下一 step  ← loop 重读 inbox\n      else:                 关闭 turn\n```"
    },
    {
     "name": "6. 代码拆解",
     "body": "- `Agent.steer(text)`：往 `inbox` 追加 steering（**副作用**）。这是续跑的真实机制。\n- `make_goal_listener()`：turn-stopping 监听器，**返回 `None`（void）**；目标 active 且 armed 时调 `agent.steer(...)`。\n- `make_budget_listener()`：只观察、不 steer、返回 void。\n- `dispatch_turn_stopping()`：按序 `await` 所有监听器（serial 语义），它们无返回值。\n- `drive()`：跑一步 → 清 inbox → 跑 turn-stopping → **重读 inbox** → 有 steering 续跑，否则关 turn。\n- `activation.armed`：进程本地激活——真实 dsh 里 resume/fork 后需人工重新授权才自动续跑。"
    },
    {
     "name": "7. 相对上一课新增了什么",
     "body": "L18 的目标状态不会自己推进。本课加上 **Goal Round Driver**：它在 `agent/turn-stopping`\n边界上，通过 `agent.steer(...)` 写 steering 让 loop 续跑（而非返回 stop 决策），\n直到目标 complete/blocked。这里也是 **serial** 分发的承接点（回顾 L03），\n并特别演示了 turn-stopping \"监听器返回 void、靠 steer 续跑\" 的真实语义。"
    },
    {
     "name": "8. 简化了什么 vs 真实 DeepSeek Harness",
     "body": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| inbox 是个 list | 真实 inbox + `agent.steer(...)` 写入、loop 重读 | steering 要能与人类输入、注入上下文排队 |\n| 监听器返回 void，靠 steer | `agent/turn-stopping` 签名就是 `Promise<void>\\|void`，靠 steer 续跑 | \"数据决定、顺序无关\"，避免监听器顺序影响结论 |\n| 反向停止未演示 | 工具结果带 `concludesTurn` 可在其 step 提前结束 turn | 让工具也能主动收尾一轮 |\n| armed 布尔 | goal 激活 armed/disarmed，不进 durable replay | resume/fork 要人工重新授权，防意外自动跑 |\n| driver 与 domain 混在文件 | goal 领域（L18）与 goal-round-driver 是独立包 | 状态与驱动分层，各自可替换 |\n\n> **本次修订说明**：早期版本把 turn-stopping 写成\"监听器返回 `{stop: False}` 投票\"，\n> 这与真实签名不符。真实的 `agent/turn-stopping` 返回 `void`，续跑靠 `agent.steer(...)`\n> 的副作用 + loop 重读 inbox。依据见 `docs/subsystems/core.zh.md` 的 `agent/turn-stopping` 条目。\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `dispatch_turn_stopping` | `agent/turn-stopping` serial 事件（监听器返回 void） |\n| `agent.steer(text)` | `agent.steer(...)` 写入 steering |\n| `drive` 重读 inbox | loop 在停止边界后重读 inbox 决定续跑 |\n| `activation.armed` | goal 激活 armed/disarmed |\n\n---\n[← 上一课 L18](../L18_goal/README.zh.md) · [返回总览](../../README.md) · [下一课 L20 →](../L20_profile_bundle/README.zh.md)"
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
     "body": "```powershell\npython lessons/L20_profile_bundle/main.py\n```\n\n预期输出（节选）：\n\n```text\n===== 组合 profile: headless =====\n  [dsh-base] 插入 行 id=llm → dsh-llm-deepseek\n  [headless] 插入 行 id=subagent → dsh-subagent-spawn-in-process\n  ...\n\n===== 用 --patch 覆盖 llm 行（换成 replay，用于测试）=====\n  [--patch] 替换 行 id=llm → dsh-llm-replay\n  ---- 最终插件树 ----\n    llm          dsh-llm-replay {'script': 'fixtures/demo.json'}\n    ...\n```"
    },
    {
     "name": "2. 观察输出",
     "body": "同一份 `dsh-base`，`headless` 和 `web` 两个 profile 叠出两个不同的插件树（产品）。\n最后用 `--patch` 把 `llm` 那一行**整行替换**成 replay——`dsh-base` 其余行一个没动。"
    },
    {
     "name": "3. 为什么需要这一层",
     "body": "前 19 课我们都手写启动代码（`ctx.provide(...)`）。但真实产品不能靠手写启动，\n需要**声明式、可组合、可覆盖**：同一套核心，headless 版和 web 版只是叠的东西不同；\n测试时想把真模型换成 replay，不该改代码。\n\n**dsh 的答案：profile 列出要叠哪些 bundle，bundle 贡献配置行，按序层叠成插件树，\n`--patch` 可覆盖任意一行。** 这让\"同一内核组合出不同产品\"成为配置问题而非编码问题。"
    },
    {
     "name": "4. 心智模型",
     "body": "profile/bundle 就像**装修房子**：\n\n```text\ndsh-base      →  毛坯（水电、承重墙）——每套房都有\nheadless bundle →  简装（一次性运行器）\nweb bundle      →  精装（浏览器界面 + 服务器）\n--patch         →  最后改一处（把某个灯换成智能灯）——不动其他\n```"
    },
    {
     "name": "5. 方案与图",
     "body": "```text\n空树\n  ← 叠 dsh-base（llm, tool-shell, persistence）\n  ← 叠 profile 的 bundle（headless: runner+subagent+goal / web: web-app+server）\n  ← 叠 profile patch\n  ← 叠 home patch\n  ← 叠 --patch 覆盖\n\napply_layer：按 id 定位 → 已存在则整行替换，否则插入\n```"
    },
    {
     "name": "6. 代码拆解",
     "body": "- `ConfigRow`：一行配置 = id + plugin + config + disabled。\n- `apply_layer()`：按 `id` 定位——存在就**整行替换**，否则插入。这就是 patch 的核心机制。\n- `dsh_base` / `headless_bundle` / `web_bundle`：三个层，各贡献若干行。\n- `build_profile()`：按顺序叠 base → profile bundle →（可选）`--patch`。\n- main：headless、web 两个 profile，再演示 `--patch` 把 llm 换成 replay。"
    },
    {
     "name": "7. 相对上一课新增了什么",
     "body": "前 19 课都是手动 new 插件。本课引入 **profile/bundle 声明式层叠 + patch 覆盖**，\n把\"手写启动\"变成\"配置组合\"，让同一内核叠出不同产品、任意一行可被替换。"
    },
    {
     "name": "8. 简化了什么 vs 真实 DeepSeek Harness",
     "body": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| dict 存 config rows | Cordis loader + `cordis.patch.yml`，插件树真实挂载 | 配置驱动真实的插件生命周期 |\n| 手写三个 bundle | bundle 是分发格式，`package.json` 的 `dsh` 字段声明 | 可打包分发、跨仓库复用 |\n| 单一 patch | profile patch → home patch → `--patch` 多层覆盖 | 不同层级（团队/机器/命令行）各自覆盖 |\n| 整行替换 | patch 按 id 替换整个 config，或插入新行 | 精确定位、可组合 |\n| 无 dump | `dsh --profile web --dump-config` 打印真实树 | 可检查机器实际启动的树 |\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `ConfigRow` | Cordis config row |\n| `dsh_base()` | `dsh-base` bundle |\n| `headless_bundle` / `web_bundle` | `dsh-headless` / `dsh-web-app` |\n| `--patch` 覆盖 | `--patch` overlay / `cordis.patch.yml` |\n\n---\n[← 上一课 L19](../L19_goal_driver/README.zh.md) · [返回总览](../../README.md) · [下一课 L21 →](../L21_capstone/README.zh.md)"
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
     "body": "```powershell\npython lessons/L21_capstone/main.py\n```\n\n预期输出（节选）：\n\n```text\n========== mini-dsh 启动（headless 缩影）==========\n  [assistant] 先本地跑一条命令。\n  [tool] shell → 'mini-dsh\\nalive'\n  [assistant] 再委派一个子任务隔离上下文。\n  [tool] subagent → '子任务完成：环境正常。（子会话内 11 条事件，未回传）'\n  [assistant] 全部完成。mini-dsh 跑通了 8 层机制。\n\n========== 唯一真源：root 会话日志 ==========\n  #0 turn/start ... #15 turn/end\n  共 16 条事件。模型历史随时可从这份日志重新派生（可回放）。\n```"
    },
    {
     "name": "2. 观察输出",
     "body": "一个约 200 行的 mini-dsh 跑通了**完整流程**：pre-step 注入提醒 → 本地 shell →\n委派 subagent（子会话隔离）→ 收尾。整个过程只留下一份 16 条事件的 root 日志，\n子 agent 的中间过程留在它自己的会话——root 保持干净。"
    },
    {
     "name": "3. 为什么需要这一层",
     "body": "前 20 课每课只看一层。但真正的理解，来自看清**这些层如何插在一起**。这一课把\n8 层核心机制装进一个文件，让你亲眼看到：一次 `loop.run()` 是怎么穿过 pre-step、\nturn/step、llm seam、工具管线、subagent，同时始终把一切追加进那份唯一真源的。"
    },
    {
     "name": "4. 心智模型",
     "body": "回到最开始的锚点——**L01 那个循环从没变过**。这一课只是把 20 课的每一层\n都插到那个循环旁边：\n\n```text\n        ┌─────────────── ctx（L02）───────────────┐\n        │  llm(L08)   tools(L10/11)   ...          │\n        └──────────────────┬──────────────────────┘\n                           │\n  user_input → pre-step(L03) → AgentLoop.run（L06 turn/step）\n                                   │\n                                   ├─ derive_messages（L05）从日志投影\n                                   ├─ llm.complete（L08 seam）\n                                   ├─ tools.dispatch（L10/11 管线）\n                                   │      └─ subagent（L16 隔离子会话）\n                                   └─ 一切 append 进 Session（L04 真源）\n```"
    },
    {
     "name": "5. 方案与图",
     "body": "```text\n组装（L20 缩影）:\n  ctx.provide(\"llm\", ReplayLLM)          # L08\n  ctx.provide(\"tools\", registry+管线)     # L10/L11\n  registry.register(\"subagent\", spawn)   # L16\n\n运行:\n  loop = AgentLoop(ctx, root_session, pre_step=[reminder])   # L06 + L03\n  loop.run(task)\n     每步: derive_messages(log) → llm → tools.dispatch → append 事件   # L05/L04\n```"
    },
    {
     "name": "6. 代码拆解",
     "body": "整个文件按课号标注了每一块的来源：\n\n- `Session` + `SessionEvent`（L04）、`derive_messages`（L05）：唯一真源与投影。\n- `Context`（L02）：极简 ctx，`llm`/`tools` 挂在上面。\n- `ToolRegistry` + `dispatch`（L10/L11）：工具注册 + pre 策略（拒绝 `rm -rf`）。\n- `run_waterfall`（L03）：pre-step 注入上下文提醒。\n- `AgentLoop.run`（L06）：turn/step 驱动，全程 append 事件。\n- `make_subagent_tool`（L16）：委派子任务到独立会话，只回传结果。\n- 底部组装对照真实 `headless` profile（L20）。"
    },
    {
     "name": "7. 相对上一课新增了什么",
     "body": "不新增机制，而是**把 8 层机制整合**成一个可运行的整体，并用课号标注每块出处，\n让你看清各层如何协同。这是从\"逐层理解\"到\"整体贯通\"的收束。"
    },
    {
     "name": "8. 简化了什么 vs 真实 DeepSeek Harness",
     "body": "| 教学版（本课） | 真实 dsh（examples/headless-agent） | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| 200 行单文件 | 数十个 package 组成的插件树 | 每层独立演进、可替换、可测试 |\n| 手动组装 ctx | `dsh --profile headless` 声明式启动 | 配置驱动，多产品复用（见 L20） |\n| 内存日志 | JSONL 持久化 + checkpoint policy | 崩溃恢复、跨进程存活（见附录 X） |\n| Replay LLM | DeepSeek V4 + 真实流式 | 生产级模型能力 |\n| 只集成 8 层 | 还有 compaction/goal/jobs/skills/scope 全都在线 | 完整产品需要全部能力协同 |\n\n> **对照真实入口**：`deepseek-harness/examples/headless-agent` 的 headless profile\n> 也是\"组合 agent 主干 + 一个 root agent + 持久化 + checkpoint\"，接一个任务、跑完、\n> 打印最终文本、退出。本课就是它的教学缩影——机制等价，规模不同。\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| 整个 mini-dsh | `examples/headless-agent` 的 headless 组合 |\n| `AgentLoop` | `ctx.agentLoop`（`core/agent-loop`） |\n| 组装段 | `dsh --profile headless` |\n| root/child Session | root agent + subagent 的独立会话 |\n\n---\n🎓 **恭喜你走完 21 课！** 你已经从最小循环一路叠到多 agent 协作，理解了 dsh 的完整骨架。\n\n[← 上一课 L20](../L20_profile_bundle/README.zh.md) · [返回总览](../../README.md) · [下一课 L22 →](../L22_session_trace/README.zh.md)"
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
     "body": "```powershell\npython lessons/L22_session_trace/main.py\n```\n\n预期输出（节选）：\n\n```text\n===== read：读全部事件 + surface 三态 =====\n  #1  user/message         [shadowed ] ○被压缩遮蔽\n  #4  assistant/message    [shadowed ] ○被压缩遮蔽\n  #5  tool/call            [log-only ] ·记账事件\n  #9  user/message         [current  ] ●在模型上下文\n\n===== trace #6（一条被压缩遮蔽的 tool/result）：谁替换了它 =====\n  被替换 (replacedBy): 9  ← 摘要事件 #9\n  替换链 (replacementChain): [9]\n\n===== trace #9（那条压缩摘要）：它遮蔽了哪些事件 =====\n  它替换掉的事件 (replacedEventSeqs): [1, 2, 3, 4, 5, 6, 7]  ← 旧的 1..7\n```"
    },
    {
     "name": "2. 观察输出",
     "body": "`read` 给每条事件标了 **surface 三态**：`current`（在模型上下文）、`shadowed`（被压缩遮蔽）、\n`log-only`（记账）。`trace #4` 追出它引用的两条 chunk；`trace #6` 追出它被摘要 #9 替换；\n`trace #9` 反过来列出它遮蔽掉的旧范围 1..7。被遮蔽的事件**一条没删**，因果链随时可查。"
    },
    {
     "name": "3. 为什么需要这一层",
     "body": "前 21 课一路在讲**写侧**：往日志追加事件（L04）、投影给模型看（L05）、用压缩遮蔽旧范围（L15）。\n但从没讲**读侧**——怎么反过来查询、追溯、搜索这份日志。\n\n这正是 dsh 事件溯源设计**最受称赞**的兑现点：因为一切皆事件、日志是唯一真源，\n所以任意一条事件的因果关系都能被**显式追出来**——它从哪来（引用了哪些来源）、\n到哪去（被谁引用/替换）、现在处于什么状态。debug、审计、agent 自查历史，全靠它。"
    },
    {
     "name": "4. 心智模型",
     "body": "trace 就是给事件日志装了一套**监控回放 + 关系图谱**：\n\n```text\n写侧（前面的课）：            读侧（本课）：\n  append 事件                 read   —— 倒带看每一帧\n  deriveMessages 投影   ⇄     search —— 按关键词跳转\n  compaction 遮蔽             trace  —— 追这一帧的前因后果\n```\n\n每条事件像监控录像里的一帧：既能顺序回放，也能点开某一帧问\"它是谁触发的、后来被什么覆盖了\"。"
    },
    {
     "name": "5. 方案与图",
     "body": "```text\nfoldSurface(events) → 每条事件的 surface 态\n   log-only : 不在 SURFACE_TYPES（turn/step、tool/call、compaction/* ...）\n   shadowed : 被某条 surfaceOp:replace 覆盖（复用 L15）\n   current  : 其余 surface 事件\n\ntrace(seq):\n  sourceEventSeqs   ← 目标的顶层字段声明的来源（message 引用 chunk）\n  derivedEventSeqs  ← 扫全表，谁的顶层 sourceEventSeqs 含 seq\n   replacedEventSeqs ← 目标若是 replace 者，它盖住的范围\n   replacedBy/chain  ← 沿 replace 覆盖关系，从直接替换者追到最终替换者\n```"
    },
    {
     "name": "6. 代码拆解",
     "body": "- `fold_surface()`：给每条事件算 `current/shadowed/log-only`——和 L05/L15 同一套 surface 概念的读侧复用。\n- `SessionQuery.read()`：按 seq 范围读，附 surface 态。\n- `SessionQuery.search()`：字面量全文搜（忽略大小写），返回命中事件及其 surface 态。\n- `SessionQuery.trace()`：四条关系——`sourceEventSeqs`（引用的来源）、`derivedEventSeqs`（被谁引用）、\n  `replacedEventSeqs`（自己遮蔽了谁）、`replacedBy`+`replacementChain`（被谁一路替换）。\n- `build_session()`：造一段含 chunk→message 引用 + 一次压缩遮蔽的真实日志。"
    },
    {
     "name": "7. 相对上一课新增了什么",
     "body": "前面所有课都是\"写日志 + 投影给模型\"。本课补上**读侧对称面**：一个迷你 `sessionQuery`，\n能 read / search / trace，并显式标注 surface 三态、追出事件间的引用与替换因果链。\n它是 L04（真源）+ L05（投影规则）+ L15（shadow）三条线的读侧收束。"
    },
    {
     "name": "8. 简化了什么 vs 真实 DeepSeek Harness",
     "body": "| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |\n|---|---|---|\n| 内存扫全表搜索 | `ctx.sessionQuery` seam + SQLite provider 全文索引 | 海量历史要快速全文检索 |\n| 单个会话 | 逻辑会话语料库，跨会话、live 优先于 persisted | fork/resume 后要跨会话追溯 |\n| 三态直接算 | `foldSurface()` 与 `deriveMessages` 同一状态机，原子观测快照 | 读一致性：trace 与模型看到的必须一致 |\n| trace 直接返回 seq | `SessionEventTrace` 完整字段 + `SessionEventTraceObservation` 绑定 header | 追溯要绑定确切的会话观测版本 |\n| 无授权 | trace/search 有授权校验、封闭错误 code 分类 | 一个 agent 不能随意查别人的会话 |\n| 无面向模型工具 | 5 个工具：`session_event_read/search/trace`、`session_search`、`session_trace` | agent 能主动回查自己和历史会话 |\n\n> **对照点**：真实 dsh 里 subagent 之间不自动共享 transcript（L16），正是靠 `sessionQuery`\n> 显式追溯——父 agent 想看子会话发生了什么，用 trace 工具查，而非把子会话塞进上下文。\n\n### 教学类名 → 真实 dsh 映射\n\n| 本课 | 真实 dsh |\n|---|---|\n| `SessionQuery` | `ctx.sessionQuery`（`session-query/session-query`） |\n| `fold_surface` | `foldSurface()`（与 `deriveMessages` 共用状态机） |\n| `read` / `search` / `trace` | `session_event_read` / `session_event_search` / `session_event_trace` |\n| surface 三态 | `SessionEventSurface`：`current`/`shadowed`/`log-only` |\n| `trace` 的 chain/source | `SessionEventTrace.replacementChain` / `sourceEventSeqs` / `derivedEventSeqs` |\n\n---\n[← 上一课 L21](../L21_capstone/README.zh.md) · [返回总览](../../README.md) · [附录 X →](../X_persistence/README.zh.md)"
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
     "body": "L04 确立了\"仅追加事件日志是唯一真源\"。持久化回答的是一个**正交问题**：\n这份日志**如何落盘、何时落盘、崩溃后如何恢复**。把它塞进主线会分散对\"事件溯源\"\n本身的注意力，所以我们把它单独拎出来。\n\n好消息是：正因为 L04 把\"真源\"设计成一份仅追加日志，持久化才变得简单——\n**只要把这份日志逐字节存下来，恢复时重新加载 + `deriveMessages`（L05）即可。**\n持久化不需要理解业务语义，它只搬运事件。"
    },
    {
     "name": "三个核心问题",
     "body": "**① 存什么**\n\n存那份仅追加的 `SessionEvent` 日志本身，逐字节、无损。因为每条事件都是 lossless JSON、\n`seq` 连续，所以可以直接序列化成 JSONL（一行一个事件），无需额外结构。\n\n```text\nsession-abc.jsonl\n  {\"seq\":0,\"type\":\"turn/start\",\"data\":{\"turn\":0}}\n  {\"seq\":1,\"type\":\"user/message\",\"data\":{\"content\":\"...\"}}\n  {\"seq\":2,\"type\":\"assistant/message\",\"data\":{...}}\n  ...\n```\n\n**② 何时 flush**\n\n不是每条事件都立刻落盘（太慢），也不能攒太久（崩溃丢太多）。真实 dsh 由\n`dsh-session-checkpoint-policy` 拥有\"每请求的持久化检查点\"——在合适的边界\n（如一次模型请求完成）把新事件刷盘。agent loop **不**在 turn 边界等待 flush；\n需要读存储的消费方在 `whenIdle()` 后自己 flush。\n\n**③ 崩溃后如何恢复**\n\n重新加载 JSONL → 得到事件列表 → `deriveMessages`（L05）投影出模型历史 → 继续。\n因为日志是唯一真源且仅追加，恢复不需要\"重放业务逻辑\"，只需重新加载事件。\n\n```text\n崩溃 → 重启 → 读 session-abc.jsonl → 事件列表 → deriveMessages → 继续对话\n              （seq 连续性校验：确保没缺页）\n```"
    },
    {
     "name": "与主线各课的关系",
     "body": "| 主线机制 | 持久化如何依赖它 |\n|---|---|\n| L04 仅追加日志 | 持久化只需搬运这份日志；仅追加保证可逐字节存储 |\n| L05 deriveMessages | 恢复时用它从加载的事件重建模型历史 |\n| L15 compaction | 压缩是\"追加 replace 事件\"，持久化照样存；恢复后 shadow 仍生效 |\n| L02 可逆注册 | 持久化后端是一个 provider，可换（本地 JSONL / 数据库 / 远程） |"
    },
    {
     "name": "简化了什么 vs 真实 DeepSeek Harness",
     "body": "| 概念对照 | 真实 dsh | 为什么需要 |\n|---|---|---|\n| 逐字节存日志 | 持久化 seam + 多后端（JSONL / 其他） | 后端可换，测试用内存、生产用磁盘 |\n| 每请求 checkpoint | `dsh-session-checkpoint-policy` | 平衡\"落盘频率\"与\"崩溃丢失量\" |\n| seq 连续性 | 运行时不变式断言 + `session/end-seed` 标记 | 区分 seed 历史（resume/fork）与本次 live 事件 |\n| 简单重载 | fork / resume 从存储重建，冷恢复子 agent | 会话可分叉、可跨会话恢复 |"
    },
    {
     "name": "想深入？",
     "body": "阅读官方文档（以源码为准）：\n\n- `deepseek-harness/docs/subsystems/persistence.md` — 持久化 seam 与后端\n- `deepseek-harness/docs/subsystems/session.md` — 日志与 `firstLiveSeq`/`session/end-seed`\n- `deepseek-harness/docs/subsystems/storage.md` — 存储抽象\n\n---\n[← 上一课 L21](../L21_capstone/README.zh.md) · [返回总览](../../README.md)"
    }
   ],
   "code": "",
   "locPct": 0
  }
 ],
 "readme": "# learn-dsh：拆解 DeepSeek Harness\n\n> 仿照 [learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) 的渐进式教学风格，\n> 但**主线来自 DeepSeek Harness 自己的架构分层**，而不是照搬那 12 课。\n\n## 这门课教什么\n\nDeepSeek Harness（下称 **dsh**）的世界观和\"一个 while 循环里不断加东西\"截然不同。\n它的骨架只有几条：\n\n- **一切皆插件（Cordis）**：没有可打补丁的\"特权核心\"。模型适配器、工具注册表、\n  会话日志、甚至 agent loop 本身都是插件，向共享的 `ctx` 贡献服务、类型化事件和可回退副作用。\n- **仅追加的 SessionEvent 日志是唯一真源**：模型看到的历史不是单独存的，\n  而是用 `deriveMessages()` 从事件日志**投影**出来的。\"模型可见即已记录\"。\n- **Turn / Step 轮次**：`step` = 一次模型请求 + 它触发的工具调用；`turn` = 零或多个 step。\n- **能力 seam**：一个可替换能力 = interface + implementation + consumer 三角色。\n  换一个 provider 就能整体换掉产品的一块能力。\n- **可选能力挂在 seam 上，不进 loop 主干**：subagent、compaction、skills、jobs、goal\n  都是可选能力，各自是独立机制，不属于 agent loop 核心。\n\n**和 learn-claude-code 最本质的区别**：原版是\"循环不变、能力层层叠加\"；\ndsh 是\"**内核极薄、一切经由插件树 + 事件 + seam 组合**\"。\n所以本课主线不是\"往循环里塞功能\"，而是\"**先立起 Cordis 插件/事件/seam 这套骨架，\n再逐层把每个能力作为插件挂上去**\"。\n\n## 四阶段地图\n\n```text\n阶段一：内核骨架          阶段二：会话即真源\n  L01 最小 Agent Loop       L04 仅追加事件日志\n  L02 Cordis 插件+可逆注册    L05 deriveMessages 投影\n  L03 四种事件分发           L22 显式 Trace 查看（读侧对称面，扩展课）\n\n阶段三：轮次与模型边界      阶段四：作用域与工具\n  L06 Turn/Step 生命周期     L09 Scope 与 shadowing\n  L07 pre-step 拦截          L10 工具注册表\n  L08 LLM 适配器与流式        L11 工具执行管线与策略\n                            L12 能力 seam\n                            L13 System Prompt 装配\n\n阶段五：上下文可持续        阶段六：委派与并发\n  L14 Skills 按需加载        L16 Subagent 上下文隔离\n  L15 Compaction 压缩        L17 Jobs 后台任务\n                            L18 持久 Goal 领域\n                            L19 Goal Round Driver\n\n阶段七：组装成产品\n  L20 Profile / Bundle\n  L21 Capstone 合成 mini-dsh\n  附录 X 持久化/flush/崩溃恢复（仅讲义，无代码）\n\n> 注：L22「显式 Trace」编号在末尾，但概念上属于阶段二（会话即真源）的读侧扩展，\n> 依赖 L04 / L05 / L15，建议学完这三课后再看。\n```\n\n## 22 课 motto 一览\n\n| 课 | 主题 | Motto |\n|---|---|---|\n| L01 | 最小 Agent Loop | 一个循环 + 一次模型调用 + 一个工具，就是 agent 的胚胎 |\n| L02 | Cordis 插件 + 可逆注册 | 不改核心，只在旁边挂插件；每个注册都能被回退 |\n| L03 | 四种事件分发 | 能力调用走 `ctx.<service>`，观察/拦截/策略走事件 |\n| L04 | 仅追加事件日志 | 不存消息历史，只存事件；一切皆可回放 |\n| L05 | deriveMessages 投影 | 模型看到的是投影，不是存储；模型可见即已记录 |\n| L06 | Turn/Step 生命周期 | step=一次请求+其工具；turn=零或多个 step，跑完才关 |\n| L07 | pre-step 拦截 | 用 waterfall 在请求前改写或拒绝要进模型的消息 |\n| L08 | LLM 适配器与流式 | 模型本身也是可替换的 provider |\n| L09 | Scope 与 shadowing | 同名最具体者胜；作用域是 per-agent 人格的根 |\n| L10 | 工具注册表 | 加一个工具，只加一个定义，循环不用动 |\n| L11 | 工具执行管线与策略 | pre→guard→execute→post→result，策略挂在管线上而非工具里 |\n| L12 | 能力 seam | 换一个 provider，就换掉产品的一整块能力 |\n| L13 | System Prompt 装配 | 提示词不是一段字符串，是各插件贡献的段落 + 工具 schema |\n| L14 | Skills 按需加载 | 用到什么知识再加载什么 |\n| L15 | Compaction 压缩 | 日志从不删除，只追加一条 replace 事件把旧范围移出 surface |\n| L16 | Subagent 隔离 | 每个子任务一份干净的上下文，只回传结果 |\n| L17 | Jobs 后台任务 | Jobs 管生命周期，控制器负责把完成事实重新交回 Agent |\n| L18 | 持久 Goal 领域 | 给会话挂一个持久目标，它是状态不是调度器 |\n| L19 | Goal Round Driver | 目标未完成就再开一轮，直到完成或阻塞 |\n| L20 | Profile / Bundle | 产品 = 有序层叠的插件树，任意一行都能被 patch 替换 |\n| L21 | Capstone | 所有机制合一，对照真实 harness 看每层如何插在一起 |\n| L22 | 显式 Trace 查看 | 一切皆事件，所以一切皆可显式回溯 |\n\n## 怎么跑\n\n需要 Python 3.10+，**无需 API key、无需联网**：每课内置一个确定性的 Replay LLM。\n\n```powershell\n# 从任意一课开始，每个文件都能独立运行\npython lessons/L01_agent_loop/main.py\npython lessons/L05_derive_messages/main.py\npython lessons/L21_capstone/main.py\npython lessons/L22_session_trace/main.py\n```\n\n## 网页版（推荐阅读方式）\n\n讲义 + 源码另有一个**纯静态**网页版，形式类似 learn.shareai.run：\n左侧按阶段分组导航，右侧课程时间线，点进去可切\"讲义 / 源码\"双标签。\n\n```powershell\npython site/build_site.py          # 改过讲义后重新生成数据\nstart site/index.html              # 双击也行，file:// 就能跑\n```\n\n零依赖、不需要 Node/npm、不需要联网。详见 [site/README.md](site/README.md)。\n\n想接真实模型？需要**显式**开启（默认永远走 Replay，避免测试意外联网）：\n\n```powershell\n$env:DSH_LIVE = \"1\"                                   # 必须显式开启；缺 key 会直接报错\n$env:DEEPSEEK_API_KEY = \"sk-...\"\n$env:DEEPSEEK_BASE_URL = \"https://api.deepseek.com\"   # 可选\n$env:DEEPSEEK_MODEL = \"deepseek-chat\"                 # 可选，默认 deepseek-chat\npip install requests                                   # 真实模型路径依赖\n# 开启后任意\"会调模型\"的课都会走真实 API（缺 key 会直接报错）。\n# 但请注意下面的局限：工具型 agent 课（L01/L21 等）不保证复现工具流程。\npython lessons/L01_agent_loop/main.py\n```\n\n> **真实模型路径是可选彩蛋，定位有限，别期望它端到端跑工具**：\n> - 它只证明\"Replay 与真实 DeepSeek 是同一个 seam 的两个 provider\"，并能做**纯文本**对话。\n> - 本课的工具调用用的是**教学格式**（`{id,name,arguments}`），不是 DeepSeek/OpenAI 的\n>   wire-format；各课也没把工具 schema 传给真实模型。所以像 L01/L21 这类工具型 agent，\n>   真实模型**不保证**复现 Replay 的工具流程。把这条链路做成 API 兼容会引入大量适配复杂度，\n>   偏离\"离线教学\"的初衷，故有意不做。**要完整体验工具型 agent，请用默认的 Replay。**\n> - `DeepSeekLLM.stream()` 是\"先 complete 再切片\"的**模拟流式**，不是真 SSE。\n\n## 课程定位（重要）\n\n本课分两种形态，别用同一把尺子衡量：\n\n- **L01–L13 是\"渐进式主干\"**：概念上后一课在前一课基础上叠一层，主线连续。\n- **L14–L22 是\"能力实验室\"**：每课聚焦一个可选能力（Skills / Compaction / Subagent /\n  Jobs / Goal / Trace 等），为了让单课能独立读懂、独立运行，各自搭建该机制的最小上下文，\n  **不强求与上一课代码逐行 diff**。真实 dsh 里这些能力也是各自独立的 seam/包。\n- **L21 Capstone** 整合的是\"核心主干\"那 8 层（ctx / 事件 / 日志 / 投影 / turn-step /\n  llm seam / 工具管线 / subagent），不是全部 22 层——它是 headless profile 的教学缩影。\n\n## 每课讲义结构\n\n每课 `README.zh.md` 固定八段，**先跑再讲**：\n\n1. **Motto** — 一句话主旨\n2. **30 秒运行** — 命令 + 预期输出\n3. **观察输出** — 你刚才看到了什么\n4. **问题** — 为什么需要这一层\n5. **心智模型** — 用一个比喻建立直觉\n6. **方案与图** — ASCII/流程图\n7. **代码拆解** — 最小实现讲解\n8. **相对上一课新增 + 简化了什么 vs 真实 dsh** — 附\"教学类名 → 真实 `ctx` 服务/事件/包\"映射表\n\n## 重要免责声明\n\n**本课的教学代码是玩具，不是 dsh 的真实实现。** dsh 本体用 TypeScript + Cordis 编写；\n本课用 Python 让机制短小易读。每课第 8 段都会明确标出：本课简化了什么、真实工程里\n那一层复杂度为什么必要。**一切以官方文档和源码为准**（见 `deepseek-harness/docs/`）。\n"
};
