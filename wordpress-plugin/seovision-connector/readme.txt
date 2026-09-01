=== SEOVision Connector ===
Requires at least: 5.6
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later

Publishes articles written by SEOVision straight to your WordPress site.

== Description ==

Connect your site to SEOVision with a single Integration Key. Articles you
approve in SEOVision are published here automatically, with their images.

This plugin asks your site to fetch articles rather than letting an outside
service push them in. That means SEOVision never holds a password to your
WordPress site, and it works on installs where the usual approach does not —
behind a firewall, on a staging domain, or where a security plugin has
disabled the WordPress API.

== Installation ==

1. In SEOVision, open your website, then Publishing.
2. Under "WordPress plugin", click New key and copy the key. It is shown once.
3. In WordPress, go to Plugins → Add New → Upload Plugin and upload the zip.
4. Activate it.
5. Go to Settings → SEOVision, paste the key, and click Save and connect.

You should see "Connected" and the name of the website it linked to. If the
name is not the site you expected, the key belongs to a different website in
SEOVision — go back and copy the right one.

== Frequently Asked Questions ==

= How often does it check for new articles? =

Once an hour, using WordPress's own scheduler. You can also press "Check for
articles now" on the settings page.

Note that WordPress's scheduler only runs when someone visits your site. On a
quiet site articles may appear later than an hour. If that matters, ask your
host about a real cron job.

= Where do articles appear? =

As published posts, with the featured image set. They are ordinary posts, so
you can edit or unpublish them like anything else.

= What happens if I lose the key? =

Revoke it in SEOVision and create a new one. Keys are stored scrambled, so
nobody — including us — can look yours up after it is created.

= Does this send my site's data to SEOVision? =

It reports your site address, WordPress version and plugin version, so support
can help when something goes wrong. Nothing else is sent. The plugin only
fetches articles and reports whether each one published.

== Changelog ==

= 1.0.0 =
* First release: connect with an Integration Key, hourly sync, featured images.
