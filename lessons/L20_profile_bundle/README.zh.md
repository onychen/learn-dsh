# L20 Profile / Bundle：把插件树叠出来

> **Motto：产品 = 有序层叠的插件树，任意一行都能被 patch 替换。**

## 1. 30 秒运行

运行前先猜：patch 一行 `llm` 时，是只合并 config 还是整行替换？两个 layer 使用相同 id、不同
plugin 时谁胜出？如果想同时保留两个实例，应该复用 id 还是创建新 id？

```powershell
python lessons/L20_profile_bundle/main.py
```

预期输出（节选）：

```text
===== 组合 profile: headless =====
  [dsh-base] 插入 行 id=llm → dsh-llm-deepseek
  [headless] 插入 行 id=subagent → dsh-subagent-spawn-in-process
  ...

===== 用 --patch 覆盖 llm 行（换成 replay，用于测试）=====
  [--patch] 替换 行 id=llm → dsh-llm-replay
  ---- 最终插件树 ----
    llm          dsh-llm-replay {'script': 'fixtures/demo.json'}
    ...
```

## 2. 观察输出

同一份 `dsh-base`，`headless` 和 `web` 两个 profile 叠出两个不同的插件树（产品）。
最后用 `--patch` 把 `llm` 那一行**整行替换**成 replay——`dsh-base` 其余行一个没动。

## 3. 为什么需要这一层

前 19 课我们都手写启动代码（`ctx.provide(...)`）。但真实产品不能靠手写启动，
需要**声明式、可组合、可覆盖**：同一套核心，headless 版和 web 版只是叠的东西不同；
测试时想把真模型换成 replay，不该改代码。

**dsh 的答案：profile 列出要叠哪些 bundle，bundle 贡献配置行，按序层叠成插件树，
`--patch` 可覆盖任意一行。** 这让"同一内核组合出不同产品"成为配置问题而非编码问题。

## 4. 心智模型

profile/bundle 就像**装修房子**：

<!-- dsh:compare id=profile-house title="同一套基础能力可以装修成不同产品" -->
- **dsh-base · 毛坯** — 提供水电和承重墙般的通用核心，每个 profile 都从这里开始。
- **headless bundle · 简装** — 加入一次性运行器、subagent 与 goal 等无界面能力。
- **web bundle · 精装** — 加入浏览器界面和服务器，形成交互式产品。
- **patch · 局部换装** — 最后按 id 替换某一项能力，不扰动其他配置。
<!-- /dsh:compare -->

## 5. 方案与图

<!-- dsh:stepper id=profile-layering title="配置树按层叠加，越后越具体" -->
1. **空树** — 从没有任何实现选择的配置开始。
2. **叠加 dsh-base** — 放入 llm、tool-shell、persistence 等共同基础。
3. **叠加 bundle** — 根据 headless 或 web profile 加入产品能力组。
4. **叠加 profile patch** — 覆盖该产品形态的局部默认值。
5. **叠加 home patch** — 应用用户机器上的长期个性化配置。
6. **叠加命令行 patch** — 最后一次、最具体的覆盖；同 id 替换，否则插入。
<!-- /dsh:stepper -->

### 执行透视：同一个 llm id 如何被后层稳定替换

<!-- dsh:trace id=l20-runtime-xray title="headless profile 的层叠与 patch" -->
| 步骤 | 执行位置 | 发生什么 | 当前 Layer | Config Tree by id | llm 行来源 |
|---|---|---|---|---|---|
| 初始化 | `tree={}` | 创建空的有序配置树。 | 无。 | `{}` | 不存在。 |
| 应用 base | `apply_layer(dsh_base)` | llm、tools、session 插入。 | dsh-base | `{llm, tools, session}` | `dsh-llm-deepseek` |
| 应用 profile | `headless_bundle` | runner、subagent、goal 插入新 id。 | headless | base + 3 行。 | 仍来自 base。 |
| 应用 patch | `id=llm, replay` | 相同 id 整行覆盖。 | --patch | key 顺序保留，value 替换。 | `dsh-llm-replay` |
| dump | `tree.values()` | disabled 行过滤，其余构成最终树。 | 所有层已折叠。 | 单一 llm winner。 | patch 获胜。 |
<!-- /dsh:trace -->

