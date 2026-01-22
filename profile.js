(() => {
  const AUTH_BASE = "https://auth.family-castro.fun";
  const PROFILE_URL = AUTH_BASE + "/profile";
  const ME_URL = AUTH_BASE + "/auth/me";

// Функція для відправки повідомлення в Discord
const sendToDiscord = async (orderId, amount) => {
    const webhookUrl = 'https://discord.com/api/webhooks/1459606590217916557/IryduTVoVW1-2rwUt-zBXAPCU9WTElMtTUB6rMtjqVJ6-MoN85HwvpbuiVd3fPwANouB';
    
    const payload = {
      content: `Замовлення #${orderId} було підтверджене та статус змінено на "Схвалено".\nСума: ${amount}$.`
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error('Не вдалося відправити повідомлення в Discord');
      } else {
        console.log('Повідомлення успішно відправлено в Discord');
      }
    } catch (error) {
      console.error('Помилка при відправці повідомлення в Discord:', error);
      console.log('Змінений статус заявки:', saved.applicationStatus);
    }
  };
  
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
        const st = o?.status || "Очікує підтвердження";
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

            <div class="pmodal__hint">Зберігається на сервері (прив’язано до Discord).</div>

            <label class="pmodal__label">🧾 Історія покупок</label>
            <div id="pf-orders-view" class="porders"></div>

            <details class="porders__json">
              <summary>Показати JSON</summary>
              <textarea id="pf-orders" class="pmodal__input" spellcheck="false"
                placeholder='[{"orderId":"Example","status":"Підтверджено"}]'></textarea>
            </details>

            <label class="pmodal__label">📩 Статус заявки</label>
            <input id="pf-status" class="pmodal__input" type="text" maxlength="100" placeholder="Напр: Прийнято / Очікується"/>

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

  const inpOrders = document.getElementById("pf-orders");
  const inpStatus = document.getElementById("pf-status");

  if (inpOrders) inpOrders.value = JSON.stringify(p.orders || [], null, 2);
  if (inpStatus) inpStatus.value = p.applicationStatus || "";

  // ✅ ОЦЕ ГОЛОВНЕ — намалювати карточки
  renderOrdersPretty(p.orders || []);
    console.log("pf-orders-view:", document.getElementById("pf-orders-view")?.innerHTML);

  modal.classList.remove("hidden");
  inpIc.focus();
};

  // expose for other scripts (authtip.js)
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

  const lockAutofilled = (isAuthed) => {
    const lock = (sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        if (!(el instanceof HTMLInputElement)) return;

        if (isAuthed) {
          el.readOnly = true;
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
    lock('input[name="nicknameId"], #nick');
    lock('input[name="discord"], #discord');
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
      const pretty = formDiscord(authUser);
      if (pretty) fillInputs('input[name="discord"], #discord', pretty);

      const ping = mention(authUser);
      fillInputs('input[name="discordMention"], #discordMention', ping);

      document.querySelectorAll('input[name="discord"], #discord').forEach((el) => {
        if (el) el.dataset.mention = ping;
      });

      lockAutofilled(true);
    } else {
      lockAutofilled(false);
    }
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
  const inpOrders = document.getElementById("pf-orders");
  const inpStatus = document.getElementById("pf-status");

  // JSON залишається як debug (можна редагувати)
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

    // на всякий — щоб одразу оновився красивий список при наступному відкритті
    renderOrdersPretty(saved?.orders || orders || []);

    // Відправка повідомлення в Discord після оновлення статусу на "Схвалено"
    if (applicationStatus === "Схвалено") {
      const order = saved?.orders[0]; // Задайте це в залежності від замовлення
      if (order) {
        sendToDiscord(order.orderId, order.amount);
      }
    }
  } catch (err) {
    console.error(err);
    alert("❌ Не вдалося зберегти профіль. Перевір, чи ти залогінений.");
  }
});
    
  const bindProfileClick = () => {
    document.addEventListener("click", (e) => {
      const authUserEl = e.target?.closest?.("#auth-user");
      if (!authUserEl) return;

      // не відкривати модалку, якщо натиснули на logout всередині
      if (e.target && (e.target.id === "auth-logout" || e.target.closest?.("#auth-logout"))) return;

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
