/* =========================================================
   Family Castro — Auth Tip (always show)
   ✅ Показує підказку КОЖНОГО разу при заході на сторінку.
   ✅ Після логіну "приклеюється" до auth-user (а не до прихованої кнопки)
   ✅ Без localStorage: "Закрити" ховає тільки до перезавантаження

   Debug:
     ?tip=1  -> форс-показ
========================================================= */
(() => {
  const ready = (fn) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else fn();
  };

  const getUser = () => window.__CASTRO_AUTH__?.user || null;

  ready(() => {
    const tip = document.getElementById("auth-tip");
    const loginBtn =
      document.getElementById("auth-login") || document.querySelector(".auth__btn");
    const userBox = document.getElementById("auth-user"); // показується після логіну

    if (!tip || !loginBtn) return;

    const url = new URL(location.href);
    const force = url.searchParams.get("tip") === "1";

    // ✅ Кнопки шукаємо ТІЛЬКИ всередині tip, щоб не ламалося від дубль-ID
    const goBtn = tip.querySelector("#authtip-go");
    const closeBtn = tip.querySelector("#authtip-close");

    const getAnchor = () => {
      const loggedIn = !!getUser() && userBox && !userBox.classList.contains("hidden");
      return loggedIn ? userBox : loginBtn;
    };

    const place = () => {
      const anchor = getAnchor();
      const r = anchor.getBoundingClientRect();
      if (!r || (r.width === 0 && r.height === 0)) return;

      const bubble = tip.querySelector(".authtip__bubble");
      const bubbleW = bubble
        ? bubble.getBoundingClientRect().width
        : Math.min(360, window.innerWidth - 24);

      const gap = 16;
      const preferLeft = (r.right > window.innerWidth * 0.6);

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
    };

    goBtn?.addEventListener("click", () => {
      const anchor = getAnchor();
      anchor.scrollIntoView({ behavior: "smooth", block: "center" });
      loginBtn.focus?.();
      loginBtn.click?.();
      close();
    });

    closeBtn?.addEventListener("click", () => close());

    // ✅ Показ завжди (як ти хочеш)
    if (force || true) setTimeout(open, 600);

    // Після логіну/оновлення стану — перепозиціонуємо
    window.addEventListener("castro-auth", () => {
      if (tip.classList.contains("is-open")) place();
    });
  });
})();
