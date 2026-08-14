# L12 能力 seam：interface / implementation / consumer

> **Motto：换一个 provider，就换掉产品的一整块能力。**

## 1. 30 秒运行

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

```text
        interface（USB 口规范）：ShellExecutor.run(cmd)
              ▲                    ▲                ▲
       LocalExecutor       SandboxExecutor    (未来的其他实现)
       （本机 U 盘）        （网盘映射）
              
       consumer（电脑）：ShellTool —— 只认 USB 口，插什么都能用
```

## 5. 方案与图

```text
       ① interface: ShellExecutor.run(command) -> str
              │ 被这些实现
       ┌──────┴───────────┐
   ② LocalShellExecutor   FakeSandboxExecutor
       │真 subprocess      │记录 + 模拟
       └──────┬───────────┘
              │ 被这个消费
       ③ ShellTool(executor)   ← 只注入 interface，不知道是哪个实现
```

## 6. 代码拆解

- `ShellExecutor`：**interface**（Service Definition），只约定 `run(command)`。
- `LocalShellExecutor` / `FakeSandboxExecutor`：两个 **implementation**（Provider）。后者带审计日志，模拟远程隔离。
- `ShellTool`：**consumer**，构造时注入一个 `ShellExecutor`，只调 `.run()`，不关心具体实现。
- main 里换一个 provider，`ShellTool` 行为立变——代码零改动。

## 7. 相对上一课新增了什么

前面的能力（llm、shell）都是"用着但没点破"。本课把 **seam 三角色
（interface / implementation / consumer）** 正式讲清，并做一个可切换的 provider demo，
把"换 provider 就换能力"从概念变成可运行的证据。

## 8. 简化了什么 vs 真实 DeepSeek Harness

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
