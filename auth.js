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

  // ✅ Глобальний юзер для інших скриптів (order.js / join.js)
  window.CASTRO_AUTH_USER = null;

  const emitAuth = (userOrNull) => {
    window.CASTRO_AUTH_USER = userOrNull || null;
    window.dispatchEvent(new CustomEvent("castro:auth", { detail: window.CASTRO_AUTH_USER }));
  };

  const setLoading = (isLoading) => {
    loginBtn.disabled = isLoading;
    loginBtn.style.opacity = isLoading ? "0.6" : "1";
  };

  const avatarUrl = (user) => {
    if (!user?.id || !user?.avatar) return "";
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=96`;
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
    // return на ту сторінку, де ти зараз
    const ret = encodeURIComponent(window.location.href);
    window.location.href = `${loginUrl}?return=${ret}`;
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      setLoading(true);
      await fetch(logoutUrl, { method: "POST", credentials: "include" });
    } catch {}
    // ✅ одразу “обнулити” юзера для інших скриптів
    emitAuth(null);
    // простіше: перезавантажити сторінку
    window.location.reload();
  });

  // init
  setLoading(true);
  fetchMe().finally(() => setLoading(false));
})();
