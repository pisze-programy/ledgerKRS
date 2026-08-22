(() => {
  const hero = document.querySelector(".hero");
  if (!hero) return;
  const glow = hero.querySelector("h1 em");
  if (glow && window.matchMedia("(pointer: fine)").matches) {
    glow.style.background = "linear-gradient(90deg, var(--accent), transparent 130%)";
    glow.style.webkitBackgroundClip = "text";
    glow.style.backgroundClip = "text";
    glow.style.color = "transparent";
  }
})();
