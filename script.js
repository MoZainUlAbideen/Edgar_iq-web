/* EdgarIQ chat widget.

   Two modes, chosen at page load:
   - Live: if config.js points at a reachable API, the input is enabled and
     typed questions run the real pipeline (POST /ask, then poll /ask/{id}).
   - Curated: otherwise (no URL, or the backend is down) the suggestion chips
     play back recorded answers from conversations.js and the input stays off.
   The chips work in both modes -- they are instant and cost nothing. */

(function () {
  const launcher = document.getElementById("chat-launcher");
  const panel = document.getElementById("chat-panel");
  const closeBtn = document.getElementById("chat-close");
  const chipsEl = document.getElementById("chat-chips");
  const messagesEl = document.getElementById("chat-messages");
  const openCta = document.getElementById("open-chat-cta");
  const subnote = document.getElementById("chat-subnote");
  const inputRow = document.getElementById("chat-input-row");
  const input = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send");
  const pill = document.getElementById("live-pill");
  const pillText = document.getElementById("live-pill-text");
  const dot = document.getElementById("launcher-dot");
  const heroForm = document.getElementById("hero-ask-form");
  const heroInput = document.getElementById("hero-ask-input");
  const heroBtn = document.getElementById("hero-ask-btn");
  const heroStatus = document.getElementById("hero-ask-status");
  const liveCopy = document.querySelector("[data-live-copy]");

  if (!launcher || !panel) return; // widget markup not present on this page

  const API = (window.EDGARIQ_API_URL || "").replace(/\/+$/, "");
  const POLL_MS = 1500;
  const MAX_WAIT_MS = 180000;

  let askedQuestions = new Set();
  let live = false;
  let busy = false;

  /* ---------- panel open/close ---------- */

  function openPanel() {
    panel.classList.add("open");
    launcher.setAttribute("aria-expanded", "true");
  }
  function closePanel() {
    panel.classList.remove("open");
    launcher.setAttribute("aria-expanded", "false");
  }
  launcher.addEventListener("click", function () {
    panel.classList.contains("open") ? closePanel() : openPanel();
  });
  closeBtn.addEventListener("click", closePanel);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && panel.classList.contains("open")) { closePanel(); launcher.focus(); }
  });
  if (openCta) {
    openCta.addEventListener("click", function (e) {
      e.preventDefault();
      openPanel();
    });
  }

  /* ---------- helpers ---------- */

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function appendMessage(role, html) {
    const msg = document.createElement("div");
    msg.className = "msg " + role;
    msg.innerHTML =
      '<span class="msg-role">' + (role === "user" ? "You" : "EdgarIQ") + "</span>" +
      '<span class="msg-text">' + html + "</span>";
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    if (messagesEl.children.length === 1) chipsEl.classList.add("compact");
    return msg;
  }

  function setBody(msg, html) {
    msg.querySelector(".msg-text").innerHTML = html;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  /* Minimal, safe markdown: everything is HTML-escaped first, then a small
     set of constructs (tables, bullets, bold, italics, code) is re-added.
     Model output is never inserted as raw HTML. */
  function inline(text) {
    return escapeHtml(text)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  function renderMarkdown(src) {
    const lines = String(src).replace(/\r/g, "").split("\n");
    const out = [];
    let i = 0;
    const isRow = (l) => /^\s*\|.*\|\s*$/.test(l);
    const isSep = (l) => /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(l) && l.includes("-");
    const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }

      if (isRow(line) && i + 1 < lines.length && isSep(lines[i + 1])) {
        const head = cells(line);
        i += 2;
        const rows = [];
        while (i < lines.length && isRow(lines[i])) { rows.push(cells(lines[i])); i++; }
        out.push(
          '<div class="md-table"><table><thead><tr>' +
          head.map((c) => "<th>" + inline(c) + "</th>").join("") +
          "</tr></thead><tbody>" +
          rows.map((r) => "<tr>" + r.map((c) => "<td>" + inline(c) + "</td>").join("") + "</tr>").join("") +
          "</tbody></table></div>"
        );
        continue;
      }

      if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, ""));
          i++;
        }
        out.push("<ul>" + items.map((t) => "<li>" + inline(t) + "</li>").join("") + "</ul>");
        continue;
      }

      const para = [];
      while (i < lines.length && lines[i].trim() && !isRow(lines[i]) &&
             !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) {
        para.push(lines[i].trim());
        i++;
      }
      if (!para.length) { i++; continue; }
      out.push("<p>" + inline(para.join(" ")) + "</p>");
    }
    return out.join("");
  }

  function renderLiveAnswer(data) {
    let html = renderMarkdown(data.answer || "");

    const cites = data.citations || [];
    if (cites.length) {
      html += '<div class="sources"><span class="sources-label">Sources</span>' +
        cites.map(function (c) {
          const label = escapeHtml(c.form_type + " · filed " + c.filing_date);
          const safe = /^https:\/\/www\.sec\.gov\//.test(c.source_url || "");
          return safe
            ? '<a href="' + escapeHtml(c.source_url) + '" target="_blank" rel="noopener noreferrer">' + label + "</a>"
            : "<span>" + label + "</span>";
        }).join("") + "</div>";
    }

    const warnings = data.warnings || [];
    if (warnings.length) {
      html += '<details class="warnings"><summary>' + warnings.length +
        " verification note" + (warnings.length > 1 ? "s" : "") + "</summary>" +
        warnings.map(function (w) { return "<p>" + escapeHtml(w) + "</p>"; }).join("") +
        "</details>";
    }
    return html;
  }

  /* ---------- curated chips ---------- */

  function renderChips() {
    chipsEl.innerHTML = "";
    (window.EDGARIQ_CONVERSATIONS || []).forEach(function (convo, i) {
      if (askedQuestions.has(i)) return;
      const chip = document.createElement("button");
      chip.className = "chat-chip";
      chip.type = "button";
      chip.textContent = convo.question;
      chip.addEventListener("click", function () { playCurated(i); });
      chipsEl.appendChild(chip);
    });
    chipsEl.style.display = chipsEl.children.length ? "flex" : "none";
    // Once a conversation has started, shrink chips to one scrollable row so
    // the answer area gets the panel's height.
    chipsEl.classList.toggle("compact", messagesEl.children.length > 0);
  }

  function playCurated(index) {
    const convo = (window.EDGARIQ_CONVERSATIONS || [])[index];
    if (!convo) return;
    askedQuestions.add(index);
    renderChips();
    appendMessage("user", escapeHtml(convo.question));
    const thinking = appendMessage("assistant", "Thinking…");
    setTimeout(function () {
      setBody(thinking,
        escapeHtml(convo.answer) + '<br><span class="cite">' + escapeHtml(convo.cite) +
        ' · recorded answer</span>');
    }, 650);
  }

  /* ---------- live backend ---------- */

  function setLive(isLive) {
    live = isLive;
    inputRow.classList.toggle("live", isLive);
    input.disabled = !isLive;
    sendBtn.disabled = !isLive;
    input.placeholder = isLive
      ? "Ask about NVIDIA's 10-K / 10-Q filings…"
      : "Live backend unavailable — try a question above";
    if (heroInput) { heroInput.disabled = !isLive; heroBtn.disabled = !isLive; }
    if (dot) dot.hidden = !isLive;
  }

  function setState(state, pillLabel, heroNote, ctaNote) {
    if (pill) { pill.dataset.state = state; pillText.textContent = pillLabel; }
    if (heroStatus && heroNote) heroStatus.textContent = heroNote;
    if (liveCopy && ctaNote) liveCopy.textContent = ctaNote;
  }

  function fetchWithTimeout(url, opts, ms) {
    const ctrl = new AbortController();
    const t = setTimeout(function () { ctrl.abort(); }, ms);
    return fetch(url, Object.assign({}, opts, { signal: ctrl.signal }))
      .finally(function () { clearTimeout(t); });
  }

  function connect() {
    if (!API) return; // curated-only deployment
    setState("connecting", "Waking the backend…",
      "Waking the live backend (free hosting sleeps when idle, up to a minute). Recorded answers work right now.");
    subnote.textContent = "Connecting to the live backend… (free hosting sleeps when idle, this can take up to a minute)";
    fetchWithTimeout(API + "/health", {}, 90000)
      .then(function (r) { if (!r.ok) throw new Error("health " + r.status); return r.json(); })
      .then(function () {
        setLive(true);
        setState("live", "Live backend",
          "Live. Questions run the full pipeline over NVIDIA's SEC filings and take about 15–60 seconds.",
          "The live backend is up. Ask your own question about NVIDIA's filings.");
        subnote.textContent = "Live: questions run the real EdgarIQ pipeline over NVIDIA's SEC filings (~15–60s). Chips below are recorded answers.";
      })
      .catch(function () {
        setLive(false);
        setState("off", "Recorded answers",
          "The live backend isn't reachable right now. The recorded answers below still work.",
          "The live backend isn't reachable right now. Recorded answers from the evaluation run are available.");
        subnote.textContent = "The live backend isn't reachable right now — showing recorded answers from an evaluation run.";
      });
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function errorDetail(resp) {
    try {
      const j = await resp.json();
      if (typeof j.detail === "string") return j.detail;
      if (Array.isArray(j.detail)) return "Please ask a question between 5 and 500 characters.";
    } catch (e) { /* fall through */ }
    return "Request failed (" + resp.status + ").";
  }

  async function askLive(question) {
    busy = true;
    sendBtn.disabled = true;
    input.disabled = true;
    appendMessage("user", escapeHtml(question));
    const msg = appendMessage("assistant", "Thinking…");
    const started = Date.now();

    function status(text) {
      setBody(msg, escapeHtml(text) + ' <span class="cite">' +
        Math.round((Date.now() - started) / 1000) + "s</span>");
    }

    try {
      const post = await fetchWithTimeout(API + "/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question }),
      }, 30000);
      if (!post.ok) { setBody(msg, '<span class="msg-error">' + escapeHtml(await errorDetail(post)) + "</span>"); return; }
      const jobId = (await post.json()).job_id;

      while (Date.now() - started < MAX_WAIT_MS) {
        await sleep(POLL_MS);
        const r = await fetchWithTimeout(API + "/ask/" + encodeURIComponent(jobId), {}, 20000);
        if (!r.ok) { setBody(msg, '<span class="msg-error">' + escapeHtml(await errorDetail(r)) + "</span>"); return; }
        const data = await r.json();
        if (data.status === "done") { setBody(msg, renderLiveAnswer(data)); return; }
        if (data.status === "error") { setBody(msg, '<span class="msg-error">' + escapeHtml(data.error || "Something went wrong.") + "</span>"); return; }
        status(data.status === "queued" && data.queue_position
          ? "Waiting in line (" + data.queue_position + " ahead)…"
          : "Reading filings and checking the answer…");
      }
      setBody(msg, '<span class="msg-error">This is taking longer than expected. Please try again.</span>');
    } catch (e) {
      setBody(msg, '<span class="msg-error">Couldn\'t reach the backend. Please try again in a moment.</span>');
    } finally {
      busy = false;
      if (live) { input.disabled = false; sendBtn.disabled = false; input.focus(); }
    }
  }

  function submit() {
    const q = input.value.trim();
    if (!live || busy || q.length < 5) return;
    input.value = "";
    askLive(q);
  }

  sendBtn.addEventListener("click", submit);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); submit(); }
  });

  if (heroForm) {
    heroForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const q = heroInput.value.trim();
      if (!live || busy || q.length < 5) return;
      heroInput.value = "";
      openPanel();
      askLive(q);
    });
  }
  document.querySelectorAll("[data-curated]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const i = Number(btn.dataset.curated);
      openPanel();
      if (!askedQuestions.has(i)) playCurated(i);
    });
  });

  setLive(false);
  renderChips();
  connect();
})();
