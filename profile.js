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
  const formDiscord = (user) => {
    const u = String(user?.username || "").trim();
    return u ? ("@" + u) : "";
  };

  const mention = (user) => (user?.id ? String(user.id) : "");
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


  // ========= Join application helpers =========
  const JOIN_COOLDOWN_MS = 30 * 60 * 1000;

  const getJoinState = (p) => {
    const st = String(p?.applicationStatus || "").toLowerCase();
    const status = (st === "accepted" || st === "rejected" || st === "pending") ? st : "";
    const cdUntil = p?.applicationCooldownUntil ? new Date(p.applicationCooldownUntil).getTime() : 0;
    return { status, cooldownUntil: cdUntil || 0 };
  };

  const canSubmitJoin = (p) => {
    const { status, cooldownUntil } = getJoinState(p || {});
    const now = Date.now();
    if (status === "accepted") return { ok: false, reason: "✅ Твою заявку вже прийнято. Подати повторно не можна." };
    if (status === "pending") return { ok: false, reason: "⏳ Твоя заявка вже на розгляді. Якщо помилився — відміни її у профілі." };
    if (cooldownUntil && cooldownUntil > now) {
      const mins = Math.ceil((cooldownUntil - now) / 60000);
      return { ok: false, reason: `⏳ Кулдаун: спробуй знову через ~${mins} хв.` };
    }
    return { ok: true, reason: "" };
  };

  const setJoinPending = async () => {
    const p = await loadProfile();
    const nowIso = new Date().toISOString();
    const next = { ...p, applicationStatus: "pending", applicationSubmittedAt: nowIso };
    // не чіпаємо cooldown тут (це для повторних)
    return await saveProfile(next);
  };

  const cancelJoinApplication = async () => {
    const p = await loadProfile();
    const st = String(p?.applicationStatus || "").toLowerCase();
    if (st !== "pending") return p;
    const now = new Date();
    const next = {
      ...p,
      applicationStatus: "",
      applicationCancelledAt: now.toISOString(),
      applicationCooldownUntil: new Date(now.getTime() + JOIN_COOLDOWN_MS).toISOString(),
    };
    return await saveProfile(next);
  };


  // ========= Pretty Orders Render =========
  const moneyUA = (n) => {
    const x = Number(n || 0);
    return x.toLocaleString("en-US");
  };

  const fmtDate = (iso) => {
    try {
      return new Date(iso).toLocaleString("uk-UA");
    } catch {
      return iso || "—";
    }
  };

  const statusClass = (s) => {
    const t = String(s || "").toLowerCase();
    if (t.includes("підтв") || t.includes("усп") || t.includes("готов") || t.includes("accepted")) return "ok";
    if (t.includes("очік") || t.includes("pending") || t.includes("wait")) return "wait";
    if (t.includes("відм") || t.includes("reject") || t.includes("скас") || t.includes("declined")) return "no";
    return "wait";
  };

  const renderOrdersPretty = (orders) => {
    const wrap = document.getElementById("pf-orders-view");
    if (!wrap) return;

    const arr = Array.isArray(orders) ? orders.slice() : [];
    if (!arr.length) {
      wrap.innerHTML = `<div class="porder"><div class="porder__id">Немає замовлень</div></div>`;
      return;
    }

    wrap.innerHTML = arr
      .slice()
      .sort((a, b) => new Date(b?.date || 0) - new Date(a?.date || 0))
      .map((o) => {
        const id = o?.orderId || "—";
        const items = o?.itemCount ?? "—";
        const amount = (o?.amount ?? 0);
        const date = fmtDate(o?.date);
        const st = o?.status || "Відправлено";
        const cls = statusClass(st);

        return `
          <div class="porder">
            <div class="porder__top">
              <div>
                <div class="porder__id">🧾 ${id}</div>
                <div class="porder__date">📅 ${date}</div>
              </div>
              <div class="pbadge ${cls}">📌 ${st}</div>
            </div>

            <div class="porder__meta">
              <div><b>📦 Позицій:</b> ${items}</div>
              <div><b>💰 Сума:</b> ${moneyUA(amount)}$</div>
            </div>
          </div>
        `;
      })
      .join("");
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

            <label for="discordId">Discord ID (не редагується):</label>
            <input id="discordId" class="pmodal__input" type="text" readonly disabled />

            <div class="pmodal__hint">Зберігається на сервері (прив’язано до Discord).</div>

            <div class="pmodal__section">
              <div class="pmodal__labelRow">
                <div class="pmodal__label">Анкетування</div>
                <div id="pf-app-badge" class="pbadge wait" title="Статус анкети">⏳ Очікує розгляду</div>
              </div>
              <div class="pmodal__hint" id="pf-app-hint">Статус змінюється автоматично після рішення у Discord.</div>
              <div class="pmodal__actions" style="justify-content:flex-start; gap:10px; padding:0; margin-top:10px;">
                <button id="pf-app-cancel" class="pmodal__cancel" type="button" style="background:rgba(255,255,255,.08);">Відмінити заявку</button>
              </div>
            </div>


            <!-- Згортання історії покупок -->
          <details>
            <summary>Історія замовлень</summary>
            <div id="pf-orders-view" class="porders"></div>
          </details>

            <details class="porders__json">
              <summary>Показати JSON</summary>
              <textarea id="pf-orders" class="pmodal__input" spellcheck="false"
                placeholder='[{"orderId":"Example","status":"Підтверджено"}]'></textarea>
            </details>


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

  document.body.classList.remove("modal-open"); // ✅ ДОДАТИ ОЦЕ
};

  const openModal = async () => {
  ensureModal();

  const modal = document.getElementById("profile-modal");
  const inpIc = document.getElementById("pf-ic");
  const inpSid = document.getElementById("pf-sid");
  if (!modal || !inpIc || !inpSid) return;

  document.body.classList.add("modal-open");

  const p = await loadProfile();
  inpIc.value = p.ic || "";
  inpSid.value = p.sid || "";

  const inpOrders = document.getElementById("pf-orders");
  const inpStatus = document.getElementById("pf-status"); // legacy
  const appBadge = document.getElementById("pf-app-badge");
  const appHint = document.getElementById("pf-app-hint");
  const appCancelBtn = document.getElementById("pf-app-cancel");

  if (inpOrders) inpOrders.value = JSON.stringify(p.orders || [], null, 2);
  if (inpStatus) inpStatus.value = p.applicationStatus || "";

  // ---- Application status (Join) ----
  const st = String(p.applicationStatus || "").toLowerCase();
  const badgeText = (st === "accepted") ? "✅ Розглянута" : (st === "rejected") ? "❌ Відхилена" : (st === "pending") ? "⏳ Очікує розгляду" : "—";
  const badgeCls = (st === "accepted") ? "ok" : (st === "rejected") ? "no" : "wait";
  if (appBadge) { appBadge.textContent = badgeText; appBadge.classList.remove("ok","no","wait"); appBadge.classList.add(badgeCls); }
  if (appHint) {
    const cdUntil = p.applicationCooldownUntil ? new Date(p.applicationCooldownUntil) : null;
    const now = new Date();
    if (cdUntil && cdUntil > now) {
      const mins = Math.ceil((cdUntil - now)/60000);
      appHint.textContent = `⏳ Повторна заявка буде доступна через ~${mins} хв.`;
    } else if (st === "pending") {
      appHint.textContent = "Заявка на розгляді. Можеш відмінити її тут, поки не прийнято рішення.";
    } else if (st === "accepted") {
      appHint.textContent = "✅ Заявка прийнята. Подати повторно вже не можна.";
    } else if (st === "rejected") {
      appHint.textContent = "❌ Заявка відхилена. Можеш подати повторно після кулдауну (якщо він є).";
    } else {
      appHint.textContent = "Статус змінюється автоматично після рішення у Discord.";
    }
  }
  if (appCancelBtn) appCancelBtn.style.display = (st === "pending") ? "inline-flex" : "none";

  renderOrdersPretty(p.orders || []);
  console.log("pf-orders-view:", document.getElementById("pf-orders-view")?.innerHTML);

// автооновлення статусу заявки
if (st === "pending") {
  if (window.__castroStatusInterval) {
    clearInterval(window.__castroStatusInterval);
  }

  window.__castroStatusInterval = setInterval(async () => {
    const latest = await loadProfile();
    const newStatus = String(latest.applicationStatus || "").toLowerCase();

    if (newStatus !== "pending") {
      clearInterval(window.__castroStatusInterval);
      openModal(); // перезавантажує модалку
    }
  }, 4000);
}
    
  modal.classList.remove("hidden");
  inpIc.focus();
};

  window.openProfileModal = openModal;

  // Expose helpers for other pages (join page)
  window.CastroProfile = {
    loadProfile,
    saveProfile,
    canSubmitJoin,
    setJoinPending,
    cancelJoinApplication,
  };

  // Cancel join application from modal
  document.addEventListener("click", async (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.id !== "pf-app-cancel") return;
    t.setAttribute("disabled", "true");
    try{
      await cancelJoinApplication();
      // refresh modal view
      await openModal();
    } catch (err){
      console.error(err);
      alert("Не вдалося відмінити заявку. Спробуй пізніше.");
    } finally {
      t.removeAttribute("disabled");
    }
  });


  // ========= Autofill =========
  const fillInputs = (selector, value) => {
    document.querySelectorAll(selector).forEach((el) => {
      if (el && el.tagName === "INPUT") el.value = value;
    });
  };

  const ensureHiddenMentionInputs = () => {
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

// Оновлення профілю
// Функція для блокування/розблокування полів
// Функція для блокування/розблокування полів
const lockAutofilled = (isAuthed) => {
    const lock = (sel, lock = true) => {
        document.querySelectorAll(sel).forEach((el) => {
            if (!(el instanceof HTMLInputElement)) return;

            if (lock) {
  el.readOnly = true;
  el.setAttribute("aria-readonly", "true");
  el.classList.add("is-locked");
  // ✅ НЕ робимо disabled, інакше FormData не відправить поле
  el.disabled = false;
} else {
  el.readOnly = false;
  el.removeAttribute("aria-readonly");
  el.classList.remove("is-locked");
  el.disabled = false;
}
        });
    };

    // Якщо користувач авторизований, заблокувати Discord поля
    lock('input[name="discord"], #discord, input[name="discordMention"], #discordMention, input[name="discordId"], #discordId', isAuthed);

    // Перевірка на стан полів IC і SID з localStorage
    const icValue = localStorage.getItem("ic");
    const sidValue = localStorage.getItem("sid");

    if (isAuthed) {
        if (icValue && sidValue) {
            lock('input[name="nick"], input[name="nicknameId"], #nick', true);  // Якщо IC та SID є в локальному сховищі, блокуємо
        } else {
            lock('input[name="nick"], input[name="nicknameId"], #nick', false); // Розблоковуємо, якщо немає значень
        }
    } else {
        lock('input[name="nick"], input[name="nicknameId"], #nick', false); // Розблоковуємо для неавторизованих
    }
};

// Оновлення профілю
const autofillForms = async (authUser) => {
    ensureHiddenMentionInputs();

    const p = await loadProfile();
    const ic = (p.ic || "").trim();
    const sid = (p.sid || "").trim();
    const nickValue = (ic || sid) ? `${ic || "—"} | ${sid || "—"}` : "";

    if (authUser) {
        if (ic && sid) {
            fillInputs('input[name="nick"], input[name="nicknameId"], #nick', nickValue);
            lockAutofilled(true); // Блокуємо поля
            // Зберігаємо в localStorage, що поля заповнені
            localStorage.setItem("ic", ic);
            localStorage.setItem("sid", sid);
        } else {
            fillInputs('input[name="nick"], input[name="nicknameId"], #nick', nickValue);
            lockAutofilled(false); // Розблоковуємо поля
            localStorage.removeItem("ic");
            localStorage.removeItem("sid");
        }

        const pretty = formDiscord(authUser);
        if (pretty) fillInputs('input[name="discord"], #discord', pretty);

        const ping = mention(authUser);
        fillInputs('input[name="discordMention"], #discordMention', ping);

        const discordId = authUser.id;
        fillInputs('input[name="discordId"], #discordId', discordId);

        lockAutofilled(true); // Поля для Discord заблоковані після авторизації
    } else {
        fillInputs('input[name="nick"], input[name="nicknameId"], #nick', nickValue);
        lockAutofilled(false); // Розблоковуємо всі поля
    }
};

// Важливе місце: викликаємо після завантаження профілю
document.addEventListener("DOMContentLoaded", async () => {
    const authUser = await fetchMe(); // Отримуємо користувача
    autofillForms(authUser); // Заповнюємо форму
    lockAutofilled(!!authUser);  // Блокуємо або розблоковуємо поля залежно від авторизації
});
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
      const inpOrders = document.getElementById("pf-orders");
      const inpStatus = document.getElementById("pf-status"); // legacy
  const appBadge = document.getElementById("pf-app-badge");
  const appHint = document.getElementById("pf-app-hint");
  const appCancelBtn = document.getElementById("pf-app-cancel");

      let orders = [];
      try {
        orders = JSON.parse(inpOrders?.value || "[]");
      } catch (e) {
        alert("❌ Невірний формат JSON у полі історії покупок.");
        return;
      }

      const applicationStatus = (inpStatus?.value || "").trim();
      const ic = (inpIc.value || "").trim().slice(0, 32);
      const sid = (inpSid.value || "").trim().replace(/\D+/g, "").slice(0, 12);

      try {
        const saved = await saveProfile({ ic, sid, orders, applicationStatus });
        closeModal();

        await autofillForms(getUser ? getUser() : null);
        window.dispatchEvent(new Event("castro-profile"));

        renderOrdersPretty(saved?.orders || orders || []);
      } catch (err) {
        console.error(err);
        alert("❌ Не вдалося зберегти профіль. Перевір, чи ти залогінений.");
      }
    });
  };

  const bindProfileClick = () => {
    document.addEventListener("click", (e) => {
      const authUserEl = e.target?.closest?.("#auth-user");
      if (!authUserEl) return;

      if (e.target && (e.target.id === "auth-logout" || e.target.closest?.("#auth-logout"))) return;

      openModal();
    });
  };

  bindProfileClick();
  bindModal(() => window.__CASTRO_AUTH__?.user || null);
  autofillForms(window.__CASTRO_AUTH__?.user || null);

  window.addEventListener("castro-auth", (e) => {
    autofillForms(e?.detail?.user || null);
  });
})();
