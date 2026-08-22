(() => {
  const track = document.querySelector(".marquee-track");
  if (!track) return;
  const resume = () => {
    if (document.hidden) return;
    track.style.animation = "none";
    void track.offsetHeight;
    track.style.animation = "";
  };
  document.addEventListener("visibilitychange", resume);
})();
