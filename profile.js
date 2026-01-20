/* ===========================
   PROFILE + AUTOFILL
=========================== */

const LS_PROFILE_KEY = "castro_profile_v1";

const loadProfile = () => {
  try { return JSON.parse(localStorage.getItem(LS_PROFILE_KEY)) || {}; }
  catch { return {}; }
};

const saveProfile = (p) =>
  localStorage.setItem(LS_PROFILE_KEY, JSON.stringify(p));

const discordLink = (u) =>
  u?.id ? `https://discord.com/users/${u.id}` : "";

const lock = (el, state) => {
  if (!el) return;
  el.readOnly = !!state;
  el.classList.toggle("is-locked", !!state);
};

function autofill(user) {
  const p = loadProfile();
  const authed = !!user;

  // join.html
  const ic = document.querySelector('[name="icName"], #icName');
  const sid = document.querySelector('[name="staticId"], #staticId');
  const jd = document.querySelector('[name="discord"], #discord');

  if (ic && p.ic) ic.value = p.ic;
  if (sid && p.sid) sid.value = p.sid;
  if (jd && authed) jd.value = discordLink(user);

  lock(ic, authed);
  lock(sid, authed);
  lock(jd, authed);

  // order.html
  const on = document.querySelector('[name="nicknameId"], #nicknameId');
  const od = document.querySelector('[name="discord"], #buyerDiscord');

  if (on && (p.ic || p.sid))
    on.value = `${p.ic || "—"} | ${p.sid || "—"}`;

  if (od && authed) od.value = discordLink(user);

  lock(on, authed);
  lock(od, authed);
}

/* ===== MODAL ===== */

function initProfileModal() {
  const modal = document.getElementById("profile-modal");
  if (!modal) return;

  const ic = document.getElementById("pf-ic");
  const sid = document.getElementById("pf-sid");
  const save = document.getElementById("pf-save");

  const open = () => {
    const p = loadProfile();
    ic.value = p.ic || "";
    sid.value = p.sid || "";
    modal.classList.remove("hidden");
  };

  save.onclick = () => {
    saveProfile({
      ic: ic.value.trim(),
      sid: sid.value.trim().replace(/\D/g, "")
    });
    modal.classList.add("hidden");
    autofill(window.CASTRO_AUTH_USER);
  };

  document.getElementById("auth-user")?.addEventListener("click", (e) => {
    if (e.target.id !== "auth-logout") open();
  });
}

/* ===== INIT ===== */

window.addEventListener("castro:auth", (e) => {
  autofill(e.detail);
  initProfileModal();
});

// fallback якщо юзер вже є
if (window.CASTRO_AUTH_USER !== undefined) {
  autofill(window.CASTRO_AUTH_USER);
  initProfileModal();
}
