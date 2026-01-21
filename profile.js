(() => {
  // =========================================================
  // ✅ SERVER PROFILE (Cloudflare Worker)
  //  - читає/пише профіль у KV через https://auth.family-castro.fun/profile
  //  - показує в полях @username
  //  - перед відправкою форм підміняє на <@!id>
  // =========================================================

  const AUTH_BASE = "https://auth.family-castro.fun";
  const PROFILE_URL = AUTH_BASE + "/profile";

  // ---------- API ----------
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
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p || {}),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) throw new Error(json?.error || "save_failed");
    return json.profile || {};
  };

  // ---------- helpers ----------
  const discordMention = (user) => (user?.id ? `<@!${user.id}>` : "");
  const discordPretty  = (user) => {
    const name = user?.name || user?.global_name || user?.username || "user";
    return `@${name}`;
  };

  const setReadonly = (el, state) => {
    if (!el) return;
    el.readOnly = !!state;
    el.disabled = false; // щоб можна було копіювати
    el.classList.toggle("is-locked", !!state);
  };

  // Підтримує 2 варіанти модалки:
  // 1) твоя (pmodal + #pf-ic #pf-sid #pf-save)
  // 2) fallback (інжект якщо модалки нема)
  const ensureModal = () => {
    if (document.getElementById("profile-modal")) return;

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div id="profile-modal" class="pmodal hidden" role="dialog" aria-modal="true" aria-labelledby="pmodal-title">
        <div class="pmodal__backdrop" data-close></div>
        <div class="pmodal__card">
          <div class="pmodal__head">
            <h2 id="pmodal-title">⚙️ Налаштування профілю</h2>
            <button class="pmodal__x" type="button" data-close>✕</button>
          </div>
          <div class="pmodal__body">
            <label class="pmodal__label">Нікнейм у грі (IC)</label>
            <input id="pf-ic" class="pmodal__input" type="text" placeholder="Напр: Dominic Castro" maxlength="32" />
            <label class="pmodal__label">Static ID</label>
            <input id="pf-sid" class="pmodal__input" type="text" placeholder="Напр: 12279" maxlength="12" inputmode="numeric" />
            <p class="pmodal__hint">Зберігається на сервері (KV). Потрібен логін через Discord.</p>
          </div>
          <div class="pmodal__actions">
            <button id="pf-save" class="pmodal__btn" type="button">Зберегти</button>
            <button class="pmodal__btn pmodal__btn--ghost" type="button" data-close>Скасувати</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
  };

  const openModal = async () => {
    ensureModal();
    const modal = document.getElementById("profile-modal");
    const inpIc = document.getElementById("pf-ic");
    const inpSid = document.getElementById("pf-sid");

    // підвантажуємо профіль
    try {
      const p = await loadProfile();
      if (inpIc) inpIc.value = (p.ic || "").trim();
      if (inpSid) inpSid.value = (p.sid || "").trim();
    } catch {}

    modal?.classList.remove("hidden");
  };

  const closeModal = () => {
    const modal = document.getElementById("profile-modal");
    modal?.classList.add("hidden");
  };

  const bindModal = (getUser) => {
    ensureModal();

    const modal = document.getElementById("profile-modal");
    const btnSave = document.getElementById("pf-save");
    const inpIc = document.getElementById("pf-ic");
    const inpSid = document.getElementById("pf-sid");

    if (!modal || !btnSave || !inpIc || !inpSid) return;

    // close
    modal.addEventListener("click", (e) => {
      if (e.target && e.target.matches("[data-close]")) closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    // ✅ зберегти (один раз!)
    btnSave.addEventListener("click", async () => {
      const ic = (inpIc.value || "").trim();
      const sid = (inpSid.value || "").trim().replace(/\D+/g, ""); // тільки цифри

      try {
        await saveProfile({ ic, sid });
        closeModal();
        await autofillForms(getUser ? getUser() : null);
      } catch (e) {
        console.error(e);
        alert("❌ Не вдалося зберегти профіль. Перевір, чи ти залогінений через Discord.");
      }
    });
  };

  // ---------- autofill + sending <@!id> ----------
  const setDiscordInput = (input, user) => {
    if (!input) return;
    if (!user?.id) return;

    input.value = discordPretty(user);           // 👀 показуємо красиво
    input.dataset.mention = discordMention(user); // ✅ а це підставимо перед відправкою
  };

  const autofillForms = async (authUser) => {
    const p = await loadProfile().catch(() => ({}));
    const ic = (p.ic || "").trim();
    const sid = (p.sid || "").trim();

    const isAuthed = !!authUser;
    const pretty = isAuthed ? discordPretty(authUser) : "";

    // join.html
    const joinIc = document.querySelector('input[name="nick"]');
    const joinDiscord = document.querySelector('input[name="discord"]');

    if (joinIc && (ic || sid)) joinIc.value = `${ic || "—"} | ${sid || "—"}`;
    if (joinDiscord && isAuthed) setDiscordInput(joinDiscord, authUser);

    // order.html
    const orderNick = document.querySelector('input[name="nicknameId"], #nick');
    const orderDiscord = document.querySelector('input[name="discord"], #disc');

    if (orderNick && (ic || sid)) orderNick.value = `${ic || "—"} | ${sid || "—"}`;
    if (orderDiscord && isAuthed) setDiscordInput(orderDiscord, authUser);

    // lock only if authed (щоб не підробляли поля)
    setReadonly(joinIc, isAuthed);
    setReadonly(joinDiscord, isAuthed);
    setReadonly(orderNick, isAuthed);
    setReadonly(orderDiscord, isAuthed);
  };

  // ✅ перед сабмітом/кліком підміняємо @user -> <@!id>
  const swapToMention = (input) => {
    if (!input) return;
    const mention = input.dataset.mention;
    if (!mention) return;
    input.dataset.pretty = input.value || "";
    input.value = mention;
  };

  const restorePretty = (input) => {
    if (!input) return;
    if (input.dataset.pretty != null) input.value = input.dataset.pretty;
  };

  // submit будь-яких форм (join)
  document.addEventListener(
    "submit",
    (e) => {
      const form = e.target;
      if (!(form instanceof HTMLFormElement)) return;

      const inp =
        form.querySelector('input[name="discord"]') ||
        form.querySelector("#disc");

      if (!inp) return;
      swapToMention(inp);
      // відновлюємо після того, як інші обробники прочитали value
      queueMicrotask(() => restorePretty(inp));
    },
    true // capture — щоб спрацювало ДО твого submit handler
  );

  // click по кнопці відправки замовлення (order)
  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target && e.target.closest ? e.target.closest("#sendBtn") : null;
      if (!btn) return;

      const inp = document.querySelector("#disc") || document.querySelector('input[name="discord"]');
      if (!inp) return;

      swapToMention(inp);
      queueMicrotask(() => restorePretty(inp));
    },
    true
  );

  // ---------- open settings by click on auth user ----------
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

  // ---------- INIT ----------
  bindProfileClick();
  bindModal(() => window.__CASTRO_AUTH__?.user || null);

  // якщо auth.js вже виставив юзера
  autofillForms(window.__CASTRO_AUTH__?.user || null);

  // оновлення при логіні/логауті
  window.addEventListener("castro-auth", (e) => {
    autofillForms(e?.detail?.user || null);
  });
})();
