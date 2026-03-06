if (window.__CASTRO_PROFILE_LOADED__) {
  console.warn("[CASTRO] profile.js loaded twice — skipping second init");
} else {
  window.__CASTRO_PROFILE_LOADED__ = true;

(() => {
  const AUTH_BASE = "https://auth.family-castro.fun";
  // Cloudflare Worker that stores application status in PROFILE_KV
  const APP_BASE = String(
     window.CASTRO_PROFILE_API ||
     document.documentElement.getAttribute("data-castro-profile-api") ||
     "https://family-castro.fun/api/join"
   ).replace(/\/+$/, "");
  const PROFILE_URL = AUTH_BASE + "/profile";
  const ME_URL = AUTH_BASE + "/auth/me";
  // ========= Premium UI (markup only; styles live in auth.css) =========

  const discordAvatarUrl = (u) => {
    try{
      if (!u || !u.id) return "";
      // common shapes: {avatar}, {avatar_hash}, {avatarUrl}, {avatar_url}
      const id = String(u.id);
      const hash = u.avatar || u.avatar_hash || u.avatarHash || "";
      const direct = u.avatarUrl || u.avatar_url || "";
      if (direct) return String(direct);
      if (hash) return `https://cdn.discordapp.com/avatars/${id}/${hash}.png?size=128`;
      return "";
    }catch{ return ""; }
  };
  const initials = (name) => {
    const t = String(name || "").trim();
    if (!t) return "👤";
    const parts = t.split(/\s+/).slice(0,2);
    return parts.map(p => p[0]?.toUpperCase() || "").join("") || "👤";
  };

  const moneyPretty = (n) => {
    const x = Number(n || 0);
    // keep your existing money formatting style
    return x.toLocaleString("en-US") + "$";
  };

 const parseMoney = (v) => {
  if (v == null) return 0;

  // number -> ok
  if (typeof v === "number" && isFinite(v)) return v;

  // string like "7,500$", "5 700", "1.800", "7 500$"
  const s = String(v).trim();
  if (!s) return 0;

  // прибираємо валюту/текст, лишаємо цифри, коми, крапки, мінус
  let cleaned = s.replace(/[^\d.,-]/g, "");

  // якщо є і кома і крапка — вважаємо коми розділювачами тисяч
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/,/g, "");
  } else {
    // якщо тільки кома — теж часто тисячі
    // "7,500" -> "7500"
    cleaned = cleaned.replace(/,/g, "");
  }

  const n = Number(cleaned);
  return isFinite(n) ? n : 0;
};

const pickOrderTotal = (o) => {
  // пріоритет: totals.total -> totals.subtotal -> amount
  const t =
    o?.totals?.total ??
    o?.totals?.grand_total ??
    o?.totals?.subtotal ??
    o?.amount ??
    o?.total ??
    o?.sum;

  return parseMoney(t);
};

const pickOrderDiscount = (o) => {
  const d =
    o?.totals?.discount_amount ??
    o?.totals?.discount ??
    o?.discount_amount ??
    o?.discount ??
    0;

  return parseMoney(d);
};

const computeStats = (orders) => {
  const arr = Array.isArray(orders) ? orders : [];
  let total = 0;
  let saved = 0;
  let lastDate = null;

  for (const o of arr) {
    total += pickOrderTotal(o);
    saved += pickOrderDiscount(o);

    const d = o?.date ? new Date(o.date) : null;
    if (d && !isNaN(d.getTime())) {
      if (!lastDate || d > lastDate) lastDate = d;
    }
  }

  return {
    count: arr.length,
    total,
    saved,
    lastDate: lastDate ? lastDate.toISOString() : ""
  };
};


  // ========= Tabs + Loading =========
const setPfLoading = (on) => {
  const modal = document.getElementById("profile-modal");
  if (!modal) return;
  modal.classList.toggle("is-loading", !!on);
};


  const showSaveHint = (msg, ok = true) => {
    const el = document.getElementById("pf-save-status");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.remove("is-ok", "is-bad", "is-show");
    el.classList.add(ok ? "is-ok" : "is-bad");
    requestAnimationFrame(() => el.classList.add("is-show"));
    clearTimeout(el.__t);
    el.__t = setTimeout(() => {
      el.classList.remove("is-show");
    }, 2200);
  };

  const bindTabs = () => {
    const modal = document.getElementById("profile-modal");
    if (!modal || modal.__pfTabsBound) return;
    modal.__pfTabsBound = true;

    const buttons = Array.from(modal.querySelectorAll(".pftab[data-tab]"));
    const panes = Array.from(modal.querySelectorAll(".pftabpane[data-pane]"));

    const activate = (name) => {
      buttons.forEach((b) => {
        const on = b.getAttribute("data-tab") === name;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      panes.forEach((p) => {
        const on = p.getAttribute("data-pane") === name;
        p.classList.toggle("is-active", on);
      });
      modal.__pfActiveTab = name;
   
  // show actions ONLY on profile tab
  const actions = modal.querySelector(".pmodal__actions");
  if (actions) actions.style.display = (name === "profile") ? "" : "none";

  // if leaving profile while editing, cancel edit mode
  if (name !== "profile" && typeof modal.__pfSetEditMode === "function") {
    try { modal.__pfSetEditMode(false); } catch {}
  }
};

    buttons.forEach((b) => {
      b.addEventListener("click", () => activate(b.getAttribute("data-tab")));
    });

    // restore last
    activate(modal.__pfActiveTab || "profile");
  };

  const renderHeroAndStats = (profile, authUser) => {
    const elA = document.getElementById("pf-avatar");
    const elName = document.getElementById("pf-name");
    const elSub = document.getElementById("pf-sub");
    const elSpent = document.getElementById("pf-stat-spent");
    const elSaved = document.getElementById("pf-stat-saved");
    const elOrders = document.getElementById("pf-stat-orders");
    const elLast = document.getElementById("pf-stat-last");
    if (!elA || !elName || !elSub) return;

    const displayName = (profile?.ic || "").trim() || (authUser?.username || "").trim() || "Користувач";
    const tag = authUser?.username ? ("@" + String(authUser.username)) : "—";
    const did = authUser?.id ? String(authUser.id) : "—";

    elName.textContent = displayName;
    elSub.innerHTML = `Discord: ${tag}<br>ID: ${did}`;

    // avatar
    const url = discordAvatarUrl(authUser);
    elA.innerHTML = "";
    if (url){
      const img = document.createElement("img");
      img.src = url;
      img.alt = "avatar";
      img.loading = "lazy";
      elA.appendChild(img);
    } else {
      elA.textContent = initials(displayName);
    }

    const st = computeStats(profile?.orders || []);
    if (elSpent) elSpent.textContent = moneyPretty(st.total);
    if (elSaved) elSaved.textContent = moneyPretty(st.saved);
    if (elOrders) elOrders.textContent = String(st.count);
    if (elLast) elLast.textContent = st.lastDate ? new Date(st.lastDate).toLocaleString("uk-UA") : "—";
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

  // ========= Discord helpers =========
  const formDiscord = (user) => {
    const u = String(user?.username || "").trim();
    return u ? ("@" + u) : "";
  };

  const mention = (user) => (user?.id ? String(user.id) : "");
// ========= Profile KV helpers =========
const loadProfile = async () => {
  // 1) базовий профіль з AUTH (/profile)
  let authP = {};
  try {
    const res = await fetch(PROFILE_URL, { method: "GET", credentials: "include", cache: "no-store" });
    const j = await res.json().catch(() => null);
    if (res.ok && j?.ok) authP = j.profile || {};
  } catch {}

  // 2) user з AUTH (/auth/me) -> беремо discord id
  const me = await fetchMe();
  const uid = String(me?.id || "").trim();

  // 3) статус заявки з JOIN воркера (/profile?uid=)
  let appP = {};
  if (uid) {
    const p = await fetchAppProfile(uid);
    if (p) appP = p;
  }

  // 4) нормалізуємо поля, щоб UI працював
  // воркер: cooldownUntil -> UI: joinCooldownUntil (ISO)
  const merged = { ...authP, ...appP };

  if (merged.cooldownUntil && !merged.joinCooldownUntil) {
    merged.joinCooldownUntil = new Date(Number(merged.cooldownUntil)).toISOString();
  }

  if (merged.applicationSubmittedAt && !merged.applicationCreatedAt) {
    merged.applicationCreatedAt = new Date(Number(merged.applicationSubmittedAt)).toISOString();
  }

  if (merged.applicationDecidedAt && !merged.applicationUpdatedAt) {
    merged.applicationUpdatedAt = new Date(Number(merged.applicationDecidedAt)).toISOString();
  }

  return merged;
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

const renderApp = (p) => {
  const appStatusEl = document.getElementById("pf-app-status");
  const appMetaEl = document.getElementById("pf-app-meta");
  const appCancelBtn = document.getElementById("pf-app-cancel");
  if (!appStatusEl || !appMetaEl) return;

  const st = String(p?.applicationStatus || "").toLowerCase();

  const label = (s) => {
    if (s === "accepted") return "Розглянута ✅";
    if (s === "rejected") return "Відхилена ❌";
    if (s === "pending") return "Очікує розгляду ⏳";
    if (s === "cancelled") return "Скасована";
    return "Немає заявки";
  };

  const cls = (s) => {
    if (s === "accepted") return "ok";
    if (s === "rejected") return "no";
    if (s === "pending") return "wait";
    if (s === "cancelled") return "no";
    return "wait";
  };

  appStatusEl.textContent = label(st);
  appStatusEl.className = "pbadge " + cls(st);

  const createdTxt = p?.applicationCreatedAt ? new Date(p.applicationCreatedAt).toLocaleString("uk-UA") : "—";
  const decidedTxt = p?.applicationUpdatedAt ? new Date(p.applicationUpdatedAt).toLocaleString("uk-UA") : null;

  appMetaEl.innerHTML =
    `🕒 Подано: <b>${createdTxt}</b>` +
    (decidedTxt && st !== "pending" ? `<br>✔ Розглянуто: <b>${decidedTxt}</b>` : "");

  if (appCancelBtn) appCancelBtn.style.display = (st === "pending") ? "" : "none";
};

let __pfSSE = null;

const startProfileSSE = () => {
  if (__pfSSE) return;

  __pfSSE = new EventSource(`${APP_BASE}/events`);

  __pfSSE.addEventListener("profile", (e) => {
    try {
      const msg = JSON.parse(e.data || "{}");
      const p = msg?.profile;
      if (!p) return;

      // normalize
      if (p.cooldownUntil && !p.joinCooldownUntil) p.joinCooldownUntil = new Date(Number(p.cooldownUntil)).toISOString();
      if (p.applicationSubmittedAt && !p.applicationCreatedAt) p.applicationCreatedAt = new Date(Number(p.applicationSubmittedAt)).toISOString();
      if (p.applicationDecidedAt && !p.applicationUpdatedAt) p.applicationUpdatedAt = new Date(Number(p.applicationDecidedAt)).toISOString();

      renderApp(p);
    } catch {}
  });

  // EventSource сам робить reconnect — не ламаємо
  __pfSSE.onerror = () => {};
};

const stopProfileSSE = () => {
  try { __pfSSE?.close?.(); } catch {}
  __pfSSE = null;
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
    setPfLoading(true);
    try {
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
    } finally {
      setPfLoading(false);
    }

  };

  const cancelJoinPending = async () => {
    setPfLoading(true);
    try {
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
    } finally {
      setPfLoading(false);
    }

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
  try { return new Date(iso).toLocaleString("uk-UA"); } catch { return iso || "—"; }
};

const orderStatusKey = (s) => {
  const t = String(s || "").trim().toLowerCase();

  if (!t) return "pending";
  if (t === "pending") return "pending";
  if (t === "claimed") return "claimed";
  if (t === "completed") return "completed";
  if (t === "rejected") return "rejected";
  if (t === "cancelled") return "cancelled";

  // legacy fallback
  if (t.includes("відправ")) return "pending";
  if (t.includes("очік")) return "pending";
  if (t.includes("claimed")) return "claimed";
  if (t.includes("оплач")) return "completed";
  if (t.includes("усп")) return "completed";
  if (t.includes("готов")) return "completed";
  if (t.includes("reject")) return "rejected";
  if (t.includes("відх")) return "rejected";
  if (t.includes("скас")) return "cancelled";

  return "pending";
};

const orderStatusText = (order) => {
  const key = orderStatusKey(order?.status);
  const custom = String(order?.statusText || "").trim();
  if (custom) return custom;

  if (key === "claimed") return "Ваше замовлення на розгляді, очікуйте повідомлення в Discord";
  if (key === "completed") return "Оплачено";
  if (key === "rejected") return "Замовлення відхилено";
  if (key === "cancelled") return "Ваше замовлення на розгляді";
  return "Ваше замовлення на розгляді";
};

const statusClass = (s) => {
  const key = orderStatusKey(s);
  if (key === "completed") return "ok";
  if (key === "rejected") return "no";
  return "wait";
};

const renderOrdersPretty = (orders) => {
  const wrap = document.getElementById("pf-orders-view");
  if (!wrap) return;

  const arr = Array.isArray(orders) ? orders.slice() : [];
  arr.sort((a, b) => (new Date(b?.date || 0).getTime() || 0) - (new Date(a?.date || 0).getTime() || 0));

  if (!arr.length) {
    wrap.innerHTML = `<div class="porder porder--empty"><div class="porder__id">Немає замовлень</div></div>`;
    return;
  }

  wrap.innerHTML = arr.map((o) => {
    const id = o?.orderId || o?.id || "—";
    const d = fmtDate(o?.date);
    const statusText = orderStatusText(o);
    const cls = statusClass(o?.status);

    return `
      <button class="porder porder--receipt" type="button" data-order-id="${String(id)}" aria-label="Відкрити чек #${String(id)}">
        <div class="porder__top">
          <div class="porder__left">
            <div class="porder__tag">ЧЕК</div>
            <div class="porder__id">#${String(id)}</div>
          </div>

          <div class="porder__right">
            <div class="pbadge ${cls}">${statusText}</div>
          </div>
        </div>

        <div class="porder__meta">
          <div class="porder__date">${d}</div>
          <div class="porder__cta">Відкрити<span class="porder__arrow">→</span></div>
        </div>
      </button>
    `;
  }).join("");
};

// ========= Receipt (order details) =========
const openReceipt = (order) => {
  const box = document.getElementById("pf-receipt");
  const body = document.getElementById("pf-receipt-body");
  if (!box || !body) return;

  const id = order?.orderId || order?.id || "—";
  const date = fmtDate(order?.date);
  const statusKey = orderStatusKey(order?.status);
  const status = orderStatusText(order);
  const rejectReason = String(order?.rejectReason || "").trim();

  const claimedBy = String(order?.claimedByName || "").trim();
  const completedBy = String(order?.completedByName || "").trim();
  const rejectedBy = String(order?.rejectedByName || "").trim();

  const claimedAt = order?.claimedAt ? fmtDate(order.claimedAt) : "";
  const completedAt = order?.completedAt ? fmtDate(order.completedAt) : "";
  const rejectedAt = order?.rejectedAt ? fmtDate(order.rejectedAt) : "";

  const buyerNick = order?.buyer?.nick_static || "";
  const buyerDiscord = order?.buyer?.discord || "";
  const delivery = order?.delivery || "";
  const note = order?.note || order?.comment || "";

  const totals = order?.totals || {};
  const lines = Number(totals?.lines ?? order?.itemCount ?? 0) || 0;
  const subtotal = parseMoney(totals?.subtotal ?? 0);
  const disc = parseMoney(totals?.discount_amount ?? totals?.discount ?? 0);
  const total = parseMoney(totals?.total ?? order?.amount ?? 0);

  const items = Array.isArray(order?.items) ? order.items : [];

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  const absUrl = (u) => {
    const s = String(u || "").trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    const base = (window.location.origin || "https://family-castro.fun").replace(/\/+$/, "");
    if (s.startsWith("/")) return base + s;
    return base + "/" + s.replace(/^\/+/, "");
  };
  
  body.innerHTML = `
    <div class="preceipt__paper preceipt__paper--premium">
      <div class="preceipt__top">
        <div class="preceipt__brand">
          <div class="preceipt__logo">CASTRO</div>
          <div class="preceipt__sub">Order receipt</div>
        </div>
        <div class="preceipt__chip preceipt__chip--${esc(statusKey)}">
          <span class="preceipt__chipDot"></span>
          <span>${esc(status)}</span>
        </div>
      </div>

      <div class="preceipt__grid2">
        <div class="preceipt__kv"><b>Замовлення</b><span>#${esc(id)}</span></div>
        <div class="preceipt__kv"><b>Дата</b><span>${esc(date)}</span></div>
      </div>

      ${(buyerNick || buyerDiscord || delivery) ? `
        <div class="preceipt__line"></div>
        <div class="preceipt__grid2">
          ${buyerNick ? `<div class="preceipt__kv"><b>Покупець</b><span>${esc(buyerNick)}</span></div>` : ``}
          ${buyerDiscord ? `<div class="preceipt__kv"><b>Discord</b><span>${esc(buyerDiscord)}</span></div>` : ``}
          ${delivery ? `<div class="preceipt__kv preceipt__kv--wide"><b>Отримання</b><span>${esc(delivery)}</span></div>` : ``}
        </div>
      ` : ""}

      ${(claimedBy || completedBy || rejectedBy) ? `
          <div class="preceipt__line"></div>
          <div class="preceipt__grid2">
            ${claimedBy ? `<div class="preceipt__kv"><b>Взяв</b><span>${esc(claimedBy)}</span></div>` : ``}
            ${claimedAt ? `<div class="preceipt__kv"><b>Коли взяв</b><span>${esc(claimedAt)}</span></div>` : ``}

            ${completedBy ? `<div class="preceipt__kv"><b>Виконав</b><span>${esc(completedBy)}</span></div>` : ``}
            ${completedAt ? `<div class="preceipt__kv"><b>Коли виконав</b><span>${esc(completedAt)}</span></div>` : ``}

            ${rejectedBy ? `<div class="preceipt__kv"><b>Відхилив</b><span>${esc(rejectedBy)}</span></div>` : ``}
            ${rejectedAt ? `<div class="preceipt__kv"><b>Коли відхилив</b><span>${esc(rejectedAt)}</span></div>` : ``}
          </div>
        ` : ""}

      <div class="preceipt__line"></div>

      ${items.length ? `
        <div class="preceipt__sectionTitle">Товари</div>
        <div class="preceipt__items preceipt__items--premium">
          ${items.map((it) => {
            const name = it?.name || it?.item?.name || "Товар";
            const cat = it?.category || "";
            const qty = Math.max(1, Number(it?.qty || 1) || 1);
            const unit = Number(it?.unit_price ?? it?.item?.unit_price ?? 0) || 0;
            const pct = Number(it?.discount_pct ?? 0) || 0;
            const lineTotal = Number(it?.total ?? it?.price ?? 0) || 0;
            const armor = it?.armor_color ? ` • 🎨 ${it.armor_color}` : "";
            const imgRaw = String(it?.image_url || it?.img || it?.image || it?.item?.image_url || "").trim();
            const img = absUrl(imgRaw);
            
            const imgHtml = img
              ? `<img class="preceipt__img" src="${esc(img)}" alt="${esc(name)}" loading="lazy" data-zoom-src="${esc(img)}">`
              : `<div class="preceipt__img preceipt__img--ph">📦</div>`;

            return `
              <div class="preceipt__item preceipt__item--premium">
                <div class="preceipt__thumb">${imgHtml}</div>

                <div class="preceipt__info">
                  <div class="preceipt__name">${esc(name)}</div>
                  <div class="preceipt__meta">${esc(cat)}${esc(armor)}</div>
                  <div class="preceipt__mini">
                    <span>${qty} × <b>${moneyUA(unit)}$</b></span>
                    ${pct ? `<span class="preceipt__discount">−${pct}%</span>` : ``}
                  </div>
                </div>

                <div class="preceipt__sum">
                  <div class="preceipt__sumLabel">Разом</div>
                  <div class="preceipt__sumVal">${moneyUA(lineTotal)}$</div>
                </div>
              </div>
            `;
          }).join("")}
        </div>

        <div class="preceipt__line"></div>
      ` : `
        <div class="preceipt__empty">Немає позицій у цьому замовленні.</div>
        <div class="preceipt__line"></div>
      `}

      <div class="preceipt__totals preceipt__totals--premium">
        <div class="preceipt__row"><b>Позицій</b><span>${esc(lines || items.length)}</span></div>
        <div class="preceipt__row"><b>Сума</b><span>${moneyUA(subtotal)}$</span></div>
        <div class="preceipt__row"><b>Знижка</b><span>${moneyUA(disc)}$</span></div>
      </div>

      ${note ? `
        <div class="preceipt__note preceipt__note--premium">
          <div class="preceipt__noteTitle">Коментар</div>
          <div class="preceipt__noteText">${esc(note)}</div>
        </div>
      ` : ""}

      ${rejectReason ? `
        <div class="preceipt__note preceipt__note--premium preceipt__note--danger">
          <div class="preceipt__noteTitle">Причина відмови</div>
          <div class="preceipt__noteText">${esc(rejectReason)}</div>
        </div>
      ` : ""}

      <div class="preceipt__paybar">
        <span>До сплати</span>
        <b>${moneyUA(total)}$</b>
      </div>

      <div class="preceipt__footer preceipt__footer--premium">
        Family Castro • www.family-castro.fun
      </div>
    </div>
  `;

  box.classList.remove("hidden");
  // entrance animation
  requestAnimationFrame(() => box.classList.add("is-open"));
};

const ensureImgViewer = () => {
  if (document.getElementById("pf-imgview")) return;

  const wrap = document.createElement("div");
  wrap.id = "pf-imgview";
  wrap.className = "pimgview hidden";
  wrap.innerHTML = `
    <div class="pimgview__backdrop" data-img-close></div>
    <div class="pimgview__card" role="dialog" aria-modal="true" aria-label="Фото товару">
      <button class="pimgview__x" type="button" data-img-close>✕</button>
      <img id="pf-imgview-img" class="pimgview__img" alt="Фото товару" />
    </div>
  `;
  document.body.appendChild(wrap);

  wrap.addEventListener("click", (e) => {
    if (e.target?.closest?.("[data-img-close]")) {
      wrap.classList.add("hidden");
      document.getElementById("pf-imgview-img").src = "";
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      wrap.classList.add("hidden");
      const im = document.getElementById("pf-imgview-img");
      if (im) im.src = "";
    }
  });
};

const openImgViewer = (src) => {
  if (!src) return;
  ensureImgViewer();
  const wrap = document.getElementById("pf-imgview");
  const img = document.getElementById("pf-imgview-img");
  if (!wrap || !img) return;
  img.src = src;
  wrap.classList.remove("hidden");
};
  
const closeReceipt = () => {
  const box = document.getElementById("pf-receipt");
  if (!box) return;

  box.classList.remove("is-open");
  // wait fade-out, then hide
  setTimeout(() => box.classList.add("hidden"), 180);
};

const bindReceiptClicks = () => {
  if (document.__pfReceiptBound) return;
  document.__pfReceiptBound = true;

  document.addEventListener("click", (e) => {
    const close = e.target?.closest?.("[data-receipt-close]");
    if (close) { closeReceipt(); return; }

    const z = e.target?.closest?.("img.preceipt__img[data-zoom-src]");
    if (z) { openImgViewer(z.getAttribute("data-zoom-src")); return; }

    const card = e.target?.closest?.(".porder[data-order-id]");
    if (!card) return;

    const id = card.getAttribute("data-order-id");
    const modal = document.getElementById("profile-modal");
    const arr = Array.isArray(modal?.__pfOrdersCache) ? modal.__pfOrdersCache : [];
    const ord = arr.find(o => String(o?.orderId || o?.id || "") === String(id));
    if (ord) openReceipt(ord);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeReceipt();
  });
};

const closeModal = () => {

  const modal = document.getElementById("profile-modal");
  if (modal) modal.classList.add("hidden");

  document.body.classList.remove("modal-open");

  stopProfileSSE();
  try{ setPfLoading(false); }catch{}

};

  const openModal = async () => {
  ensureModal();
  bindTabs();

  const modal = document.getElementById("profile-modal");
  const inpIc = document.getElementById("pf-ic");
  const inpSid = document.getElementById("pf-sid");
  const appCancelBtn = document.getElementById("pf-app-cancel");
  if (!modal || !inpIc || !inpSid) return;

  document.body.classList.add("modal-open");

  setPfLoading(true);
  try {
    const p = await loadProfile();
    const authUser = await fetchMe();
renderHeroAndStats(p, authUser);
  bindPfHeroParallax();
  renderApp(p);
  startProfileSSE();
    
  inpIc.value = p.ic || "";
  inpSid.value = p.sid || "";

  // default: view mode (edit only after clicking "Редагувати")
  inpIc.readOnly = true; inpSid.readOnly = true;
  inpIc.classList.add("is-locked"); inpSid.classList.add("is-locked");
  const btnEdit = document.getElementById("pf-edit");
  const btnSave = document.getElementById("pf-save");
  const btnCancel = document.getElementById("pf-cancel");

  if (btnEdit) btnEdit.style.display = "";
  if (btnSave) btnSave.style.display = "none";
  if (btnCancel) btnCancel.style.display = "none";

  modal.__pfEditMode = false;
  modal.__pfOriginal = { ic: inpIc.value, sid: inpSid.value };
  

  // ✅ Авто-оновлення статусу анкети, поки вона "pending"
  const st = String(p?.applicationStatus || "").toLowerCase();

  renderOrdersPretty(p.orders || []);
  try{ if (modal) modal.__pfOrdersCache = Array.isArray(p.orders) ? p.orders : []; }catch{}
  try{ bindReceiptClicks(); }catch{}
  setPfLoading(false);

  // Cancel join application (only pending)
  try{
    if (appCancelBtn && !appCancelBtn.__bound){
      appCancelBtn.__bound = true;
      appCancelBtn.addEventListener("click", async () => {
        const profNow = await loadProfile();
        const st = String(profNow?.applicationStatus || "").toLowerCase();
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
  } finally {
    setPfLoading(false);
  }

  modal.classList.remove("hidden");
  inpIc.focus();
};

  window.openProfileModal = openModal;

  // ========= Autofill =========
  const fillInputs = (selector, value) => {
  document.querySelectorAll(selector).forEach((el) => {
    if (el && el.tagName === "INPUT") {
      el.value = value;
    }
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

    setPfLoading(true);
    try {
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
    } finally {
      setPfLoading(false);
    }

};

// Важливе місце: викликаємо після завантаження профілю
document.addEventListener("DOMContentLoaded", async () => {
    const authUser = await fetchMe(); // Отримуємо користувача
    autofillForms(authUser); // Заповнюємо форму
    lockAutofilled(!!authUser);  // Блокуємо або розблоковуємо поля залежно від авторизації
});

// ========= Modal markup (create once) =========
const ensureModal = () => {
  if (document.getElementById("profile-modal")) return;

  const wrap = document.createElement("div");
  wrap.id = "profile-modal-wrap";

  wrap.innerHTML = `
    <div id="profile-modal" class="pmodal hidden" role="dialog" aria-modal="true">
      <div class="pmodal__backdrop" data-close></div>

      <div class="pmodal__card">
        <div class="pmodal__head">
          <div class="pmodal__title">⚙️ Налаштування профілю</div>
          <button class="pmodal__x" type="button" data-close>✕</button>
        </div>

        <div class="pmodal__body">
          <div class="pfhero" id="pfhero">
  <div class="pfhero__fx" aria-hidden="true">
    <div class="pfhero__fire"></div>
    <div class="pfhero__dust"></div>
    <div class="pfhero__logo"></div>
    <div class="pfhero__chain pfhero__chain--top"></div>
    <div class="pfhero__chain pfhero__chain--bottom"></div>
    <div class="pfhero__shine"></div>
  </div>

  <div id="pf-avatar" class="pfhero__avatar">👤</div>

  <div class="pfhero__meta">
    <div id="pf-name" class="pfhero__name">Користувач</div>
    <div id="pf-sub" class="pfhero__sub">Discord: — • ID: —</div>
  </div>
</div>

          <div class="pftabs" role="tablist" aria-label="Профіль">
            <button class="pftab is-active" type="button" data-tab="profile">Профіль</button>
            <button class="pftab" type="button" data-tab="application">Анкета</button>
            <button class="pftab" type="button" data-tab="orders">Замовлення</button>
          </div>

          <div class="pftabpanes">
            <section class="pftabpane is-active" data-pane="profile">
              <div class="pfrow">
                <div class="pfcol">
                  <label class="pmodal__label">Нікнейм у грі (IC)</label>
                  <input id="pf-ic" class="pmodal__input" type="text" maxlength="32" placeholder="Напр: Dominic Castro">
                </div>

                <div class="pfcol pfcol--sid">
                  <label class="pmodal__label">Static ID</label>
                  <input id="pf-sid" class="pmodal__input" type="text" inputmode="numeric" maxlength="6" placeholder="12279">
                </div>
              </div>
              <div class="pmodal__hint">Зберігається на сервері (прив’язано до Discord).</div>
            </section>

            <section class="pftabpane" data-pane="application">
              <div class="pfapp">
                <div class="pfapp__top">
                  <div class="pmodal__label" style="margin:0">Анкетування</div>
                  <div id="pf-app-status" class="pbadge wait pfapp__badge">—</div>
                </div>
                <div id="pf-app-meta" class="pmodal__hint pfapp__meta">—</div>
                <div class="pfapp__actions">
                  <button id="pf-app-cancel" class="pmodal__cancel" type="button">Відмінити заявку</button>
                </div>
              </div>
            </section>

            <section class="pftabpane" data-pane="orders">
             <div class="pfstats">

              <div class="pfstat pfstat--spent">
                <div class="pfstat__label">Витрачено</div>
                <div id="pf-stat-spent" class="pfstat__value">—</div>
              </div>

              <div class="pfstat pfstat--saved">
                <div class="pfstat__label">Заощаджено</div>
                <div id="pf-stat-saved" class="pfstat__value">—</div>
              </div>

              <div class="pfstat pfstat--orders">
                <div class="pfstat__label">Замовлень</div>
                <div id="pf-stat-orders" class="pfstat__value">—</div>
              </div>

              <div class="pfstat pfstat--last">
                <div class="pfstat__label">Останнє</div>
                <div id="pf-stat-last" class="pfstat__value">—</div>
              </div>

            </div>

              <div id="pf-orders-view" class="porders"></div>
            </section>
          </div>

          <div id="pf-receipt" class="preceipt hidden" role="dialog" aria-modal="true" aria-label="Чек">
            <div class="preceipt__backdrop" data-receipt-close></div>
            <div class="preceipt__card">
              <div class="preceipt__head">
                <div class="preceipt__title">🧾 Чек</div>
                <button class="preceipt__x" type="button" data-receipt-close>✕</button>
              </div>
              <div id="pf-receipt-body" class="preceipt__body"></div>
            </div>
          </div>
        </div>

        <div class="pmodal__actions">
          <div id="pf-save-status" class="pfsavehint" aria-live="polite"></div>

          <button id="pf-edit" class="pmodal__btn pmodal__btn--ghost" type="button">Редагувати</button>
          <button id="pf-save" class="pmodal__save" type="button">Зберегти</button>
          <button id="pf-cancel" class="pmodal__cancel" type="button">Скасувати</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(wrap);
    // ✅ PORTAL: receipt overlay must live in <body>, not inside transformed modal
  const receipt = document.getElementById("pf-receipt");
  if (receipt && receipt.parentElement !== document.body) {
     document.body.appendChild(receipt);
  }
};

 const bindModal = (getUser) => {
  ensureModal();

  const modal = document.getElementById("profile-modal");
  if (modal && modal.__pfBound) return;
  if (modal) modal.__pfBound = true;

  const btnSave = document.getElementById("pf-save");
  const inpIc = document.getElementById("pf-ic");
  const inpSid = document.getElementById("pf-sid");
  const appCancelBtn = document.getElementById("pf-app-cancel");
  if (!modal || !btnSave || !inpIc || !inpSid) return;

  modal.addEventListener("click", (e) => {
    if (e.target && e.target.matches("[data-close]")) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  const btnEdit = document.getElementById("pf-edit");
  const btnCancel = document.getElementById("pf-cancel");

  const setEditMode = (on) => {
    const modalEl = document.getElementById("profile-modal");
    const icEl = document.getElementById("pf-ic");
    const sidEl = document.getElementById("pf-sid");
    const saveEl = document.getElementById("pf-save");
    const editEl = document.getElementById("pf-edit");
    const cancelEl = document.getElementById("pf-cancel");
    if (!modalEl || !icEl || !sidEl || !saveEl || !editEl || !cancelEl) return;

    modalEl.__pfEditMode = !!on;

    if (on) {
      icEl.readOnly = false; sidEl.readOnly = false;
      icEl.classList.remove("is-locked"); sidEl.classList.remove("is-locked");

      editEl.style.display = "none";
      saveEl.style.display = "";
      cancelEl.style.display = "";

      icEl.focus();
    } else {
      icEl.readOnly = true; sidEl.readOnly = true;
      icEl.classList.add("is-locked"); sidEl.classList.add("is-locked");

      const orig = modalEl.__pfOriginal || {};
      if (typeof orig.ic === "string") icEl.value = orig.ic;
      if (typeof orig.sid === "string") sidEl.value = orig.sid;

      editEl.style.display = "";
      saveEl.style.display = "none";
      cancelEl.style.display = "none";
    }
  };

  
if (btnEdit && btnCancel && !btnEdit.__bound) {
  btnEdit.__bound = true;
  btnEdit.addEventListener("click", () => setEditMode(true));
  btnCancel.addEventListener("click", () => setEditMode(false));
}


  if (!btnSave.__bound) {
    btnSave.__bound = true;
    btnSave.addEventListener("click", async () => {
      const modalEl = document.getElementById("profile-modal");
      if (btnSave.disabled || !modalEl?.__pfEditMode) return;

      // orders are managed server-side; keep whatever is currently stored
      let orders = [];
      try { const pNow = await loadProfile(); orders = pNow?.orders || []; } catch { orders = []; }

      const ic = (inpIc.value || "").trim().slice(0, 32);
      const sid = (inpSid.value || "").trim().replace(/\D+/g, "").slice(0, 6);

      try {
        const saved = await saveProfile({ ic, sid, orders });
        try {
          const modalEl2 = document.getElementById("profile-modal");
          if (modalEl2) {
            modalEl2.__pfOriginal = { ic, sid };
            modalEl2.__pfEditMode = false;
          }
        } catch {}

        showSaveHint("✅ Збережено", true);

        await autofillForms(getUser ? getUser() : null);
        window.dispatchEvent(new Event("castro-profile"));

        renderOrdersPretty(saved?.orders || orders || []);
        try { renderHeroAndStats(saved || { ic, sid, orders }, await fetchMe()); } catch {}
      } catch (err) {
        console.error(err);
        showSaveHint("❌ Не вдалося зберегти", false);
      }
    });
  }
}; // ✅ ОЦЕ важливо — закриття bindModal

const bindProfileClick = () => {
  document.addEventListener("click", (e) => {
    const authUserEl = e.target?.closest?.("#auth-user, .auth__user, [data-open-profile]");
    if (!authUserEl) return;
    if (e.target && (e.target.id === "auth-logout" || e.target.closest?.("#auth-logout, .auth__logout"))) return;

    try { openModal(); } catch (err) { console.error("openModal failed", err); }
  });
};

bindProfileClick();
bindModal(() => window.__CASTRO_AUTH__?.user || null);
autofillForms(window.__CASTRO_AUTH__?.user || null);

window.addEventListener("castro-auth", (e) => {
  autofillForms(e?.detail?.user || null);
});
  const bindPfHeroParallax = () => {
  const hero = document.getElementById("pfhero");
  if (!hero || hero.__parallaxBound) return;
  hero.__parallaxBound = true;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  let raf = 0;

  const setVars = (x, y) => {
    hero.style.setProperty("--pf-parallax-x", `${x}px`);
    hero.style.setProperty("--pf-parallax-y", `${y}px`);
  };

  hero.addEventListener("mousemove", (e) => {
    const rect = hero.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;

    const moveX = (px - 0.5) * 16;
    const moveY = (py - 0.5) * 10;

    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => setVars(moveX, moveY));
  });

  hero.addEventListener("mouseleave", () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => setVars(0, 0));
  });
};
})(); // кінець IIFE

}
