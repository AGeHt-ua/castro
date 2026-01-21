/* =========================================================
   Family Castro — Auth Tip (always show)
   ✅ Показує підказку КОЖНОГО разу при заході на сторінку.
   ✅ Після логіну "приклеюється" до auth-user (а не до прихованої кнопки)
   ✅ Без localStorage: "Закрити" ховає тільки до перезавантаження

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

  ready(async () => {
    const tip = document.getElementById("auth-tip");
    const loginBtn = document.getElementById("auth-login") || document.querySelector(".auth__btn");
    const userBox = document.getElementById("auth-user"); // показується після логіну
    if (!tip || !loginBtn) return;

    const url = new URL(location.href);
    const force = url.searchParams.get("tip") === "1";

    // Вибираємо якір: якщо юзер залогінений — біля блоку юзера, інакше біля кнопки
    const getAnchor = () => {
      const loggedIn = !!getUser() && userBox && !userBox.classList.contains("hidden");
      return loggedIn ? userBox : loginBtn;
    };

    // Якщо хочеш "завжди" — лишаємо true.
    // (нижче profileOk рахуємо тільки для потенційних майбутніх правил/тексту)
    const user = getUser();
    const isAuthed = !!user;

    let profileOk = false;
    if (isAuthed) {
      const p = await loadProfile();
      const ic = String(p.ic || "").trim();
      const sid = String(p.sid || "").trim();
      profileOk = !!(ic && sid);
    }

    const shouldShow = force || true;
    if (!shouldShow) return;

    const place = () => {
      const anchor = getAnchor();
      const r = anchor.getBoundingClientRect();

      // якщо елемент прихований/0x0 — не позиціонуємо
      if (!r || (r.width === 0 && r.height === 0)) return;

      const bubble = tip.querySelector(".authtip__bubble");
      const bubbleW = bubble
        ? bubble.getBoundingClientRect().width
        : Math.min(360, window.innerWidth - 24);

      const gap = 16;

      // Якщо якір справа — ставимо зліва, і навпаки
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

    document.getElementById("authtip-go")?.addEventListener("click", () => {
      const anchor = getAnchor();
      anchor.scrollIntoView({ behavior: "smooth", block: "center" });

      // Якщо залогінений і профіль не ок — логічніше підштовхнути до профілю,
      // але поки просто клікаємо по кнопці логіну (як ти хотів).
      loginBtn.focus?.();
      loginBtn.click?.();
      close();
    });

    document.getElementById("authtip-close")?.addEventListener("click", () => close());

    setTimeout(open, 600);

    // Після того як auth.js визначить статус (fetchMe) — перепозиціонуй
    window.addEventListener("castro-auth", async () => {
      // якщо користувач залогінився — перемістимо підказку до auth-user
      if (tip.classList.contains("is-open")) place();
      else {
        // якщо хочеш, щоб ПІСЛЯ логіну підказка відкривалась заново — розкоментуй:
        // setTimeout(open, 200);
      }
    });
  });
})();
