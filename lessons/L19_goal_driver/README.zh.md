# L19 Goal Round Driver：自动续跑

> **Motto：目标未完成就再开一轮，直到完成或阻塞。**

## 1. 30 秒运行

运行前先判断：turn-stopping listener 是返回 `continue=True`，还是通过 `agent.steer()` 写入
真实输入？两个 listener 的执行顺序交换后，目标是否继续的结论应不应该改变？

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

<!-- dsh:flow id=turn-stopping-loop title="steering 是续跑的数据，不是监听器的返回值" variant=map -->
| ID | 节点 | 说明 | 下一步 | 位置 | 类型 |
|---|---|---|---|---|---|
| step | 执行当前 step | agent 推进工作，然后到达准备关闭 turn 的边界。 | stopping | 1,1 | |
| stopping | 通知 stopping listeners | 按顺序 await；监听器返回 void，只能产生副作用。 | goal | 2,1 | boundary |
| goal | Goal listener | 目标仍 active 且 armed 时调用 agent.steer。 | inbox[写入 steering] | 3,1 | |
| inbox | 真实 inbox | 保存监听器留下的 steering，是决定是否续跑的数据。 | inspect | 4,1 | state |
| inspect | 重读 inbox | 监听结束后由 loop 检查是否出现新消息。 | step[有 steering：下一 step], close[没有 steering] | 5,1 | decision |
| close | 关闭 turn | inbox 为空，说明没有新的工作事实。 | - | 6,1 | terminal |
<!-- /dsh:flow -->

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

### 执行透视：续跑决定存在 inbox，不存在 listener 返回值

<!-- dsh:trace id=l19-runtime-xray title="目标从 active 到 complete 的三轮驱动" -->
| 步骤 | 执行位置 | 发生什么 | Goal phase / remaining | Agent inbox | Loop 下一动作 |
|---|---|---|---|---|---|
| Round 1 工作 | `run_one_step(1)` | remaining 从 3 减为 2。 | `active / 2` | 上轮输入消费后清空。 | 进入 stopping。 |
| Goal listener | `agent.steer` | active 且 armed，写 goal-round。 | `active / 2` | `[继续推进目标]` | 重读后续跑。 |
| Round 2 工作 | `run_one_step(2)` | remaining 变 1。 | `active / 1` | 再次清空后写入。 | 继续下一 step。 |
| Round 3 工作 | `run_one_step(3)` | remaining 归零，phase complete。 | `complete / 0` | 清空。 | 进入 stopping。 |
| 不再 steer | `goal listener` | phase 非 active，只观察。 | `complete / 0` | `[]` | inbox 空，关闭 turn。 |
| Blocked 场景 | `phase=blocked` | 第二轮外部状态转 blocked。 | `blocked / 97` | listener 不写入。 | 同样停止。 |
<!-- /dsh:trace -->

## 6. 代码拆解

- `Agent.steer(text)`：往 `inbox` 追加 steering（**副作用**）。这是续跑的真实机制。
- `make_goal_listener()`：turn-stopping 监听器，**返回 `None`（void）**；目标 active 且 armed 时调 `agent.steer(...)`。
- `make_budget_listener()`：只观察、不 steer、返回 void。
- `dispatch_turn_stopping()`：按序 `await` 所有监听器（serial 语义），它们无返回值。
- `drive()`：跑一步 → 清 inbox → 跑 turn-stopping → **重读 inbox** → 有 steering 续跑，否则关 turn。
- `activation.armed`：进程本地激活——真实 dsh 里 resume/fork 后需人工重新授权才自动续跑。

### 动手破坏一次

让 goal listener 返回 `True`，但删除 `agent.steer()`。loop 重读 inbox 仍为空并关闭。这验证：
**通知返回值不是调度输入；真正驱动下一 step 的是 steering 数据。**

## 7. 代码解读：边界通知如何通过副作用转成下一轮输入

<!-- dsh:code-walkthrough id=l19-code-reading title="stopping listener、inbox 与 loop 的职责链" source=main.py -->
| 阶段 | 行号 | 读代码 | 设计原因 |
|---|---|---|---|
| steer 写数据而不返回决定 | 38-53 | Agent 持有 inbox；steer append 文本，run_one_step 推进工作并可能更新 goal。 | 是否续跑变成可检查的数据，而不是监听者瞬时返回值，多个插件可共同注入。 |
| Budget listener 只观察 | 60-65 | listener 打印后返回 None，也不 steer。 | turn-stopping 是通知点，不要求每个参与者投票；不干预就什么都不写。 |
| Goal listener 翻译领域状态 | 68-76 | 仅 active 且 armed 时 steer，其他 phase 不写 inbox。 | Goal 仍只是状态；driver consumer 把“未完成”转换成真实下一轮请求。 |
| serial 只按序 await | 80-82 | dispatch 忽略 listener 返回值。 | 顺序可影响副作用先后，但不能引入“首个布尔值胜出”的错误协议。 |
| loop 在边界后重读 inbox | 85-105 | 每轮工作后清空已消费输入、分发 stopping，再按 inbox 是否为空 continue/break。 | 数据面是唯一判定点；listener 数量与顺序不改变核心语义。 |
<!-- /dsh:code-walkthrough -->

## 8. 相对上一课新增了什么

L18 的目标状态不会自己推进。本课加上 **Goal Round Driver**：它在 `agent/turn-stopping`
边界上，通过 `agent.steer(...)` 写 steering 让 loop 续跑（而非返回 stop 决策），
直到目标 complete/blocked。这里也是 **serial** 分发的承接点（回顾 L03），
并特别演示了 turn-stopping "监听器返回 void、靠 steer 续跑" 的真实语义。

## 9. 简化了什么 vs 真实 DeepSeek Harness

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
