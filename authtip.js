(function(){
  const tip = document.getElementById("auth-tip");
  if(!tip) return;

  const KEY = "castro_authtip_v1";

  // Підлаштуй під свій код:
  const isAuthed = !!window.CASTRO_USER;              // true якщо залогінений
  const profileOk = !!window.CASTRO_PROFILE_OK;       // true якщо профіль заповнений

  const wasShown = localStorage.getItem(KEY) === "1";

  // Показуємо:
  // - одноразово для неавторизованих
  // - або якщо авторизований, але профіль не заповнений
  const shouldShow = (!isAuthed && !wasShown) || (isAuthed && !profileOk);
  if(!shouldShow) return;

  const authBtn = document.getElementById("auth-login") || document.querySelector(".auth__btn");
  if(!authBtn) return;

  function place(){
    const r = authBtn.getBoundingClientRect();

    // Розміщуємо "бульбашку" зліва від кнопки (щоб стрілка дивилась вправо на кнопку)
    const bubbleW = Math.min(320, window.innerWidth - 24);
    const gap = 16;

    let left = Math.round(r.left - bubbleW - gap);
    let top  = Math.round(r.top + (r.height/2) - 70);

    // Якщо не влазить зліва — ставимо знизу/справа
    if(left < 12){
      left = Math.round(r.right + gap);
    }
    if(left + bubbleW > window.innerWidth - 12){
      left = Math.round(window.innerWidth - bubbleW - 12);
    }
    if(top < 12) top = 12;
    if(top > window.innerHeight - 180) top = Math.round(window.innerHeight - 180);

    tip.style.left = left + "px";
    tip.style.top  = top + "px";
  }

  function open(){
    tip.classList.add("is-open");
    tip.setAttribute("aria-hidden", "false");
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
  }

  function close(mark=true){
    tip.classList.remove("is-open");
    tip.setAttribute("aria-hidden", "true");
    window.removeEventListener("resize", place);
    window.removeEventListener("scroll", place, true);
    if(mark) localStorage.setItem(KEY, "1");
  }

  document.getElementById("authtip-go")?.addEventListener("click", () => {
    authBtn.scrollIntoView({behavior:"smooth", block:"center"});
    authBtn.focus?.();
    authBtn.click?.();
    close(true);
  });

  document.getElementById("authtip-close")?.addEventListener("click", () => close(true));

  // Автозакриття через 10с (щоб не заважало)
  setTimeout(() => close(true), 10000);

  // Показати через 700мс після завантаження
  setTimeout(open, 700);
})();
