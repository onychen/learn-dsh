# L19 Goal Round Driver：自动续跑

> **Motto：目标未完成就再开一轮，直到完成或阻塞。**

## 1. 30 秒运行

```powershell
python lessons/L19_goal_driver/main.py
```

预期输出（节选）：

```text
===== 场景 A：目标需要 3 步完成，driver 通过 steer 自动续跑 =====
  [round 1] agent 干活……剩余 2 步
    [turn-stopping:budget] 预算充足，不干预（不 steer）
    [turn-stopping:goal] 目标未完成 → agent.steer('继续推进目标：修绿所有测试')（写 steering，不返回决策）
  → inbox 有 steering，loop 续跑下一 step
  ...
  [round 3] 目标达成 → complete
    [turn-stopping:goal] 目标 complete → 不 steer，turn 将关闭
  → inbox 为空，turn 关闭

===== 场景 B：目标中途被阻塞 → 不再 steer，turn 关闭 =====
  [round 2] 遇到需要人工批准的操作 → blocked
  → inbox 为空，turn 关闭
```

## 2. 观察输出

场景 A 里，agent 每到停止边界，goal 监听器就**调 `agent.steer(...)` 写入一条续跑输入**
（不是返回 `{stop:False}`），loop 因为 inbox 里有 steering 就再跑一步，直到目标 complete
时不再 steer、inbox 为空、turn 关闭。场景 B 里目标一 blocked，监听器就不再 steer。

## 3. 为什么需要这一层

L18 有了目标状态，但**状态自己不会动**。谁在目标没完成时把 agent"再踹一轮"？

这就是 Goal Round Driver。它挂在 **`agent/turn-stopping`** 这个停止边界上。
但要害是它的**真实机制**（此前版本讲错了，本次已修正）：`agent/turn-stopping` 虽然是
serial 事件，**监听器却返回 `void`**——它不是"对 stop 布尔值投票"。想让 turn 继续的监听器
调用 `agent.steer(...)` 写入真实 steering（一个副作用），loop 随后**重新读取 inbox**：
有新 steering 就再跑一个 step，没有就关闭 turn。**数据（有没有 steering）决定结果，
监听器顺序不改变结论。**

## 4. 心智模型

turn-stopping 不是"举手表决要不要停"，而是"**关门前的最后一声吆喝**"：

<!-- dsh:stepper id=turn-stopping-loop title="关门前检查一次 inbox" loop-from=4 loop-to=2 loop-label="收到 steering，继续下一 step" -->
1. **准备关门** — loop 完成当前 step，准备结束 turn。
2. **通知监听器** — 按顺序调用 stopping listeners；它们只做副作用，不返回投票结果。
3. **留下纸条** — goal 仍 active 时，goal listener 用 steer 往 inbox 放入“继续干”。
4. **回看 inbox** — 有纸条就回到监听后的执行入口继续；没有纸条才真正关闭 turn。
<!-- /dsh:stepper -->

关键区别：监听器**不**返回"别停"，它**留下一张纸条**；是 loop 看到纸条才继续。

## 5. 方案与图

<!-- dsh:flow id=goal-driver-flow title="Goal Round Driver 的继续条件" -->
| ID | 节点 | 说明 | 下一步 |
|---|---|---|---|
| step | 执行一步 | `agent.run_one_step()` 可能推进或完成目标 | consume |
| consume | 消费旧 steering | 清理上一轮已经使用的 inbox 内容 | stopping |
| stopping | 触发关停监听 | goal active 且 armed 时执行 `agent.steer("继续…")` | inspect |
| inspect | 重读 inbox | 是否出现新的 steering | step[有消息且未超上限], close[为空或达到上限] |
| close | 关闭 turn | 没有新的工作事实需要继续 | - |
<!-- /dsh:flow -->

## 6. 代码拆解

- `Agent.steer(text)`：往 `inbox` 追加 steering（**副作用**）。这是续跑的真实机制。
- `make_goal_listener()`：turn-stopping 监听器，**返回 `None`（void）**；目标 active 且 armed 时调 `agent.steer(...)`。
- `make_budget_listener()`：只观察、不 steer、返回 void。
- `dispatch_turn_stopping()`：按序 `await` 所有监听器（serial 语义），它们无返回值。
- `drive()`：跑一步 → 清 inbox → 跑 turn-stopping → **重读 inbox** → 有 steering 续跑，否则关 turn。
- `activation.armed`：进程本地激活——真实 dsh 里 resume/fork 后需人工重新授权才自动续跑。

## 7. 相对上一课新增了什么

L18 的目标状态不会自己推进。本课加上 **Goal Round Driver**：它在 `agent/turn-stopping`
边界上，通过 `agent.steer(...)` 写 steering 让 loop 续跑（而非返回 stop 决策），
直到目标 complete/blocked。这里也是 **serial** 分发的承接点（回顾 L03），
并特别演示了 turn-stopping "监听器返回 void、靠 steer 续跑" 的真实语义。

## 8. 简化了什么 vs 真实 DeepSeek Harness

| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |
|---|---|---|
| inbox 是个 list | 真实 inbox + `agent.steer(...)` 写入、loop 重读 | steering 要能与人类输入、注入上下文排队 |
| 监听器返回 void，靠 steer | `agent/turn-stopping` 签名就是 `Promise<void>\|void`，靠 steer 续跑 | "数据决定、顺序无关"，避免监听器顺序影响结论 |
| 反向停止未演示 | 工具结果带 `concludesTurn` 可在其 step 提前结束 turn | 让工具也能主动收尾一轮 |
| armed 布尔 | goal 激活 armed/disarmed，不进 durable replay | resume/fork 要人工重新授权，防意外自动跑 |
| driver 与 domain 混在文件 | goal 领域（L18）与 goal-round-driver 是独立包 | 状态与驱动分层，各自可替换 |

> **本次修订说明**：早期版本把 turn-stopping 写成"监听器返回 `{stop: False}` 投票"，
> 这与真实签名不符。真实的 `agent/turn-stopping` 返回 `void`，续跑靠 `agent.steer(...)`
> 的副作用 + loop 重读 inbox。依据见 `docs/subsystems/core.zh.md` 的 `agent/turn-stopping` 条目。

### 教学类名 → 真实 dsh 映射

| 本课 | 真实 dsh |
|---|---|
| `dispatch_turn_stopping` | `agent/turn-stopping` serial 事件（监听器返回 void） |
| `agent.steer(text)` | `agent.steer(...)` 写入 steering |
| `drive` 重读 inbox | loop 在停止边界后重读 inbox 决定续跑 |
| `activation.armed` | goal 激活 armed/disarmed |

---
[← 上一课 L18](../L18_goal/README.zh.md) · [返回总览](../../README.md) · [下一课 L20 →](../L20_profile_bundle/README.zh.md)
