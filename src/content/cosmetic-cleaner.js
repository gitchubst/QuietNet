(function quietNetCosmeticCleaner(global) {
  const QN = global.QuietNet;
  const QNC = global.QuietNetContent;
  const MESSAGE = QN.constants.MESSAGE;
  let observer = null;
  let scanTimer = 0;
  let lastScrubCount = 0;

  const strongAdSelectors = [
    "[id^='ad-']",
    "[id^='ad_']",
    "[id$='-ad']",
    "[id$='_ad']",
    "[id*='-ad-']",
    "[id*='_ad_']",
    "[class~='ad']",
    "[class*=' ad-']",
    "[class*=' ad_']",
    "[class*='-ad ']",
    "[class*='_ad ']",
    "[class*='advertisement']",
    "[class*='ad-container']",
    "[class*='ad-wrapper']",
    "[class*='ad-slot']",
    "[class*='adunit']",
    "[class*='dfp']",
    "[class*='gpt-ad']",
    "[data-ad]",
    "[data-ad-unit]",
    "[data-google-query-id]",
    "iframe[src*='doubleclick.net']",
    "iframe[src*='googlesyndication.com']",
    "iframe[src*='adservice.google.com']",
    "iframe[src*='amazon-adsystem.com']",
    "iframe[src*='taboola.com']",
    "iframe[src*='outbrain.com']"
  ];

  const sponsoredSelectors = [
    "[class*='sponsored']",
    "[id*='sponsored']",
    "[data-testid*='sponsored']",
    "[aria-label*='Sponsored']",
    "[class*='promoted']",
    "[class*='native-ad']",
    "[class*='recommendation-widget']",
    "[class*='related-products'][data-ad]",
    "[class*='around-the-web']",
    "[class*='taboola']",
    "[class*='outbrain']"
  ];

  const annoyanceSelectors = [
    "[class*='newsletter']",
    "[id*='newsletter']",
    "[class*='subscribe-modal']",
    "[class*='signup-modal']",
    "[class*='email-capture']",
    "[class*='cookie-banner']",
    "[id*='cookie-banner']",
    "[class*='cookie-consent']",
    "[id*='cookie-consent']",
    "[class*='social-share']",
    "[class*='share-bar']",
    "[class*='sticky-share']",
    "[class*='continue-reading']",
    "[class*='paywall-overlay']"
  ];

  const promotionSelectors = [
    "[class*='promo']",
    "[id*='promo']",
    "[class*='promotion']",
    "[id*='promotion']",
    "[class*='advertorial']",
    "[class*='marketing']",
    "[class*='paid-content']",
    "[class*='newsletter-signup']",
    "[class*='newsletter-sign-up']",
    "[class*='newsletterPromo']",
    "[class*='newsletter-promo']",
    "[class*='morning-briefing']",
    "[class*='daily-briefing']",
    "[data-testid*='promo']",
    "[data-testid*='newsletter']",
    "[aria-label*='promotion' i]",
    "[aria-label*='advertisement' i]"
  ];

  const recommendationSelectors = [
    "[class*='recommended']",
    "[id*='recommended']",
    "[class*='recommendation']",
    "[class*='recirc']",
    "[id*='recirc']",
    "[class*='related-content']",
    "[class*='related-stories']",
    "[class*='related-articles']",
    "[class*='related-videos']",
    "[class*='more-stories']",
    "[class*='more-from']",
    "[class*='read-next']",
    "[class*='watch-next']",
    "[class*='up-next']",
    "[data-testid*='recommended']",
    "[data-testid*='recirc']",
    "[data-testid*='related']"
  ];

  const newsletterPromoTextPattern = /fox news first|get all the stories you need-to-know|delivered first thing every morning|morning headlines|arrives weekdays|to your inbox|newsletter signup|newsletter sign up|subscribe to (our|the).*newsletter|sign up for (our|the).*newsletter|daily newsletter|morning briefing|evening briefing|receive.*promotional communications/i;
  const promotionTextPattern = /watch\s+\d*\s*(days?|months?)?\s*free|watch.*free|stream now|free trial|subscribe now|limited offer|special offer|shop now|sign up.*free|start watching|presented by|sponsored by|paid for by|download our app|install now|morning headlines|daily briefing|newsletter/i;
  const recommendationTextPattern = /\brecommended\s+(videos?|articles?|stories?)\b|\brelated\s+(videos?|articles?|stories?)\b|\bmore\s+(stories|from|to watch)\b|\bread next\b|\bwatch next\b|\bup next\b|\baround the web\b|\byou may also like\b|\btrending now\b/i;
  const floatingVideoTextPattern = /\b(up next|watch next|now playing|recommended video|related video|more videos|continue watching|video player|sponsored video|advertisement)\b/i;
  const googleSponsoredTextPattern = /^sponsored( result| results)?$/i;
  const youtubeAdSelectors = [
    "ytd-ad-slot-renderer",
    "ytd-display-ad-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "ytd-promoted-sparkles-web-renderer",
    "ytd-promoted-video-renderer",
    "ytd-compact-promoted-video-renderer",
    "ytd-player-legacy-desktop-watch-ads-renderer",
    "ytd-statement-banner-renderer",
    "#masthead-ad",
    "#player-ads"
  ];
  const googleSponsoredSelectors = [
    "#tads",
    "#tadsb",
    "#bottomads",
    "[data-text-ad]",
    "[data-pcu]",
    "[aria-label='Ads']",
    "[aria-label='Sponsored result']",
    "[aria-label='Sponsored results']",
    "div[role='region'][aria-label*='Ads' i]"
  ];
  const floatingVideoSelectors = [
    "video",
    "iframe[src*='player']",
    "iframe[src*='video']",
    "iframe[src*='youtube']",
    "iframe[src*='vimeo']",
    "iframe[src*='jwplayer']",
    "iframe[src*='aniview']",
    "[class*='mini-player']",
    "[id*='mini-player']",
    "[class*='floating'][class*='video']",
    "[id*='floating'][id*='video']",
    "[class*='sticky'][class*='video']",
    "[id*='sticky'][id*='video']",
    "[class*='up-next']",
    "[id*='up-next']",
    "[class*='dock'][class*='video']",
    "[id*='dock'][id*='video']"
  ];

  function shouldClean() {
    const settings = QNC.settings();
    return QNC.isEnabled() && settings.cosmeticCleanup !== false;
  }

  function shouldBlockPromotions() {
    const settings = QNC.settings();
    return QNC.isEnabled() && settings.blockPromotions !== false;
  }

  function isYouTubePage() {
    const domain = QNC.domain();
    return domain === "youtube.com" || domain.endsWith(".youtube.com") || domain === "youtu.be";
  }

  function isGoogleSearchPage() {
    const domain = QNC.domain();
    if (!(domain === "google.com" || domain.endsWith(".google.com") || /^google\.[a-z.]+$/.test(domain))) return false;
    return global.location.pathname === "/search";
  }

  function isSafeCandidate(element) {
    if (!element || !QNC.visible(element) || QNC.isCoreLayout(element)) return false;
    const rect = element.getBoundingClientRect();
    const viewportArea = Math.max(1, global.innerWidth * global.innerHeight);
    const area = rect.width * rect.height;
    if (area > viewportArea * 0.45) return false;
    if (rect.width >= global.innerWidth * 0.96 && rect.height >= global.innerHeight * 0.36) return false;
    return true;
  }

  function isLikelyArticlePage() {
    const h1 = document.querySelector("h1");
    const paragraphCount = QNC.safeSelectorAll("article p, main p").filter((paragraph) => QNC.textOf(paragraph).length > 80).length;
    const articleElement = document.querySelector("article");
    const ogType = document.querySelector("meta[property='og:type'], meta[name='og:type']");
    const ogValue = ogType ? String(ogType.getAttribute("content") || "").toLowerCase() : "";
    const schemaText = QNC.safeSelectorAll("script[type='application/ld+json']")
      .slice(0, 6)
      .map((script) => script.textContent || "")
      .join(" ");
    const path = global.location.pathname || "";
    if (/article|newsarticle|story/.test(ogValue)) return true;
    if (/NewsArticle|Article|ReportageNewsArticle/.test(schemaText) && paragraphCount >= 2) return true;
    if (articleElement && h1 && paragraphCount >= 2) return true;
    return Boolean(h1 && paragraphCount >= 3 && /\/(article|story|news|sports|politics|world|business|entertainment|tech|health|opinion)\//i.test(path));
  }

  function hideMatchedElements(selectors, reason, root = document) {
    let count = 0;
    selectors.forEach((selector) => {
      QNC.safeSelectorAll(selector, root).forEach((element) => {
        if (isSafeCandidate(element) && QNC.hideElement(element, reason)) count += 1;
      });
    });
    return count;
  }

  function hasVisibleUsefulContent(element) {
    if (!element) return false;
    const text = QNC.textOf(element).replace(/advertisement|sponsored|promoted|ad choices/gi, "").trim();
    if (text.length > 18) return true;
    const media = Array.from(element.querySelectorAll("img, picture, video, canvas, svg, iframe")).slice(0, 8);
    return media.some((node) => {
      if (node.dataset && node.dataset.quietnetHidden === "true") return false;
      if (!QNC.visible(node)) return false;
      if (node.tagName === "IMG") {
        const src = node.currentSrc || node.src || "";
        return Boolean(src && !/doubleclick|googlesyndication|adservice|adserver|\/ads?\//i.test(src));
      }
      return true;
    });
  }

  function removeYouTubeAdPlaceholders(root = document) {
    if (!shouldClean() || !isYouTubePage()) return 0;
    let count = 0;
    const containers = new Set();
    youtubeAdSelectors.forEach((selector) => {
      QNC.safeSelectorAll(selector, root).forEach((node) => {
        const container =
          node.closest("ytd-rich-item-renderer, ytd-rich-section-renderer, ytd-shelf-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-item-section-renderer") || node;
        containers.add(container);
      });
    });

    QNC.safeSelectorAll("ytd-rich-item-renderer, ytd-rich-section-renderer, ytd-shelf-renderer", root).forEach((card) => {
      const hasAdChild = youtubeAdSelectors.some((selector) => card.querySelector(selector));
      const title = QNC.textOf(card.querySelector("#video-title, h3, yt-formatted-string"));
      const thumbnail = card.querySelector("ytd-thumbnail img[src], img[src]");
      const rect = card.getBoundingClientRect();
      const blankAdShell = rect.width > 220 && rect.height > 120 && !title && !thumbnail && /ad|promo|sparkles|masthead/i.test(card.innerHTML.slice(0, 1800));
      if (hasAdChild || blankAdShell) containers.add(card);
    });

    containers.forEach((container) => {
      if (container && !QNC.isCoreLayout(container) && QNC.hideElement(container, "youtube-ad-placeholder")) count += 1;
    });
    return count;
  }

  function findPromotionContainer(element) {
    let current = element;
    let best = element;
    const viewportArea = Math.max(1, global.innerWidth * global.innerHeight);
    for (let depth = 0; depth < 5 && current && current.parentElement && !QNC.isCoreLayout(current.parentElement); depth += 1) {
      const parent = current.parentElement;
      const rect = parent.getBoundingClientRect();
      const area = rect.width * rect.height;
      const text = QNC.textOf(parent);
      const hasMedia = Boolean(parent.querySelector("img, picture, iframe, video, svg"));
      const usefulSize = rect.width > 180 && rect.height > 60 && area < viewportArea * 0.42;
      if (usefulSize && (promotionTextPattern.test(text) || newsletterPromoTextPattern.test(text) || hasMedia)) {
        best = parent;
        current = parent;
      } else {
        break;
      }
    }
    return best;
  }

  function blockPromotions(root = document) {
    if (!shouldBlockPromotions()) return 0;
    let count = hideMatchedElements(promotionSelectors, "promotion", root);
    QNC.safeSelectorAll("aside, section, form, div, figure", root).forEach((element) => {
      if (!QNC.visible(element) || QNC.isCoreLayout(element)) return;
      const rect = element.getBoundingClientRect();
      if (rect.width < 180 || rect.height < 48) return;
      const text = QNC.textOf(element);
      const href = QNC.safeSelectorAll("a[href]", element)
        .slice(0, 5)
        .map((anchor) => anchor.href || "")
        .join(" ");
      const mediaHint = Array.from(element.querySelectorAll("img, source, iframe"))
        .map((node) => `${node.currentSrc || node.src || ""} ${node.alt || ""} ${node.title || ""}`)
        .join(" ");
      if (promotionTextPattern.test(`${text} ${href} ${mediaHint}`) || newsletterPromoTextPattern.test(text)) {
        const target = findPromotionContainer(element);
        if (target && isSafeCandidate(target) && QNC.hideElement(target, "promotion")) count += 1;
      }
    });
    return count;
  }

  function findRecommendationContainer(element) {
    let current = element;
    let best = null;
    const viewportArea = Math.max(1, global.innerWidth * global.innerHeight);
    for (let depth = 0; depth < 5 && current && current.parentElement && !QNC.isCoreLayout(current.parentElement); depth += 1) {
      const parent = current.parentElement;
      const rect = parent.getBoundingClientRect();
      const area = rect.width * rect.height;
      const text = QNC.textOf(parent);
      const linkCount = parent.querySelectorAll("a[href]").length;
      const mediaCount = parent.querySelectorAll("img, picture, video, iframe").length;
      const usefulSize = rect.width > 260 && rect.height > 80 && area < viewportArea * 0.55;
      if (usefulSize && recommendationTextPattern.test(text) && (linkCount >= 2 || mediaCount >= 2 || rect.width > global.innerWidth * 0.6)) {
        best = parent;
        current = parent;
      } else if (best) {
        break;
      } else {
        current = parent;
      }
    }
    return best || element;
  }

  function findRecommendationLabels(root = document) {
    const labels = [];
    const walker = document.createTreeWalker(root.body || root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node && labels.length < 80) {
      if (QNC.visible(node)) {
        const text = QNC.textOf(node);
        if (/^(recommended|related)\s+(videos?|articles?|stories?)$|^(read|watch)\s+next$|^up next$/i.test(text)) {
          labels.push(node);
        }
      }
      node = walker.nextNode();
    }
    return labels;
  }

  function blockArticleRecommendations(root = document) {
    if (!shouldBlockPromotions() || !isLikelyArticlePage()) return 0;
    let count = 0;
    const candidates = new Set();
    recommendationSelectors.forEach((selector) => {
      QNC.safeSelectorAll(selector, root).forEach((element) => candidates.add(element));
    });
    findRecommendationLabels(root).forEach((element) => candidates.add(element));

    candidates.forEach((element) => {
      if (!QNC.visible(element) || QNC.isCoreLayout(element)) return;
      const target = findRecommendationContainer(element);
      if (!target || !QNC.visible(target) || QNC.isCoreLayout(target)) return;
      const text = QNC.textOf(target);
      const linkCount = target.querySelectorAll("a[href]").length;
      const mediaCount = target.querySelectorAll("img, picture, video, iframe").length;
      if (recommendationTextPattern.test(text) && (linkCount >= 2 || mediaCount >= 2) && isSafeCandidate(target) && QNC.hideElement(target, "article-recommendations")) {
        count += 1;
      }
    });
    return count;
  }

  function findLabelBasedAds(root = document) {
    const labels = [];
    const walker = document.createTreeWalker(root.body || root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node && labels.length < 120) {
      if (QNC.visible(node)) {
        const text = QNC.textOf(node).toLowerCase();
        if (/^(advertisement|advertising|sponsored|promoted|paid post|ad choices|recommended by)$/i.test(text)) {
          labels.push(node);
        }
      }
      node = walker.nextNode();
    }
    return labels;
  }

  function cleanSponsoredWidgets(root = document) {
    let count = hideMatchedElements(sponsoredSelectors, "sponsored-widget", root);
    findLabelBasedAds(root).forEach((label) => {
      const target = findBestContainer(label);
      if (target && isSafeCandidate(target) && QNC.hideElement(target, "sponsored-label")) count += 1;
    });
    return count;
  }

  function findGoogleSponsoredContainer(label) {
    let current = label;
    let best = null;
    const viewportArea = Math.max(1, global.innerWidth * global.innerHeight);
    for (let depth = 0; depth < 8 && current && current.parentElement && !QNC.isCoreLayout(current.parentElement); depth += 1) {
      const parent = current.parentElement;
      const rect = parent.getBoundingClientRect();
      const text = QNC.textOf(parent);
      const area = rect.width * rect.height;
      const hasAdLink = Boolean(parent.querySelector("a[href*='adurl'], a[data-pcu], a[href*='googleadservices'], a[href]"));
      const hasSponsoredLabel = googleSponsoredTextPattern.test(QNC.textOf(parent.firstElementChild || parent)) || /\bsponsored( result| results)?\b/i.test(text.slice(0, 180));
      const looksLikeResultBlock = rect.width > 260 && rect.height > 70 && area < viewportArea * 0.38;
      if (hasSponsoredLabel && hasAdLink && looksLikeResultBlock) best = parent;
      if (/people also ask|related searches|searches related to|organic results/i.test(text) && !hasSponsoredLabel) break;
      current = parent;
    }
    return best || label.closest("#tads, #tadsb, #bottomads, [data-text-ad], [data-pcu]");
  }

  function removeGoogleSponsoredResults(root = document) {
    if (!shouldClean() || !isGoogleSearchPage()) return 0;
    let count = 0;
    googleSponsoredSelectors.forEach((selector) => {
      QNC.safeSelectorAll(selector, root).forEach((element) => {
        if (!element || QNC.isCoreLayout(element)) return;
        const text = QNC.textOf(element);
        const isKnownAdContainer = /sponsored|adurl|googleadservices|hide sponsored result/i.test(`${text} ${element.innerHTML.slice(0, 1200)}`);
        if (isKnownAdContainer && QNC.hideElement(element, "google-sponsored-result")) count += 1;
      });
    });

    const walker = document.createTreeWalker(root.body || root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node && count < 40) {
      if (QNC.visible(node) && googleSponsoredTextPattern.test(QNC.textOf(node))) {
        const target = findGoogleSponsoredContainer(node);
        if (target && !QNC.isCoreLayout(target) && QNC.hideElement(target, "google-sponsored-result")) count += 1;
      }
      node = walker.nextNode();
    }

    QNC.safeSelectorAll("button, [role='button']", root).forEach((button) => {
      if (/hide sponsored result/i.test(QNC.textOf(button))) {
        const target = findGoogleSponsoredContainer(button) || button;
        if (target && !QNC.isCoreLayout(target) && QNC.hideElement(target, "google-sponsored-control")) count += 1;
      }
    });
    return count;
  }

  function findBestContainer(element) {
    let current = element;
    for (let depth = 0; depth < 4 && current && current.parentElement; depth += 1) {
      const parent = current.parentElement;
      const rect = parent.getBoundingClientRect();
      const text = QNC.textOf(parent).toLowerCase();
      if (rect.height > 24 && rect.height < Math.max(480, global.innerHeight * 0.7) && /advertisement|sponsored|promoted|ad choices|recommended by/.test(text)) {
        current = parent;
      } else {
        break;
      }
    }
    return current;
  }

  function collapseEmptyAdSlots(root = document) {
    let count = 0;
    const selectors = [
      "iframe",
      "[class*='ad-slot']",
      "[class*='ad-container']",
      "[class*='ad-wrapper']",
      "[class*='advertisement']",
      "[data-ad]",
      "[data-google-query-id]"
    ];
    selectors.forEach((selector) => {
      QNC.safeSelectorAll(selector, root).forEach((element) => {
        if (!isSafeCandidate(element)) return;
        const rect = element.getBoundingClientRect();
        const text = QNC.textOf(element);
        const empty = !text && !hasVisibleUsefulContent(element) && rect.height > 20;
        const allChildrenHidden = element.children.length > 0 && Array.from(element.children).every((child) => child.dataset.quietnetHidden === "true" || !QNC.visible(child));
        const blankFrame = element.tagName === "IFRAME" && (!element.getAttribute("src") || element.clientHeight > 40);
        if ((empty || blankFrame) && QNC.hideElement(element, "empty-ad-slot")) count += 1;
        if (allChildrenHidden && rect.height > 24 && QNC.hideElement(element, "empty-ad-wrapper")) count += 1;
      });
    });
    return count;
  }

  function collapseResidualAdWhitespace(root = document) {
    let count = 0;
    const selectors = [
      "[class*='ad-container']",
      "[class*='ad-wrapper']",
      "[class*='ad-slot']",
      "[class*='advertisement']",
      "[class*='sponsor']",
      "[id*='ad-container']",
      "[id*='ad-wrapper']",
      "[id*='ad-slot']",
      "[data-ad]",
      "[data-ad-unit]"
    ];
    selectors.forEach((selector) => {
      QNC.safeSelectorAll(selector, root).forEach((element) => {
        if (!element || QNC.isCoreLayout(element) || element.dataset.quietnetHidden === "true") return;
        const rect = element.getBoundingClientRect();
        if (rect.width < 120 || rect.height < 24) return;
        const text = QNC.textOf(element).replace(/advertisement|sponsored|promoted|ad choices/gi, "").trim();
        const hasUseful = hasVisibleUsefulContent(element);
        const onlyHiddenChildren = element.children.length > 0 && Array.from(element.children).every((child) => child.dataset.quietnetHidden === "true" || !QNC.visible(child));
        if ((!text && !hasUseful) || onlyHiddenChildren) {
          const parent = element.parentElement;
          if (QNC.hideElement(element, "ad-whitespace")) count += 1;
          if (parent && !QNC.isCoreLayout(parent)) {
            const parentRect = parent.getBoundingClientRect();
            const parentText = QNC.textOf(parent).replace(/advertisement|sponsored|promoted|ad choices/gi, "").trim();
            if (parentRect.height > 24 && parentRect.height < Math.max(420, global.innerHeight * 0.45) && !parentText && !hasVisibleUsefulContent(parent)) {
              if (QNC.hideElement(parent, "ad-whitespace-parent")) count += 1;
            }
          }
        }
      });
    });
    return count;
  }

  function collapseWrappersAroundHiddenAds(root = document) {
    let count = 0;
    QNC.safeSelectorAll("[data-quietnet-hidden='true']", root).forEach((hidden) => {
      const reason = `${hidden.dataset.quietnetReason || ""} ${hidden.id || ""} ${hidden.className || ""}`;
      if (!/ad|sponsor|promo|banner|slot|video|google/i.test(reason)) return;
      let current = hidden.parentElement;
      for (let depth = 0; depth < 4 && current && !QNC.isCoreLayout(current); depth += 1) {
        if (!QNC.visible(current)) {
          current = current.parentElement;
          continue;
        }
        const rect = current.getBoundingClientRect();
        if (rect.width < 80 || rect.height < 18 || rect.height > Math.max(680, global.innerHeight * 0.58)) break;
        const cleanedText = QNC.textOf(current).replace(/advertisement|advertising|sponsored|promoted|ad choices|hide sponsored result/gi, "").trim();
        const onlyHiddenChildren = current.children.length > 0 && Array.from(current.children).every((child) => child.dataset.quietnetHidden === "true" || !QNC.visible(child));
        if ((!cleanedText && !hasVisibleUsefulContent(current)) || onlyHiddenChildren) {
          const next = current.parentElement;
          if (QNC.hideElement(current, "ad-space-wrapper")) count += 1;
          current = next;
        } else {
          break;
        }
      }
    });
    return count;
  }

  function removeStickyAdBars(root = document) {
    let count = 0;
    QNC.safeSelectorAll("body *", root).forEach((element) => {
      if (!QNC.visible(element) || QNC.isCoreLayout(element)) return;
      const style = getComputedStyle(element);
      if (style.position !== "fixed" && style.position !== "sticky") return;
      const rect = element.getBoundingClientRect();
      const text = QNC.textOf(element).toLowerCase();
      const zIndex = Number.parseInt(style.zIndex, 10) || 0;
      const bottomBar = rect.width > global.innerWidth * 0.45 && rect.height > 32 && rect.bottom > global.innerHeight - 4;
      const topBar = rect.width > global.innerWidth * 0.55 && rect.height > 32 && rect.top < 8;
      const adLike = /advertisement|sponsored|promoted|cookie|subscribe|newsletter|sign up|coupon|deal|share/.test(text) || /ad|banner|sticky|cookie|newsletter|share/i.test(element.className || "");
      if ((bottomBar || topBar || zIndex > 999) && adLike && isSafeCandidate(element) && QNC.hideElement(element, "sticky-bar")) {
        count += 1;
      }
    });
    return count;
  }

  function isFloatingPromoBox(element) {
    if (!element || QNC.isCoreLayout(element) || !QNC.visible(element)) return false;
    const style = getComputedStyle(element);
    if (style.position !== "fixed" && style.position !== "sticky") return false;
    const rect = element.getBoundingClientRect();
    const viewportArea = Math.max(1, global.innerWidth * global.innerHeight);
    const area = rect.width * rect.height;
    const nearBottom = rect.bottom > global.innerHeight - 90;
    const nearEdge = rect.left < 36 || rect.right > global.innerWidth - 36;
    const cornerPlayer = nearBottom && nearEdge && rect.width >= 180 && rect.width <= Math.min(720, global.innerWidth * 0.72) && rect.height >= 90 && rect.height <= Math.min(440, global.innerHeight * 0.58);
    const bottomDock = nearBottom && rect.width > global.innerWidth * 0.45 && rect.height >= 46 && rect.height <= global.innerHeight * 0.34;
    const smallEnough = area < viewportArea * 0.28 || bottomDock;
    if (!smallEnough || (!cornerPlayer && !bottomDock)) return false;
    const text = QNC.textOf(element);
    const media = element.querySelector("video, iframe, embed, object, canvas");
    const closeButton = element.querySelector("button, [role='button'], [aria-label*='close' i], [class*='close' i], [id*='close' i]");
    const hint = `${text} ${element.id || ""} ${element.className || ""}`;
    return Boolean(media || closeButton || floatingVideoTextPattern.test(hint));
  }

  function findFloatingPromoContainer(node) {
    let current = node;
    let best = null;
    for (let depth = 0; depth < 8 && current && current.parentElement && !QNC.isCoreLayout(current); depth += 1) {
      if (isFloatingPromoBox(current)) best = current;
      current = current.parentElement;
    }
    return best;
  }

  function removeFloatingVideoPlayers(root = document) {
    if (QNC.cleanupLevel() < 2 && !shouldBlockPromotions()) return { hidden: 0, paused: 0 };
    let hidden = 0;
    let paused = 0;
    const candidates = new Set();
    floatingVideoSelectors.forEach((selector) => {
      QNC.safeSelectorAll(selector, root).forEach((node) => candidates.add(node));
    });
    candidates.forEach((node) => {
      const container = findFloatingPromoContainer(node);
      if (!container) return;
      const videos = node.tagName === "VIDEO" ? [node] : Array.from(container.querySelectorAll("video"));
      videos.forEach((video) => {
        try {
          if (!video.paused) paused += 1;
          video.pause();
        } catch (error) {
          // Some players intentionally block scripted pause; hiding still quiets the page.
        }
      });
      if (QNC.hideElement(container, "floating-video-promo")) {
        hidden += 1;
      }
    });
    QNC.safeSelectorAll("body *", root).forEach((element) => {
      if (!isFloatingPromoBox(element)) return;
      const hint = `${QNC.textOf(element)} ${element.id || ""} ${element.className || ""}`;
      if (!floatingVideoTextPattern.test(hint) && !element.querySelector("video, iframe, canvas")) return;
      if (QNC.hideElement(element, "floating-video-promo")) hidden += 1;
    });
    return { hidden, paused };
  }

  function hideAnnoyances(root = document) {
    if (QNC.cleanupLevel() < 2) return 0;
    let count = hideMatchedElements(annoyanceSelectors, "annoyance", root);
    if (QNC.cleanupLevel() >= 3) {
      QNC.safeSelectorAll("[class*='related'], [class*='recommend'], [class*='trending'], [class*='more-stories']", root).forEach((element) => {
        const text = QNC.textOf(element).toLowerCase();
        if (/recommended|related|more stories|around the web|you may like|trending/.test(text) && isSafeCandidate(element) && QNC.hideElement(element, "ultra-quiet")) {
          count += 1;
        }
      });
    }
    return count;
  }

  function scanForAdContainers(root = document) {
    if (!shouldClean()) return { count: 0 };
    let leftovers = 0;
    leftovers += hideMatchedElements(strongAdSelectors, "ad-container", root);
    leftovers += removeYouTubeAdPlaceholders(root);
    leftovers += blockPromotions(root);
    leftovers += removeGoogleSponsoredResults(root);
    leftovers += blockArticleRecommendations(root);
    leftovers += cleanSponsoredWidgets(root);
    leftovers += collapseEmptyAdSlots(root);
    leftovers += collapseResidualAdWhitespace(root);
    leftovers += collapseWrappersAroundHiddenAds(root);
    const sticky = removeStickyAdBars(root);
    leftovers += sticky;
    const video = removeFloatingVideoPlayers(root);
    leftovers += video.hidden;
    leftovers += hideAnnoyances(root);
    if (leftovers || sticky || video.hidden || video.paused) {
      QNC.reportMetric({
        leftovers,
        stickyElements: sticky,
        autoplayElements: video.paused
      });
    }
    lastScrubCount = leftovers;
    return { count: leftovers, sticky, video };
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => scanForAdContainers(document), 250);
  }

  function observePageMutations() {
    if (observer || !document.documentElement) return;
    observer = new MutationObserver((mutations) => {
      if (!shouldClean()) return;
      const interesting = mutations.some((mutation) => mutation.addedNodes && mutation.addedNodes.length);
      if (interesting) scheduleScan();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function applyUserCosmeticRules() {
    if (!QNC.isEnabled()) return 0;
    const rules = (QNC.siteConfig() && QNC.siteConfig().zappedRules) || [];
    let count = 0;
    rules.forEach((rule) => {
      QNC.safeSelectorAll(rule.selector).forEach((element) => {
        if (QNC.hideElement(element, "user-zap")) count += 1;
      });
    });
    if (count) QNC.reportMetric({ leftovers: count });
    return count;
  }

  function cleanNow(showToast = false) {
    applyUserCosmeticRules();
    const result = scanForAdContainers(document);
    if (showToast) {
      QNC.toast("Leftovers scrubbed", `Cleaned ${result.count || 0} empty ad spaces.`);
    }
    return result;
  }

  QNC.onMessage(MESSAGE.SCRUB_LEFTOVERS, async () => {
    const result = cleanNow(true);
    return { ok: true, cleaned: result.count };
  });

  QNC.onConfig(() => {
    cleanNow(false);
  });

  QNC.ready(() => {
    cleanNow(false);
    observePageMutations();
  });

  global.QuietNetCleaner = {
    applyUserCosmeticRules,
    cleanNow,
    cleanSponsoredWidgets,
    blockPromotions,
    blockArticleRecommendations,
    collapseResidualAdWhitespace,
    collapseEmptyAdSlots,
    collapseWrappersAroundHiddenAds,
    hideMatchedElements,
    observePageMutations,
    removeGoogleSponsoredResults,
    removeFloatingVideoPlayers,
    removeStickyAdBars,
    removeYouTubeAdPlaceholders,
    scanForAdContainers,
    lastScrubCount: () => lastScrubCount
  };
})(globalThis);
