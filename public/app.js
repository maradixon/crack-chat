/* Crack Chat — client logic
 * Everything personal (name, journal, chat history) is stored in this browser
 * via localStorage. Keys are namespaced per profile name so different people
 * on the same device keep separate journals.
 */

const $ = (sel) => document.querySelector(sel);

const els = {
  messages: $("#messages"),
  chatForm: $("#chatForm"),
  chatInput: $("#chatInput"),
  sendBtn: $("#sendBtn"),
  tabs: document.querySelectorAll(".tab"),
  chatView: $("#chatView"),
  journalView: $("#journalView"),
  profileBtn: $("#profileBtn"),
  profileInitial: $("#profileInitial"),
  themeBtn: $("#themeBtn"),
  profileDialog: $("#profileDialog"),
  nameInput: $("#nameInput"),
  journalForm: $("#journalForm"),
  journalInput: $("#journalInput"),
  journalList: $("#journalList"),
  journalEmpty: $("#journalEmpty"),
};

// ---------- Profile ----------
function getName() {
  return localStorage.getItem("cc:name") || "";
}
function setName(name) {
  localStorage.setItem("cc:name", name);
  renderProfile();
}
function renderProfile() {
  const name = getName();
  els.profileInitial.textContent = name ? name[0] : "?";
  els.profileBtn.title = name ? `${name}'s profile` : "Set your name";
}
function journalKey() {
  const name = getName() || "guest";
  return `cc:journal:${name.toLowerCase()}`;
}

els.profileBtn.addEventListener("click", () => {
  els.nameInput.value = getName();
  els.profileDialog.showModal();
  els.nameInput.focus();
});
els.profileDialog.addEventListener("close", () => {
  if (els.profileDialog.returnValue === "save") {
    const name = els.nameInput.value.trim();
    if (name) setName(name);
    renderJournal();
  }
});

// ---------- Theme (light/dark) ----------
// Default: follow the OS. Once the user taps the toggle, their choice is saved
// and overrides the system setting on this device.
const THEME_COLORS = { light: "#ce4b36", dark: "#d3543f" };

// Line-weight icons (inherit the header text color via currentColor).
const SUN_SVG =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON_SVG =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>';

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
function effectiveTheme() {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return systemPrefersDark() ? "dark" : "light";
}
function updateThemeButton(theme) {
  // Show the icon of the mode you'd switch TO.
  els.themeBtn.innerHTML = theme === "dark" ? SUN_SVG : MOON_SVG;
  els.themeBtn.title =
    theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLORS[theme]);
}
function applyTheme(theme, persist) {
  document.documentElement.setAttribute("data-theme", theme);
  if (persist) {
    try {
      localStorage.setItem("cc:theme", theme);
    } catch (e) {}
  }
  updateThemeButton(theme);
}

els.themeBtn.addEventListener("click", () => {
  applyTheme(effectiveTheme() === "dark" ? "light" : "dark", true);
});

// Reflect the OS theme live if the user hasn't chosen one yet.
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (!document.documentElement.getAttribute("data-theme")) {
    updateThemeButton(effectiveTheme());
  }
});

// ---------- Tabs ----------
els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    els.tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const view = tab.dataset.view;
    els.chatView.classList.toggle("is-active", view === "chat");
    els.journalView.classList.toggle("is-active", view === "journal");
    if (view === "journal") renderJournal();
  });
});

// ---------- Tiny, safe markdown-ish renderer ----------
function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function renderMarkdown(text) {
  const escaped = escapeHTML(text);
  const lines = escaped.split("\n");
  let html = "";
  let inList = false;
  const inline = (s) =>
    s
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>");

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    if (bullet) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inline(bullet[1])}</li>`;
    } else {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      if (line.trim() === "") continue;
      html += `<p>${inline(line)}</p>`;
    }
  }
  if (inList) html += "</ul>";
  return html;
}

// ---------- Chat ----------
const WELCOME = `Hey! I'm **Crack Chat** — your group's American Mah Jongg brain. 🀄