## 6. 代码拆解

- `ConfigRow`：一行配置 = id + plugin + config + disabled。
- `apply_layer()`：按 `id` 定位——存在就**整行替换**，否则插入。这就是 patch 的核心机制。
- `dsh_base` / `headless_bundle` / `web_bundle`：三个层，各贡献若干行。
- `build_profile()`：按顺序叠 base → profile bundle →（可选）`--patch`。
- main：headless、web 两个 profile，再演示 `--patch` 把 llm 换成 replay。

### 动手破坏一次

把 key 从 `row.id` 改成 `row.plugin`。replay patch 会插入第二行而非覆盖 deepseek。这验证：
**稳定 id 表达配置槽位，plugin 名只是槽位当前选择的实现。**

## 7. 代码解读：声明式层叠如何把产品差异变成数据

<!-- dsh:code-walkthrough id=l20-code-reading title="Layer、稳定 id 与整行覆盖" source=main.py -->
| 阶段 | 行号 | 读代码 | 设计原因 |
|---|---|---|---|
| ConfigRow 区分槽位与实现 | 25-29 | id、plugin、config、disabled 表达身份、选择、参数和启停。 | patch 需要稳定槽位；若把 plugin 名当身份，替换实现就无法覆盖原行。 |
| apply_layer 只有一条规则 | 32-37 | 每行执行 `tree[row.id] = row`，存在是替换，不存在是插入。 | 所有 layer 共享确定语义；不做深合并可避免旧实现配置泄漏给新 provider。 |
| Bundle 只贡献配置行 | 43-66 | base、headless、web 分别返回列表，不直接 new 插件。 | bundle 是可组合声明，不拥有启动副作用；同一 base 可形成不同产品。 |
| build_profile 固化优先级 | 69-79 | base 先应用，profile 次之，patch 最后。 | 优先级由单一组装点表达，不依赖文件加载顺序或插件互相覆盖。 |
| dump 消费最终折叠视图 | 82-86 | tree.values 保留槽位顺序，并跳过 disabled。 | 运行器只消费 winner，不需要理解每行来自哪一层。 |
<!-- /dsh:code-walkthrough -->

## 8. 相对上一课新增了什么

前 19 课都是手动 new 插件。本课引入 **profile/bundle 声明式层叠 + patch 覆盖**，
把"手写启动"变成"配置组合"，让同一内核叠出不同产品、任意一行可被替换。

## 9. 简化了什么 vs 真实 DeepSeek Harness

| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |
|---|---|---|
| dict 存 config rows | Cordis loader + `cordis.patch.yml`，插件树真实挂载 | 配置驱动真实的插件生命周期 |
| 手写三个 bundle | bundle 是分发格式，`package.json` 的 `dsh` 字段声明 | 可打包分发、跨仓库复用 |
| 单一 patch | profile patch → home patch → `--patch` 多层覆盖 | 不同层级（团队/机器/命令行）各自覆盖 |
| 整行替换 | patch 按 id 替换整个 config，或插入新行 | 精确定位、可组合 |
| 无 dump | `dsh --profile web --dump-config` 打印真实树 | 可检查机器实际启动的树 |

### 教学类名 → 真实 dsh 映射

| 本课 | 真实 dsh |
|---|---|
| `ConfigRow` | Cordis config row |
| `dsh_base()` | `dsh-base` bundle |
| `headless_bundle` / `web_bundle` | `dsh-headless` / `dsh-web-app` |
| `--patch` 覆盖 | `--patch` overlay / `cordis.patch.yml` |

---
[← 上一课 L19](../L19_goal_driver/README.zh.md) · [返回总览](../../README.md) · [下一课 L21 →](../L21_capstone/README.zh.md)
