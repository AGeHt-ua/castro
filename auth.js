(() => {
  const AUTH_BASE = "https://auth.family-castro.fun";
  const $ = (id) => document.getElementById(id);

  const loginBtn = $("auth-login");
  const userBox = $("auth-user");
  const avatarEl = $("auth-avatar");
  const nameEl = $("auth-name");
  const logoutBtn = $("auth-logout");

  if (!loginBtn || !userBox) return;

  const meUrl = AUTH_BASE + "/auth/me";
  const loginUrl = AUTH_BASE + "/auth/login";
  const logoutUrl = AUTH_BASE + "/auth/logout";

  // 🔥 ГЛОБАЛЬНИЙ ЮЗЕР
  window.CASTRO_AUTH_USER = null;

  const emitAuth = (user) => {
    window.CASTRO_AUTH_USER = user || null;
    window.dispatchEvent(
      new CustomEvent("castro:auth", { detail: window.CASTRO_AUTH_USER })
    );
  };

  const avatarUrl = (u) =>
    u?.id && u?.avatar
      ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=96`
      : "";

  const showOut = () => {
    userBox.classList.add("hidden");
    loginBtn.classList.remove("hidden");
    emitAuth(null);
  };

  const showIn = (u) => {
    nameEl.textContent = u.name || "Discord";
    const av = avatarUrl(u);
    if (av) avatarEl.src = av;
    loginBtn.classList.add("hidden");
    userBox.classList.remove("hidden");
    emitAuth(u);
  };

  const fetchMe = async () => {
    try {
      const r = await fetch(meUrl, { credentials: "include" });
      const j = await r.json();
      if (j?.ok && j.user) return showIn(j.user);
    } catch {}
    showOut();
  };

  loginBtn.onclick = () => {
    const ret = encodeURIComponent(location.href);
    location.href = `${loginUrl}?return=${ret}`;
  };

  logoutBtn.onclick = async () => {
    try {
      await fetch(logoutUrl, { method: "POST", credentials: "include" });
    } catch {}
    emitAuth(null);
    location.reload();
  };

  fetchMe();
})();
