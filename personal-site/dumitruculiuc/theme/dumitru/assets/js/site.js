/**
 * Site behaviour: light/dark switch, header on scroll, project strip
 * arrows, copy-link. Everything works (or is simply absent) without it.
 */
(function () {
  "use strict";

  var root = document.documentElement;
  var KEY = "dumitru-theme";

  // --- Light / dark ---------------------------------------------------------
  // No stored choice: follow the device. A choice is remembered.
  var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  function isDark() {
    if (root.dataset.theme) return root.dataset.theme === "dark";
    return !!(media && media.matches);
  }
  function showSwitch() {
    var buttons = document.querySelectorAll("[data-dc-theme-switch]");
    for (var i = 0; i < buttons.length; i++) buttons[i].setAttribute("aria-pressed", isDark() ? "true" : "false");
  }
  document.addEventListener("click", function (e) {
    var button = e.target.closest && e.target.closest("[data-dc-theme-switch]");
    if (!button) return;
    var next = isDark() ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch (err) { /* private mode */ }
    showSwitch();
  });
  if (media && media.addEventListener) media.addEventListener("change", showSwitch);
  showSwitch();

  // --- Header: tighter once the page has scrolled ----------------------------
  var header = document.querySelector("[data-dc-header]");
  if (header) {
    var ticking = false;
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        header.classList.toggle("is-scrolled", window.scrollY > 24);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // --- Project strip arrows ----------------------------------------------------
  var shelves = document.querySelectorAll("[data-dc-shelf]");
  Array.prototype.forEach.call(shelves, function (shelf) {
    var list = shelf.querySelector(".shelf__items");
    var buttons = shelf.querySelectorAll("[data-dc-shelf-step]");
    if (!list) return;
    function update() {
      var max = list.scrollWidth - list.clientWidth - 2;
      shelf.classList.toggle("is-static", max <= 0);
      buttons[0].disabled = list.scrollLeft <= 2;
      buttons[1].disabled = list.scrollLeft >= max;
    }
    Array.prototype.forEach.call(buttons, function (button) {
      button.addEventListener("click", function () {
        var step = Number(button.getAttribute("data-dc-shelf-step")) || 1;
        list.scrollBy({ left: step * list.clientWidth * 0.8, behavior: "smooth" });
      });
    });
    list.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  });

  // --- Copy link ------------------------------------------------------------------
  document.addEventListener("click", function (e) {
    var button = e.target.closest && e.target.closest("[data-dc-copy]");
    if (!button) return;
    var url = button.getAttribute("data-dc-copy");
    var label = button.textContent;
    var done = function () {
      button.textContent = button.getAttribute("data-dc-copied") || label;
      setTimeout(function () { button.textContent = label; }, 1800);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, function () { window.prompt("", url); });
    } else {
      window.prompt("", url);
    }
  });
})();
