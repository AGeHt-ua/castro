/* =========================================================
   Family Castro — Auth Tip (smart)
   ✅ Показує підказку:
      - якщо НЕ авторизований (кожен захід)
      - якщо авторизований, але профіль НЕ заповнений (ic + sid)
   ✅ НЕ показує, якщо профіль заповнений
   ✅ Після логіну автоматично:
      - якщо профіль ОК -> ховає підказку
      - якщо профіль НЕ ОК -> може відкрити (або перепозиціонує)

   Debug:
     ?tip=1  -> форс-показ
========================================================= */
(() => {
  const AUTH_BASE = "https://auth.family-castro.fun";
  const PROFILE_URL = AUTH_BASE + "/profile";

  const ready = (fn) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else fn();
  };

  const getUser = () => window.__CASTRO_AUTH__?.user || null;

  const loadProfile = async () => {
    try {
      const res = await fetch(PROFILE_URL, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) return {};
      return j.profile || {};
    } catch {
      return {};
    }
  };

  const profileIsOk = (p) => {
    const ic = String(p?.ic || "").trim();
    const sid = String(p?.sid || "").trim();
    return !!(ic && sid);
  };

  ready(async () => {
    const tip = document.getElementById("auth-tip");
    const loginBtn =
      document.getElementById("auth-login") || document.querySelector(".auth__btn");
    const userBox = document.getElementById("auth-user"); // показується після логіну
    if (!tip || !loginBtn) return;

    const url = new URL(location.href);
    const force = url.searchParams.get("tip") === "1";

    const goBtn = tip.querySelector("#authtip-go");
    const closeBtn = tip.querySelector("#authtip-close");

    const isLoggedInUI = () =>
      !!getUser() && userBox && !userBox.classList.contains("hidden");

    const getAnchor = () => (isLoggedInUI() ? userBox : loginBtn);

    const place = () => {
      const anchor = getAnchor();
      const r = anchor.getBoundingClientRect();
      if (!r || (r.width === 0 && r.height === 0)) return;

      const bubble = tip.querySelector(".authtip__bubble");
      const bubbleW = bubble
        ? bubble.getBoundingClientRect().width
        : Math.min(360, window.innerWidth - 24);

      const gap = 16;
      const preferLeft = r.right > window.innerWidth * 0.6;

      let left = preferLeft
        ? Math.round(r.left - bubbleW - gap)
        : Math.round(r.right + gap);
      let top = Math.round(r.top + r.height / 2 - 70);

      if (left < 12) left = 12;
      if (left + bubbleW > window.innerWidth - 12)
        left = Math.round(window.innerWidth - bubbleW - 12);
      if (top < 12) top = 12;
      if (top > window.innerHeight - 180) top = Math.round(window.innerHeight - 180);

      tip.style.left = left + "px";
      tip.style.top = top + "px";
    };

    const open = () => {
      tip.classList.add("is-open");
      tip.setAttribute("aria-hidden", "false");
      place();
      window.addEventListener("resize", place);
      window.addEventListener("scroll", place, true);
    };

    const close = () => {
      tip.classList.remove("is-open");
      tip.setAttribute("aria-hidden", "true");
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };

    goBtn?.addEventListener("click", () => {
      const anchor = getAnchor();
      anchor.scrollIntoView({ behavior: "smooth", block: "center" });

      // Якщо вже залогінений — краще відкривати профіль (модалка) замість повторного логіну
      if (isLoggedInUI() && typeof window.openProfileModal === "function") {
        window.openProfileModal();
      } else {
        loginBtn.focus?.();
        loginBtn.click?.();
      }
      close();
    });

    closeBtn?.addEventListener("click", () => close());

    // --- рішення, показувати чи ні
    let shouldShow = force;

    const user = getUser();
    const isAuthed = !!user;

    if (!shouldShow) {
      if (!isAuthed) {
        // ✅ гість: показуємо кожного разу
        shouldShow = true;
      } else {
        // ✅ авторизований: показуємо ТІЛЬКИ якщо профіль НЕ заповнений
        const p = await loadProfile();
        shouldShow = !profileIsOk(p);
      }
    }

    if (shouldShow) setTimeout(open, 600);

    // Після оновлення стану (логін/логаут) — переперевіряємо
    window.addEventListener("castro-auth", async () => {
      const u = getUser();
      const authedNow = !!u;

      if (!authedNow) {
        // якщо вийшов — можна показати знову
        if (!tip.classList.contains("is-open")) setTimeout(open, 300);
        else place();
        return;
      }

      // залогінився -> перевір профіль
      const p = await loadProfile();
      if (profileIsOk(p)) {
        // ✅ профіль ок — НЕ показуємо
        close();
      } else {
        // ❗ профіль не ок — якщо закрито, можеш відкрити або просто перепозиціонуємо
        if (tip.classList.contains("is-open")) place();
        else setTimeout(open, 300);
      }
    });
  });
})();
