(() => {
  // ✅ Твій Worker
  const AUTH_BASE = "https://auth.family-castro.fun";

  const $ = (id) => document.getElementById(id);

  // DOM
  const box = $("auth-box");
  const loginBtn = $("auth-login");
  const userBox = $("auth-user");
  const avatarEl = $("auth-avatar");
  const nameEl = $("auth-name");
  const logoutBtn = $("auth-logout");

  // If widget not on page — just exit
  if (!box || !loginBtn || !userBox || !avatarEl || !nameEl || !logoutBtn) return;

  const meUrl = AUTH_BASE + "/auth/me";
  const loginUrl = AUTH_BASE + "/auth/login";
  const logoutUrl = AUTH_BASE + "/auth/logout";

  const setLoading = (isLoading) => {
    loginBtn.disabled = isLoading;
    loginBtn.style.opacity = isLoading ? "0.6" : "1";
  };

  const avatarUrl = (user) => {
    if (!user?.id || !user?.avatar) return "";
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=96`;
  };

  const emitAuth = (user) => {
    // глобально зберігаємо стан
    window.__CASTRO_AUTH__ = { user: user || null };
    // івент для profile.js
    window.dispatchEvent(new CustomEvent("castro-auth", { detail: { user: user || null } }));
  };

  const showLoggedOut = () => {
    userBox.classList.add("hidden");
    loginBtn.classList.remove("hidden");
    emitAuth(null);
  };

  const showLoggedIn = (user) => {
    nameEl.textContent = user?.name || "Discord";

    const av = avatarUrl(user);
    if (av) {
      avatarEl.src = av;
      avatarEl.style.display = "block";
    } else {
      avatarEl.removeAttribute("src");
      avatarEl.style.display = "none";
    }

    loginBtn.classList.add("hidden");
    userBox.classList.remove("hidden");
    emitAuth(user);
  };

  const fetchMe = async () => {
    try {
      const res = await fetch(meUrl, { credentials: "include" });
      const data = await res.json().catch(() => null);

      if (data?.ok && data?.user) {
        showLoggedIn(data.user);
        return true;
      }
    } catch {}

    showLoggedOut();
    return false;
  };

  loginBtn.addEventListener("click", () => {
    const ret = encodeURIComponent(window.location.href);
    window.location.href = `${loginUrl}?return=${ret}`;
  });

  logoutBtn.addEventListener("click", async (e) => {
    e.stopPropagation(); // важливо, щоб не відкривалась модалка
    try {
      setLoading(true);
      await fetch(logoutUrl, { method: "POST", credentials: "include" });
    } catch {}
    window.location.reload();
  });

userBox.addEventListener("click", () => {
  // Наприклад, відкрити модалку профілю
  const modal = document.getElementById("profile-modal");
  if (modal) modal.classList.remove("hidden");
});
  
  // init
  setLoading(true);
  fetchMe().finally(() => setLoading(false));
})();

<script>
/* =========================
   🔐 AUTH GATE — BLOCK FORMS
   ========================= */

let AUTH_USER = null;

async function checkAuthGate() {
  try {
    const res = await fetch("https://auth.family-castro.fun/auth/me", {
      credentials: "include",
      cache: "no-store"
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok || !json.user) {
      AUTH_USER = null;
      lockForms();
      return;
    }

    AUTH_USER = json.user;
    unlockForms();
  } catch {
    AUTH_USER = null;
    lockForms();
  }
}

function lockForms() {
  // 🔒 всі submit / send кнопки
  document.querySelectorAll("button[type='submit'], #sendBtn").forEach(b => {
    b.disabled = true;
    b.classList.add("locked");
  });

  // 🧊 блокуємо поля
  document.querySelectorAll("input, textarea, select").forEach(el => {
    el.setAttribute("data-locked", "1");
  });

  showAuthWarning();
}

function unlockForms() {
  document.querySelectorAll("button[type='submit'], #sendBtn").forEach(b => {
    b.disabled = false;
    b.classList.remove("locked");
  });

  document.querySelectorAll("[data-locked]").forEach(el => {
    el.removeAttribute("data-locked");
  });

  hideAuthWarning();
}

function showAuthWarning() {
  if (document.getElementById("auth-warning")) return;

  const div = document.createElement("div");
  div.id = "auth-warning";
  div.innerHTML = `
    🔐 <b>Потрібна авторизація</b><br>
    Увійди через Discord, щоб відправляти форми
  `;
  div.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,.85);
    border: 1px solid rgba(255,255,255,.2);
    color: #fff;
    padding: 12px 16px;
    border-radius: 14px;
    font-weight: 900;
    z-index: 99999;
    backdrop-filter: blur(10px);
    text-align: center;
  `;
  document.body.appendChild(div);
}

function hideAuthWarning() {
  document.getElementById("auth-warning")?.remove();
}

/* 🚀 старт */
checkAuthGate();

/* 🔁 перевірка після логіну / логауту */
window.addEventListener("focus", checkAuthGate);
</script>
