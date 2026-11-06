/**
 * IMAGE STUDIO - CHECKOUT: REMOVE AN ITEM v1.0 (2026-11-05)
 * WPCode: PHP Snippet, Run Everywhere
 *
 * The client: buyers need an X on each product in the order summary.
 * - Each product in "Order summary" gets an X button. It removes that one
 *   product from the cart, by its real cart item key, through WooCommerce's own
 *   cart. WooCommerce then recalculates the order as it does after a coupon:
 *   totals, discount, tax and which payment methods are offered. The page does
 *   not reload, so the name, the email and the chosen payment method stay.
 * - The last product: the page reloads to the checkout's own "Your cart is
 *   currently empty" message, at the address without ?add-to-cart=.
 * - With two or more products, the summary also shows the subtotal and total.
 *   The checkout shows them only with a coupon otherwise, so a buyer with two
 *   products could not see what the order adds up to.
 * - ?add-to-cart=<id> is taken out of the address as soon as a product is
 *   removed: reloading that address would put the product straight back.
 * - The button is a real button: keyboard, screen reader label naming the
 *   product, and a spoken message. English, Italian and Spanish follow the page.
 * Nothing here creates or changes an order. Deactivate to undo; the cart keeps
 * working as before.
 * Goes with "ISX - checkout design" and "ISX - checkout fixes"; changes neither.
 */

// The checkout page itself (not the thank-you page).
$isx_cr_page = function () {
    return function_exists('is_checkout') && is_checkout() && !(function_exists('is_wc_endpoint_url') && is_wc_endpoint_url('order-received'));
};

// The request the X sends. A wc-ajax request: it has the visitor's own cart, and
// the nonce is WooCommerce's own for cart changes (as its remove links use).
add_action('wc_ajax_isx_co_remove_item', function () {
    check_ajax_referer('woocommerce-cart', 'security');
    $key = isset($_POST['cart_item_key']) ? wc_clean(wp_unslash($_POST['cart_item_key'])) : '';
    if (!is_string($key) || $key === '') {
        wp_send_json_error(array('code' => 'no_item'), 400);
    }
    $cart = WC()->cart;
    // Gone already (removed in another tab): the answer below still says what is left.
    if ($cart->get_cart_item($key) && !$cart->remove_cart_item($key)) {
        wp_send_json_error(array('code' => 'not_removed'), 409);
    }
    $cart->calculate_totals();
    wp_send_json_success(array(
        'keys'  => array_keys($cart->get_cart()),
        'empty' => $cart->is_empty(),
    ));
});

