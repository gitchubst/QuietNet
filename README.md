# QuietNet

QuietNet is a Manifest V3 Chrome extension for calm browsing: ad and tracker blocking, cosmetic cleanup, Popup Freeze, Clean Links, Clean Copy, Element Zapper, per-site profiles, Support List, Breakage Guard, blocked-item inspection, and a Daily Calm dashboard.

## Load Unpacked

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `QuietNet`.
5. Pin QuietNet from the Chrome extensions button, then click it to open the popup.

## Main Controls

- **Protection ON/OFF** toggles network rules and page cleanup.
- **Block Promotions** hides promotional banners, sponsored offer blocks, and small floating video popups while avoiding main page videos.
- **Google sponsored cleanup** removes sponsored result blocks from Google Search, including the top sponsored result area.
- **YouTube ad cleanup** blocks known YouTube ad calls, skips player ads when YouTube marks the player as showing an ad, and removes companion ad panels without touching normal videos.
- **Article recommendation cleanup** hides bulky recommended-video/article rails on news story pages, while leaving general section and homepage layouts alone.
- **Ad whitespace cleanup** removes empty ad shells after blocking, including YouTube in-feed ad placeholders, so pages reflow instead of leaving clickable blank cards.
- **Zapper** lets you remove an element once or save a site-specific cosmetic rule.
- **Zapper frame slider** lets you expand the highlighted frame to parent containers before saving a rule.
- **Remove for Similar Sites** lets a saved Zapper rule apply across matching base-domain sites.
- **Quiet Mode** cycles Normal, Quiet, and Ultra Quiet cleanup.
- **Clean Links** removes tracking parameters from the current page URL and links.
- **Pause Site** can pause filtering for 10 minutes, 1 hour, or until browser restart.
- **Open dashboard** shows reports, filter categories, custom rules, site profiles, privacy controls, import/export, and saved Zapper rules.

QuietNet stores settings and stats locally in Chrome extension storage.
Automatic cleanup runs silently during normal browsing. QuietNet only shows in-page messages when you intentionally use an interactive feature like Zapper, Clean Links, or Scrub Leftovers.

QuietNet is open source: https://github.com/gitchubst/QuietNet
