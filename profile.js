/* ===========================
   Castro Profile: modal + autofill
   - Зберігає IC Nick + Static ID у localStorage
   - Якщо користувач залогінений (auth.js), поля в join/order автозаповнюються і блокуються
=========================== */

(() => {
  const LS_PROFILE_KEY = "castro_profile_v1";

  const loadProfile = () => {
    try { return JSON.parse(localStorage.getItem(LS_PROFILE_KEY) || "{}"); }
    catch { return {}; }
  };

  const saveProfile = (p) => {
    localStorage.setItem(LS_PROFILE_KEY, JSON.stringify(p || {}));
  };

  const discordLink = (user) => {
    if (!user || !user.id) return "";
    return `https://discord.com/users/${user.id}`;
  };

  const setReadonly = (el, state) => {
    if (!el) return;
    el.readOnly = !!state;
    // не disabled, щоб можна було копіювати
    el.classList.toggle("is-locked", !!state);
    el.setAttribute("aria-readonly", state ? "true" : "false");
  };

  // Пошук полів на сторінках
  const getJoinFields = () => ({
    ic: document.querySelector('#nickname[name="nickname"]') || document.querySelector('[name="nickname"]'),
    sid: document.querySelector('#pid[name="pid"]') || document.querySelector('[name="pid"]'),
    discord: document.querySelector('#discord[name="discord"]') || document.querySelector('[name="discord"]'),
  });

  const getOrderFields = () => ({
    nickStatic: document.querySelector('#nick[name="nicknameId"]') || document.querySelector('[name="nicknameId"]'),
    discord: document.querySelector('#disc[name="discord"]') || document.querySelector('[name="discord"]'),
  });

  const autofillForms = (authUser) => {
    const p = loadProfile();
    const isAuthed = !!authUser;

    const ic = String(p.ic || "").trim();
    const sid = String(p.sid || "").trim();

    // ---- join.html ----
    const jf = getJoinFields();
    if (jf.ic && ic) jf.ic.value = ic;
    if (jf.sid && sid) jf.sid.value = sid;
    if (jf.discord) {
      if (isAuthed) jf.discord.value = discordLink(authUser);
      // якщо не авторизований — не чіпаємо (людина може вписати вручну)
    }

    // ---- order.html ----
    const of = getOrderFields();
    if (of.nickStatic) {
      const combo = (ic || sid) ? `${ic || "—"} | ${sid || "—"}` : of.nickStatic.value;
      if (ic || sid) of.nickStatic.value = combo;
    }
    if (of.discord) {
      if (isAuthed) of.discord.value = discordLink(authUser);
    }

    // lock/unlock тільки якщо авторизований
    setReadonly(jf.ic, isAuthed);
    setReadonly(jf.sid, isAuthed);
    setReadonly(jf.discord, isAuthed);

    setReadonly(of.nickStatic, isAuthed);
    setReadonly(of.discord, isAuthed);
  };

  const initProfileModal = (authUserGetter) => {
    const modal = document.getElementById("profile-modal");
    const btnSave = document.getElementById("pf-save");
    const inpIc = document.getElementById("pf-ic");
    const inpSid = document.getElementById("pf-sid");

    if (!modal || !btnSave || !inpIc || !inpSid) return;

    const open = () => {
      const p = loadProfile();
      inpIc.value = p.ic || "";
      inpSid.value = p.sid || "";
      modal.classList.remove("hidden");
      inpIc.focus();
    };

    const close = () => modal.classList.add("hidden");

    modal.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.matches("[data-close]")) close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });

    btnSave.addEventListener("click", () => {
      const ic = inpIc.value.trim();
      const sid = inpSid.value.trim().replace(/\D+/g, ""); // тільки цифри
      saveProfile({ ic, sid });
      close();
      const u = authUserGetter ? authUserGetter() : null;
      autofillForms(u);
    });

    // ✅ клік по профілю відкриває модалку
    const authUserEl = document.getElementById("auth-user");
    if (authUserEl) {
      authUserEl.style.cursor = "pointer";
      authUserEl.addEventListener("click", (e) => {
        const t = e.target;
        // щоб кнопка logout не відкривала модалку
        if (t && t.id === "auth-logout") return;
        open();
      });
    }
  };

  // експортуємо для auth.js
  window.__CASTRO_AUTOFILL__ = { autofillForms, initProfileModal };
})();