add_action('wp_head', function () use ($isx_cr_page) {
    if (!$isx_cr_page()) {
        return;
    }
    ?>
<style id="isx-checkout-remove">
.cwc-checkout .cwc-cart-item { position: relative; }
.cwc-checkout .cwc-cart-item.isx-co-removing { opacity: .45; }
.isx-co-remove {
    flex: none; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box;
    width: 40px; height: 40px; min-width: 40px; margin: 0 -8px 0 -6px; padding: 0 !important;
    border: 0 !important; border-radius: 50% !important; background: transparent !important; box-shadow: none !important;
    color: #6b6560 !important; line-height: 1; cursor: pointer; transition: background-color .15s, color .15s;
}
.isx-co-remove svg { display: block; width: 16px; height: 16px; }
.isx-co-remove:hover, .isx-co-remove:focus { background: rgba(0, 0, 0, .07) !important; color: #111 !important; }
.isx-co-remove:focus-visible { outline: 2px solid currentColor; outline-offset: 1px; }
.isx-co-remove[aria-disabled="true"] { cursor: default; opacity: .5; }
.isx-co-status { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.isx-co-status.isx-co-status--error { position: static; width: auto; height: auto; margin: 0 0 14px; padding: 10px 12px; overflow: visible; clip: auto; white-space: normal; border-left: 4px solid #c62828; border-radius: 8px; background: #fdecea; color: #8e1c1c; font-size: 14px; }
/* Two or more products: the subtotal and total, under the coupon. The rows of products stay hidden: they are listed above. */
body.woocommerce-checkout .cwc-checkout .cwc-col-right:has(.cwc-cart-item + .cwc-cart-item) .cwc-order-review table.woocommerce-checkout-review-order-table { display: table !important; }
/* One column may not grow wider than the card, which clips what sticks out: the X would be cut off. */
@media (max-width: 860px) {
    .cwc-checkout .cwc-grid { grid-template-columns: minmax(0, 1fr) !important; }
    .cwc-checkout .cwc-coupon-row input#coupon_code { min-width: 0; }
}
@media (max-width: 480px) {
    .cwc-checkout .cwc-cart-item { gap: 10px !important; padding: 12px !important; }
    .cwc-checkout .cwc-cart-item-thumb img { width: 52px !important; height: 52px !important; }
    .cwc-checkout :is(.cwc-cart-item-info, .cwc-cart-item-price) { font-size: 16px !important; }
    .isx-co-remove { margin: 0 -6px 0 -4px; }
}
@media (prefers-reduced-motion: reduce) { .isx-co-remove { transition: none; } }
</style>
    <?php
}, 100);

add_action('wp_footer', function () use ($isx_cr_page) {
    if (!$isx_cr_page() || !function_exists('WC') || !WC()->cart) {
        return;
    }
    $items = array();
    foreach (WC()->cart->get_cart() as $key => $item) {
        $product = isset($item['data']) ? $item['data'] : null;
        $name = $product ? apply_filters('woocommerce_cart_item_name', $product->get_name(), $item, $key) : '';
        $items[] = array('key' => (string) $key, 'name' => html_entity_decode(wp_strip_all_tags((string) $name), ENT_QUOTES, 'UTF-8'));
    }
    ?>
<script id="isx-checkout-remove-js">
(function () {
    var ITEMS = <?php echo wp_json_encode($items); ?>;
    var NONCE = <?php echo wp_json_encode(wp_create_nonce('woocommerce-cart')); ?>;
    var lang = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
    var T = {
        en: { remove: 'Remove %s from your order', removed: '%s removed. Your order has been updated.', failed: 'This product could not be removed. Please reload the page and try again.' },
        it: { remove: 'Rimuovi %s dal tuo ordine', removed: '%s rimosso. Il tuo ordine è stato aggiornato.', failed: 'Non è stato possibile rimuovere questo prodotto. Ricarica la pagina e riprova.' },
        es: { remove: 'Quitar %s de tu pedido', removed: '%s eliminado. Tu pedido se ha actualizado.', failed: 'No se ha podido quitar este producto. Vuelve a cargar la página e inténtalo de nuevo.' }
    };
    var t = T[lang] || T.en;
    var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    var busy = false;

    function fill(text, name) { return text.replace('%s', name); }
    // Letters and digits only: the page may show "–" where the product's name has "-".
    function plain(text) { return String(text || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''); }
    function rowName(row) {
        var node = row.querySelector('.cwc-cart-item-name') || row.querySelector('.cwc-cart-item-info');
        return node ? node.textContent.replace(/\s+/g, ' ').trim() : '';
    }
    function sameName(a, b) {
        a = plain(a); b = plain(b);
        return a !== '' && b !== '' && (a.indexOf(b) === 0 || b.indexOf(a) === 0);
    }

    // Each row, with its cart item. A row that cannot be matched for certain gets no X.
    function attach() {
        [].forEach.call(document.querySelectorAll('.cwc-checkout .cwc-cart-items'), function (list) {
            var free = ITEMS.slice();
            [].forEach.call(list.querySelectorAll('.cwc-cart-item'), function (row) {
                var name = rowName(row);
                var found = -1;
                for (var i = 0; i < free.length && found < 0; i++) if (sameName(free[i].name, name)) found = i;
                if (found < 0) return;
                var item = free.splice(found, 1)[0];
                row.setAttribute('data-isx-key', item.key);
                if (row.querySelector('.isx-co-remove')) return;
                var button = document.createElement('button');
                button.type = 'button';
                button.className = 'isx-co-remove';
                button.setAttribute('aria-label', fill(t.remove, name || item.name));
                button.innerHTML = ICON;
                row.appendChild(button);
            });
        });
    }

    function status(message, isError) {
        var right = document.querySelector('.cwc-checkout .cwc-col-right');
        if (!right) return;
        var node = right.querySelector('.isx-co-status');
        if (!node) {
            node = document.createElement('div');
            node.className = 'isx-co-status';
            node.setAttribute('role', 'status');
            node.setAttribute('aria-live', 'polite');
            var list = right.querySelector('.cwc-cart-items');
            list.parentNode.insertBefore(node, list);
        }
        node.classList.toggle('isx-co-status--error', !!isError);
        node.textContent = message;
    }

    // The address without what would put a product back when the page is reloaded.
    function cleanAddress() {
        var url = new URL(window.location.href);
        ['add-to-cart', 'quantity', 'variation_id'].forEach(function (name) { url.searchParams.delete(name); });
        return url.pathname + url.search + url.hash;
    }

    function setBusy(on) {
        busy = on;
        [].forEach.call(document.querySelectorAll('.isx-co-remove'), function (b) {
            if (on) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled');
        });
    }

    function remove(button) {
        var row = button.closest('.cwc-cart-item');
        var params = window.wc_checkout_params;
        if (busy || !row || !params) return;
        var name = rowName(row);
        var body = new URLSearchParams({ security: NONCE, cart_item_key: row.getAttribute('data-isx-key') });
        setBusy(true);
        row.classList.add('isx-co-removing');
        fetch(params.wc_ajax_url.toString().replace('%%endpoint%%', 'isx_co_remove_item'), {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body: body.toString()
        }).then(function (response) {
            return response.ok ? response.json() : Promise.reject(new Error('HTTP ' + response.status));
        }).then(function (answer) {
            if (!answer || !answer.success) throw new Error('refused');
            window.history.replaceState(window.history.state, '', cleanAddress());
            if (answer.data.empty) {
                // Reloaded, so the checkout's own empty-cart message shows, in the page's language.
                window.location.replace(cleanAddress());
                return;
            }
            ITEMS = ITEMS.filter(function (item) { return answer.data.keys.indexOf(item.key) >= 0; });
            var next = null;
            [].forEach.call(document.querySelectorAll('.cwc-checkout .cwc-cart-item[data-isx-key]'), function (other) {
                if (answer.data.keys.indexOf(other.getAttribute('data-isx-key')) < 0) {
                    if (other === row) {
                        var after = row.nextElementSibling || row.previousElementSibling;
                        next = after ? after.querySelector('.isx-co-remove') : null;
                    }
                    other.parentNode.removeChild(other);
                }
            });
            setBusy(false);
            if (next) next.focus();
            status(fill(t.removed, name));
            // WooCommerce's own recalculation: totals, discount, tax, payment methods.
            if (window.jQuery) {
                window.jQuery(document.body).trigger('update_checkout', { update_shipping_method: false });
                window.jQuery(document.body).trigger('wc_fragment_refresh');
            }
        }).catch(function () {
            row.classList.remove('isx-co-removing');
            setBusy(false);
            button.focus();
            status(t.failed, true);
        });
    }

    document.addEventListener('click', function (event) {
        var button = event.target.closest ? event.target.closest('.isx-co-remove') : null;
        if (button) {
            event.preventDefault();
            remove(button);
        }
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach); else attach();
    if (window.jQuery) window.jQuery(document.body).on('updated_checkout', attach);
})();
</script>
    <?php
}, 100);
