/*
 * "Get Featured in This Article" (includes/featured.php): opens the panel
 * under the pill, moves between the offer and the three questions, and says
 * what happened when the reader comes back from PayPal (?featured=thanks or
 * cancelled) or the request was refused (?featured=error&reason=...).
 *
 * The form itself is a plain POST: it works, and goes on to PayPal, without
 * anything here.
 */
(function () {
  "use strict";

  // The panel is the last thing in the page, after this script: wait for it.
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  function init() {
    var trigger = document.querySelector(".isb-feature-trigger");
    var panel = document.getElementById("isb-feature-panel");
    if (!trigger || !panel) return;

    var offer = panel.querySelector(".isb-offer");
    var form = panel.querySelector(".isb-details");
    var notice = panel.querySelector(".isb-notice");
    var error = panel.querySelector(".isb-error");

    /** Under the pill, as wide as the article's column; kept on screen on a phone. */
    function place() {
      var pill = trigger.getBoundingClientRect();
      var column = trigger.closest(".cps-single-wrap");
      var box = column ? column.getBoundingClientRect() : null;
      var viewport = document.documentElement.clientWidth;
      var width = Math.min(box ? box.width : 760, viewport - 32);
      var left = box ? box.left : pill.right - width;
      left = Math.max(16, Math.min(left, viewport - width - 16));
      panel.style.width = width + "px";
      panel.style.left = left + window.scrollX + "px";
      panel.style.top = pill.bottom + window.scrollY + 12 + "px";
    }

    function step(name) {
      offer.hidden = name !== "offer";
      form.hidden = name !== "details";
      if (name === "details") {
        var first = form.querySelector("input[type=email]");
        if (first) first.focus();
      }
    }

    function say(text) {
      notice.textContent = text || "";
      notice.hidden = !text;
    }

    function open() {
      panel.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      place();
      panel.focus();
      document.addEventListener("keydown", onKey);
      document.addEventListener("pointerdown", onOutside, true);
      window.addEventListener("resize", place);
    }

    function close(returnFocus) {
      panel.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      step("offer");
      say("");
      error.hidden = true;
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onOutside, true);
      window.removeEventListener("resize", place);
      if (returnFocus) trigger.focus();
    }

    function onKey(event) {
      if (event.key === "Escape") close(true);
    }

    function onOutside(event) {
      if (!panel.contains(event.target) && !trigger.contains(event.target)) close(false);
    }

    trigger.addEventListener("click", function () {
      if (panel.hidden) open();
      else close(true);
    });
    panel.querySelector("[data-isb-next]").addEventListener("click", function () {
      step("details");
    });
    panel.querySelector("[data-isb-back]").addEventListener("click", function () {
      error.hidden = true;
      step("offer");
    });
    var submit = form.querySelector("button[type=submit]");
    var submitLabel = submit.innerHTML;
    form.addEventListener("submit", function () {
      // Sent once: a second press would start a second request.
      window.setTimeout(function () {
        submit.disabled = true;
        submit.textContent = panel.getAttribute("data-opening");
      }, 0);
    });
    // Back from PayPal with the browser's Back button: the page comes from its cache, button and all.
    window.addEventListener("pageshow", function (event) {
      if (!event.persisted) return;
      submit.disabled = false;
      submit.innerHTML = submitLabel;
    });

    // Back from PayPal, or a refused request: open the panel and say so.
    var params = new URLSearchParams(window.location.search);
    var state = params.get("featured");
    if (state) {
      open();
      if (state === "thanks") say(panel.getAttribute("data-thanks"));
      if (state === "cancelled") say(panel.getAttribute("data-cancelled"));
      if (state === "error") {
        step("details");
        error.textContent = panel.getAttribute("data-error-" + (params.get("reason") || "fields")) || panel.getAttribute("data-error-fields");
        error.hidden = false;
      }
      params.delete("featured");
      params.delete("reason");
      var query = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (query ? "?" + query : "") + window.location.hash);
    }
  }
})();
