(() => {
  const AUTH_BASE = "https://auth.family-castro.fun";
  // Cloudflare Worker that stores application status in PROFILE_KV
  const APP_BASE = String(
    window.CASTRO_PROFILE_API ||
    document.documentElement.getAttribute("data-castro-profile-api") ||
    "https://winter-cake-f101.d-f12339.workers.dev"
  ).replace(/\/+$/, "");
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


  const fetchAppProfile = async (uid) => {
    try {
      const res = await fetch(`${APP_BASE}/profile?uid=${encodeURIComponent(uid)}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) return null;
      return j.profile || null;
    } catch {
      return null;
    }
  };

  const cancelApplication = async () => {
    const res = await fetch(`${APP_BASE}/cancel`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => null);

    const j = await res?.json?.().catch(() => null);
    if (!res || !res.ok || !j?.ok) {
      const err = j?.error || `HTTP ${res?.status || 0}`;
      throw new Error(err);
    }
    return j.profile || null;
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
  const COOLDOWN_MS = 30 * 60 * 1000;

  const statusLabelUA = (st) => {
    const s = String(st || "").toLowerCase();
    if (s === "accepted") return "Розглянута ✅";
    if (s === "rejected") return "Відхилена ❌";
    if (s === "pending") return "Очікує розгляду ⏳";
    if (s === "cancelled") return "Скасована";
    return "Немає заявки";
  };

  const statusClassUA = (st) => {
    const s = String(st || "").toLowerCase();
    if (s === "accepted") return "ok";
    if (s === "rejected") return "no";
    if (s === "pending") return "wait";
    if (s === "cancelled") return "no";
    return "wait";
  };

  const msLeft = (untilIso) => {
    const t = new Date(untilIso).getTime();
    if (!t) return 0;
    return Math.max(0, t - Date.now());
  };

  const fmtLeft = (ms) => {
    const s = Math.ceil(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    if (m <= 0) return r + "с";
    return m + "хв " + String(r).padStart(2, "0") + "с";
  };

  const canSubmitJoin = (profile) => {
    const st = String(profile?.applicationStatus || "").toLowerCase() || "none";
    if (st === "accepted") return { ok: false, reason: "✅ Твою заявку вже прийнято. Повторно подати не можна." };
    if (st === "pending") return { ok: false, reason: "⏳ Анкета вже на розгляді. Можеш відмінити її в профілі." };

    // rejected -> можна одразу (за умовою)
    if (st === "rejected") return { ok: true };

    // cancelled/none -> перевіряємо КД
    const left = msLeft(profile?.joinCooldownUntil);
    if (left > 0) return { ok: false, reason: "⏱️ КД на подачу: " + fmtLeft(left) };
    return { ok: true };
  };

  const setJoinPending = async () => {
    const p = await loadProfile();
    const st = String(p?.applicationStatus || "").toLowerCase();

    // якщо вже accepted — не чіпаємо
    if (st === "accepted") return p;

    // якщо pending — теж
    if (st === "pending") return p;

    const now = new Date().toISOString();
    const next = { ...(p || {}) };
    next.applicationStatus = "pending";
    next.applicationCreatedAt = next.applicationCreatedAt || now;
    next.applicationUpdatedAt = now;

    const saved = await saveProfile(next);
    window.dispatchEvent(new Event("castro-profile"));
    return saved;
  };

  const cancelJoinPending = async () => {
    const p = await loadProfile();
    const st = String(p?.applicationStatus || "").toLowerCase();
    if (st !== "pending") return p;

    const now = Date.now();
    const until = new Date(now + COOLDOWN_MS).toISOString();

    const next = { ...(p || {}) };
    next.applicationStatus = "cancelled";
    next.applicationUpdatedAt = new Date().toISOString();
    next.joinCooldownUntil = until;

    const saved = await saveProfile(next);
    window.dispatchEvent(new Event("castro-profile"));
    return saved;
  };

  // Expose minimal API for other pages (join/order/etc)
  window.CastroProfile = {
    loadProfile,
    saveProfile,
    canSubmitJoin,
    setJoinPending,
    cancelJoinPending,
    statusLabel: statusLabelUA,
    statusClass: statusClassUA,
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

            <!-- Анкетування -->
            <div class="pjoin" style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.08)">
              <div class="pjoin__row" style="display:flex;align-items:center;justify-content:space-between;gap:10px">
                <div class="pmodal__label" style="margin:0">Анкетування</div>
                <div id="pf-app-status" class="pbadge wait">Очікує розгляду</div>
              </div>
              <div id="pf-app-meta" class="pmodal__hint" style="margin-top:6px">—</div>
              <div class="pjoin__actions" style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap">
                <button id="pf-app-cancel" class="pmodal__cancel" type="button">Відмінити заявку</button>
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

  document.body.classList.remove("modal-open");

  if (window.__pfStatusTimer) { clearInterval(window.__pfStatusTimer); window.__pfStatusTimer = null; } // ✅ ДОДАТИ ОЦЕ
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
  const appStatusEl = document.getElementById("pf-app-status");
  const appMetaEl = document.getElementById("pf-app-meta");
  const appCancelBtn = document.getElementById("pf-app-cancel");

  if (inpOrders) inpOrders.value = JSON.stringify(p.orders || [], null, 2);
  

  // ✅ Авто-оновлення статусу анкети, поки вона "pending"
  const st = String(p.applicationStatus || "pending").toLowerCase();
  if (window.__pfStatusTimer) { clearInterval(window.__pfStatusTimer); window.__pfStatusTimer = null; }

  if (st === "pending") {
    window.__pfStatusTimer = setInterval(async () => {
      try {
        const latest = await loadProfile();
        const newSt = String(latest.applicationStatus || "pending").toLowerCase();

        if (inpOrders) inpOrders.value = JSON.stringify(latest.orders || [], null, 2);
        renderOrdersPretty(latest.orders || []);

        if (newSt !== "pending") {
          clearInterval(window.__pfStatusTimer);
          window.__pfStatusTimer = null;
        }
      } catch (e) {
        // тихо: якщо auth/cookie пропав — просто перестаємо опитувати
        clearInterval(window.__pfStatusTimer);
        window.__pfStatusTimer = null;
      }
    }, 4000);
  }


  renderOrdersPretty(p.orders || []);
  console.log("pf-orders-view:", document.getElementById("pf-orders-view")?.innerHTML);

  // Cancel join application (only pending)
  try{
    if (appCancelBtn && !appCancelBtn.__bound){
      appCancelBtn.__bound = true;
      appCancelBtn.addEventListener("click", async () => {
        const profNow = await loadProfile();
        const st = String(profNow?.applicationStatus || "pending").toLowerCase();
        if (st !== "pending") return;
        const ok = confirm("Відмінити заявку? Після відміни буде КД 30 хвилин на повторну подачу.");
        if (!ok) return;
        try{
          await window.CastroProfile.cancelJoinPending();
          const latest = await loadProfile();
          renderOrdersPretty(latest.orders || []);
          // renderApp is in scope via closure
          if (typeof renderApp === "function") renderApp(latest);
        }catch(e){
          alert("Не вдалося відмінити. Спробуй ще раз.");
        }
      });
    }
  }catch(e){}

  modal.classList.remove("hidden");
  inpIc.focus();
};

  window.openProfileModal = openModal;

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
      const appStatusEl = document.getElementById("pf-app-status");
  const appMetaEl = document.getElementById("pf-app-meta");
  const appCancelBtn = document.getElementById("pf-app-cancel");

      let orders = [];
      try {
        orders = JSON.parse(inpOrders?.value || "[]");
      } catch (e) {
        alert("❌ Невірний формат JSON у полі історії покупок.");
        return;
      }
      const ic = (inpIc.value || "").trim().slice(0, 32);
      const sid = (inpSid.value || "").trim().replace(/\D+/g, "").slice(0, 12);

      try {
        const saved = await saveProfile({ ic, sid, orders });
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
