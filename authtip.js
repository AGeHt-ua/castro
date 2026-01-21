/* =========================================================
   Family Castro — Auth Tip (arrow)
   - Works with existing auth.js (__CASTRO_AUTH__ + castro-auth event)
   - Shows 1x for guests, and repeats for authed users if profile is not filled
   - Debug:  ?tip=1   (force show)
            ?tipreset=1 (reset localStorage flag)
========================================================= */
(() => {
  const AUTH_BASE = "https://auth.family-castro.fun";
  const PROFILE_URL = AUTH_BASE + "/profile";
  const KEY = "castro_authtip_v1";

  const ready = (fn) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else fn();
  };

  const getUser = () => window.__CASTRO_AUTH__?.user || null;

  const loadProfile = async () => {
    try {
      const res = await fetch(PROFILE_URL, { method: "GET", credentials: "include", cache: "no-store" });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) return {};
      return j.profile || {};
    } catch {
      return {};
    }
  };

  ready(async () => {
    const tip = document.getElementById("auth-tip");
    const authBtn = document.getElementById("auth-login") || document.querySelector(".auth__btn");
    if (!tip || !authBtn) return;

    const url = new URL(location.href);
    const force = url.searchParams.get("tip") === "1";
    const reset = url.searchParams.get("tipreset") === "1";
    if (reset) localStorage.removeItem(KEY);

    const wasShown = localStorage.getItem(KEY) === "1";

    const user = getUser();
    const isAuthed = !!user;

    let profileOk = false;
    if (isAuthed) {
      const p = await loadProfile();
      const ic = String(p.ic || "").trim();
      const sid = String(p.sid || "").trim();
      profileOk = !!(ic && sid);
    }

    const shouldShow = force || ((!isAuthed && !wasShown) || (isAuthed && !profileOk));
    if (!shouldShow) return;

    const place = () => {
      const r = authBtn.getBoundingClientRect();
      const bubble = tip.querySelector(".authtip__bubble");
      const bubbleW = bubble ? bubble.getBoundingClientRect().width : Math.min(320, window.innerWidth - 24);
      const gap = 16;

      // default: bubble to the LEFT of the auth button (button is top-right)
      let left = Math.round(r.left - bubbleW - gap);
      let top  = Math.round(r.top + r.height / 2 - 70);

      if (left < 12) left = Math.round(r.right + gap);
      if (left + bubbleW > window.innerWidth - 12) left = Math.round(window.innerWidth - bubbleW - 12);

      if (top < 12) top = 12;
      if (top > window.innerHeight - 180) top = Math.round(window.innerHeight - 180);

      tip.style.left = left + "px";
      tip.style.top  = top + "px";
    };

    const open = () => {
      tip.classList.add("is-open");
      tip.setAttribute("aria-hidden", "false");
      place();
      window.addEventListener("resize", place);
      window.addEventListener("scroll", place, true);
    };

    const close = (mark = true) => {
      tip.classList.remove("is-open");
      tip.setAttribute("aria-hidden", "true");
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      if (mark && !force) localStorage.setItem(KEY, "1");
    };

    document.getElementById("authtip-go")?.addEventListener("click", () => {
      authBtn.scrollIntoView({ behavior: "smooth", block: "center" });
      authBtn.focus?.();
      authBtn.click?.();
      close(true);
    });

    document.getElementById("authtip-close")?.addEventListener("click", () => close(true));

    setTimeout(open, 700);
    setTimeout(() => close(true), 12000);

    // If user logs in after page load: show again if profile isn't filled
    window.addEventListener("castro-auth", async () => {
      const u = getUser();
      if (!u) return;

      const p = await loadProfile();
      const ic = String(p.ic || "").trim();
      const sid = String(p.sid || "").trim();
      const ok = !!(ic && sid);

      if (!ok) {
        localStorage.removeItem(KEY);
        setTimeout(open, 300);
      }
    });
  });
})();
