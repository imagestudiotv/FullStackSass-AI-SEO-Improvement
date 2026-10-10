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

/* Editorial articles (custom_post) print Astra's own footer
   (<footer class="site-footer" id="colophon">) before the site footer
   (<footer id="colophon" role="contentinfo">, Elementor template 313, 5954 in
   Italian). The footer script inside the site footer works on the page's
   FIRST <footer>, so on these pages it put the small copyright line in
   Astra's footer, above the site footer, missed the Services/Studio columns
   and left the old copyright line showing (client, 2026-10-09). Astra's
   footer goes before that script runs (it waits for DOMContentLoaded; this
   file is a plain script after both footers), so it finds the site footer,
   as on the homepage. Only an Astra footer that comes before the site footer
   is removed, whatever is left inside it. The real fix is in the code that
   prints these articles (it runs before the header/footer plugin removes
   Astra's footer); once that is fixed, this does nothing. */
(function () {
  'use strict';
  function dropThemeFooter() {
    var fixer = document.querySelector('footer[role="contentinfo"] > .footer-width-fixer');
    if (!fixer) return;
    var site = fixer.parentNode;
    var themes = document.querySelectorAll('footer.site-footer');
    for (var i = 0; i < themes.length; i++) {
      var theme = themes[i];
      if (theme === site || theme.contains(site) || site.contains(theme) || !theme.parentNode) continue;
      if (!(theme.compareDocumentPosition(site) & 4)) continue; /* 4: the site footer follows */
      theme.parentNode.removeChild(theme);
    }
  }
  dropThemeFooter();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', dropThemeFooter);
})();

/* "Next project" at the end of a portfolio post (client, 2026-10-09) must lead
   to a post in the page's own language. The theme's single-post template links
   the next newer post of the same language, but the newest post of each
   language gets the newest other post of ANY language: the English villa post
   led to /it/victoria-matteo/, the Italian Victoria & Matteo post to the
   English villa post. Only when the link's language differs from the page's,
   this asks WordPress (its REST API, which WPML keeps to the page's language)
   for the posts by date and applies the template's own rule in the page's
   language: the next newer post, or for the newest post the newest other one.
   A link that is right is never touched and nothing is fetched; anything
   unexpected leaves the link as it is. Once the template's fallback query is
   made language-aware, the languages match and this does nothing. */
(function () {
  'use strict';
  // A path's WPML language folder: "/it/slug/" -> "it"; the default language has none.
  function langDir(path) {
    var match = /^\/([a-z]{2})\/[^\/]/i.exec(path || '');
    return match ? match[1].toLowerCase() : '';
  }
  function parse(href) {
    var a = document.createElement('a');
    a.href = href;
    return a;
  }
  // REST titles are HTML ("Victoria &#038; Matteo"); a textarea decodes without running anything.
  function plainText(html) {
    var box = document.createElement('textarea');
    box.innerHTML = String(html).replace(/<[^>]*>/g, '');
    return box.value.replace(/\s+/g, ' ').trim();
  }
  function fixNextProject() {
    if (!window.fetch || !document.querySelector('body.single-post #viewport #track .slide-intro')) return;
    var link = document.querySelector('#track .next-combined-box a.next-link[href]');
    var title = document.querySelector('#track .next-combined-box .next-title');
    var api = document.querySelector('link[rel="alternate"][type="application/json"][href*="/wp-json/wp/v2/posts/"]');
    var self = /(?:^|\s)postid-(\d+)(?:\s|$)/.exec(document.body.className);
    if (!link || !title || !api || !self) return;
    var lang = langDir(location.pathname);
    if (link.host !== location.host || langDir(link.pathname) === lang) return;
    // This post's own REST address, in the page's language: .../wp-json/wp/v2/posts/<id>.
    var route = /^(.*\/wp-json\/wp\/v2\/posts)\/(\d+)\/?$/.exec(api.href);
    if (!route || route[2] !== self[1]) return;
    var base = parse(route[1]);
    if (base.host !== location.host || langDir(base.pathname) !== lang) return;
    var id = Number(self[1]);
    fetch(route[1] + '?per_page=100&orderby=date&order=desc&_fields=id,date,link,title', { credentials: 'omit', headers: { Accept: 'application/json' } })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (posts) {
        if (!Array.isArray(posts)) return;
        // This language's posts, newest first.
        posts = posts.filter(function (post) {
          if (!post || typeof post.id !== 'number' || typeof post.date !== 'string' || typeof post.link !== 'string' || !post.title || typeof post.title.rendered !== 'string') return false;
          var a = parse(post.link);
          return a.host === location.host && langDir(a.pathname) === lang;
        }).sort(function (a, b) {
          return a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id;
        });
        var at = -1;
        for (var i = 0; i < posts.length; i++) if (posts[i].id === id) at = i;
        if (at < 0) return;
        var next = at > 0 ? posts[at - 1] : posts[1];
        var name = next ? plainText(next.title.rendered) : '';
        if (!name) return;
        link.setAttribute('data-isb-original-href', link.getAttribute('href'));
        link.setAttribute('href', next.link);
        title.textContent = name;
      })
      .catch(function () {});
  }
  // layout.js loads in the footer, after the gallery: start at once rather
  // than after the scripts that follow it.
  if (document.readyState !== 'loading' || document.querySelector('#track .next-combined-box')) fixNextProject();
  else document.addEventListener('DOMContentLoaded', fixNextProject);
})();
