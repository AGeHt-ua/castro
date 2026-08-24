(() => {
  const storageKey = "castro-page-transition-v2";
  const legacyStorageKey = "castro-page-transition";
  const root = document.documentElement;
  const staticRoutes = new Set(["/", "/info/", "/join/", "/shop/", "/info/legal/", "/shop/reviews/"]);

  const normalizeStaticDestination = (url) => {
    const normalized = new URL(url.href);
    if (!normalized.pathname.endsWith("/") && staticRoutes.has(`${normalized.pathname}/`)) {
      normalized.pathname += "/";
    }
    return normalized;
  };

  let arrivalState = null;

  try {
    const storedState = sessionStorage.getItem(storageKey);
    const arrivedViaLegacyTransition = sessionStorage.getItem(legacyStorageKey) === "1";

    if (storedState) arrivalState = JSON.parse(storedState);
    if (arrivalState || arrivedViaLegacyTransition) {
      const x = Number(arrivalState?.x);
      const y = Number(arrivalState?.y);

      if (Number.isFinite(x)) root.style.setProperty("--page-transition-x", `${x}%`);
      if (Number.isFinite(y)) root.style.setProperty("--page-transition-y", `${y}%`);
      root.classList.add("page-transition-entering");
    }

    sessionStorage.removeItem(storageKey);
    sessionStorage.removeItem(legacyStorageKey);
  } catch (_) {}

  const ready = () => {
    const overlay = document.querySelector(".page-transition");
    if (!overlay) return;

    const arrivedFromAnotherPage = root.classList.contains("page-transition-entering");
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const wait = (milliseconds) => new Promise(resolve => window.setTimeout(resolve, milliseconds));
    const nextPaint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const transitionTime = () => {
      const styles = getComputedStyle(overlay);
      const durations = styles.transitionDuration.split(",").map(value => {
        const duration = Number.parseFloat(value);
        return value.trim().endsWith("ms") ? duration : duration * 1000;
      });
      return Math.max(0, ...durations.filter(Number.isFinite));
    };

    const waitForOverlayTransition = (expectedOpacity) => new Promise(resolve => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        overlay.removeEventListener("transitionend", onTransitionEnd);
        resolve();
      };
      const onTransitionEnd = (event) => {
        if (event.target === overlay && event.propertyName === "opacity") finish();
      };

      overlay.addEventListener("transitionend", onTransitionEnd);
      window.setTimeout(finish, transitionTime() + 120);

      if (getComputedStyle(overlay).opacity === String(expectedOpacity)) {
        requestAnimationFrame(() => {
          if (getComputedStyle(overlay).opacity === String(expectedOpacity)) finish();
        });
      }
    });

    const findBackgroundVideo = () =>
      document.querySelector(".video-bg video") ||
      document.querySelector(".hero-bg video") ||
      document.querySelector("video#bgVideo") ||
      document.querySelector("video");

    const waitForBackground = async () => {
      const startedAt = performance.now();
      const minimumLoadingTime = reducedMotion.matches ? 180 : 700;
      const fallbackTime = 7000;
      const video = findBackgroundVideo();

      const backgroundReady = new Promise(resolve => {
        let resolved = false;
        const finish = () => {
          if (resolved) return;
          resolved = true;
          requestAnimationFrame(resolve);
        };

        if (video) {
          if (video.readyState >= 2) finish();
          else {
            video.addEventListener("loadeddata", finish, { once:true });
            video.addEventListener("canplay", finish, { once:true });
            try { video.load(); } catch (_) {}
          }
        } else if (document.readyState === "complete") finish();
        else window.addEventListener("load", finish, { once:true });

        window.setTimeout(finish, fallbackTime);
      });

      await backgroundReady;
      const remaining = minimumLoadingTime - (performance.now() - startedAt);
      if (remaining > 0) await wait(remaining);
    };

    const waitForPageLoader = () => new Promise(resolve => {
      const loader = document.getElementById("vload");
      if (!loader || loader.classList.contains("is-hide") || loader.getAttribute("aria-hidden") === "true") {
        resolve();
        return;
      }

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        observer.disconnect();
        resolve();
      };
      const observer = new MutationObserver(() => {
        if (loader.classList.contains("is-hide") || loader.getAttribute("aria-hidden") === "true") finish();
      });

      observer.observe(loader, { attributes:true, attributeFilter:["class", "aria-hidden"] });
      window.setTimeout(finish, 7200);
    });

    const revealDestination = async () => {
      root.classList.add("page-transition-background-only");
      await Promise.all([waitForBackground(), waitForPageLoader()]);
      await nextPaint();

      overlay.setAttribute("aria-hidden", "true");
      root.classList.remove("page-transition-entering");
      await waitForOverlayTransition(0);

      if (!reducedMotion.matches) await wait(1000);

      root.classList.remove("page-transition-background-only");
      root.classList.add("page-transition-content-reveal");
      window.setTimeout(
        () => root.classList.remove("page-transition-content-reveal"),
        reducedMotion.matches ? 240 : 1100
      );
    };

    if (arrivedFromAnotherPage) revealDestination();

    const internalDestination = (link) => {
      if (!link || link.hasAttribute("download") || link.dataset.noTransition != null) return null;
      if (link.target && link.target.toLowerCase() !== "_self") return null;

      let destination;
      try { destination = normalizeStaticDestination(new URL(link.href, location.href)); }
      catch (_) { return null; }

      if (!/^https?:$/.test(destination.protocol) || destination.origin !== location.origin) return null;
      return destination;
    };

    const prefetched = new Set();
    const prefetch = (link) => {
      const destination = internalDestination(link);
      if (!destination || !staticRoutes.has(destination.pathname)) return;
      if (destination.pathname === location.pathname || prefetched.has(destination.href)) return;

      prefetched.add(destination.href);
      const hint = document.createElement("link");
      hint.rel = "prefetch";
      hint.as = "document";
      hint.href = destination.href;
      document.head.append(hint);
    };

    document.addEventListener("pointerover", event => prefetch(event.target.closest?.("a[href]")), { passive:true });
    document.addEventListener("focusin", event => prefetch(event.target.closest?.("a[href]")));

    const prefetchVisibleRoutes = () => document.querySelectorAll("a[href]").forEach(prefetch);
    if ("requestIdleCallback" in window) requestIdleCallback(prefetchVisibleRoutes, { timeout:1800 });
    else window.setTimeout(prefetchVisibleRoutes, 900);

    let leaving = false;

    document.addEventListener("click", async event => {
      if (leaving || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const link = event.target.closest?.("a[href]");
      const destination = internalDestination(link);
      if (!destination) return;

      const sameDocument =
        destination.pathname === location.pathname &&
        destination.search === location.search;
      if (sameDocument && (destination.hash || destination.href === location.href)) return;

      event.preventDefault();
      leaving = true;

      const transitionX = event.detail === 0 ? window.innerWidth / 2 : event.clientX;
      const transitionY = event.detail === 0 ? window.innerHeight / 2 : event.clientY;
      const xPercent = Math.max(0, Math.min(100, transitionX / window.innerWidth * 100));
      const yPercent = Math.max(0, Math.min(100, transitionY / window.innerHeight * 100));

      root.style.setProperty("--page-transition-x", `${xPercent}%`);
      root.style.setProperty("--page-transition-y", `${yPercent}%`);
      overlay.setAttribute("aria-hidden", "false");
      root.classList.add("page-transition-leaving");

      try {
        sessionStorage.setItem(storageKey, JSON.stringify({ x:xPercent, y:yPercent }));
      } catch (_) {}

      await nextPaint();
      await waitForOverlayTransition(1);
      await nextPaint();
      location.assign(destination.href);
    });

    window.addEventListener("pageshow", event => {
      if (!event.persisted) return;
      leaving = false;
      root.classList.remove("page-transition-leaving", "page-transition-entering");
      root.classList.remove("page-transition-background-only", "page-transition-content-reveal");
      overlay.setAttribute("aria-hidden", "true");
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready, { once:true });
  } else ready();
})();
