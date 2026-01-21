/* =========================================================
   FAMILY CASTRO — AUTH NUDGE (one-time spotlight)
========================================================= */
(function () {
  const nudge = document.getElementById("auth-nudge");
  if (!nudge) return;

  const STORAGE_KEY = "castro_auth_nudge_v1";

  // ⬇️ ЦІ ЗМІННІ ТИ МОЖЕШ ПІЗНІШЕ ЗАМІНИТИ СВОЄЮ ЛОГІКОЮ
  const isAuthed = !!window.CASTRO_USER;
  const profileOk = !!window.CASTRO_PROFILE_OK;

  const wasShown = localStorage.getItem(STORAGE_KEY) === "1";

  // показуємо:
  // 1) якщо не авторизований і ще не показували
  // 2) якщо авторизований, але профіль НЕ заповнений
  const shouldShow =
    (!isAuthed && !wasShown) ||
    (isAuthed && !profileOk);

  if (!shouldShow) return;

  const authBtn =
    document.getElementById("auth-login") ||
    document.querySelector(".auth__btn");

  if (!authBtn) return;

  const backdrop = nudge.querySelector(".nudge__backdrop");

  function updateSpotlight() {
    const r = authBtn.getBoundingClientRect();
    const x = Math.round(r.left + r.width / 2);
    const y = Math.round(r.top + r.height / 2);
    const radius = Math.round(Math.max(r.width, r.height) * 1.8);

    backdrop.style.setProperty("--x", x + "px");
    backdrop.style.setProperty("--y", y + "px");
    backdrop.style.setProperty("--r", radius + "px");
  }

  function open() {
    nudge.classList.add("is-open");
    nudge.setAttribute("aria-hidden", "false");
    updateSpotlight();

    window.addEventListener("resize", updateSpotlight);
    window.addEventListener("scroll", updateSpotlight, true);
  }

  function close(markShown = true) {
    nudge.classList.remove("is-open");
    nudge.setAttribute("aria-hidden", "true");

    window.removeEventListener("resize", updateSpotlight);
    window.removeEventListener("scroll", updateSpotlight, true);

    if (markShown) {
      localStorage.setItem(STORAGE_KEY, "1");
    }
  }

  // КНОПКИ
  document.getElementById("nudge-go")?.addEventListener("click", () => {
    authBtn.scrollIntoView({ behavior: "smooth", block: "center" });
    authBtn.focus?.();
    authBtn.click?.();
    close(true);
  });

  document.getElementById("nudge-close")?.addEventListener("click", () => {
    close(true);
  });

  // Клік по затемненню
  nudge.addEventListener("click", (e) => {
    if (e.target.classList.contains("nudge__backdrop")) {
      close(true);
    }
  });

  // ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nudge.classList.contains("is-open")) {
      close(true);
    }
  });

  // Невелика затримка, щоб сторінка повністю завантажилась
  setTimeout(open, 600);
})();
