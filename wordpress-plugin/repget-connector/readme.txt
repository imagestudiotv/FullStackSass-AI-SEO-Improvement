=== RepGet Connector ===
Requires at least: 5.6
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 1.7.1
License: GPLv2 or later

Publishes articles written by RepGet straight to your WordPress site.

== Description ==

Connect your site to RepGet with one button. Articles you approve in RepGet
are published here automatically, with their images.

This plugin asks your site to fetch articles rather than letting an outside
service push them in. That means RepGet never holds a password to your
WordPress site, and it works on installs where the usual approach does not —
behind a firewall, on a staging domain, or where a security plugin has
disabled the WordPress API.

== Installation ==

1. In RepGet, open Integrations, then WordPress plugin, and download the
   plugin. Keep the zip as it is - do not unpack it.
2. In WordPress, go to Plugins, Add New Plugin, Upload Plugin. Choose the zip,
   install it and activate it. WordPress brings you to the RepGet screen.
3. Press "Connect to RepGet". Sign in to RepGet if it asks, check the website
   it shows and confirm. You come straight back to WordPress, connected.

Or start in RepGet: Integrations → WordPress plugin → Connect WordPress. It
opens this WordPress screen; press "Finish connecting to RepGet".

RepGet appears in your WordPress menu, below Settings.

You should see "Connected to" your RepGet account and your site's domain. If
that is not the account you expected, press "Connect to a different RepGet
account".

There is no key to copy: RepGet and your site exchange it directly, and it is
never shown. Sites that were connected with a key keep working; the key field
is still there, under "Advanced: use an Integration Key".

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

= How do I stop publishing to this site, or move it to another account? =

Press "Disconnect" on the RepGet screen in WordPress. RepGet is told, and the
site forgets its connection. To move the site, press "Connect to a different
RepGet account" instead: the old account keeps publishing until the new
connection is confirmed.

= What happens if I lose the key? =

With "Connect to RepGet" there is no key to lose - just press it again. A key
made by hand can be revoked in RepGet and replaced. Keys are stored scrambled,
so nobody — including us — can look yours up after it is created.

= How is the plugin updated? =

From 1.7.0, WordPress offers new versions of this plugin on its Updates
screen, like any other plugin. Each download is checked against the SHA-256
fingerprint RepGet publishes, and refused if it does not match.

= Does this send my site's data to RepGet? =

It reports your site address, WordPress version and plugin version, so support
can help when something goes wrong, and the address of your site's admin-ajax.php
so RepGet can ask the plugin to check for articles when you press Publish.
When you press Connect to RepGet it also sends the address of this RepGet
screen, so RepGet can bring you back to it. Nothing else is sent. The plugin
only fetches articles and reports whether each one published.

== Changelog ==

= 1.7.1 =
* The plugin now talks to RepGet at www.repget.com, RepGet's own address,
  instead of the older technical address it used before. "Connect to RepGet"
  opens RepGet where you are already signed in.

= 1.7.0 =
* Connect to RepGet: one button connects this site to your RepGet account.
  There is no key to copy - RepGet and your site exchange it directly, once,
  and it is never shown or put in a web address.
* The RepGet screen says which RepGet account and website this site is
  connected to, checked with RepGet when you open it.
* New buttons: Connect to a different RepGet account, and Disconnect.
* Starting from RepGet's "Connect WordPress" now takes one press in WordPress:
  "Finish connecting to RepGet".
* Changing "Publish articles as" no longer holds back articles that were about
  to publish. It used to fetch them and then drop them, leaving them waiting
  ten minutes.
* WordPress now offers updates to this plugin itself, and installs one only if
  it matches the fingerprint RepGet publishes.
* The Integration Key field moved under "Advanced: use an Integration Key",
  and no longer shows the saved key.

= 1.6.0 =
* Each report to RepGet now names the exact delivery it answers. When a
  check was slow and RepGet had meanwhile sent a newer version of the same
  article, an older report could be taken for the newer one; it no longer can.
* Reports waiting to be retried are kept per delivery, so a report for an
  older version and one for a newer version of the same article are both
  delivered (1.5.x kept only the last). Reports parked by 1.5.x are still sent.
* RepGet is told the status WordPress actually stored - for example a post you
  keep as a draft, or a post your site saved as pending - rather than the
  status it asked for, so RepGet no longer counts such a post as live.
* The plugin tells RepGet its version with each request.

= 1.5.2 =
* A check interrupted at the exact moment a post is created no longer causes a
  duplicate: every RepGet post now carries its article's identity in the post
  itself, so a post whose details were not fully saved is still recognised and
  repaired on the next check.
* Only one check runs at a time, reliably. The previous lock could, rarely, be
  taken by two checks arriving at the same instant.
* A check that stalls for longer than five minutes stops before writing any
  further post once another check has taken over, and can no longer release
  the other check's lock.
* A check that creates several posts within the same second no longer stops
  after the first one, and a database error while confirming the lock stops
  the check safely instead of being mistaken for another check taking over.

= 1.5.1 =
* Never creates a duplicate post. An article is identified by its RepGet id, so
  a repeated check, a report that did not reach RepGet, or a check interrupted
  half way through now updates the post it already made instead of adding a
  second one competing with it.
* Reports that fail to reach RepGet are retried on the next check, separately
  from publishing, so a network problem no longer costs you a duplicate.
* Only one check runs at a time, whether it was started by RepGet, by the
  hourly schedule, or by the button on this screen. Previously the three could
  overlap.
* A check interrupted by a fatal error or a timeout no longer blocks later
  checks: an abandoned lock is reclaimed automatically.
* Republishing an edited article keeps the status and content type you chose -
  an article you moved back to draft stays a draft.

= 1.5.0 =
* Choose which content type articles are published as - for themes that show
  ordinary Posts as portfolio or project pages rather than as articles.
  Changing it moves the articles RepGet already created, and RepGet is told
  their new addresses.

= 1.4.0 =
* Publish in RepGet now publishes straight away: RepGet asks the plugin to
  check immediately instead of waiting for the hourly check. The request is
  signed with your integration key and can only trigger that check.

= 1.3.2 =
* Articles are created as posts or drafts according to RepGet's "Publish as"
  setting, instead of always being published live.
* RepGet now only sends articles that are due: auto-publish on and the planned
  date reached, or Publish pressed in RepGet.
* The settings screen says where to find the key in the current RepGet menus.

= 1.3.1 =
* The key from a RepGet link is read from the part of the address after #,
  which is never sent to a server, so it no longer appears in access logs.

= 1.3.0 =
* The key can arrive from a RepGet link, so it never has to be copied by hand.

= 1.2.0 =
* RepGet now has its own menu item instead of hiding under Settings.
* Activating the plugin opens its settings screen.
* A reminder banner while no key is set, and a Settings link on the plugins list.

= 1.0.0 =
* First release: connect with an Integration Key, hourly sync, featured images.
