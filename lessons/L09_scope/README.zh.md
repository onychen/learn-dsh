# L09 Scope 与 shadowing：给单个 agent 一套隔离能力

> **Motto：同名最具体者胜；作用域是 per-agent 人格的根。**

## 1. 30 秒运行

运行前先判断：translator 注册同名 `shell` 后，应该报冲突、保留全局版本，还是让 scoped
版本胜出？readonly 的 restriction 应不应该连它自己的 scoped 工具也一起过滤？

```powershell
python lessons/L09_scope/main.py
```

预期输出（节选）：

```text
===== translator agent 看到的工具（shell 被遮蔽 + 多了 translate）=====
  shell      翻译官专用 shell：只允许 echo 翻译结果  ← 遮蔽了全局同名
  translate  翻译官私有工具：翻译文本  ← scope 私有

===== readonly agent 看到的工具（write 被 restrict 过滤掉）=====
  shell      全局 shell：执行任意命令
  read       全局 read：读文件
  （注意：write 不在列表里——被过滤的工具，和不存在没有区别）
```

## 2. 观察输出

三个 agent 看到三份不同的工具集。translator 的 `shell` 被它自己的同名工具**遮蔽**了，
还多了私有的 `translate`；readonly 的 `write` 被 **restrict 过滤**掉，
从它的视角看 `write` 根本不存在。

## 3. 为什么需要这一层

**为什么 Scope 排在工具（L10/L11）之前？** 因为工具、提示段落、skill、事件分发
全都建立在"注册是全局还是 scoped"这个模型之上。如果先讲一个纯全局的工具注册表，
后面讲 per-agent 差异化时就得推翻它。所以先立起 scope，再讲挂在 scope 上的东西。

真实产品里，一个只读子 agent 不该有 `write`；一个"翻译官"人格需要一个和全局同名
但行为不同的工具。Scope 就是实现"per-agent 人格"的根机制。

## 4. 心智模型

Scope 就像**编程语言的变量作用域**：

<!-- dsh:structure id=scope-shadowing title="工具作用域像变量作用域" -->
- **global 层** — 提供 shell、write、read，所有 agent 默认可见。
  - **translator 层** — 提供私有 shell 与 translate；同名 shell 遮蔽 global shell。
  - **readonly 层** — restriction 只放行 read 与 shell，其余全局工具不可见。
<!-- /dsh:structure -->

"最具体者胜"（most-specific-wins）就是 shadowing。

## 5. 方案与图

<!-- dsh:stepper id=scope-resolution title="most-specific-wins 解析过程" -->
1. **读取限制** — 确定当前 scope 的 restriction 白名单。
2. **建立基础集合** — 从全局工具中只保留白名单允许的项目。
3. **叠加局部工具** — 遍历 scope 层，把局部定义按 name 写入集合。
4. **发生遮蔽** — 局部工具与全局工具同名时，局部定义直接覆盖。
5. **返回结果** — consumer 只看到解析后的最终工具集。
<!-- /dsh:stepper -->

### 执行透视：同一个名称在不同 agent 中如何解析

<!-- dsh:trace id=l09-runtime-xray title="translator 与 readonly 的可见能力不是同一张表" -->
| 步骤 | 执行位置 | 发生什么 | Global 层 | 当前 Scope 层 | resolve 结果 |
|---|---|---|---|---|---|
| 注册全局 | `register_global` | shell、write、read 成为默认能力。 | `{shell, write, read}` | 尚未选择 scope。 | 全局 agent 看见三者。 |
| 建 translator 层 | `register_scoped` | translator 增加同名 shell 与私有 translate。 | 全局层不变。 | `{shell:受限版, translate}` | scoped shell 覆盖 global shell。 |
| 解析 translator | `resolve(translator)` | 先复制 global，再覆盖 scoped 同名 key。 | `{shell, write, read}` | `{shell, translate}` | `{shell:受限版, write, read, translate}` |
| 限制 readonly | `restrict(readonly)` | 只允许 read 与 shell 进入 base。 | 原始 global 不被修改。 | `allowed={read,shell}` | write 在合并前已消失。 |
| 解析 readonly | `resolve(readonly)` | 过滤 global；该 scope 没有私有项可覆盖。 | 过滤后 `{read,shell}` | `{}` | `{read,shell}` |
<!-- /dsh:trace -->

