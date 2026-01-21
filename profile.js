(() => {
  const AUTH_BASE = "https://auth.family-castro.fun";
  const PROFILE_URL = AUTH_BASE + "/profile";

  const ME_URL = AUTH_BASE + "/auth/me";

  const fetchMe = async () => {
    try {
      const res = await fetch(ME_URL, { method: "GET", credentials: "include", cache: "no-store" });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) return null;
      return j.user || null;
    } catch {
      return null;
    }
  };

  // ========= Discord helpers =========
  // Автозаповнення форм: ТІЛЬКИ @username
  const formDiscord = (user) => {
    const u = String(user?.username || "").trim();
    return u ? ("@" + u) : "";
  };

  // Відправка в Discord: mention
  const mention = (user) => (user?.id ? `<@!${user.id}>` : "");

  // ========= Profile KV helpers =========
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

  const saveProfile = async (p) => {
    const res = await fetch(PROFILE_URL, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p || {}),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.ok) throw new Error(j?.error || "save_failed");
    return j.profile || {};
  };

  // ========= Modal =========
  const ensureModal = () => {
    if (document.getElementById("profile-modal")) return;

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div id="profile-modal" class="pmodal hidden" role="dialog" aria-modal="true">
        <div class="pmodal__backdrop" data-close></div>
        <div class="pmodal__card">
          <div class="pmodal__head">
            <div class="pmodal__title">⚙️ Налаштування профілю</div>
            <button class="pmodal__x" type="button" data-close>✕</button>
          </div>

          <div class="pmodal__body">
            <label class="pmodal__label">Нікнейм у грі (IC)</label>
            <input id="pf-ic" class="pmodal__input" type="text" maxlength="32" placeholder="Напр: Dominic Castro"/>

            <label class="pmodal__label">Static ID</label>
            <input id="pf-sid" class="pmodal__input" type="text" inputmode="numeric" maxlength="12" placeholder="Напр: 12279"/>

            <div class="pmodal__hint">Зберігається на сервері (прив’язано до Discord).</div>

            <div class="pmodal__actions">
              <button id="pf-save" class="pmodal__save" type="button">Зберегти</button>
              <button class="pmodal__cancel" type="button" data-close>Скасувати</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
  };

  const closeModal = () => {
    const modal = document.getElementById("profile-modal");
    if (modal) modal.classList.add("hidden");
  };

  const openModal = async () => {
    ensureModal();
    const modal = document.getElementById("profile-modal");
    const inpIc = document.getElementById("pf-ic");
    const inpSid = document.getElementById("pf-sid");
    if (!modal || !inpIc || !inpSid) return;

    const p = await loadProfile();
    inpIc.value = p.ic || "";
    inpSid.value = p.sid || "";

    modal.classList.remove("hidden");
    inpIc.focus();
  };

  // ========= Autofill =========
  const fillInputs = (selector, value) => {
    document.querySelectorAll(selector).forEach((el) => {
      if (el && el.tagName === "INPUT") el.value = value;
    });
  };

  const ensureHiddenMentionInputs = () => {
    // Якщо на сторінці є input[name="discord"] але нема discordMention — додамо автоматично
    document.querySelectorAll('input[name="discord"]').forEach((discordEl) => {
      const form = discordEl.closest("form");
      if (!form) return;
      if (form.querySelector('input[name="discordMention"]')) return;
      const hidden = document.createElement("input");
      hidden.type = "hidden";
      hidden.name = "discordMention";
      hidden.id = "discordMention";
      form.appendChild(hidden);
    });
  };

  const autofillForms = async (authUser) => {
    ensureHiddenMentionInputs();

    const p = await loadProfile();
    const ic = (p.ic || "").trim();
    const sid = (p.sid || "").trim();
    const nickValue = (ic || sid) ? `${ic || "—"} | ${sid || "—"}` : "";

    if (nickValue) {
      fillInputs('input[name="nick"], input[name="nicknameId"], #nick', nickValue);
    }

    if (authUser && !authUser?.username) {
      const me = await fetchMe();
      if (me?.id) authUser = { ...authUser, ...me };
    }

    if (authUser) {
      // Видиме поле: @username
      const pretty = formDiscord(authUser);
      if (pretty) fillInputs('input[name="discord"], #discord', pretty);

      // Hidden: <@!id>
      const ping = mention(authUser);
      fillInputs('input[name="discordMention"], #discordMention', ping);

      // Для скриптів, які читають значення напряму
      document.querySelectorAll('input[name="discord"], #discord').forEach((el) => {
        if (el) el.dataset.mention = ping;
        lockAutofilled(!!authUser);
      });
    }
  };

  const lockAutofilled = (isAuthed) => {
  const lock = (sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      if (!(el instanceof HTMLInputElement)) return;

      if (isAuthed) {
        el.readOnly = true;               // не редагується, але виділяється/копіюється
        el.setAttribute("aria-readonly", "true");
        el.classList.add("is-locked");
      } else {
        el.readOnly = false;
        el.removeAttribute("aria-readonly");
        el.classList.remove("is-locked");
      }
    });
  };

  lock('input[name="nick"]');
  lock('input[name="nicknameId"], #nick'); // підстраховка
  lock('input[name="discord"], #discord');
};

  // ========= Submit patch: send <@!> but keep @username visible =========
  const patchSubmissions = () => {
    const swapToMention = (form) => {
      const d = form.querySelector('input[name="discord"], #discord');
      if (!d) return () => {};
      const m =
        (form.querySelector('input[name="discordMention"]')?.value || "") ||
        (d.dataset.mention || "");
      if (!m) return () => {};
      const prev = d.value;
      d.value = m;
      return () => {
        d.value = prev;
      };
    };

    // native submit
    document.addEventListener(
      "submit",
      (e) => {
        const form = e.target;
        if (!(form instanceof HTMLFormElement)) return;
        const restore = swapToMention(form);
        setTimeout(restore, 0);
      },
      true
    );

    // click submit buttons
    document.addEventListener(
      "click",
      (e) => {
        const btn = e.target?.closest?.('button[type="submit"], input[type="submit"]');
        if (!btn) return;
        const form = btn.closest("form");
        if (!form) return;
        const restore = swapToMention(form);
        setTimeout(restore, 0);
      },
      true
    );
  };

  // ========= Bind modal =========
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
      const ic = (inpIc.value || "").trim().slice(0, 32);
      const sid = (inpSid.value || "").trim().replace(/\D+/g, "").slice(0, 12);

      try {
        await saveProfile({ ic, sid });
        closeModal();
        await autofillForms(getUser ? getUser() : null);
      } catch (err) {
        console.error(err);
        alert("❌ Не вдалося зберегти профіль. Перевір, чи ти залогінений.");
      }
    });
  };

  const bindProfileClick = () => {
    const authUserEl = document.getElementById("auth-user");
    if (!authUserEl) return;

    authUserEl.style.cursor = "pointer";
    authUserEl.addEventListener("click", (e) => {
      if (e.target && e.target.id === "auth-logout") return;
      openModal();
    });
  };

  // ========= INIT =========
  bindProfileClick();
  bindModal(() => window.__CASTRO_AUTH__?.user || null);
  patchSubmissions();
  autofillForms(window.__CASTRO_AUTH__?.user || null);

  window.addEventListener("castro-auth", (e) => {
    autofillForms(e?.detail?.user || null);
  });
})();
