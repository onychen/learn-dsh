# L12 能力 seam：interface / implementation / consumer

> **Motto：换一个 provider，就换掉产品的一整块能力。**

## 1. 30 秒运行

运行前先猜：`ShellTool` 是否应该根据 provider.name 写 `if local / if sandbox`？如果 consumer
需要知道实现类型，这条 seam 还算成立吗？沙箱审计日志又应该属于 tool 还是 provider？

```powershell
python lessons/L12_capability_seam/main.py
```

预期输出（节选）：

```text
--- provider = local（真执行）---
  结果: 'capability\nseam\ndemo'

--- provider = sandbox（假远程沙箱，consumer 一行没改）---
  结果: "[sandbox] 已在远程隔离环境模拟执行: 'echo capability seam demo'（宿主机未受影响）"
  沙箱审计日志: ['echo capability seam demo']

→ 换 provider 就换掉了整块 shell 能力，ShellTool 代码完全没动。
```

## 2. 观察输出

同一个 `ShellTool`（consumer），先接本地执行器，再接假沙箱执行器——**代码一行没改**，
行为却从"真在本机跑"变成"送去远程隔离环境"。这就是 seam 的威力。

## 3. 为什么需要这一层

其实 L08 的 `ctx.llm` 就是一个 seam，我们只是没点破。这一课正式把这个模式讲清楚，
因为它是 dsh"一切皆可替换"的核心机制。

真实产品需要：本地开发用本机 shell、云端部署用远程沙箱、测试用假执行器——
如果 shell 工具直接写死 `subprocess.run`，这些切换就得改工具代码。
**seam 把"接口"和"实现"分开，consumer 只依赖接口，换实现就换能力。**

## 4. 心智模型

seam 就是 **USB 接口标准**：

<!-- dsh:structure id=seam-usb-structure title="能力 seam 就像 USB 标准" -->
- **ShellExecutor 接口** — 只约定 `run(command)`，相当于稳定的 USB 口。
  - **LocalExecutor** — 在本机真实执行命令。
  - **SandboxExecutor** — 把同一请求送进隔离沙箱。
  - **未来 provider** — 只要遵守接口，就能无缝替换。
- **ShellTool consumer** — 只依赖 ShellExecutor，不知道实际插入了哪个 provider。
<!-- /dsh:structure -->

## 5. 方案与图

<!-- dsh:flow id=seam-roles title="Provider 实现契约，Consumer 只面向契约调用" variant=map -->
| ID | 节点 | 说明 | 下一步 | 位置 | 类型 |
|---|---|---|---|---|---|
| local | LocalShellExecutor | 用本机 subprocess 实现同一份 run 契约。 | interface[实现] | 1,1 | |
| sandbox | FakeSandboxExecutor | 用隔离执行世界实现相同契约。 | interface[实现] | 1,2 | |
| future | 未来 Provider | 新 provider 只需遵守契约即可接入。 | interface[实现] | 1,3 | |
| interface | ShellExecutor Interface | 稳定约定 run(command)→str，不包含部署细节。 | service | 2,2 | boundary |
| service | ctx.shell | profile 选择一个 provider，把能力认领到稳定服务位。 | consumer | 3,2 | state |
| consumer | ShellTool Consumer | 只注入 ctx.shell 并调用 run，不知道当前 provider 是谁。 | - | 4,2 | terminal |
<!-- /dsh:flow -->

### 执行透视：替换 provider 时哪一层发生变化

<!-- dsh:trace id=l12-runtime-xray title="同一个 ShellTool 的两次调用" -->
| 步骤 | 执行位置 | 发生什么 | Interface 契约 | 当前 Provider 世界 | Consumer 代码 |
|---|---|---|---|---|---|
| 构造本地工具 | `ShellTool(LocalShellExecutor())` | 本地实现注入 consumer。 | `run(command) -> str` | 宿主机 subprocess。 | `call → executor.run` 不变。 |
| 本地调用 | `tool_local.call` | 命令经接口抵达 run_shell。 | 契约满足。 | 真实执行并返回输出。 | 不检查 provider 类型。 |
| 构造沙箱工具 | `ShellTool(FakeSandboxExecutor())` | 只替换注入对象。 | 同一契约。 | 隔离环境 + audit_log。 | 完全相同的 ShellTool。 |
| 沙箱调用 | `tool_sandbox.call` | 命令被记录并生成模拟结果。 | 返回仍是 str。 | 宿主机没有执行命令。 | 无分支、无改动。 |
| 观察审计 | `sandbox.audit_log` | provider 暴露实现特有运维状态。 | 不属于公共 run 契约。 | 只有沙箱拥有。 | ShellTool 无需消费。 |
<!-- /dsh:trace -->

