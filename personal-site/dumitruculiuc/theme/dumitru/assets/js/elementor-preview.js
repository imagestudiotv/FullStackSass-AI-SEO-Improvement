/**
 * Elementor's editor only: when it redraws a Dumitru widget, start the
 * portrait and the project strip in the new markup. The live site does not
 * load this file.
 */
(function ($) {
  "use strict";

  function ready($scope) {
    var root = $scope && $scope[0];
    if (!root) return;
    if (window.DCPortrait) {
      Array.prototype.forEach.call(root.querySelectorAll("[data-dc-portrait]"), window.DCPortrait.mount);
    }
    if (window.DCShelf) {
      Array.prototype.forEach.call(root.querySelectorAll("[data-dc-shelf]"), window.DCShelf.mount);
    }
  }

  function hook() {
    window.elementorFrontend.hooks.addAction("frontend/element_ready/dumitru-intro.default", ready);
    window.elementorFrontend.hooks.addAction("frontend/element_ready/dumitru-projects.default", ready);
  }

  if (window.elementorFrontend && window.elementorFrontend.hooks) {
    hook();
  } else {
    $(window).on("elementor/frontend/init", hook);
  }
})(jQuery);