## 6. 代码拆解

- `register_global` / `register_scoped`：分别往全局层和某个 scope 层注册。
- `restrict(scope, allowed)`：给某 scope 设白名单。
- `resolve(scope)`：先按 restriction 过滤全局层，再用 scope 层同名覆盖。
- scope key 用 `object()`：对应真实 dsh"live agent 就是自己 scope 的 key"（对象身份比较）。

### 动手破坏一次

把 `resolve` 中“过滤 global”移动到 scoped 合并之后，并对整个结果过滤。translator 的私有
`translate` 可能被误删。这验证：**restriction 约束继承来的全局能力，shadowing 则在过滤后
合并最具体层；两者顺序不能交换。**

## 7. 代码解读：most-specific-wins 是怎样由合并顺序实现的

<!-- dsh:code-walkthrough id=l09-code-reading title="作用域解析不是查找，而是过滤后覆盖" source=main.py -->
| 阶段 | 行号 | 读代码 | 设计原因 |
|---|---|---|---|
| 三张表分开保存三种语义 | 22-28 | global、scoped 和 restrictions 分别存储，不把规则压进一张复合表。 | 注册事实、scope 私有项与继承过滤是不同维度；分开后 resolve 才能明确控制应用顺序。 |
| 注册只写所属层 | 30-38 | global 直接按 name 写入；scoped 先按对象身份分桶；restrict 只记录允许集合。 | 写入时不提前计算最终视图，新增全局工具后所有 scope 才能在下次 resolve 自动看到最新结果。 |
| 先过滤继承，再覆盖最具体层 | 40-49 | resolve 先构造允许的 global base，再逐项写入当前 scope；字典赋值实现同名覆盖。 | 私有能力不应被全局 restriction 误伤；覆盖顺序把“most-specific-wins”落实为代码规则。 |
| 对象身份隔离 agent | 55-69 | translator 与 readonly 都是独立 object，并分别作为配置 key。 | 即使两个 agent 配置内容相同，它们仍是不同作用域；身份 key 避免字符串名称碰撞和跨 agent 泄漏。 |
<!-- /dsh:code-walkthrough -->

## 8. 相对上一课新增了什么

前 8 课的注册都是隐式全局的。本课引入 **scope 两层结构 + shadowing + restriction**，
让不同 agent 能看到不同的能力集，为后面工具、提示、skill 的 per-agent 差异化打地基。

## 9. 简化了什么 vs 真实 DeepSeek Harness

| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |
|---|---|---|
| 一个 dict 存 scope 层 | `core/scope` 的 scoped-registration 原语，`agent.ctx` 承载 | 注册的可见性与生命周期由一个事实驱动 |
| scope key 是裸 object | scope key 按对象身份比较，live agent 是自己的 key | 稳定身份，subagent 不向下继承 |
| 只有工具 | 工具、提示段落、变量、监听器、restriction 都可 scoped | per-agent 人格是多维度的 |
| 两层，无 setup window | 有 setup window：创建时组合 agent 的 scoped 世界 | 在 agent 发布前把人格装好 |
| 事件不过滤 | scoped dispatch：一个 agent 的事件带它的 scope carrier | 一个 agent 的活动不惊动别的 agent |

### 教学类名 → 真实 dsh 映射

| 本课 | 真实 dsh |
|---|---|
| `ScopedRegistry` | `core/scope` + 工具/提示注册表的分层 |
| `register_scoped` | 通过 `agent.ctx` 的 scoped 注册 |
| `resolve` shadowing | most-specific-wins 名称解析 |
| `restrict` | `tools.restrict`（按交集组合） |

---
[← 上一课 L08](../L08_llm_seam/README.zh.md) · [返回总览](../../README.md) · [下一课 L10 →](../L10_tool_registry/README.zh.md)
