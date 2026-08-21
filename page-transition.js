(() => {
  const storageKey = "castro-page-transition";
  const root = document.documentElement;

  try {
    if (sessionStorage.getItem(storageKey) === "1") {
      sessionStorage.removeItem(storageKey);
      root.classList.add("page-transition-entering");
    }
  } catch (_) {}

  const ready = () => {
    const overlay = document.querySelector(".page-transition");
    if (!overlay) return;

    const arrivedFromAnotherPage = root.classList.contains("page-transition-entering");

    const wait = (milliseconds) => new Promise(resolve => window.setTimeout(resolve, milliseconds));

    const waitForBackground = async () => {
      const startedAt = performance.now();
      const minimumLoadingTime = 700;
      const fallbackTime = 7000;
      const video =
        document.querySelector(".video-bg video") ||
        document.querySelector(".hero-bg video") ||
        document.querySelector("video#bgVideo") ||
        document.querySelector("video");

      const backgroundReady = new Promise(resolve => {
        let resolved = false;
        const finish = () => {
          if (resolved) return;
          resolved = true;
          resolve();
        };

        if (video) {
          if (video.readyState >= 2) {
            requestAnimationFrame(finish);
          } else {
            video.addEventListener("loadeddata", finish, { once:true });
            video.addEventListener("canplay", finish, { once:true });
            try { video.load(); } catch (_) {}
          }
        } else if (document.readyState === "complete") {
          requestAnimationFrame(finish);
        } else {
          window.addEventListener("load", finish, { once:true });
        }

        window.setTimeout(finish, fallbackTime);
      });

      await backgroundReady;
      const remaining = minimumLoadingTime - (performance.now() - startedAt);
      if (remaining > 0) await wait(remaining);
    };

    const revealDestination = async () => {
      await waitForBackground();

      const hasDedicatedIntro =
        root.classList.contains("join-intro-pending") ||
        root.classList.contains("info-intro-pending") ||
        root.classList.contains("shop-intro-pending");
      const needsSharedBackgroundHold = document.body.classList.contains("home") || !hasDedicatedIntro;

      if (needsSharedBackgroundHold) root.classList.add("page-transition-background-only");

      overlay.setAttribute("aria-hidden", "true");
      root.classList.remove("page-transition-entering");

      if (!needsSharedBackgroundHold) return;

      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      /* 480 ms overlay fade + 1200 ms of a fully visible background. */
      await wait(reduced ? 420 : 1680);
      root.classList.remove("page-transition-background-only");
      root.classList.add("page-transition-content-reveal");
      window.setTimeout(() => root.classList.remove("page-transition-content-reveal"), reduced ? 240 : 1000);
    };

    if (arrivedFromAnotherPage) revealDestination();

    let leaving = false;

    document.addEventListener("click", (event) => {
      if (leaving || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const link = event.target.closest?.("a[href]");
      if (!link || link.hasAttribute("download") || link.dataset.noTransition != null) return;
      if (link.target && link.target.toLowerCase() !== "_self") return;

      let destination;
      try { destination = new URL(link.href, location.href); } catch (_) { return; }

      if (!/^https?:$/.test(destination.protocol) || destination.origin !== location.origin) return;

      const sameDocument =
        destination.pathname === location.pathname &&
        destination.search === location.search;

      if (sameDocument && (destination.hash || destination.href === location.href)) return;

      event.preventDefault();
      leaving = true;

      const transitionX = event.detail === 0 ? window.innerWidth / 2 : event.clientX;
      const transitionY = event.detail === 0 ? window.innerHeight / 2 : event.clientY;
      root.style.setProperty("--page-transition-x", `${transitionX}px`);
      root.style.setProperty("--page-transition-y", `${transitionY}px`);
      root.classList.add("page-transition-leaving");
      overlay.setAttribute("aria-hidden", "false");

      try { sessionStorage.setItem(storageKey, "1"); } catch (_) {}

      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.setTimeout(() => location.assign(destination.href), reduced ? 180 : 480);
    });

    window.addEventListener("pageshow", (event) => {
      if (!event.persisted) return;
      leaving = false;
      root.classList.remove("page-transition-leaving", "page-transition-entering");
      root.classList.remove("page-transition-background-only", "page-transition-content-reveal");
      overlay.setAttribute("aria-hidden", "true");
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready, { once: true });
  } else {
    ready();
  }
})();