## 6. 代码拆解

- `ShellExecutor`：**interface**（Service Definition），只约定 `run(command)`。
- `LocalShellExecutor` / `FakeSandboxExecutor`：两个 **implementation**（Provider）。后者带审计日志，模拟远程隔离。
- `ShellTool`：**consumer**，构造时注入一个 `ShellExecutor`，只调 `.run()`，不关心具体实现。
- main 里换一个 provider，`ShellTool` 行为立变——代码零改动。

### 动手破坏一次

让 `ShellTool.call` 使用 `isinstance` 区分两个 provider。添加第三个实现时就必须修改 consumer，
这验证：**consumer 只能依赖接口语义；实现特有分支一旦进入 consumer，seam 就被击穿。**

## 7. 代码解读：三角色怎样把替换范围限制在组装点

<!-- dsh:code-walkthrough id=l12-code-reading title="interface、provider、consumer 的依赖方向" source=main.py -->
| 阶段 | 行号 | 读代码 | 设计原因 |
|---|---|---|---|
| Interface 只描述可观察行为 | 32-38 | ShellExecutor 声明 name 与 run(command)，默认实现只抛 NotImplementedError。 | 接口不携带进程、网络或审计细节，才能同时描述本地和远程执行世界。 |
| 本地 provider 封装真实副作用 | 44-50 | LocalShellExecutor 把公共 run 契约适配到 shared.run_shell。 | 平台差异和 subprocess 细节停留在 provider 内，不扩散到工具或 Agent Loop。 |
| 沙箱 provider 拥有另一套状态 | 53-67 | FakeSandboxExecutor 维护 audit_log，run 只记录命令并返回隔离结果。 | 实现可以拥有私有状态与安全模型，只要公共输入输出不变，consumer 就无需感知。 |
| Consumer 只转发到接口 | 73-80 | ShellTool 构造时接收 ShellExecutor，call 中只有一行 `executor.run`。 | 依赖箭头从 consumer 指向 interface，而非具体 provider；替换范围缩小到依赖组装点。 |
| 入口通过注入选择执行世界 | 83-96 | 两次构造只替换 executor，随后调用相同的 `tool.call(command)`。 | 产品配置决定实现，业务代码不决定。真实 profile/bundle 正是把这个组装点声明化。 |
<!-- /dsh:code-walkthrough -->

## 8. 相对上一课新增了什么

前面的能力（llm、shell）都是"用着但没点破"。本课把 **seam 三角色
（interface / implementation / consumer）** 正式讲清，并做一个可切换的 provider demo，
把"换 provider 就换能力"从概念变成可运行的证据。

## 9. 简化了什么 vs 真实 DeepSeek Harness

| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |
|---|---|---|
| Python 抽象类 | Cordis `Service`（abstract class），认领 `ctx.<key>` | 服务有生命周期、类型词汇、依赖注入 |
| 手动 new + 注入 | provider 注册进 `ctx`，consumer 用 `inject` 找 | 组合由 profile/bundle 决定（见 L20） |
| 只有 shell | fs / subprocess / llm / subagent / compaction 都是 seam | 每块能力独立可换 |
| 单一实现选一个 | subagent 允许**多个**同类 provider 按名注册 | 一个 agent 可同时用 spawn/fork/codex 等 |
| 假沙箱 | fs + subprocess 共享执行世界，一起换成 E2B 远程沙箱 | 换一处，Bash/PTY/LSP 全跟着搬，无需 fork provider |

### 教学类名 → 真实 dsh 映射

| 本课 | 真实 dsh |
|---|---|
| `ShellExecutor` | `ShellExecutor`（`dsh-shell` Service Definition，`ctx.shell`） |
| `LocalShellExecutor` | `dsh-bash-local` |
| `FakeSandboxExecutor` | `dsh-bash-sandbox` / E2B provider |
| `ShellTool` | `dsh-tool-bash`（consumer） |

---
[← 上一课 L11](../L11_tool_pipeline/README.zh.md) · [返回总览](../../README.md) · [下一课 L13 →](../L13_system_prompt/README.zh.md)
