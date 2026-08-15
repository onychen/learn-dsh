# L02 Cordis：一切皆插件 + 可逆注册

> **Motto：不改核心，只在旁边挂插件；每个注册都能被回退。**

## 1. 30 秒运行

运行前先猜：如果先挂载 `tools`、后挂载它依赖的 `shell`，系统应该默默等待、运行时报错，
还是在启动阶段立即拒绝？再想一想：为什么卸载顺序必须与注册顺序相反？

```powershell
python lessons/L02_cordis_plugins/main.py
```

预期输出（节选）：

```text
[boot] 挂载插件 llm
  [ctx] 提供服务 ctx.llm
[boot] 挂载插件 shell
  [ctx] 提供服务 ctx.shell
[boot] 挂载插件 tools
  [ctx] 提供服务 ctx.tools
  [tools] 注册工具 shell
[boot] 挂载插件 agent-loop
  [ctx] 提供服务 ctx.agent_loop

[boot] 插件树就绪，运行 agent
...
[boot] 卸载所有插件（逆序）
  [ctx] 卸载服务 ctx.agent_loop
  [tools] 注销工具 shell
  [ctx] 卸载服务 ctx.tools
  [ctx] 卸载服务 ctx.shell
  [ctx] 卸载服务 ctx.llm
```

## 2. 观察输出

agent 干的活和 L01 一模一样。但**启动方式变了**：不再是调一个函数，
而是往 `ctx` 上依次挂 4 个插件，每个插件认领一个服务。结尾还演示了
**逆序卸载**——每个注册都被干净回退了。

## 3. 为什么需要这一层

L01 的循环把 llm、tools、shell 全焊死在一起。想换模型？改函数。想加权限？改函数。
**一切改动都得动核心。**

dsh 的答案是：**没有核心可动。** 每一块都是插件，向共享 `ctx` 贡献服务；
要扩展，就在旁边挂一个新插件。而且每个注册都是**可逆副作用**——
插件卸载时，它装的东西（服务、工具、监听器）都能预测地回退。

## 4. 心智模型

把 `ctx` 想成一块**公告板 + 一个仓库**：

<!-- dsh:structure id=ctx-service-structure title="插件通过 ctx 共享服务" -->
- **ctx（服务仓库）** — 按稳定的 key 保存已经就绪的能力。
  - **ctx.llm** — 由 llm 插件提供。
  - **ctx.shell** — 由 shell 插件提供。
  - **ctx.tools** — tools 插件注入 shell 后提供工具注册表。
  - **ctx.agent_loop** — agent-loop 插件注入 llm 与 tools 后提供循环。
<!-- /dsh:structure -->

插件不互相 import，而是**按 key 找服务**。谁依赖谁，用 `inject` 声明，
`ctx` 保证依赖就绪后才 `apply`。

## 5. 方案与图

<!-- dsh:flow id=plugin-lifecycle title="挂载建立能力，卸载沿 effect 栈反向回退" variant=map -->
| ID | 节点 | 说明 | 下一步 | 位置 | 类型 |
|---|---|---|---|---|---|
| register | ctx.plugin(P) | 提交一个带 inject 声明和 apply 的插件。 | deps | 1,1 | |
| deps | 检查 inject | 所有依赖服务就绪后才能执行插件代码。 | apply[齐全], error[缺失] | 2,1 | decision |
| apply | P.apply(ctx) | 插件开始提供服务并注册其他副作用。 | effects | 3,1 | |
| effects | Effect 栈 | 每次 provide/effect 都登记对应 disposer。 | running | 4,1 | state |
| running | 运行期 | 能力保持可用；卸载不是挂载后的自动下一步。 | unload[外部触发卸载] | 5,1 | |
| unload | 开始卸载 | 停止插件并进入回退阶段。 | dispose | 5,3 | boundary |
| dispose | 逆序调用 disposer | 后注册的副作用先撤销，依赖关系不会被提前拆掉。 | clean | 4,3 | |
| clean | 回到挂载前状态 | 服务和副作用都已移除。 | - | 3,3 | terminal |
| error | 拒绝挂载 | 依赖缺失时不运行 apply，也不留下半成品。 | - | 2,3 | terminal |
<!-- /dsh:flow -->

### 执行透视：一次插件启动如何变成可回退的服务树

<!-- dsh:trace id=l02-runtime-xray title="从挂载 provider 到逆序卸载" -->
| 步骤 | 执行位置 | 发生什么 | ctx 服务表 | Effect / disposer 栈 | 依赖判定 |
|---|---|---|---|---|---|
| 创建容器 | `ctx = Context()` | 初始化空服务表和 disposer 栈。 | `{}` | `[]` | 尚无依赖可满足。 |
| 提供基础能力 | `ctx.plugin(llm)` 与 `ctx.plugin(shell)` | 两个 provider 分别认领稳定 key。 | `{llm, shell}` | `[dispose(llm), dispose(shell)]` | `tools.inject=[shell]` 已满足。 |
| 注册工具 | `tools_plugin()` | 提供工具表，并用 effect 注册 shell handler。 | `{llm, shell, tools}` | `[…, dispose(tools), unregister(shell-tool)]` | `agent-loop.inject=[llm,tools]` 已满足。 |
| 提供循环 | `agent_loop_plugin()` | 循环改为经 ctx 读取模型和工具。 | `{llm, shell, tools, agent_loop}` | `[…, dispose(agent_loop)]` | 插件树就绪。 |
| 执行任务 | `ctx.agent_loop(...)` | consumer 经服务 key 串起模型、工具和 shell。 | 服务表不变。 | 栈不变；运行不注册副作用。 | 依赖只在挂载期校验一次。 |
| 逆序卸载 | `ctx.unload_all()` | 从最后一个 disposer 开始回退。 | `agent_loop → tools → shell → llm` 依次消失。 | 栈从尾到头清空。 | consumer 总在 provider 之前移除。 |
<!-- /dsh:trace -->

