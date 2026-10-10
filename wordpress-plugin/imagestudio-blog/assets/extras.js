/*
 * "In this article" (includes/extras.php): its links stop each heading below
 * the site's fixed header. The CSS does that - scroll-margin-top on the
 * headings - for the browser's own jump. But the theme (Astra's "scroll to
 * ID", on at imagestudio.com) takes every click on a "#..." link and scrolls
 * to the heading's very top itself, under the fixed header. So:
 *  - a click on a contents link is kept from it (and from any other script
 *    that would do the same), and the browser jumps: to the right place,
 *    smoothly as the site's CSS asks;
 *  - opening an address with a heading's #id: the browser jumps right, then
 *    Astra scrolls again, 750ms after the page loaded, to the heading's very
 *    top. Its scrolling function is told to stop scroll-margin-top short of
 *    the heading.
 * On a page without the contents box, or without Astra, this does nothing.
 */
(function () {
  "use strict";

  var LINKS = ".isb-toc a[href^='#']";

  function contentsLink(node) {
    return node && node.closest ? node.closest(LINKS) : null;
  }

  // First of all (the page, in the capture phase): the theme's handlers never see the click.
  window.addEventListener(
    "click",
    function (event) {
      if (event.defaultPrevented || !contentsLink(event.target)) return;
      event.stopPropagation();
    },
    true
  );

  /** The heading's top in the page, measured as Astra measures it. */
  function pageTop(element) {
    var top = 0;
    for (; element; element = element.offsetParent) top += element.offsetTop;
    return top;
  }

  /** Astra's target, moved up by the heading's scroll-margin-top when it is a contents heading. */
  function clearOfHeader(top) {
    var links = document.querySelectorAll(LINKS);
    for (var i = 0; i < links.length; i++) {
      var id;
      try {
        id = decodeURIComponent(links[i].getAttribute("href").slice(1));
      } catch {
        continue;
      }
      var heading = document.getElementById(id);
      if (heading && Math.abs(pageTop(heading) - top) < 1) {
        return top - (parseFloat(window.getComputedStyle(heading).scrollMarginTop) || 0);
      }
    }
    return top;
  }

  function wrapAstra() {
    var scroll = window.astraSmoothScroll;
    if (typeof scroll !== "function" || scroll.isbWrapped || !document.querySelector(LINKS)) return;
    var wrapped = function (event, top) {
      return scroll.call(this, event, typeof top === "number" ? clearOfHeader(top) : top);
    };
    wrapped.isbWrapped = true;
    window.astraSmoothScroll = wrapped;
  }

  wrapAstra();
  // Astra's script may come after this one: it is in place by then.
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wrapAstra);
})();
