# L09 Scope 与 shadowing：给单个 agent 一套隔离能力

> **Motto：同名最具体者胜；作用域是 per-agent 人格的根。**

## 1. 30 秒运行

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

```text
global 层：  shell, write, read        （全局变量）
translator： shell(私有), translate     （局部变量，同名遮蔽全局）
    → 在 translator 里写 shell，指的是局部那个
readonly：   restrict 到 {read, shell}  （只能访问白名单）
```

"最具体者胜"（most-specific-wins）就是 shadowing。

## 5. 方案与图

```text
resolve(scope_key):
  base = { 全局工具 里通过 restriction 白名单的 }
  if scope_key:
      for 工具 in scope 层:
          base[name] = scope 工具   ← 同名直接覆盖（shadow）
  return base
```

## 6. 代码拆解

- `register_global` / `register_scoped`：分别往全局层和某个 scope 层注册。
- `restrict(scope, allowed)`：给某 scope 设白名单。
- `resolve(scope)`：先按 restriction 过滤全局层，再用 scope 层同名覆盖。
- scope key 用 `object()`：对应真实 dsh"live agent 就是自己 scope 的 key"（对象身份比较）。

## 7. 相对上一课新增了什么

前 8 课的注册都是隐式全局的。本课引入 **scope 两层结构 + shadowing + restriction**，
让不同 agent 能看到不同的能力集，为后面工具、提示、skill 的 per-agent 差异化打地基。

## 8. 简化了什么 vs 真实 DeepSeek Harness

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
