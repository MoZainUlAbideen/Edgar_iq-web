/* EdgarIQ chat widget — curated playback of real, verified answers.
   No network calls: this is the honest "curated demo" version described
   on the site. A live backend can later replace renderAssistantReply()
   with a real fetch() to a hosted agent API. */

(function () {
  const launcher = document.getElementById("chat-launcher");
  const panel = document.getElementById("chat-panel");
  const closeBtn = document.getElementById("chat-close");
  const chipsEl = document.getElementById("chat-chips");
  const messagesEl = document.getElementById("chat-messages");
  const openCta = document.getElementById("open-chat-cta");

  if (!launcher || !panel) return; // widget markup not present on this page

  let askedQuestions = new Set();

  function openPanel() {
    panel.classList.add("open");
    launcher.setAttribute("aria-expanded", "true");
  }

  function closePanel() {
    panel.classList.remove("open");
    launcher.setAttribute("aria-expanded", "false");
  }

  function togglePanel() {
    panel.classList.contains("open") ? closePanel() : openPanel();
  }

  launcher.addEventListener("click", togglePanel);
  closeBtn.addEventListener("click", closePanel);
  if (openCta) {
    openCta.addEventListener("click", function (e) {
      e.preventDefault();
      openPanel();
    });
  }

  function renderChips() {
    chipsEl.innerHTML = "";
    (window.EDGARIQ_CONVERSATIONS || []).forEach(function (convo, i) {
      if (askedQuestions.has(i)) return;
      const chip = document.createElement("button");
      chip.className = "chat-chip";
      chip.type = "button";
      chip.textContent = convo.question;
      chip.addEventListener("click", function () {
        askQuestion(i);
      });
      chipsEl.appendChild(chip);
    });
    chipsEl.style.display = chipsEl.children.length ? "flex" : "none";
  }

  function appendMessage(role, html) {
    const msg = document.createElement("div");
    msg.className = "msg " + role;
    const roleLabel = role === "user" ? "You" : "EdgarIQ";
    msg.innerHTML =
      '<span class="msg-role">' + roleLabel + '</span>' +
      '<span class="msg-text">' + html + '</span>';
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return msg;
  }

  function askQuestion(index) {
    const convo = EDGARIQ_CONVERSATIONS[index];
    if (!convo) return;

    askedQuestions.add(index);
    renderChips();

    appendMessage("user", escapeHtml(convo.question));

    const thinking = appendMessage("assistant", "Thinking…");

    setTimeout(function () {
      thinking.querySelector(".msg-text").innerHTML =
        escapeHtml(convo.answer) + '<br><span class="cite">' + escapeHtml(convo.cite) + "</span>";
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }, 650);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  renderChips();
})();