Ask me about the Charleston, jokers, exposures, scoring, dead hands… whatever's got the table arguing. Fair warning: I play to win, but I'll always show my work.`;

const SUGGESTIONS = [
  "Can jokers be used in a pair?",
  "Walk me through the Charleston",
  "Who pays what when I win?",
  "What makes a hand dead?",
];

// In-memory conversation history sent to the API.
let history = [];

function scrollToBottom() {
  els.messages.scrollTop = els.messages.scrollHeight;
}

function addUserMessage(text) {
  const div = document.createElement("div");
  div.className = "msg user";
  div.textContent = text;
  els.messages.appendChild(div);
  scrollToBottom();
}

function addBotBubble() {
  const div = document.createElement("div");
  div.className = "msg bot";
  div.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
  els.messages.appendChild(div);
  scrollToBottom();
  return div;
}

function addSaveButton(bubble, text) {
  const btn = document.createElement("button");
  btn.className = "save-note";
  btn.type = "button";
  btn.innerHTML = "📝 Save to journal";
  btn.addEventListener("click", () => {
    addJournalEntry(text);
    btn.innerHTML = "✓ Saved!";
    btn.disabled = true;
  });
  bubble.appendChild(btn);
}

function renderWelcome() {
  const wrap = document.createElement("div");
  wrap.className = "msg bot welcome";
  wrap.innerHTML = renderMarkdown(WELCOME);
  const chips = document.createElement("div");
  chips.className = "suggestions";
  SUGGESTIONS.forEach((s) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.type = "button";
    chip.textContent = s;
    chip.addEventListener("click", () => {
      els.chatInput.value = s;
      els.chatForm.requestSubmit();
    });
    chips.appendChild(chip);
  });
  wrap.appendChild(chips);
  els.messages.appendChild(wrap);
}

let sending = false;

async function send(text) {
  if (sending || !text.trim()) return;
  sending = true;
  els.sendBtn.disabled = true;

  // Clear the welcome block on first send.
  const welcome = els.messages.querySelector(".welcome");
  if (welcome) welcome.remove();

  addUserMessage(text);
  history.push({ role: "user", content: text });

  const bubble = addBotBubble();
  let full = "";

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    });

    if (!res.ok) {
      let msg = "Something went wrong. Try again in a sec.";
      try {
        const data = await res.json();
        if (data.error) msg = data.error;
      } catch {}
      bubble.innerHTML = renderMarkdown(`⚠ ${msg}`);
      sending = false;
      els.sendBtn.disabled = false;
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      full += decoder.decode(value, { stream: true });
      bubble.innerHTML = renderMarkdown(full);
      scrollToBottom();
    }

    history.push({ role: "assistant", content: full });
    if (full.trim()) addSaveButton(bubble, full);
  } catch (err) {
    bubble.innerHTML = renderMarkdown(
      "⚠ I couldn't reach the server. Check that it's running and try again."
    );
  } finally {
    sending = false;
    els.sendBtn.disabled = false;
    els.chatInput.focus();
    scrollToBottom();
  }
}

els.chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = els.chatInput.value.trim();
  if (!text) return;
  els.chatInput.value = "";
  send(text);
});

// ---------- Journal ----------
function loadJournal() {
  try {
    return JSON.parse(localStorage.getItem(journalKey())) || [];
  } catch {
    return [];
  }
}
function saveJournal(entries) {
  localStorage.setItem(journalKey(), JSON.stringify(entries));
}
function addJournalEntry(text) {
  const entries = loadJournal();
  entries.unshift({ id: Date.now(), text: text.trim(), ts: Date.now() });
  saveJournal(entries);
  renderJournal();
}
function deleteEntry(id) {
  saveJournal(loadJournal().filter((e) => e.id !== id));
  renderJournal();
}
function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function renderJournal() {
  const entries = loadJournal();
  els.journalList.innerHTML = "";
  els.journalEmpty.classList.toggle("hidden", entries.length > 0);
  for (const entry of entries) {
    const li = document.createElement("li");
    li.className = "journal-item";
    const text = document.createElement("div");
    text.className = "text";
    text.textContent = entry.text;
    const meta = document.createElement("div");
    meta.className = "meta";
    const date = document.createElement("span");
    date.className = "date";
    date.textContent = formatDate(entry.ts);
    const del = document.createElement("button");
    del.className = "del";
    del.textContent = "Delete";
    del.addEventListener("click", () => deleteEntry(entry.id));
    meta.append(date, del);
    li.append(text, meta);
    els.journalList.appendChild(li);
  }
}

els.journalForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = els.journalInput.value.trim();
  if (!text) return;
  addJournalEntry(text);
  els.journalInput.value = "";
});

// ---------- Init ----------
updateThemeButton(effectiveTheme());
renderProfile();
renderWelcome();
if (!getName()) {
  // Gently prompt for a name on first visit.
  setTimeout(() => els.profileDialog.showModal(), 400);
}
