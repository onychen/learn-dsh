/* learn-dsh 静态站点：hash 路由 + 轻量 Markdown 渲染
   无任何第三方依赖，file:// 直接打开即可运行 */

(function () {
  "use strict";

  var D = window.DSH_DATA;
  var app = document.getElementById("app");
  var byId = {};
  D.lessons.forEach(function (l) { byId[l.id] = l; });

  var layerOf = {};
  D.layers.forEach(function (x) { layerOf[x.id] = x; });

  // ------------------------------------------------------------------
  // 工具
  // ------------------------------------------------------------------
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function colorClass(lessonOrLayerId) {
    var lid = typeof lessonOrLayerId === "string"
      ? lessonOrLayerId : lessonOrLayerId.layer;
    var L = layerOf[lid];
    return "c-" + (L ? L.color : "blue");
  }

  var PROGRESS_KEY = "dsh-progress-v1";

  function readProgress() {
    try {
      var value = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
      return {
        completed: Array.isArray(value.completed) ? value.completed : [],
        lastLesson: value.lastLesson || "",
        lastSection: value.lastSection || {}
      };
    } catch (_) {
      return { completed: [], lastLesson: "", lastSection: {} };
    }
  }

  function writeProgress(value) {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(value)); } catch (_) { /* 可无存储阅读 */ }
  }

  function rememberLesson(id) {
    var progress = readProgress();
    progress.lastLesson = id;
    writeProgress(progress);
  }

  function isCompleted(id) {
    return readProgress().completed.indexOf(id) >= 0;
  }

  // ------------------------------------------------------------------
  // 极简 Markdown 渲染（够用于本课讲义：标题/表格/围栏代码/列表/引用/强调）
  // ------------------------------------------------------------------
  function inline(s) {
    // 先保护行内代码
    var codes = [];
    s = s.replace(/`([^`]+)`/g, function (_, c) {
      codes.push(c);
      return "\u0000" + (codes.length - 1) + "\u0000";
    });
    s = esc(s);
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, t, href) {
      // 课程内部相对链接 → 转成 hash 路由
      var m = /\.\.\/(L\d+|X)_[^/]*\/README\.zh\.md/.exec(href);
      if (m) return '<a href="#/l/' + m[1] + '">' + t + "</a>";
      if (/README\.md$/.test(href) && href.indexOf("..") === 0) {
        return '<a href="#/">' + t + "</a>";
      }
      if (/^https?:/.test(href)) {
        return '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + t + "</a>";
      }
      return t;
    });
    s = s.replace(/\u0000(\d+)\u0000/g, function (_, i) {
      return "<code>" + esc(codes[+i]) + "</code>";
    });
    return s;
  }

  function renderMd(md) {
    var lines = md.replace(/\r\n/g, "\n").split("\n");
    var out = [];
    var i = 0;

    function flushPara(buf) {
      if (buf.length) out.push("<p>" + inline(buf.join(" ")) + "</p>");
      buf.length = 0;
    }

    var para = [];

    while (i < lines.length) {
      var ln = lines[i];

      // 围栏代码
      if (/^```/.test(ln)) {
        flushPara(para);
        var lang = ln.slice(3).trim();
        var body = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) { body.push(lines[i]); i++; }
        i++;
        out.push('<pre><code class="lang-' + esc(lang) + '">' +
          esc(body.join("\n")) + "</code></pre>");
        continue;
      }

      // 表格
      if (/^\|/.test(ln) && i + 1 < lines.length && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
        flushPara(para);
        var head = ln.split("|").slice(1, -1);
        i += 2;
        var rows = [];
        while (i < lines.length && /^\|/.test(lines[i])) {
          rows.push(lines[i].split("|").slice(1, -1));
          i++;
        }
        var t = "<table><thead><tr>";
        head.forEach(function (c) { t += "<th>" + inline(c.trim()) + "</th>"; });
        t += "</tr></thead><tbody>";
        rows.forEach(function (r) {
          t += "<tr>";
          r.forEach(function (c) { t += "<td>" + inline(c.trim()) + "</td>"; });
          t += "</tr>";
        });
        out.push(t + "</tbody></table>");
        continue;
      }

      // 标题
      var h = /^(#{1,6})\s+(.*)$/.exec(ln);
      if (h) {
        flushPara(para);
        var lv = Math.min(h[1].length + 1, 6);
        out.push("<h" + lv + ">" + inline(h[2]) + "</h" + lv + ">");
        i++;
        continue;
      }

      // 分隔线
      if (/^---+\s*$/.test(ln)) {
        flushPara(para);
        out.push("<hr>");
        i++;
        continue;
      }

      // 引用
      if (/^>\s?/.test(ln)) {
        flushPara(para);
        var q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          q.push(lines[i].replace(/^>\s?/, ""));
          i++;
        }
        out.push("<blockquote>" + renderMd(q.join("\n")) + "</blockquote>");
        continue;
      }

      // 列表
      if (/^\s*([-*+]|\d+\.)\s+/.test(ln)) {
        flushPara(para);
        var ordered = /^\s*\d+\./.test(ln);
        var items = [];
        while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
          var txt = lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, "");
          i++;
          // 续行（缩进）
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) &&
                 !/^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
            txt += " " + lines[i].trim();
            i++;
          }
          items.push("<li>" + inline(txt) + "</li>");
        }
        out.push((ordered ? "<ol>" : "<ul>") + items.join("") + (ordered ? "</ol>" : "</ul>"));
        continue;
      }

      if (!ln.trim()) { flushPara(para); i++; continue; }

      para.push(ln.trim());
      i++;
    }
    flushPara(para);
    return out.join("\n");
  }

  // ------------------------------------------------------------------
  // 教学组件（由 build_site.py 从 README 注释标记编译而来）
  // ------------------------------------------------------------------
  function componentTitle(block, label) {
    return '<div class="teach-kicker">' + esc(label) + '</div>' +
      (block.title ? '<h3 class="teach-title">' + inline(block.title) + '</h3>' : "");
  }

  function renderStepper(block) {
    var h = '<section class="teach teach-stepper" data-stepper data-current="0" ' +
      'data-component-id="' + esc(block.id) + '"' +
      (block.loop ? ' data-loop-from="' + block.loop.from + '" data-loop-to="' + block.loop.to + '"' : '') + '>';
    h += '<header class="teach-head"><div>' + componentTitle(block, "STEP BY STEP") + '</div>' +
      '<div class="step-controls"><button type="button" data-step-action="prev" aria-label="上一步">上一步</button>' +
      '<button type="button" data-step-action="next">继续</button>' +
      '<button type="button" data-step-action="replay">重播</button></div></header>';
    h += '<div class="step-status">STEP <b data-step-number>01</b> / ' +
      String(block.steps.length).padStart(2, "0") + '</div><div class="step-track' +
      (block.loop ? ' has-loop' : '') + '">';
    block.steps.forEach(function (step, index) {
      if (index) h += '<span class="step-arrow" aria-hidden="true">&rarr;</span>';
      h += '<button type="button" class="step-card" data-step-index="' + index +
        '" aria-label="第 ' + (index + 1) + ' 步：' + esc(step.title) + '"><small>' +
        String(index + 1).padStart(2, "0") + '</small><strong>' + inline(step.title) + '</strong></button>';
    });
    if (block.loop) {
      h += '<span class="step-loop-arrow" aria-hidden="true"><i>' + inline(block.loop.label) + '</i></span>';
    }
    h += '</div><div class="step-detail" aria-live="polite"><small>当前发生</small>' +
      '<strong data-step-title></strong><p data-step-detail></p></div></section>';
    return h;
  }

  function renderAgentLoop(block) {
    var nodes = {};
    var indexes = {};
    block.nodes.forEach(function (node, index) {
      nodes[node.id] = node;
      indexes[node.id] = index;
    });

    function node(id, kicker, className) {
      return '<button type="button" class="flow-node agent-loop-node ' + className +
        '" data-flow-index="' + indexes[id] + '"><small>' + kicker + '</small><strong>' +
        inline(nodes[id].title) + '</strong></button>';
    }

    var h = '<section class="teach teach-flow teach-agent-loop" data-flow data-component-id="' +
      esc(block.id) + '">';
    h += '<header class="teach-head"><div>' + componentTitle(block, "MENTAL MODEL") + '</div>' +
      '<p class="agent-loop-hint">点击节点，理解每一环发生了什么</p></header>';
    h += '<div class="agent-loop-scroll"><div class="agent-loop-map">';
    h += node("input", "入口", "node-input");
    h += '<span class="agent-loop-link link-input-history" aria-hidden="true"><i>初始化</i></span>';
    h += '<div class="agent-loop-memory"><small>唯一状态</small><strong>messages</strong>' +
      '<span>当前对话历史</span></div>';
    h += '<span class="agent-loop-link link-history-model" aria-hidden="true"><i>读取</i></span>';
    h += node("model", "每一轮", "node-model");
    h += '<span class="agent-loop-link link-model-decision" aria-hidden="true"></span>';
    h += node("decide", "分岔点", "node-decide");
    h += '<span class="agent-loop-link link-decision-done" aria-hidden="true"><i>否</i></span>';
    h += node("done", "退出", "node-done");
    h += '<span class="agent-loop-link link-decision-tool" aria-hidden="true"><i>是</i></span>';
    h += node("tool", "行动", "node-tool");
    h += '<span class="agent-loop-link link-tool-observe" aria-hidden="true"><i>工具结果</i></span>';
    h += node("observe", "观察", "node-observe");
    h += '<span class="agent-loop-link link-observe-history" aria-hidden="true"><i>追加进历史</i></span>';
    h += '</div></div><div class="flow-detail" aria-live="polite"><small>节点说明</small>' +
      '<strong data-flow-title></strong><p data-flow-detail></p></div></section>';
    return h;
  }

  function renderFlow(block) {
    if (block.variant === "agent-loop") return renderAgentLoop(block);
    var titles = {};
    block.nodes.forEach(function (node) { titles[node.id] = node.title; });
    var h = '<section class="teach teach-flow" data-flow data-component-id="' + esc(block.id) + '">';
    h += '<header class="teach-head"><div>' + componentTitle(block, "FLOW") + '</div></header>';
    h += '<div class="flow-grid">';
    block.nodes.forEach(function (node, index) {
      h += '<button type="button" class="flow-node" data-flow-index="' + index + '"><small>' +
        String(index + 1).padStart(2, "0") + '</small><strong>' + inline(node.title) + '</strong>';
      if (node.edges.length) {
        h += '<span class="flow-next">';
        node.edges.forEach(function (edge) {
          h += '<i>' + inline(edge.label || "下一步") + ' &rarr; ' +
            inline(titles[edge.target] || edge.target) + '</i>';
        });
        h += '</span>';
      } else {
        h += '<span class="flow-next"><i>流程结束</i></span>';
      }
      h += '</button>';
    });
    h += '</div><div class="flow-detail" aria-live="polite"><small>节点说明</small>' +
      '<strong data-flow-title></strong><p data-flow-detail></p></div></section>';
    return h;
  }

  function renderStructureNodes(nodes) {
    var h = '<ul>';
    nodes.forEach(function (node) {
      h += '<li><div class="structure-node"><strong>' + inline(node.title) + '</strong>' +
        (node.detail ? '<p>' + inline(node.detail) + '</p>' : '') + '</div>';
      if (node.children && node.children.length) h += renderStructureNodes(node.children);
      h += '</li>';
    });
    return h + '</ul>';
  }

  function renderStructure(block) {
    return '<section class="teach teach-structure" data-component-id="' + esc(block.id) + '">' +
      '<header class="teach-head"><div>' + componentTitle(block, "STRUCTURE") + '</div></header>' +
      '<div class="structure-tree">' + renderStructureNodes(block.nodes) + '</div></section>';
  }

  function renderCompare(block) {
    var h = '<section class="teach teach-compare" data-component-id="' + esc(block.id) + '">' +
      '<header class="teach-head"><div>' + componentTitle(block, "COMPARE") + '</div></header>' +
      '<div class="compare-grid">';
    block.items.forEach(function (item, index) {
      h += '<article class="compare-card"><small>' + String(index + 1).padStart(2, "0") +
        '</small><strong>' + inline(item.title) + '</strong><p>' + inline(item.detail) + '</p></article>';
    });
    return h + '</div></section>';
  }

  function renderCodeFocus(block) {
    var h = '<section class="teach teach-code-focus" data-code-focus data-component-id="' + esc(block.id) + '">';
    h += '<header class="teach-head"><div>' + componentTitle(block, "CONCEPT SKETCH") + '</div></header>';
    h += '<div class="code-focus-grid"><pre aria-label="概念代码"><code>';
    block.code.split("\n").forEach(function (line, index) {
      h += '<span class="focus-line" data-code-line="' + (index + 1) + '"><i>' +
        String(index + 1).padStart(2, "0") + '</i><b>' + esc(line || " ") + '</b></span>';
    });
    h += '</code></pre><ol class="focus-notes">';
    block.notes.forEach(function (note, index) {
      h += '<li><button type="button" data-focus-index="' + index + '" data-start="' + note.start +
        '" data-end="' + note.end + '"><i>' + (index + 1) + '</i><span><strong>' +
        inline(note.title) + '</strong><small>' + inline(note.detail) + '</small></span></button></li>';
    });
    h += '</ol></div></section>';
    return h;
  }

  function renderBlock(block) {
    if (block.type === "markdown") return renderMd(block.markdown);
    if (block.type === "stepper") return renderStepper(block);
    if (block.type === "flow") return renderFlow(block);
    if (block.type === "structure") return renderStructure(block);
    if (block.type === "compare") return renderCompare(block);
    if (block.type === "code-focus") return renderCodeFocus(block);
    return "";
  }

  // ------------------------------------------------------------------
  // 侧栏
  // ------------------------------------------------------------------
  function sidebar(activeId) {
    var h = '<nav class="side' + (activeId ? ' lesson-side' : '') + '"><div class="side-in">';
    D.layers.forEach(function (L) {
      var items = D.lessons.filter(function (l) { return l.layer === L.id; });
      if (!items.length) return;
      var current = items.some(function (l) { return l.id === activeId; });
      h += '<div class="grp ' + ("c-" + L.color) + (current ? ' current' : '') + '">';
      h += '<div class="grp-h"><span class="dot"></span><b>' + esc(L.name) + "</b></div><ul>";
      items.forEach(function (l) {
        h += '<li><a class="' + (l.id === activeId ? "on" : "") +
          '" href="#/l/' + l.id + '"><i>' + esc(l.id) + "</i>" +
          "<span>" + esc(l.title) + "</span></a></li>";
      });
      h += "</ul></div>";
    });
    h += "</div></nav>";
    return h;
  }

  // ------------------------------------------------------------------
  // 时间线（首页）
  // ------------------------------------------------------------------
  function viewTimeline(query) {
    var q = (query || "").trim().toLowerCase();
    var list = D.lessons.filter(function (l) {
      if (!q) return true;
      return (l.id + " " + l.title + " " + l.motto + " " + l.subtitle)
        .toLowerCase().indexOf(q) >= 0;
    });

    var h = sidebar(null) + '<div class="main">';
    h += '<div class="ph"><h1>学习路径</h1><p>' +
      esc(D.tagline) + "</p></div>";

    var progress = readProgress();
    var resume = byId[progress.lastLesson];
    if (resume) {
      h += '<a class="resume-card ' + colorClass(resume) + '" href="#/l/' + resume.id + '">' +
        '<span><small>继续学习</small><strong>' + esc(resume.id + " " + resume.title) +
        '</strong></span><i aria-hidden="true">&rarr;</i></a>';
    }

    h += '<div class="searchbar"><span>&#128269;</span>' +
      '<input id="q" placeholder="搜索课程、motto、机制关键词…" value="' + esc(query || "") + '">' +
      "</div>";

    // 图例
    h += '<div class="legend"><h3>阶段图例</h3>';
    D.layers.forEach(function (L) {
      h += '<div class="' + ("c-" + L.color) + '"><span class="dot dot-lg"></span>' +
        "<span>" + esc(L.name) + "</span> <em>" + esc(L.desc) + "</em></div>";
    });
    h += "</div>";

    if (!list.length) {
      h += '<div class="empty">没有匹配的课程</div>';
    } else {
      h += '<div class="tl">';
      list.forEach(function (l) {
        h += '<div class="row ' + colorClass(l) + '">';
        h += '<div class="rail"><div class="node">' +
          esc(l.id.replace("L", "")) + '</div><div class="line"></div></div>';
        var completed = progress.completed.indexOf(l.id) >= 0;
        h += '<div class="card' + (completed ? ' completed' : '') + '" data-go="' + l.id + '">';
        h += '<div class="card-top"><span class="badge">' + esc(l.id) + "</span>" +
          "<em>" + esc(l.subtitle) + "</em>" +
          (completed ? '<span class="complete-mark">已完成</span>' : '') + '</div>';
        h += "<h3>" + esc(l.title) +
          (l.hasCode ? "" : '<span class="pill">仅讲义</span>') + "</h3>";
        h += '<div class="stats">';
        if (l.hasCode) {
          h += "<span>" + l.loc + " 行代码</span><span>" +
            l.sections.length + " 段讲义</span>";
        } else {
          h += "<span>附录 · 无代码</span><span>" + l.sections.length + " 段讲义</span>";
        }
        h += "</div>";
        h += '<div class="bar"><i style="width:' + (l.hasCode ? l.locPct : 0) + '%"></i></div>';
        if (l.motto) h += '<p class="motto">' + esc(l.motto) + "</p>";
        h += '<span class="more">查看这一课 <span aria-hidden="true">&rarr;</span></span>';
        h += "</div></div>";
      });
      h += "</div>";
    }
    h += "</div>";
    return h;
  }

  // ------------------------------------------------------------------
  // 阶段总览
  // ------------------------------------------------------------------
  function viewLayers() {
    var h = sidebar(null) + '<div class="main">';
    h += '<div class="ph"><h1>阶段总览</h1><p>课程主线按 harness 真实架构分层</p></div>';
    D.layers.forEach(function (L) {
      var items = D.lessons.filter(function (l) { return l.layer === L.id; });
      h += '<div class="lcard ' + ("c-" + L.color) + '">';
      h += "<h3><span class=\"dot dot-lg\"></span>" + esc(L.name) + "</h3>";
      h += "<p>" + esc(L.desc) + "</p><div class=\"chips\">";
      items.forEach(function (l) {
        h += '<a class="chip" href="#/l/' + l.id + '"><i>' + esc(l.id) +
          "</i><span>" + esc(l.title) + "</span></a>";
      });
      h += "</div></div>";
    });
    h += "</div>";
    return h;
  }

  // ------------------------------------------------------------------
  // 课程详情
  // ------------------------------------------------------------------
  function viewLesson(id, tab) {
    var l = byId[id];
    if (!l) return viewTimeline("");
    var L = layerOf[l.layer];
    var idx = D.lessons.indexOf(l);
    var prev = D.lessons[idx - 1];
    var next = D.lessons[idx + 1];

    var h = sidebar(id) + '<div class="main"><div class="detail-shell"><article class="detail ' + colorClass(l) + '">';

    h += '<div class="reading-progress" aria-hidden="true"><i id="reading-bar"></i></div>';

    h += '<div class="crumb"><a href="#/">学习路径</a><span>/</span>' +
      '<span class="dot"></span><span>' + esc(L.name) + "</span></div>";

    h += '<div class="d-head">';
    h += '<div class="card-top"><span class="badge">' + esc(l.id) + "</span>" +
      "<em>" + esc(l.subtitle) + "</em>" +
      (l.hasCode ? "" : '<span class="pill">仅讲义</span>') + "</div>";
    h += "<h1>" + esc(l.title) + "</h1>";
    h += '<p class="lesson-meta">' + l.sections.length + ' 个章节 · ' +
      (l.hasCode ? l.loc + ' 行示例代码' : '讲义') + '</p>';
    if (l.motto) h += '<p class="d-motto">' + esc(l.motto) + "</p>";
    h += "</div>";

    var showCode = tab === "code" && l.hasCode;
    h += '<div class="tabs">';
    h += '<button data-tab="doc" class="' + (showCode ? "" : "on") + '">讲义</button>';
    if (l.hasCode) {
      h += '<button data-tab="code" class="' + (showCode ? "on" : "") +
        '">源码 <span style="color:var(--text-3);font-weight:400">' + l.loc + " 行</span></button>";
    }
    h += "</div>";

    if (showCode) {
      h += '<div class="runline"><span>&#9654;</span><code>python lessons/' +
        esc(l.dir) + "/main.py</code></div>";
      h += '<div class="codebox"><button class="copy" id="cp">复制</button>' +
        "<pre><code>" + esc(l.code) + "</code></pre></div>";
    } else {
      h += '<div class="md">';
      l.sections.forEach(function (s, index) {
        h += '<section class="lesson-section" id="lesson-section-' + (index + 1) +
          '" data-section-index="' + (index + 1) + '"><h2>' + inline(s.name) + "</h2>";
        (s.blocks || [{ type: "markdown", markdown: s.body || "" }]).forEach(function (block) {
          h += renderBlock(block);
        });
        h += '</section>';
      });
      h += "</div>";
    }

    if (!showCode) {
      h += '<div class="lesson-complete"><div><small>学完这一课了吗？</small>' +
        '<strong>完成后，学习路径会记录你的进度。</strong></div>' +
        '<button type="button" data-complete-lesson="' + esc(l.id) + '" aria-pressed="' +
        (isCompleted(l.id) ? 'true' : 'false') + '">' +
        (isCompleted(l.id) ? '已完成本课' : '标记本课完成') + '</button></div>';
    }

    h += '<div class="pager">';
    h += prev
      ? '<a href="#/l/' + prev.id + '"><small>&larr; 上一课</small>' + esc(prev.id + " " + prev.title) + "</a>"
      : '<a href="#/" ><small>&larr; 返回</small>学习路径</a>';
    h += next
      ? '<a class="nxt" href="#/l/' + next.id + '"><small>下一课 &rarr;</small>' + esc(next.id + " " + next.title) + "</a>"
      : '<a class="nxt" href="#/"><small>已是最后一课</small>返回学习路径</a>';
    h += "</div>";

    h += '</article>';
    if (!showCode) {
      h += '<aside class="lesson-toc" aria-label="本课目录"><small>本课目录</small><ol>';
      l.sections.forEach(function (s, index) {
        h += '<li><button type="button" data-scroll-section="' + (index + 1) + '"><i>' +
          String(index + 1).padStart(2, "0") + '</i><span>' + inline(s.name.replace(/^\d+\.\s*/, "")) + '</span></button></li>';
      });
      h += '</ol></aside>';
    }
    h += "</div></div>";
    return h;
  }

  // ------------------------------------------------------------------
  // 路由
  // ------------------------------------------------------------------
  var state = { q: "" };
  var lessonScrollHandler = null;
  var lessonObserver = null;
  var stepperResizeHandler = null;

  function positionStepperLoop(root) {
    var arrow = root.querySelector(".step-loop-arrow");
    if (!arrow) return;
    var cards = root.querySelectorAll("[data-step-index]");
    var source = cards[(+root.dataset.loopFrom) - 1];
    var target = cards[(+root.dataset.loopTo) - 1];
    if (!source || !target) return;
    var vertical = window.matchMedia("(max-width: 760px)").matches;
    arrow.classList.toggle("vertical", vertical);
    if (vertical) {
      var targetY = target.offsetTop + target.offsetHeight / 2;
      var sourceY = source.offsetTop + source.offsetHeight / 2;
      arrow.style.left = Math.max(4, target.offsetLeft - 26) + "px";
      arrow.style.top = targetY + "px";
      arrow.style.width = "22px";
      arrow.style.height = Math.max(24, sourceY - targetY) + "px";
    } else {
      var targetX = target.offsetLeft - 10;
      var sourceX = source.offsetLeft + source.offsetWidth / 2;
      arrow.style.left = targetX + "px";
      arrow.style.top = source.offsetTop + source.offsetHeight + 5 + "px";
      arrow.style.width = Math.max(40, sourceX - targetX) + "px";
      arrow.style.height = "27px";
    }
  }

  function route() {
    var hash = location.hash.replace(/^#/, "") || "/";
    var parts = hash.split("/").filter(Boolean);
    var navKey = "timeline";
    var html;

    if (parts[0] === "l" && parts[1]) {
      rememberLesson(parts[1]);
      html = viewLesson(parts[1], parts[2]);
      navKey = "timeline";
    } else if (parts[0] === "layers") {
      html = viewLayers();
      navKey = "layers";
    } else {
      html = viewTimeline(state.q);
      navKey = "timeline";
    }

    if (stepperResizeHandler) window.removeEventListener("resize", stepperResizeHandler);
    app.innerHTML = html;
    document.querySelectorAll(".nav a").forEach(function (a) {
      a.classList.toggle("on", a.dataset.nav === navKey);
    });

    bind();
    window.scrollTo(0, 0);
    revealCards();
  }

  function bind() {
    // 卡片整体可点
    document.querySelectorAll("[data-go]").forEach(function (el) {
      el.addEventListener("click", function () {
        location.hash = "#/l/" + el.dataset.go;
      });
    });

    // 标签切换
    document.querySelectorAll("[data-tab]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = location.hash.split("/")[2];
        location.hash = "#/l/" + id + (b.dataset.tab === "code" ? "/code" : "");
      });
    });

    // 复制源码
    var cp = document.getElementById("cp");
    if (cp) {
      cp.addEventListener("click", function () {
        var code = document.querySelector(".codebox code").textContent;
        navigator.clipboard.writeText(code).then(function () {
          cp.textContent = "已复制";
          setTimeout(function () { cp.textContent = "复制"; }, 1600);
        });
      });
    }

    // 教学步骤器
    document.querySelectorAll("[data-stepper]").forEach(function (root) {
      function showStep(index) {
        var cards = [].slice.call(root.querySelectorAll("[data-step-index]"));
        index = Math.max(0, Math.min(index, cards.length - 1));
        root.dataset.current = index;
        cards.forEach(function (card, i) {
          card.classList.toggle("active", i === index);
          card.classList.toggle("done", i < index);
          card.setAttribute("aria-current", i === index ? "step" : "false");
        });
        var steps = byId[location.hash.split("/")[2]];
        var componentId = root.dataset.componentId;
        var component = null;
        if (steps) {
          steps.sections.some(function (section) {
            return (section.blocks || []).some(function (block) {
              if (block.id === componentId) { component = block; return true; }
              return false;
            });
          });
        }
        if (!component) return;
        root.querySelector("[data-step-number]").textContent = String(index + 1).padStart(2, "0");
        root.querySelector("[data-step-title]").innerHTML = inline(component.steps[index].title);
        root.querySelector("[data-step-detail]").innerHTML = inline(component.steps[index].detail);
        root.querySelector('[data-step-action="prev"]').disabled = index === 0;
        root.querySelector('[data-step-action="next"]').disabled = index === cards.length - 1;
      }
      root.querySelectorAll("[data-step-index]").forEach(function (card) {
        card.addEventListener("click", function () { showStep(+card.dataset.stepIndex); });
      });
      root.querySelectorAll("[data-step-action]").forEach(function (button) {
        button.addEventListener("click", function () {
          var current = +root.dataset.current;
          if (button.dataset.stepAction === "prev") showStep(current - 1);
          if (button.dataset.stepAction === "next") showStep(current + 1);
          if (button.dataset.stepAction === "replay") showStep(0);
        });
      });
      showStep(0);
      positionStepperLoop(root);
    });
    stepperResizeHandler = function () {
      document.querySelectorAll("[data-stepper]").forEach(positionStepperLoop);
    };
    window.addEventListener("resize", stepperResizeHandler, { passive: true });

    // 流程图节点解释
    document.querySelectorAll("[data-flow]").forEach(function (root) {
      var lesson = byId[location.hash.split("/")[2]];
      var component = null;
      if (lesson) lesson.sections.forEach(function (section) {
        (section.blocks || []).forEach(function (block) {
          if (block.id === root.dataset.componentId) component = block;
        });
      });
      function selectFlow(index) {
        if (!component) return;
        root.querySelectorAll("[data-flow-index]").forEach(function (node, i) {
          node.classList.toggle("active", i === index);
          node.setAttribute("aria-pressed", i === index ? "true" : "false");
        });
        root.querySelector("[data-flow-title]").innerHTML = inline(component.nodes[index].title);
        root.querySelector("[data-flow-detail]").innerHTML = inline(component.nodes[index].detail);
      }
      root.querySelectorAll("[data-flow-index]").forEach(function (node) {
        node.addEventListener("click", function () { selectFlow(+node.dataset.flowIndex); });
      });
      selectFlow(0);
    });

    // 代码讲解联动
    document.querySelectorAll("[data-code-focus]").forEach(function (root) {
      function focusNote(button) {
        var start = +button.dataset.start;
        var end = +button.dataset.end;
        root.querySelectorAll("[data-code-line]").forEach(function (line) {
          var n = +line.dataset.codeLine;
          line.classList.toggle("active", n >= start && n <= end);
        });
        root.querySelectorAll("[data-focus-index]").forEach(function (note) {
          note.classList.toggle("active", note === button);
          note.setAttribute("aria-pressed", note === button ? "true" : "false");
        });
      }
      root.querySelectorAll("[data-focus-index]").forEach(function (button) {
        button.addEventListener("click", function () { focusNote(button); });
        button.addEventListener("focus", function () { focusNote(button); });
      });
      var first = root.querySelector("[data-focus-index]");
      if (first) focusNote(first);
    });

    // 本课目录与完成状态
    document.querySelectorAll("[data-scroll-section]").forEach(function (button) {
      button.addEventListener("click", function () {
        var target = document.getElementById("lesson-section-" + button.dataset.scrollSection);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    var completeButton = document.querySelector("[data-complete-lesson]");
    if (completeButton) {
      completeButton.addEventListener("click", function () {
        var progress = readProgress();
        var id = completeButton.dataset.completeLesson;
        var at = progress.completed.indexOf(id);
        if (at >= 0) progress.completed.splice(at, 1); else progress.completed.push(id);
        writeProgress(progress);
        var completed = progress.completed.indexOf(id) >= 0;
        completeButton.textContent = completed ? "已完成本课" : "标记本课完成";
        completeButton.setAttribute("aria-pressed", completed ? "true" : "false");
      });
    }

    setupLessonProgress();

    // 搜索
    var q = document.getElementById("q");
    if (q) {
      q.addEventListener("input", function () {
        state.q = q.value;
        var pos = q.selectionStart;
        app.innerHTML = viewTimeline(state.q);
        bind();
        var nq = document.getElementById("q");
        if (nq) { nq.focus(); nq.setSelectionRange(pos, pos); }
        revealCards();
      });
    }
  }

  function setupLessonProgress() {
    if (lessonScrollHandler) window.removeEventListener("scroll", lessonScrollHandler);
    if (lessonObserver) lessonObserver.disconnect();
    var article = document.querySelector(".detail");
    var bar = document.getElementById("reading-bar");
    if (!article || !bar) return;

    lessonScrollHandler = function () {
      var rect = article.getBoundingClientRect();
      var available = Math.max(1, article.offsetHeight - window.innerHeight);
      var passed = Math.min(available, Math.max(0, -rect.top + 72));
      bar.style.width = Math.round(passed / available * 100) + "%";
    };
    window.addEventListener("scroll", lessonScrollHandler, { passive: true });
    lessonScrollHandler();

    if (!("IntersectionObserver" in window)) return;
    lessonObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var index = entry.target.dataset.sectionIndex;
        document.querySelectorAll("[data-scroll-section]").forEach(function (button) {
          button.classList.toggle("active", button.dataset.scrollSection === index);
        });
        var id = location.hash.split("/")[2];
        var progress = readProgress();
        progress.lastSection[id] = index;
        writeProgress(progress);
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    document.querySelectorAll(".lesson-section").forEach(function (section) {
      lessonObserver.observe(section);
    });
  }

  function revealCards() {
    var cards = [].slice.call(document.querySelectorAll(".card"));
    if (!("IntersectionObserver" in window)) {
      cards.forEach(function (c) { c.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        var d = cards.indexOf(el) % 6;
        setTimeout(function () { el.classList.add("in"); }, d * 55);
        io.unobserve(el);
      });
    }, { rootMargin: "0px 0px -40px 0px" });
    cards.forEach(function (c) { io.observe(c); });
  }

  // 主题
  function initTheme() {
    var t = localStorage.getItem("dsh-theme");
    if (t === "dark" || (!t && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.classList.add("dark");
    }
    document.getElementById("theme").addEventListener("click", function () {
      var dark = document.documentElement.classList.toggle("dark");
      localStorage.setItem("dsh-theme", dark ? "dark" : "light");
    });
  }

  window.addEventListener("hashchange", route);
  initTheme();
  route();
})();
