"""把 learn-dsh 的讲义与代码编译成一个纯静态站点数据文件。

产物：site/data.js  （window.DSH_DATA = {...}）
运行：python site/build_site.py
无第三方依赖。
"""

from __future__ import annotations

import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LESSONS = os.path.join(ROOT, "lessons")
OUT = os.path.join(ROOT, "site", "data.js")

# ---------------------------------------------------------------------------
# 阶段（层）定义 —— 对应 README 的七阶段地图，颜色仿 learn-claude-code 的 layer legend
# ---------------------------------------------------------------------------
LAYERS = [
    {"id": "kernel", "name": "内核骨架", "color": "blue",
     "desc": "Cordis 插件 / 事件 / 可逆注册"},
    {"id": "session", "name": "会话即真源", "color": "emerald",
     "desc": "仅追加事件日志与投影"},
    {"id": "turn", "name": "轮次与模型边界", "color": "purple",
     "desc": "turn/step 生命周期与 llm seam"},
    {"id": "tools", "name": "作用域与工具", "color": "amber",
     "desc": "scope / 注册表 / 管线 / seam"},
    {"id": "context", "name": "上下文可持续", "color": "rose",
     "desc": "skills 与 compaction"},
    {"id": "concurrency", "name": "委派与并发", "color": "cyan",
     "desc": "subagent / jobs / goal"},
    {"id": "product", "name": "组装成产品", "color": "red",
     "desc": "profile / capstone / trace"},
]

LESSON_LAYER = {
    "L01": "kernel", "L02": "kernel", "L03": "kernel",
    "L04": "session", "L05": "session",
    "L06": "turn", "L07": "turn", "L08": "turn",
    "L09": "tools", "L10": "tools", "L11": "tools", "L12": "tools", "L13": "tools",
    "L14": "context", "L15": "context",
    "L16": "concurrency", "L17": "concurrency", "L18": "concurrency", "L19": "concurrency",
    "L20": "product", "L21": "product", "L22": "product", "X": "product",
}

# 一句话副标题（卡片顶部的灰色小字），概括该课的机制
SUBTITLE = {
    "L01": "最小 while 循环 + 一个工具",
    "L02": "ctx 服务与可逆 effect",
    "L03": "emit / waterfall / parallel / serial",
    "L04": "append-only SessionEvent",
    "L05": "deriveMessages 纯函数投影",
    "L06": "turn/step 驱动器",
    "L07": "agent/pre-step waterfall",
    "L08": "ctx.llm 适配器与流式",
    "L09": "作用域链与 shadowing",
    "L10": "schema + handler 注册表",
    "L11": "pre/guard/execute/post 管线",
    "L12": "interface / impl / consumer",
    "L13": "提示词片段协作组装",
    "L14": "两段式按需注入",
    "L15": "surfaceOp:replace 遮蔽",
    "L16": "子会话上下文隔离",
    "L17": "后台任务与交付控制器",
    "L18": "目标是状态不是调度器",
    "L19": "turn-stopping + steer 续跑",
    "L20": "配置行层叠与 patch",
    "L21": "八层机制合成 mini-dsh",
    "L22": "read / search / trace 读侧",
    "X": "flush / 崩溃恢复（仅讲义）",
}


def parse_motto(lines: list[str]) -> str:
    for ln in lines:
        if "Motto" in ln:
            m = re.sub(r"^>\s*", "", ln).strip()
            m = m.replace("**", "")
            m = re.sub(r"^Motto[：:]\s*", "", m)
            return m.strip().rstrip("。") + "。"
    return ""


def parse_title(lines: list[str]) -> str:
    for ln in lines:
        if ln.startswith("# "):
            return ln[2:].strip()
    return ""


def split_sections(md: str) -> list[dict]:
    """按 '## N. xxx' 切成八段，保留原始 markdown。"""
    parts = re.split(r"\n(?=##\s)", md)
    out = []
    for p in parts:
        if not p.startswith("##"):
            continue
        head = p.split("\n", 1)[0]
        name = re.sub(r"^##\s*", "", head).strip()
        body = p.split("\n", 1)[1] if "\n" in p else ""
        out.append({"name": name, "body": body.strip()})
    return out


def main() -> None:
    lessons = []
    for entry in sorted(os.listdir(LESSONS)):
        d = os.path.join(LESSONS, entry)
        if not os.path.isdir(d):
            continue
        code_id = entry.split("_")[0]
        readme = os.path.join(d, "README.zh.md")
        mainpy = os.path.join(d, "main.py")

        md = ""
        if os.path.exists(readme):
            with open(readme, encoding="utf-8") as f:
                md = f.read()
        lines = md.splitlines()

        code = ""
        if os.path.exists(mainpy):
            with open(mainpy, encoding="utf-8") as f:
                code = f.read()

        title = parse_title(lines)
        # 去掉标题里的 "L01 " 前缀，卡片上单独用 badge 显示编号
        short = re.sub(r"^(L\d+|附录\s*X)[：:\s]*", "", title).strip()

        lessons.append({
            "id": code_id,
            "dir": entry,
            "num": code_id.replace("L", "").replace("X", "X"),
            "title": short or title,
            "fullTitle": title,
            "subtitle": SUBTITLE.get(code_id, ""),
            "motto": parse_motto(lines),
            "layer": LESSON_LAYER.get(code_id, "product"),
            "loc": len(code.splitlines()),
            "hasCode": bool(code),
            "sections": split_sections(md),
            "code": code,
        })

    max_loc = max((l["loc"] for l in lessons), default=1) or 1
    for l in lessons:
        l["locPct"] = round(l["loc"] / max_loc * 100)

    readme_top = ""
    p = os.path.join(ROOT, "README.md")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            readme_top = f.read()

    data = {
        "title": "learn-dsh",
        "subtitle": "拆解 DeepSeek Harness：22 课 + 1 附录",
        "tagline": "先立 Cordis 插件 / 事件 / seam 骨架，再逐层把能力挂上去",
        "layers": LAYERS,
        "lessons": lessons,
        "readme": readme_top,
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("// 由 build_site.py 自动生成，请勿手工编辑\n")
        f.write("window.DSH_DATA = ")
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write(";\n")

    print(f"已生成 {OUT}")
    print(f"课程数 {len(lessons)}，最大代码行数 {max_loc}")


if __name__ == "__main__":
    main()
