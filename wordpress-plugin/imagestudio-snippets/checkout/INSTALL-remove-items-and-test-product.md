# Image Studio checkout: X on each product, and the test product

Two separate jobs. Neither has been done on the live site. Nothing here was run on imagestudio.com.

## A. The X on each product (new WPCode snippet)

1. Back up: WordPress admin, Settings, UpdraftPlus Backups, Backup Now (or MyKinsta, Backups, Manual).
2. WordPress admin, Code Snippets (WPCode), + Add Snippet, Add Your Custom Code (New Snippet).
3. Title: `ISX - checkout remove item`. Code Type: **PHP Snippet**.
4. Paste the whole of `isx-checkout-remove-items.php`. Its first lines must read `IMAGE STUDIO - CHECKOUT: REMOVE AN ITEM v1.0`.
5. Insertion: **Auto Insert**, Location: **Run Everywhere**. Save, switch to **Active**, save again.
6. Clear caches: the admin bar's Clear Caches (Kinsta) and WP Rocket; Cloudflare if used.

The two existing snippets, "ISX - checkout design" and "ISX - checkout fixes", are not edited.

### Check (no payment needed; do not press Place order)

In a private window, in English, Italian and Spanish:

1. Add two products: open a shop product, Add to cart, then a second one, then the checkout.
2. Each product has an X. Type a name and an email.
3. Press X on one product: the row goes, the total below the coupon changes, the name and email stay.
4. With a coupon applied, the discount changes too. Check the Stripe card box and PayPal still show.
5. Reload the page: the removed product does not come back.
6. Press X on the last product: "Your cart is currently empty." (In Italian and Spanish, the saved pages show a separate cart page, so WooCommerce may open that page, with its own empty-cart message.)
7. On a phone: the rows fit and the X can be tapped. With the keyboard: Tab reaches the X, Enter removes.

### Undo

WPCode, switch `ISX - checkout remove item` to **Inactive**, clear the caches. Nothing else changed.

## B. "Test - do not buy": PENDING, needs Daniel's approval before anyone does it

This is the product to take off sale. The evidence, from the public site on 2026-11-05:

| | |
|---|---|
| Name | Test - do not buy |
| Product ID | **11863** (body class `postid-11863`, shop card `post-11863`, `data-product_id="11863"`) |
| Address | /product/test-do-not-buy/ |
| Price | $1.00, published, in stock, listed on /shop/ and in the product sitemap |
| Languages | /it/prodotto/... and /es/producto/... show the same post, 11863: there is no separate copy to remove |

`5100`, the id in the screenshot's address (`checkout/?add-to-cart=5100`), is **not** this product. It is "How to Use a Reflector Masterclass" ($199). Do not trash 5100.

### Steps (reversible)

1. WordPress admin, Products, All Products. Search `Test`.
2. Confirm the row before touching it: hover over the name. It must say **ID: 11863**, price **$1.00**, and View must open `/product/test-do-not-buy/`.
3. Check for dependencies: WooCommerce, Orders, search `do not buy`; Marketing, Coupons, for one limited to this product. Orders keep their own copy of the name and price, so they are not affected. Note any coupon for Daniel.
4. In the row, press **Trash**. Do not use Delete Permanently, and do not empty the trash.
5. Clear the caches (Kinsta, WP Rocket, Cloudflare).
6. Check in a private window: it is gone from /shop/; /product/test-do-not-buy/ answers 404; the other three products still show.

Do not delete anything in Stripe or PayPal for this. A cart still holding the product loses it, with WooCommerce's own notice, on the visitor's next page.

### Undo

Products, the **Trash** tab, Test - do not buy, **Restore**. It returns as published, under the same address. Clear the caches.
