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
  // 侧栏
  // ------------------------------------------------------------------
  function sidebar(activeId) {
    var h = '<nav class="side"><div class="side-in">';
    D.layers.forEach(function (L) {
      var items = D.lessons.filter(function (l) { return l.layer === L.id; });
      if (!items.length) return;
      h += '<div class="grp ' + ("c-" + L.color) + '">';
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
        h += '<div class="card" data-go="' + l.id + '">';
        h += '<div class="card-top"><span class="badge">' + esc(l.id) + "</span>" +
          "<em>" + esc(l.subtitle) + "</em></div>";
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

    var h = sidebar(id) + '<div class="main"><div class="detail ' + colorClass(l) + '">';

    h += '<div class="crumb"><a href="#/">学习路径</a><span>/</span>' +
      '<span class="dot"></span><span>' + esc(L.name) + "</span></div>";

    h += '<div class="d-head">';
    h += '<div class="card-top"><span class="badge">' + esc(l.id) + "</span>" +
      "<em>" + esc(l.subtitle) + "</em>" +
      (l.hasCode ? "" : '<span class="pill">仅讲义</span>') + "</div>";
    h += "<h1>" + esc(l.title) + "</h1>";
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
      l.sections.forEach(function (s) {
        h += "<h2>" + inline(s.name) + "</h2>" + renderMd(s.body);
      });
      h += "</div>";
    }

    h += '<div class="pager">';
    h += prev
      ? '<a href="#/l/' + prev.id + '"><small>&larr; 上一课</small>' + esc(prev.id + " " + prev.title) + "</a>"
      : '<a href="#/" ><small>&larr; 返回</small>学习路径</a>';
    h += next
      ? '<a class="nxt" href="#/l/' + next.id + '"><small>下一课 &rarr;</small>' + esc(next.id + " " + next.title) + "</a>"
      : '<a class="nxt" href="#/"><small>已是最后一课</small>返回学习路径</a>';
    h += "</div>";

    h += "</div></div>";
    return h;
  }

  // ------------------------------------------------------------------
  // 路由
  // ------------------------------------------------------------------
  var state = { q: "" };

  function route() {
    var hash = location.hash.replace(/^#/, "") || "/";
    var parts = hash.split("/").filter(Boolean);
    var navKey = "timeline";
    var html;

    if (parts[0] === "l" && parts[1]) {
      html = viewLesson(parts[1], parts[2]);
      navKey = "timeline";
    } else if (parts[0] === "layers") {
      html = viewLayers();
      navKey = "layers";
    } else {
      html = viewTimeline(state.q);
      navKey = "timeline";
    }

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
