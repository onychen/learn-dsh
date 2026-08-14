# learn-dsh 网页版

把 22 课讲义 + 源码编译成一个**纯静态**学习站点，形式仿
[learn.shareai.run](https://learn.shareai.run/en/timeline/)：左侧按阶段分组的粘性导航，
右侧是带节点连线的课程时间线，点卡片进入讲义 / 源码双标签页。

## 怎么看

最简单：直接双击 `index.html`（纯静态，`file://` 也能跑）。

或者起一个本地服务器：

```powershell
python -m http.server 8000 --directory site
# 然后打开 http://localhost:8000
```

## 讲义改了怎么办

站点数据是从 `lessons/*/README.zh.md` 和 `main.py` 编译出来的。
改完讲义或代码后重新生成一次即可：

```powershell
python site/build_site.py
```

它会重新写出 `site/data.js`（课程元数据 + 全文讲义 + 全部源码）。

## 文件说明

| 文件 | 作用 |
|---|---|
| `index.html` | 入口，只有一个 `#app` 容器 |
| `style.css` | 全部样式，含深浅色主题与七个阶段配色 |
| `app.js` | hash 路由 + 轻量 Markdown 渲染 + 搜索 |
| `data.js` | **自动生成**，请勿手改 |
| `build_site.py` | 编译脚本 |

## 功能

- **学习路径**：22 课 + 附录 X 的时间线，卡片显示编号、机制小结、代码行数、motto。
- **阶段总览**：按七个阶段（内核骨架 → 组装成产品）分组浏览。
- **课程页**：讲义八段完整渲染（表格 / ASCII 图 / 代码块），可切到源码标签并一键复制。
- **搜索**：按课号、标题、motto、机制关键词实时过滤。
- **深浅色**：跟随系统，可手动切换，选择记在 `localStorage`。
- **零依赖**：不需要 Node、不需要 npm、不需要联网。

## 与参考站的差异

原版 learn-claude-code 的 web 是 Next.js 14 + TypeScript + Tailwind + Framer Motion，
带交互式 agent loop 模拟器和版本 diff 对比。本站刻意做成**零构建的单页静态站**——
课程本身就强调"离线可跑、无依赖"，站点保持同样的调性，也省掉一整条前端工具链。
动效改用 CSS transition + IntersectionObserver 实现卡片入场，视觉效果接近。
