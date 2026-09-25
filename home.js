/* Головна: «логотип-вікно» у стилі сайту GTA VI.
   Скрол по висоті .hero керує кадром: слово CASTRO збільшується,
   маска зникає, відкривається відео, далі з'являються логотип і картки 01–04. */
(() => {
  const hero = document.getElementById("hero");
  const stage = document.getElementById("heroStage");
  if (!hero || !stage) return;

  const root = document.documentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const easeIn = (t) => t * t * t;
  let frame = 0;

  const set = (name, value) => stage.style.setProperty(name, value);

  function progress(){
    const max = hero.offsetHeight - window.innerHeight;
    if (max <= 0) return 1;
    return clamp(-hero.getBoundingClientRect().top / max);
  }

  function render(){
    frame = 0;
    const p = reduced.matches ? 1 : progress();
    const zoom = clamp(p / .55);

    set("--mask-scale", (1 + easeIn(zoom) * 38).toFixed(3));
    set("--mask-opacity", (1 - clamp((p - .32) / .2)).toFixed(3));
    set("--intro-opacity", (1 - clamp(p / .12)).toFixed(3));
    set("--video-scale", (1.15 - zoom * .15).toFixed(4));

    const final = clamp((p - .55) / .25);
    set("--final", final.toFixed(3));
    stage.classList.toggle("is-final", final > .6);
    stage.classList.toggle("is-scrolled", p > .1);
  }

  const request = () => { if (!frame) frame = requestAnimationFrame(render); };

  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request);
  reduced.addEventListener?.("change", () => {
    root.classList.toggle("home-reduced", reduced.matches);
    request();
  });
  root.classList.toggle("home-reduced", reduced.matches);

  // Кнопка «Гортай» — плавно доводить до меню
  stage.querySelector("[data-hero-skip]")?.addEventListener("click", () => {
    const target = hero.offsetTop + hero.offsetHeight - window.innerHeight;
    window.scrollTo({ top: target, behavior: reduced.matches ? "auto" : "smooth" });
  });

  // Повернення «Назад» у браузері не повинно лишати недомальований кадр
  window.addEventListener("pageshow", request);
  render();
})();
