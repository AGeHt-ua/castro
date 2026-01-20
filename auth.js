/*
  Discord OAuth2 Auth Widget
  - показує кнопку "Увійти через Discord" або профіль + "Вийти"
  - очікує бекенд (Cloudflare Worker) з роутами:
      GET  {WORKER_BASE}/auth/me
      GET  {WORKER_BASE}/auth/login?return=<url>
      POST {WORKER_BASE}/auth/logout
  - /auth/me повертає JSON:
      { ok: true, user: { id, username, global_name, avatar_url } }
    або { ok:false }
*/

(() => {
  const WORKER_BASE = window.DISCORD_AUTH_WORKER || "https://YOUR_WORKER_DOMAIN";

  function el(tag, attrs = {}, html = ""){
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k,v]) => {
      if(k === "class") n.className = v;
      else if(k === "dataset") Object.assign(n.dataset, v);
      else n.setAttribute(k, v);
    });
    if(html) n.innerHTML = html;
    return n;
  }

  function safeName(u){
    return (u.global_name || u.username || "Discord").toString();
  }

  async function apiMe(){
    try{
      const res = await fetch(`${WORKER_BASE}/auth/me`, {
        credentials: "include",
        cache: "no-store",
        headers: { "Accept": "application/json" }
      });
      if(!res.ok) return { ok:false };
      const j = await res.json().catch(()=>({ok:false}));
      return j && typeof j === "object" ? j : { ok:false };
    }catch{
      return { ok:false };
    }
  }

  async function apiLogout(){
    try{
      await fetch(`${WORKER_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
    }catch{}
  }

  function mountShell(){
    if(document.getElementById("authDock")) return document.getElementById("authDock");
    const dock = el("div", { id: "authDock", class: "authDock" });
    document.body.appendChild(dock);
    return dock;
  }

  function renderLoggedOut(dock){
    dock.innerHTML = "";

    const ret = encodeURIComponent(window.location.href);
    const loginHref = `${WORKER_BASE}/auth/login?return=${ret}`;

    const btn = el("a", {
      class: "authBtn",
      href: loginHref,
      rel: "nofollow"
    }, "🔐 Увійти через Discord");

    dock.appendChild(btn);
  }

  function renderLoggedIn(dock, user){
    dock.innerHTML = "";

    const profile = el("a", { class: "authChip", href: "#", title: "Discord профіль" });
    profile.addEventListener("click", (e) => e.preventDefault());

    const img = el("img", { class: "authAva", alt: "Discord avatar" });
    img.src = user.avatar_url || "";

    const name = el("span", { class: "authName" }, safeName(user));
    profile.appendChild(img);
    profile.appendChild(name);

    const logout = el("button", { class: "authBtn", type: "button" }, "🚪 Вийти");
    logout.addEventListener("click", async () => {
      logout.disabled = true;
      await apiLogout();
      renderLoggedOut(dock);
      logout.disabled = false;
    });

    dock.appendChild(profile);
    dock.appendChild(logout);
  }

  async function init(){
    const dock = mountShell();
    renderLoggedOut(dock);

    const me = await apiMe();
    if(me && me.ok && me.user){
      renderLoggedIn(dock, me.user);
    }
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
