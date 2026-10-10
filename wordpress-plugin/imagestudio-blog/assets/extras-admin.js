/*
 * The "Article extras" box on an article's edit screen (includes/extras.php):
 * "Add question" adds an empty question and answer, "Remove" takes one away.
 * The rows are plain form fields, saved with the article - by the classic
 * editor's form, and by the block editor, which sends its boxes' fields after
 * saving the article. It listens on the whole page: the block editor moves
 * the box into place after the page has loaded.
 */
(function () {
  "use strict";

  function matches(node, selector) {
    var test = node.matches || node.msMatchesSelector || node.webkitMatchesSelector;
    return test ? test.call(node, selector) : false;
  }

  function closest(node, selector) {
    while (node && node.nodeType === 1) {
      if (matches(node, selector)) return node;
      node = node.parentNode;
    }
    return null;
  }

  function rowCount(rows) {
    return rows.querySelectorAll(".isb-faq-row").length;
  }

  function limit(rows) {
    return parseInt(rows.getAttribute("data-max"), 10) || 20;
  }

  /** "Add question" stops at 20 rows, and says why. */
  function refresh(box) {
    var rows = box.querySelector("[data-isb-faq-rows]");
    var add = box.querySelector("[data-isb-faq-add]");
    var full = box.querySelector("[data-isb-faq-full]");
    if (!rows || !add) return;
    var isFull = rowCount(rows) >= limit(rows);
    add.disabled = isFull;
    if (full) full.hidden = !isFull;
  }

  function addRow(box) {
    var rows = box.querySelector("[data-isb-faq-rows]");
    var template = box.querySelector("template[data-isb-faq-template]");
    if (!rows || !template || rowCount(rows) >= limit(rows)) return;
    // Each row gets a number of its own, so the saved rows never mix.
    var next = parseInt(rows.getAttribute("data-next"), 10) || 0;
    rows.setAttribute("data-next", String(next + 1));
    var holder = document.createElement("div");
    holder.innerHTML = template.innerHTML.replace(/__i__/g, String(next));
    var row = holder.querySelector(".isb-faq-row");
    if (!row) return;
    rows.appendChild(row);
    var question = row.querySelector("input");
    if (question) question.focus();
    refresh(box);
  }

  function removeRow(box, button) {
    var row = closest(button, ".isb-faq-row");
    if (row && row.parentNode) row.parentNode.removeChild(row);
    refresh(box);
    var add = box.querySelector("[data-isb-faq-add]");
    if (add) add.focus();
  }

  document.addEventListener("click", function (event) {
    var add = closest(event.target, "[data-isb-faq-add]");
    var remove = add ? null : closest(event.target, "[data-isb-faq-remove]");
    if (!add && !remove) return;
    var box = closest(add || remove, "[data-isb-extras]");
    if (!box) return;
    event.preventDefault();
    if (add) addRow(box);
    else removeRow(box, remove);
  });
})();
