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


  // ========= Premium UI (styles + hero/stats) =========
  const PF_PREMIUM_CSS = `
  /* Premium profile UI */
  .pmodal{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:9999}
  .pmodal.hidden{display:none}
  .pmodal__backdrop{position:absolute;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(2px)}
  .pmodal__card{position:relative;width:min(640px,92vw);border-radius:18px;overflow:hidden;
    background:linear-gradient(180deg, rgba(28,28,40,.88), rgba(14,14,20,.92));
    border:1px solid rgba(255,255,255,.08);
    box-shadow:0 20px 60px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.06);
    backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
    animation: pfModalIn .22s ease;
  }
  @keyframes pfModalIn{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}
  .pmodal__head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.06)}
  .pmodal__title{font-weight:700;letter-spacing:.2px}
  .pmodal__x{border:0;background:rgba(255,255,255,.06);color:#fff;border-radius:12px;padding:8px 10px;cursor:pointer}
  .pmodal__x:hover{background:rgba(255,255,255,.10)}
  .pmodal__body{padding:16px}
  .pfhero{display:flex;align-items:center;gap:12px;padding:12px;border-radius:16px;
    background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.06);
    margin-bottom:14px;
  }
  .pfhero__avatar{width:52px;height:52px;border-radius:16px;overflow:hidden;flex:0 0 auto;
    background:rgba(255,255,255,.06);display:grid;place-items:center;font-weight:800;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.10);
  }
  .pfhero__avatar img{width:100%;height:100%;object-fit:cover;display:block}
  .pfhero__info{min-width:0;flex:1}
  .pfhero__name{font-size:16px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .pfhero__sub{font-size:12px;opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .pchip{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;
    font-size:12px;font-weight:700;letter-spacing:.2px;
    background:linear-gradient(90deg, rgba(90,125,255,.20), rgba(180,90,255,.18));
    border:1px solid rgba(140,120,255,.35);
  }
  .pfstats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:10px 0 14px}
  @media (max-width:520px){.pfstats{grid-template-columns:1fr}}
  .pfstat{padding:12px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06)}
  .pfstat__label{font-size:12px;opacity:.65}
  .pfstat__value{font-size:16px;font-weight:800;margin-top:4px}
  .pmodal__label{display:block;margin:10px 0 6px;font-size:13px;opacity:.85}
  .pmodal__hint{font-size:12px;opacity:.6;margin-top:6px}
  .pmodal__input{width:100%;border-radius:12px;background:rgba(255,255,255,.04);
    border:1px solid rgba(255,255,255,.08);padding:10px 12px;color:#fff;transition:.14s;
  }
  .pmodal__input:focus{outline:none;border-color:rgba(90,125,255,.7);box-shadow:0 0 0 2px rgba(90,125,255,.22)}
  .pmodal__actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
  .pmodal__save{border:0;cursor:pointer;border-radius:12px;padding:10px 14px;font-weight:800;color:#fff;
    background:linear-gradient(90deg, rgba(90,125,255,.95), rgba(180,90,255,.92));
    box-shadow:0 10px 26px rgba(90,125,255,.18);
  }
  .pmodal__save:hover{filter:brightness(1.05)}
  .pmodal__cancel{border:1px solid rgba(255,255,255,.10);cursor:pointer;border-radius:12px;padding:10px 14px;
    background:rgba(255,255,255,.05);color:#fff;font-weight:700;
  }
  .pmodal__cancel:hover{background:rgba(255,255,255,.08)}
  details{margin-top:10px}
  details>summary{cursor:pointer;opacity:.9}
  .porders{margin-top:10px;display:flex;flex-direction:column;gap:10px}
  .porder{background:rgba(255,255,255,.03);border-radius:14px;padding:14px 16px;border:1px solid rgba(255,255,255,.05);transition:.18s}
  .porder:hover{transform:translateY(-2px);border-color:rgba(255,255,255,.14);background:rgba(255,255,255,.05)}
  .porder__id{font-weight:800;font-size:14px}
  .porder__date{font-size:12px;opacity:.65;margin-top:2px}
  .porder__meta{display:flex;gap:20px;margin-top:10px;font-size:13px;flex-wrap:wrap}
  .pbadge{padding:6px 12px;border-radius:999px;font-weight:800;font-size:12px;letter-spacing:.2px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04)}
  .pbadge.ok{background:rgba(60,200,120,.15);color:#4cff9a;border-color:rgba(60,200,120,.35)}
  .pbadge.wait{background:rgba(255,180,60,.12);color:#ffbf66;border-color:rgba(255,180,60,.35)}
  .pbadge.no{background:rgba(255,80,80,.12);color:#ff6b6b;border-color:rgba(255,80,80,.35)}
  .is-locked{opacity:.85}
  `;

  const ensurePremiumStyles = () => {
    if (document.getElementById("pf-premium-style")) return;
    const s = document.createElement("style");
    s.id = "pf-premium-style";
    s.textContent = PF_PREMIUM_CSS;
    document.head.appendChild(s);
  };

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

  const computeStats = (orders) => {
    const arr = Array.isArray(orders) ? orders : [];
    let total = 0;
    let lastDate = null;
    for (const o of arr){
      total += Number(o?.amount || 0);
      const d = o?.date ? new Date(o.date) : null;
      if (d && !isNaN(d.getTime())){
        if (!lastDate || d > lastDate) lastDate = d;
      }
    }
    return { count: arr.length, total, lastDate: lastDate ? lastDate.toISOString() : "" };
  };


  // ========= Tabs + Loading =========
  const setPfLoading = (on) => {
    const sk = document.getElementById("pf-loading");
    if (!sk) return;
    sk.classList.toggle("hidden", !on);
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
    const elOrders = document.getElementById("pf-stat-orders");
    const elLast = document.getElementById("pf-stat-last");
    if (!elA || !elName || !elSub) return;

    const displayName = (profile?.ic || "").trim() || (authUser?.username || "").trim() || "Користувач";
    const tag = authUser?.username ? ("@" + String(authUser.username)) : "—";
    const did = authUser?.id ? String(authUser.id) : "—";

    elName.textContent = displayName;
    elSub.textContent = `Discord: ${tag} • ID: ${did}`;

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
    setPfLoading(true);
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

    ensurePremiumStyles();

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
<!-- Premium hero -->
            <div class="pfhero">
              <div id="pf-avatar" class="pfhero__avatar">👤</div>
              <div class="pfhero__info">
                <div id="pf-name" class="pfhero__name">—</div>
                <div id="pf-sub" class="pfhero__sub">Discord: —</div>
              </div>
              <div class="pfhero__badges">
                <span class="pchip">✨ Premium</span>
              </div>
            </div>

            <div class="pfstats">
              <div class="pfstat">
                <div class="pfstat__label">Витрачено</div>

<!-- Tabs -->
<div class="pftabs" role="tablist" aria-label="Профіль">
  <button class="pftab is-active" type="button" data-tab="profile" role="tab" aria-selected="true">Профіль</button>
  <button class="pftab" type="button" data-tab="application" role="tab" aria-selected="false">Анкета</button>
  <button class="pftab" type="button" data-tab="orders" role="tab" aria-selected="false">Замовлення</button>
  <button class="pftab" type="button" data-tab="json" role="tab" aria-selected="false">JSON</button>
</div>

<div class="pftabpanes">
  <!-- Profile tab -->
  <section class="pftabpane is-active" data-pane="profile" role="tabpanel">
    <label class="pmodal__label">Нікнейм у грі (IC)</label>
    <input id="pf-ic" class="pmodal__input" type="text" maxlength="32" placeholder="Напр: Dominic Castro"/>

    <label class="pmodal__label">Static ID</label>
    <input id="pf-sid" class="pmodal__input" type="text" inputmode="numeric" maxlength="12" placeholder="Напр: 12279"/>

    <label for="discordId" class="pmodal__label">Discord ID (не редагується)</label>
    <input id="discordId" class="pmodal__input" type="text" readonly disabled />

    <div class="pmodal__hint">Зберігається на сервері (прив’язано до Discord).</div>
  </section>

  <!-- Application tab -->
  <section class="pftabpane" data-pane="application" role="tabpanel">
    <div class="pjoin" style="margin-top:4px;padding-top:4px">
      <div class="pjoin__row" style="display:flex;align-items:center;justify-content:space-between;gap:10px">
        <div class="pmodal__label" style="margin:0">Анкетування</div>
        <div id="pf-app-status" class="pbadge wait">—</div>
      </div>
      <div id="pf-app-meta" class="pmodal__hint" style="margin-top:6px">—</div>
      <div class="pjoin__actions" style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap">
        <button id="pf-app-cancel" class="pmodal__cancel" type="button">Відмінити заявку</button>
      </div>
    </div>
  </section>

  <!-- Orders tab -->
  <section class="pftabpane" data-pane="orders" role="tabpanel">
    <div id="pf-orders-view" class="porders"></div>
  </section>

  <!-- JSON tab -->
  <section class="pftabpane" data-pane="json" role="tabpanel">
    <div class="pmodal__hint" style="margin-top:0">Для адмінів/технічних перевірок. Формат має бути валідним JSON.</div>
    <textarea id="pf-orders" class="pmodal__input" spellcheck="false"
      placeholder='[{"orderId":"Example","status":"Підтверджено"}]'></textarea>
  </section>
</div>

<div id="pf-loading" class="pfskeleton hidden" aria-hidden="true">
  <div class="pfskeleton__line"></div>
  <div class="pfskeleton__line"></div>
  <div class="pfskeleton__line"></div>
</div>

          <div class="pmodal__actions">
              <button id="pf-edit" class="pmodal__cancel pmodal__btn--ghost" type="button">Редагувати</button>
              <button id="pf-save" class="pmodal__save" type="button" disabled aria-disabled="true" style="opacity:.6;cursor:not-allowed">Зберегти</button>
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

  stopProfileSSE();
  try{ setPfLoading(false); }catch{}

};

  const openModal = async () => {
  ensureModal();
  bindTabs();

  const modal = document.getElementById("profile-modal");
  const inpIc = document.getElementById("pf-ic");
  const inpSid = document.getElementById("pf-sid");
  if (!modal || !inpIc || !inpSid) return;

  document.body.classList.add("modal-open");

  setPfLoading(true);
  const p = await loadProfile();
  const authUser = await fetchMe();

  renderHeroAndStats(p, authUser);
  renderApp(p);
  startProfileSSE();
    
  inpIc.value = p.ic || "";
  inpSid.value = p.sid || "";

  // default: view mode (edit only after clicking "Редагувати")
  inpIc.readOnly = true; inpSid.readOnly = true;
  inpIc.classList.add("is-locked"); inpSid.classList.add("is-locked");
  const btnEdit = document.getElementById("pf-edit");
  const btnSave = document.getElementById("pf-save");
  if (btnSave){ btnSave.disabled = true; btnSave.setAttribute("aria-disabled","true"); btnSave.style.opacity = ".6"; btnSave.style.cursor = "not-allowed"; }
  if (btnEdit){ btnEdit.textContent = "Редагувати"; }
  modal.__pfEditMode = false;
  modal.__pfOriginal = { ic: inpIc.value, sid: inpSid.value };

  const inpOrders = document.getElementById("pf-orders");
  const appStatusEl = document.getElementById("pf-app-status");
  const appMetaEl = document.getElementById("pf-app-meta");
  const appCancelBtn = document.getElementById("pf-app-cancel");

  if (inpOrders) inpOrders.value = JSON.stringify(p.orders || [], null, 2);
  

  // ✅ Авто-оновлення статусу анкети, поки вона "pending"
  const st = String(p?.applicationStatus || "").toLowerCase();

  renderOrdersPretty(p.orders || []);
  setPfLoading(false);
  console.log("pf-orders-view:", document.getElementById("pf-orders-view")?.innerHTML);

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

    setPfLoading(true);
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


    const btnEdit = document.getElementById("pf-edit");

    const setEditMode = (on) => {
      const modalEl = document.getElementById("profile-modal");
      const icEl = document.getElementById("pf-ic");
      const sidEl = document.getElementById("pf-sid");
      const saveEl = document.getElementById("pf-save");
      const editEl = document.getElementById("pf-edit");
      if (!modalEl || !icEl || !sidEl || !saveEl || !editEl) return;

      modalEl.__pfEditMode = !!on;

      if (on){
        icEl.readOnly = false; sidEl.readOnly = false;
        icEl.classList.remove("is-locked"); sidEl.classList.remove("is-locked");
        saveEl.disabled = false;
        saveEl.setAttribute("aria-disabled","false");
        saveEl.style.opacity = "1";
        saveEl.style.cursor = "pointer";
        editEl.textContent = "Скасувати";
        icEl.focus();
      } else {
        icEl.readOnly = true; sidEl.readOnly = true;
        icEl.classList.add("is-locked"); sidEl.classList.add("is-locked");
        saveEl.disabled = true;
        saveEl.setAttribute("aria-disabled","true");
        saveEl.style.opacity = ".6";
        saveEl.style.cursor = "not-allowed";
        editEl.textContent = "Редагувати";
        const orig = modalEl.__pfOriginal || {};
        if (typeof orig.ic === "string") icEl.value = orig.ic;
        if (typeof orig.sid === "string") sidEl.value = orig.sid;
      }
    };

    if (btnEdit && !btnEdit.__bound){
      btnEdit.__bound = true;
      btnEdit.addEventListener("click", () => {
        const modalEl = document.getElementById("profile-modal");
        const on = !(modalEl && modalEl.__pfEditMode);
        setEditMode(on);
      });
    }

    btnSave.addEventListener("click", async () => {
      const modalEl = document.getElementById("profile-modal");
      if (btnSave.disabled || !modalEl?.__pfEditMode) return;
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
        try{ const modalEl2 = document.getElementById("profile-modal"); if (modalEl2){ modalEl2.__pfOriginal = { ic, sid }; modalEl2.__pfEditMode = false; } }catch{}
        closeModal();

        await autofillForms(getUser ? getUser() : null);
        window.dispatchEvent(new Event("castro-profile"));

        renderOrdersPretty(saved?.orders || orders || []);
        try{ renderHeroAndStats(saved || {ic, sid, orders}, await fetchMe()); }catch{}
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
