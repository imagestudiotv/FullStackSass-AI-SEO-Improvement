/* Scoped repairs for the Image Studio markup inspected on 2026-10-08. */
(function () {
  'use strict';
  function setup() {
    var viewport = document.querySelector('body.single-post #viewport');
    if (viewport && viewport.querySelector('#track .slide-intro')) {
      document.body.classList.add('isb-portfolio');
      document.documentElement.classList.add('isb-portfolio-root');
      // The existing gallery listens on window. Let the reader consume its own
      // wheel events without moving the horizontal gallery behind it.
      document.addEventListener('wheel', function (event) {
        if (event.target instanceof Element && event.target.closest('.isx-story-v2')) event.stopPropagation();
      }, { passive: true });
      document.addEventListener('mousedown', function (event) {
        if (event.target instanceof Element && event.target.closest('.isx-story-v2')) event.stopPropagation();
      }, true);
    }

    var grid = document.querySelector('body.home .elementor-element-707268c');
    if (!grid || grid.children.length !== 4) return;
    var columns = Array.from(grid.children);
    var wrappers = [document.createElement('div'), document.createElement('div')];
    wrappers.forEach(function (wrapper) { wrapper.className = 'isb-mobile-column'; });
    var mobile = window.matchMedia('(max-width: 767px)');
    function arrange() {
      if (mobile.matches) {
        wrappers.forEach(function (wrapper) { grid.appendChild(wrapper); });
        columns.forEach(function (column, index) { wrappers[index % 2].appendChild(column); });
        grid.classList.add('isb-mobile-grid');
      } else {
        columns.forEach(function (column) { grid.appendChild(column); });
        wrappers.forEach(function (wrapper) { wrapper.remove(); });
        grid.classList.remove('isb-mobile-grid');
      }
    }
    arrange();
    mobile.addEventListener('change', arrange);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
