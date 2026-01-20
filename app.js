// order.js — форма замовлення + профіль (IC/Static ID) + авто-заповнення/lock після Discord-авторизації
// ✅ ВАЖЛИВО: AUTH (login/logout) у тебе вже робить auth.js. Цей файл тільки підхоплює юзера і заповнює форми.

// сюди вставиш свій Cloudflare Worker URL
const WORKER_ENDPOINT = "https://odd-night-e9f6.d-f-12339.workers.dev";

const form = document.getElementById("orderForm");
const statusEl = document.getElementById("status");

function setStatus(text, ok = true) {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.style.opacity = "1";
  statusEl.style.color = ok ? "" : "#ff6b6b";
}

// ==============================
// ✅ Submit to Worker
// ==============================
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus("Відправляю…");

  const data = Object.fromEntries(new FormData(form).entries());

  // Поле має бути: Nickname | ID
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

    // Не чіпаємо автозаповнені поля — просто чистимо все, а потім повертаємо автофіл
    form.reset();
    setStatus("✅ Заявка відправлена в Discord!");

    // повертаємо автофіл (якщо авторизований)
    autofillForms(currentUser);
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

function discordLink(user) {
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

// ------------------------------
// ✅ Тут ЗАДАЙ селектори полів order.html
// Якщо в тебе інші id/name — заміни тут 2 рядки.
// ------------------------------
function getOrderFields() {
  const nicknameId = document.querySelector('[name="nicknameId"], #nicknameId');
  const discord = document.querySelector('[name="discord"], #discord');
  return { nicknameId, discord };
}

// ✅ Якщо у тебе є join.html на цій сторінці — можна залишити (не заважає)
function getJoinFields() {
  const icName = document.querySelector('[name="icName"], #icName, input[data-field="icName"]');
  const staticId = document.querySelector('[name="staticId"], #staticId, input[data-field="staticId"]');
  const discord = document.querySelector('[name="discord"], #discord, input[data-field="discord"]');
  return { icName, staticId, discord };
}

function autofillForms(authUser) {
  const profile = loadProfile();
  const isAuthed = !!authUser;

  const ic = (profile.ic || "").trim();
  const sid = (profile.sid || "").trim();
  const dlink = isAuthed ? discordLink(authUser) : "";

  // order.html
  const order = getOrderFields();
  if (order.nicknameId && (ic || sid)) {
    order.nicknameId.value = `${ic || "—"} | ${sid || "—"}`;
  }
  if (order.discord && isAuthed) {
    order.discord.value = dlink;
  }

  // lock/unlock (тільки якщо авторизований)
  setReadonly(order.nicknameId, isAuthed);
  setReadonly(order.discord, isAuthed);

  // join.html (якщо раптом цей код підключений на join)
  const join = getJoinFields();
  if (join.icName && ic) join.icName.value = ic;
  if (join.staticId && sid) join.staticId.value = sid;
  if (join.discord && isAuthed) join.discord.value = dlink;

  setReadonly(join.icName, isAuthed);
  setReadonly(join.staticId, isAuthed);
  setReadonly(join.discord, isAuthed);
}

function initProfileModal(authUserGetter) {
  const modal = document.getElementById("profile-modal");
  const btnSave = document.getElementById("pf-save");
  const inpIc = document.getElementById("pf-ic");
  const inpSid = document.getElementById("pf-sid");

  // Якщо модалки нема на сторінці — просто вихід (код автофілу працюватиме і без модалки)
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
}

// ==============================
// ✅ Підхоплюємо юзера з auth.js
// ==============================
//
// Варіант 1: auth.js встановлює window.CASTRO_AUTH_USER = {id, username, ...}
// Варіант 2: auth.js диспатчить подію:
//   window.dispatchEvent(new CustomEvent("castro:auth", { detail: userOrNull }))
//
let currentUser = null;

function setUser(u) {
  currentUser = u || null;
  autofillForms(currentUser);
}

// 1) якщо auth.js вже поклав юзера в глобал
if (window.CASTRO_AUTH_USER) {
  setUser(window.CASTRO_AUTH_USER);
}

// 2) слухаємо подію від auth.js
window.addEventListener("castro:auth", (e) => {
  setUser(e?.detail || null);
});

// 3) ініціалізація модалки + первинний автофіл (на випадок без auth)
initProfileModal(() => currentUser);
autofillForms(currentUser);
