// сюди вставиш свій Cloudflare Worker URL
const WORKER_ENDPOINT = "https://odd-night-e9f6.d-f-12339.workers.dev";

const form = document.getElementById("orderForm");
const statusEl = document.getElementById("status");

function setStatus(text, ok = true) {
  statusEl.textContent = text;
  statusEl.style.opacity = "1";
  statusEl.style.color = ok ? "" : "#ff6b6b";
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus("Відправляю…");

  const data = Object.fromEntries(new FormData(form).entries());

  if (!String(data.nicknameId || "").includes("|")) {
    setStatus("Помилка: формат має бути Nickname | ID", false);
    return;
  }

  try {
    const res = await fetch(WORKER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "HTTP " + res.status);
    }

    form.reset();
    setStatus("✅ Заявка відправлена в Discord!");
  } catch (err) {
    console.error(err);
    setStatus("❌ Не вдалося відправити. Перевір Worker URL / секрет webhook.", false);
  }
});

/* ===========================
   Profile settings + Autofill
=========================== */

const LS_PROFILE_KEY = "castro_profile_v1";

function loadProfile() {
  try { return JSON.parse(localStorage.getItem(LS_PROFILE_KEY) || "{}"); }
  catch { return {}; }
}
function saveProfile(p) {
  localStorage.setItem(LS_PROFILE_KEY, JSON.stringify(p || {}));
}

function discordMention(user) {
  // user: { id, username, discriminator? }
  if (!user || !user.id) return "";
  // клікабельне посилання (можна відкривати в браузері)
  return `https://discord.com/users/${user.id}`;
}

function setReadonly(el, state) {
  if (!el) return;
  el.readOnly = !!state;
  el.disabled = false; // не дизейблимо щоб можна було копіювати
  el.classList.toggle("is-locked", !!state);
}

function autofillForms(authUser) {
  const profile = loadProfile();

  // join.html
  const joinIc = document.querySelector('[name="icName"], #icName, input[data-field="icName"]');
  const joinSid = document.querySelector('[name="staticId"], #staticId, input[data-field="staticId"]');
  const joinDiscord = document.querySelector('[name="discord"], #discord, input[data-field="discord"]');

  // order.html (під твої реальні id/name; я роблю кілька варіантів щоб точно влучити)
  const orderNick = document.querySelector('[name="nickStatic"], #nickStatic, #buyerNick, input[data-field="nickStatic"]');
  const orderDiscord = document.querySelector('[name="discord"], #discord, #buyerDiscord, input[data-field="discord"]');

  const isAuthed = !!authUser;

  // значення
  const ic = (profile.ic || "").trim();
  const sid = (profile.sid || "").trim();
  const discordLink = isAuthed ? discordMention(authUser) : "";

  // join автозаповнення
  if (joinIc && ic) joinIc.value = ic;
  if (joinSid && sid) joinSid.value = sid;
  if (joinDiscord && isAuthed) joinDiscord.value = discordLink;

  // order автозаповнення
  if (orderNick && (ic || sid)) {
    const combo = `${ic || "—"} | ${sid || "—"}`.trim();
    orderNick.value = combo;
  }
  if (orderDiscord && isAuthed) orderDiscord.value = discordLink;

  // lock/unlock тільки якщо авторизований
  setReadonly(joinIc, isAuthed);
  setReadonly(joinSid, isAuthed);
  setReadonly(joinDiscord, isAuthed);

  setReadonly(orderNick, isAuthed);
  setReadonly(orderDiscord, isAuthed);
}

function initProfileModal(authUserGetter) {
  const modal = document.getElementById("profile-modal");
  const btnSave = document.getElementById("pf-save");
  const inpIc = document.getElementById("pf-ic");
  const inpSid = document.getElementById("pf-sid");

  if (!modal || !btnSave || !inpIc || !inpSid) return;

  const open = () => {
    const p = loadProfile();
    inpIc.value = p.ic || "";
    inpSid.value = p.sid || "";
    modal.classList.remove("hidden");
    inpIc.focus();
  };
  const close = () => modal.classList.add("hidden");

  modal.addEventListener("click", (e) => {
    if (e.target && e.target.matches("[data-close]")) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  btnSave.addEventListener("click", () => {
    const ic = inpIc.value.trim();
    const sid = inpSid.value.trim().replace(/\D+/g, ""); // тільки цифри
    saveProfile({ ic, sid });
    close();
    const u = authUserGetter ? authUserGetter() : null;
    autofillForms(u);
  });

  // ✅ клік по профілю (по блоку auth-user) відкриває модалку
  const authUserEl = document.getElementById("auth-user");
  if (authUserEl) {
    authUserEl.style.cursor = "pointer";
    authUserEl.addEventListener("click", (e) => {
      // щоб кнопка logout не відкривала модалку
      if (e.target && e.target.id === "auth-logout") return;
      open();
    });
  }

  // відкривати налаштування також з кнопки "Увійти" після логіну не треба — лише з профілю
}

/*
  ⚠️ ВАЖЛИВО:
  Тобі треба викликати нижче 2 штуки тоді, коли auth.js вже знає хто залогінений.
  У тебе вже є логіка, яка показує #auth-user та ховає #auth-login.
  В тій точці просто виклич:
    autofillForms(currentUser);
    initProfileModal(() => currentUser);
*/

// Якщо в тебе в auth.js вже є глобальний currentUser — закоментуй рядки нижче і підключи як написано вище.
window.__CASTRO_AUTOFILL__ = { autofillForms, initProfileModal };

