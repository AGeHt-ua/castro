/* CASTRO — спільна поведінка оновлених сторінок: навігація, мобільне меню, поява блоків */
(() => {
  const nav = document.querySelector(".cnav");
  const burger = nav?.querySelector(".cnav__burger");

  // Навігація стає суцільною після початку гортання
  const onScroll = () => {
    nav?.classList.toggle("is-solid", window.scrollY > 24);
    const hero = document.querySelector(".chero");
    if (hero) {
      const p = Math.min(1, Math.max(0, window.scrollY / hero.offsetHeight));
      hero.style.setProperty("--hero-p", p.toFixed(3));
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Мобільне меню
  burger?.addEventListener("click", () => {
    const open = !nav.classList.contains("is-open");
    nav.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.textContent = open ? "✕" : "☰";
  });
  nav?.querySelectorAll(".cnav__links a").forEach((link) => link.addEventListener("click", () => {
    nav.classList.remove("is-open");
    burger?.setAttribute("aria-expanded", "false");
    if (burger) burger.textContent = "☰";
  }));

  // Бічна розкадровка розділів: активний пункт
  const rail = document.querySelector(".fm-rail");
  const railLinks = [...document.querySelectorAll("[data-rail]")];
  const sections = railLinks.map((a) => document.getElementById(a.dataset.rail)).filter(Boolean);
  const railHero = document.querySelector(".chero");
  let frame = 0;

  const updateRail = () => {
    frame = 0;
    rail?.classList.toggle("is-visible", scrollY > (railHero?.offsetHeight || 600) * .6);
    let active = null;
    sections.forEach((s) => { if (s.getBoundingClientRect().top <= innerHeight * .4) active = s.id; });
    railLinks.forEach((a) => {
      const on = a.dataset.rail === active;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    });
  };
  const requestRail = () => { if (!frame) frame = requestAnimationFrame(updateRail); };
  addEventListener("scroll", requestRail, { passive: true });
  addEventListener("resize", requestRail, { passive: true });
  updateRail();

  // Поява блоків при гортанні
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("is-in");
    io.unobserve(entry.target);
  }), { rootMargin: "0px 0px -8% 0px", threshold: .12 });
  items.forEach((el) => io.observe(el));
})();