## 6. 代码拆解

- `Context.provide(key, svc)`：认领一个 `ctx.<key>`，返回 disposer。这是"可逆注册"的最小形态。
- `Context.effect(setup)`：执行 setup、登记它返回的 disposer。对应真实 `ctx.effect()`。
- `Context.plugin(plug)`：挂载前检查 `inject` 依赖是否就绪，再 `apply`。
- `Context.unload_all()`：**逆序**调用所有 disposer——保证 teardown 顺序正确。

4 个插件把 L01 拆开：`llm_plugin`、`shell_plugin`、`tools_plugin`（`inject=["shell"]`）、
`agent_loop_plugin`（`inject=["llm","tools"]`）。循环逻辑没变，只是改成通过 `ctx` 找服务。

### 动手破坏一次

把入口处 `shell` 与 `tools` 的挂载顺序调换，观察启动阶段直接失败。再把 `unload_all()` 中的
`reversed` 去掉，思考为什么 provider 可能先于消费者消失。这验证：**依赖先就绪，卸载按
依赖反方向进行。**

## 7. 代码解读：服务是怎样被注册、消费并回退的

<!-- dsh:code-walkthrough id=l02-code-reading title="迷你 Cordis 的完整生命周期" source=main.py -->
| 阶段 | 行号 | 读代码 | 设计原因 |
|---|---|---|---|
| 认领服务并生成撤销动作 | 40-53 | `provide` 拒绝重名 key，再保存 service；内部 `dispose` 只删除仍指向同一对象的注册。 | 身份检查避免旧插件卸载时误删后来替换的新 provider。注册与回退在同一处定义，副作用才不会只进不出。 |
| 把任意副作用纳入生命周期 | 62-80 | `effect` 保存 setup 返回的 disposer；`plugin` 校验 inject；`unload_all` 逆序回放撤销函数。 | 服务和工具注册本质上都是副作用。统一 disposer 栈后，reload、测试隔离和异常清理才有同一语义。 |
| 工具插件通过服务组合能力 | 105-124 | 工具表由本插件提供，shell handler 在执行时读取 `ctx.shell`；注册动作同时定义注销动作。 | consumer 依赖接口 key，而不是具体实现函数。替换 shell provider 时，工具插件无需修改。 |
| 循环只消费抽象服务 | 127-151 | Agent Loop 从 `ctx.llm` 请求模型，从 `ctx.tools` 查 handler，自己不创建模型也不 import shell。 | 核心循环只负责调度。能力的创建、选择和生命周期全部留在插件树，才真正做到“不改核心”。 |
| 启动顺序就是依赖拓扑 | 167-181 | 入口先挂基础 provider，再挂 consumer；运行结束后统一卸载。错误顺序会被 inject 校验拒绝。 | 把配置错误提前到启动期，比任务执行一半才报缺服务更容易定位，也不会留下半完成副作用。 |
<!-- /dsh:code-walkthrough -->

## 8. 相对上一课新增了什么

L01 的三块（循环/工具/模型）从"写死在一个函数"变成了"**四个向 ctx 贡献服务的插件**"。
新增了三个 Cordis 核心概念：**服务（`ctx.<key>`）、依赖声明（`inject`）、可逆注册（`effect`/disposer）**。

## 9. 简化了什么 vs 真实 DeepSeek Harness

| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |
|---|---|---|
| 手写 40 行 `Context` | 完整的 Cordis 框架（vendored） | 类型化服务、生命周期、reload、隔离 realm 都要框架支撑 |
| `provide` + 属性访问 | `Service` 子类 / 带 `inject` 的函数插件，Cordis 挂载其生命周期 | 服务有 start/stop、依赖图、热重载 |
| `inject` 只查存在性 | `inject` 驱动加载顺序，服务未就绪则插件挂起等待 | 大插件树的启动顺序由依赖表达，而非手工排序 |
| `effect` 就是登记 disposer | `ctx.effect()` + Cordis helper，按 scope 生命周期自动回退 | 卸载/reload 要精确 unwind 大量注册 |
| 事件？本课还没有 | 插件间还靠**类型化事件**通信（emit/waterfall/parallel/serial） | 观察、拦截、策略组合都走事件（见 L03） |

> **关键澄清**（两位审查者都强调）：插件间**不是**"只能通过事件通信"。正确原则是——
> **直接能力调用走 `ctx.<service>`，观察/拦截/策略组合才走事件**。本课演示的是前者（服务调用），
> L03 演示后者（事件）。

### 教学类名 → 真实 dsh 映射

| 本课 | 真实 dsh |
|---|---|
| `Context` | Cordis `Context`（`vendor/cordis`） |
| `ctx.provide(key, svc)` | 服务认领 `ctx.<key>` |
| `Plugin.inject` | 插件 `inject` 字段 |
| `ctx.effect(setup)` | `ctx.effect()` 可逆副作用 |
| `unload_all()` 逆序回退 | 插件卸载/reload 的 disposer unwind |

---
[← 上一课 L01](../L01_agent_loop/README.zh.md) · [返回总览](../../README.md) · [下一课 L03 →](../L03_event_dispatch/README.zh.md)
