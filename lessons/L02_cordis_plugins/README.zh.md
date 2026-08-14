# L02 Cordis：一切皆插件 + 可逆注册

> **Motto：不改核心，只在旁边挂插件；每个注册都能被回退。**

## 1. 30 秒运行

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

<!-- dsh:flow id=plugin-lifecycle title="插件挂载与回退" -->
| ID | 节点 | 说明 | 下一步 |
|---|---|---|---|
| register | 注册插件 | 调用 `ctx.plugin(P)` | deps |
| deps | 检查依赖 | 确认 `P.inject` 声明的服务已经就绪 | apply[依赖齐全], error[依赖缺失] |
| apply | 应用插件 | 执行 `P.apply(ctx)` | effects |
| effects | 登记副作用 | `provide/effect` 都返回 disposer | unload |
| unload | 卸载 | 逆序调用 disposer，干净回退 | - |
| error | 拒绝挂载 | 报告依赖未就绪，不产生半成品状态 | - |
<!-- /dsh:flow -->

## 6. 代码拆解

- `Context.provide(key, svc)`：认领一个 `ctx.<key>`，返回 disposer。这是"可逆注册"的最小形态。
- `Context.effect(setup)`：执行 setup、登记它返回的 disposer。对应真实 `ctx.effect()`。
- `Context.plugin(plug)`：挂载前检查 `inject` 依赖是否就绪，再 `apply`。
- `Context.unload_all()`：**逆序**调用所有 disposer——保证 teardown 顺序正确。

4 个插件把 L01 拆开：`llm_plugin`、`shell_plugin`、`tools_plugin`（`inject=["shell"]`）、
`agent_loop_plugin`（`inject=["llm","tools"]`）。循环逻辑没变，只是改成通过 `ctx` 找服务。

## 7. 相对上一课新增了什么

L01 的三块（循环/工具/模型）从"写死在一个函数"变成了"**四个向 ctx 贡献服务的插件**"。
新增了三个 Cordis 核心概念：**服务（`ctx.<key>`）、依赖声明（`inject`）、可逆注册（`effect`/disposer）**。

## 8. 简化了什么 vs 真实 DeepSeek Harness

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
