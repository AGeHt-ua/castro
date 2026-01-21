(() => {
  const AUTH_BASE = "https://auth.family-castro.fun";
const PROFILE_URL = AUTH_BASE + "/profile";

const loadProfile = async () => {
  const res = await fetch(PROFILE_URL, {
    method: "GET",
    credentials: "include", // ✅ важливо: шле cookie castro_session
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) return {};
  return json.profile || {};
};

const saveProfile = async (p) => {
  const res = await fetch(PROFILE_URL, {
    method: "POST",
    credentials: "include", // ✅ важливо
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p || {}),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) throw new Error(json?.error || "save_failed");
};


const discordLink = (user) => {
  if (!user?.id) return "";
  return `<@!${user.id}>`;
};

const discordPretty = (user) => {
  const name = user?.name || user?.username || "user";
  return `@${name}`;
};

  const setReadonly = (el, state) => {
    if (!el) return;
    el.readOnly = !!state;
    el.disabled = false; // щоб можна було копіювати
    el.classList.toggle("is-locked", !!state);
  };

  const ensureModal = () => {
    if (document.getElementById("profile-modal")) return;

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div id="profile-modal" class="pf hidden" role="dialog" aria-modal="true">
        <div class="pf__backdrop" data-close></div>
        <div class="pf__card">
          <div class="pf__head">
            <div class="pf__title">⚙️ Налаштування профілю</div>
            <button class="pf__x" type="button" data-close>✕</button>
          </div>

          <div class="pf__body">
            <label class="pf__label">Нікнейм у грі (IC)</label>
            <input id="pf-ic" class="pf__input" type="text" placeholder="Напр: Dominic Castro" />

            <label class="pf__label">Static ID</label>
            <input id="pf-sid" class="pf__input" type="text" inputmode="numeric" placeholder="Напр: 12279" />

            <div class="pf__actions">
              <button id="pf-save" class="pf__save" type="button">Зберегти</button>
              <button class="pf__cancel" type="button" data-close>Скасувати</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    // мінімальні стилі (щоб точно було видно навіть якщо CSS не підключився)
    const st = document.createElement("style");
    st.textContent = `
      .pf.hidden{display:none}
      .pf{position:fixed;inset:0;z-index:9999}
      .pf__backdrop{position:absolute;inset:0;background:rgba(0,0,0,.55)}
      .pf__card{position:relative;max-width:420px;margin:10vh auto;background:#0e0e14;color:#fff;
        border:1px solid rgba(255,255,255,.12);border-radius:16px;box-shadow:0 30px 90px rgba(0,0,0,.6);
        padding:14px}
      .pf__head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
      .pf__title{font-weight:900}
      .pf__x{background:transparent;border:0;color:#fff;font-size:18px;cursor:pointer}
      .pf__label{display:block;margin:10px 0 6px;font-weight:700;opacity:.9}
      .pf__input{width:100%;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.14);
        background:rgba(255,255,255,.06);color:#fff;outline:none}
      .pf__actions{display:flex;gap:10px;margin-top:14px}
      .pf__save{flex:1;padding:10px 12px;border-radius:12px;border:0;background:#e0182d;color:#fff;font-weight:900;cursor:pointer}
      .pf__cancel{padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:transparent;color:#fff;cursor:pointer}
      .is-locked{opacity:.85}
    `;
    document.head.appendChild(st);
  };

  const openModal = async () => {
  ensureModal();
  const modal = document.getElementById("profile-modal");
  const inpIc = document.getElementById("pf-ic");
  const inpSid = document.getElementById("pf-sid");

  const p = await loadProfile();
  inpIc.value = p.ic || "";
  inpSid.value = p.sid || "";

  modal.classList.remove("hidden");
  inpIc.focus();
};

  const closeModal = () => {
    const modal = document.getElementById("profile-modal");
    if (modal) modal.classList.add("hidden");
  };

  const bindModal = (getUser) => {
  ensureModal();

  const modal = document.getElementById("profile-modal");
  const btnSave = document.getElementById("pf-save");
  const inpIc = document.getElementById("pf-ic");
  const inpSid = document.getElementById("pf-sid");

  if (!modal || !btnSave || !inpIc || !inpSid) return;

  modal.addEventListener("click", (e) => {
    if (e.target && e.target.matches("[data-close]")) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  btnSave.addEventListener("click", async () => {
    const ic = (inpIc.value || "").trim();
    const sid = (inpSid.value || "").trim().replace(/\D+/g, "");

    try {
      await saveProfile({ ic, sid });
      closeModal();
      await autofillForms(getUser ? getUser() : null);
    } catch (e) {
      console.error(e);
      alert("❌ Не вдалося зберегти профіль. Перевір, чи ти залогінений.");
    }
  });

btnSave.addEventListener("click", async () => {
  const ic = (inpIc.value || "").trim();
  const sid = (inpSid.value || "").trim().replace(/\D+/g, "");

  try {
    await saveProfile({ ic, sid });
    closeModal();
    await autofillForms(getUser ? getUser() : null);
  } catch (e) {
    console.error(e);
    alert("❌ Не вдалося зберегти профіль. Перевір, чи ти залогінений.");
  }
});

  try {
    await saveProfile({ ic, sid });
    closeModal();
    await autofillForms(getUser ? getUser() : null);
  } catch (e) {
    console.error(e);
    alert("❌ Не вдалося зберегти профіль. Перевір, чи ти залогінений.");
  }
});

    });
  };

const autofillForms = async (authUser) => {
  const p = await loadProfile();
  const ic = (p.ic || "").trim();
  const sid = (p.sid || "").trim();

  const isAuthed = !!authUser;
  const dLink = isAuthed ? discordLink(authUser) : "";

  const joinIc = document.querySelector('input[name="nick"]');
  const joinDiscord = document.querySelector('input[name="discord"]');

  if (joinIc && (ic || sid)) joinIc.value = `${ic || "—"} | ${sid || "—"}`;
  if (joinDiscord && isAuthed) joinDiscord.value = dLink;

  const orderNick = document.querySelector('input[name="nicknameId"], #nick');
  const orderDiscord = document.querySelector('input[name="discord"]');

  if (orderNick && (ic || sid)) orderNick.value = `${ic || "—"} | ${sid || "—"}`;
  if (orderDiscord && isAuthed) orderDiscord.value = dLink;

  setReadonly(joinIc, isAuthed);
  setReadonly(joinDiscord, isAuthed);
  setReadonly(orderNick, isAuthed);
  setReadonly(orderDiscord, isAuthed);
};

  // клік по профілю відкриває модалку
  const bindProfileClick = () => {
    const authUserEl = document.getElementById("auth-user");
    if (!authUserEl) return;

    authUserEl.style.cursor = "pointer";
    authUserEl.addEventListener("click", (e) => {
      // якщо натиснули logout — не відкривати
      if (e.target && e.target.id === "auth-logout") return;
      openModal();
    });
  };

  // --- INIT ---
  bindProfileClick();

  // модалка має мати доступ до поточного юзера
  bindModal(() => window.__CASTRO_AUTH__?.user || null);

  // при старті (якщо auth.js вже встиг підняти юзера)
  autofillForms(window.__CASTRO_AUTH__?.user || null);

  // слухаємо зміни авторизації
  window.addEventListener("castro-auth", (e) => {
    autofillForms(e?.detail?.user || null);
  });
})();
