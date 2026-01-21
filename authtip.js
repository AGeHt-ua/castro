/* =========================================================
   Family Castro — Auth Tip (stable + logical)
   Логіка:
   ✅ Якщо НЕ авторизований -> показує завжди при заході
   ✅ Якщо авторизований, але профіль НЕ заповнений (ic + sid) -> показує
   ✅ Якщо профіль заповнений -> НЕ показує
   ✅ Після логіну/логауту (подія castro-auth) -> перевіряє знову і показує/ховає
   ✅ Кнопка "Авторизуватись":
        - якщо не залогінений -> натискає Discord login
        - якщо залогінений -> відкриває модалку профілю (profile.js), якщо доступна
   Debug:
     ?tip=1 -> форс-показ
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

  const isProfileOk = (p) => {
    const ic = String(p?.ic || "").trim();
    const sid = String(p?.sid || "").trim();
    return !!(ic && sid);
  };

  ready(() => {
    const tip = document.getElementById("auth-tip");
    const loginBtn = document.getElementById("auth-login") || document.querySelector(".auth__btn");
    const userBox = document.getElementById("auth-user");
    if (!tip || !loginBtn) return;

    // IMPORTANT: кнопки беремо тільки всередині tip (на випадок дублів)
    const goBtn = tip.querySelector("#authtip-go");
    const closeBtn = tip.querySelector("#authtip-close");

    const url = new URL(location.href);
    const force = url.searchParams.get("tip") === "1";

    const isLoggedInUI = () => !!getUser() && userBox && !userBox.classList.contains("hidden");

    const getAnchor = () => (isLoggedInUI() ? userBox : loginBtn);

    const place = () => {
      const anchor = getAnchor();
      const r = anchor.getBoundingClientRect();
      if (!r || (r.width === 0 && r.height === 0)) return;

      const bubble = tip.querySelector(".authtip__bubble");
      const bubbleW = bubble ? bubble.getBoundingClientRect().width : Math.min(360, window.innerWidth - 24);

      const gap = 16;
      const preferLeft = r.right > window.innerWidth * 0.6;

      let left = preferLeft ? Math.round(r.left - bubbleW - gap) : Math.round(r.right + gap);
      let top  = Math.round(r.top + r.height / 2 - 70);

      if (left < 12) left = 12;
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

    const close = () => {
      tip.classList.remove("is-open");
      tip.setAttribute("aria-hidden", "true");
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    // --- UI text/labels depending on state (guest vs need profile)
    const textBox = tip.querySelector(".authtip__text");
    const guestHTML = textBox ? textBox.innerHTML : "";

    const setGuestUI = () => {
      if (textBox) textBox.innerHTML = guestHTML;
      const mono = tip.querySelector(".authtip__mono");
      if (mono) mono.style.display = "";
      if (goBtn) goBtn.textContent = "Авторизуватись";
    };

    const setNeedProfileUI = () => {
      if (textBox) textBox.innerHTML = "<b>Налаштуйте профіль:</b>";
      const mono = tip.querySelector(".authtip__mono");
      if (mono) mono.style.display = "none";
      if (goBtn) goBtn.textContent = "Налаштувати";
    };
};

    const openProfileModalIfPossible = () => {
      // profile.js не експортує openModal у window, тому ми "клікаємо" по кнопці/боксу юзера,
      // бо в profile.js там зазвичай висить відкриття модалки.
      if (typeof window.openProfileModal === "function") {
        window.openProfileModal();
        return true;
      }
      // fallback: клік по userBox якщо він є
      if (userBox && !userBox.classList.contains("hidden")) {
        userBox.click?.();
        return true;
      }
      return false;
    };

    goBtn?.addEventListener("click", () => {
      const anchor = getAnchor();
      anchor.scrollIntoView({ behavior: "smooth", block: "center" });

      if (!isLoggedInUI()) {
        loginBtn.focus?.();
        loginBtn.click?.();
      } else {
        // залогінений -> відкриваємо профіль (щоб ввів ic/sid)
        openProfileModalIfPossible();
      }
      close();
    });

    closeBtn?.addEventListener("click", () => close());

    // --- головна функція перевірки/показу
    let lastDecision = null; // "show" | "hide"
    const evaluate = async () => {
      if (force) {
        // форс-показ показує як для гостя (щоб було зрозуміло)
        setGuestUI();
        if (lastDecision !== "show") open();
        lastDecision = "show";
        return;
      }

      const user = getUser();
      const authed = !!user;

      if (!authed) {
        setGuestUI();
        if (lastDecision !== "show") open();
        lastDecision = "show";
        return;
      }

      // authed -> перевір профіль
      const p = await loadProfile();
      const ok = isProfileOk(p);

      if (ok) {
        if (lastDecision !== "hide") close();
        lastDecision = "hide";
      } else {
        setNeedProfileUI();
        if (lastDecision !== "show") open();
        lastDecision = "show";
      }
    };

    // Старт: даємо auth.js встигнути fetchMe + emitAuth
    setTimeout(() => { evaluate(); }, 700);

    // На зміну стану
    window.addEventListener("castro-auth", () => {
      // auth.js міняє UI (hidden/class) синхронно, але надійніше — через мікротаск
      setTimeout(() => { evaluate(); }, 0);
    });

    // Коли збережено профіль (profile.js кидає подію) — перевіряємо знову
    window.addEventListener("castro-profile", () => {
      setTimeout(() => { evaluate(); }, 0);
    });
  });
})();
