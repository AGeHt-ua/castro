/* =========================================================
   Family Castro — Auth Tip (always show)
   ✅ Показує підказку КОЖНОГО разу при заході на сторінку.
   - Працює з існуючим auth.js (window.__CASTRO_AUTH__ + подія castro-auth)
   - Якщо користувач вже авторизований, по кнопці "Авторизуватись" просто натисне auth-login
   - Закриття ховає підказку лише до перезавантаження сторінки (без localStorage)

   Debug:
     ?tip=1      -> форс-показ (навіть якщо ти вимкнеш показ вручну в коді)
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
    const authBtn =
      document.getElementById("auth-login") || document.querySelector(".auth__btn");
    if (!tip || !authBtn) return;

    const url = new URL(location.href);
    const force = url.searchParams.get("tip") === "1";

    // Можеш використати ці змінні, якщо захочеш міняти текст/поведінку:
    const user = getUser();
    const isAuthed = !!user;

    let profileOk = false;
    if (isAuthed) {
      const p = await loadProfile();
      const ic = String(p.ic || "").trim();
      const sid = String(p.sid || "").trim();
      profileOk = !!(ic && sid);
    }

    // ✅ ГОЛОВНЕ: показуємо завжди (навіть якщо profileOk),
    // бо ти цього хочеш.
    const shouldShow = force || true;
    if (!shouldShow) return;

    const place = () => {
      const r = authBtn.getBoundingClientRect();
      const bubble = tip.querySelector(".authtip__bubble");
      const bubbleW = bubble
        ? bubble.getBoundingClientRect().width
        : Math.min(320, window.innerWidth - 24);
      const gap = 16;

      // За замовчуванням: бульбашка зліва від кнопки (бо кнопка справа зверху)
      let left = Math.round(r.left - bubbleW - gap);
      let top = Math.round(r.top + r.height / 2 - 70);

      // Якщо не влазить зліва — ставимо справа
      if (left < 12) left = Math.round(r.right + gap);
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

    // Кнопки в підказці
    document.getElementById("authtip-go")?.addEventListener("click", () => {
      authBtn.scrollIntoView({ behavior: "smooth", block: "center" });
      authBtn.focus?.();
      authBtn.click?.();
      close();
    });

    document.getElementById("authtip-close")?.addEventListener("click", () => close());

    // Показ з невеликою затримкою
    setTimeout(open, 600);

    // Автоховання (щоб не заважало)
    setTimeout(close, 12000);

    // Якщо юзер залогінився після завантаження — можна (за бажанням) знову показати
    // або змінити текст. Зараз просто перепозиціонуємо, якщо треба.
    window.addEventListener("castro-auth", () => {
      // Якщо підказка ще відкрита — перепозиціонуй
      if (tip.classList.contains("is-open")) place();

      // Приклад: якщо хочеш ховати, коли профіль ОК — увімкнеш цей блок:
      // (async () => {
      //   const p = await loadProfile();
      //   const ic = String(p.ic || "").trim();
      //   const sid = String(p.sid || "").trim();
      //   if (ic && sid) close();
      // })();
    });
  });
})();
