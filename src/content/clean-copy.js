(function quietNetCleanCopy(global) {
  const QN = global.QuietNet;
  const QNC = global.QuietNetContent;
  const MESSAGE = QN.constants.MESSAGE;
  let linkObserver = null;
  let cleanedCurrentUrl = false;

  function preserveParamsForSite() {
    const config = QNC.siteConfig();
    const allowlist = config && config.settings && config.settings.preserveTrackingParams;
    return Array.isArray(allowlist) ? allowlist : [];
  }

  function cleanTextUrls(text) {
    const urlPattern = /https?:\/\/[^\s<>"')]+/g;
    let changed = false;
    const next = String(text || "").replace(urlPattern, (match) => {
      const result = QN.utils.cleanUrl(match, { preserve: preserveParamsForSite() });
      if (result.changed) changed = true;
      return result.url;
    });
    return { text: next, changed };
  }

  function cleanAttribution(text) {
    return String(text || "")
      .replace(/\n+\s*(read more|read the full story|source|originally published)\s+(at|on).+$/i, "")
      .replace(/\n+\s*(sent from|download our app|subscribe to our newsletter).+$/i, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function cleanCurrentUrl() {
    const settings = QNC.settings();
    if (!QNC.isEnabled() || settings.cleanLinks === false || settings.cleanAddressBar === false || cleanedCurrentUrl) return false;
    const result = QN.utils.cleanUrl(global.location.href, { preserve: preserveParamsForSite() });
    if (result.changed && result.url !== global.location.href) {
      cleanedCurrentUrl = true;
      history.replaceState(history.state, document.title, result.url);
      QNC.reportMetric({ linksCleaned: 1 });
      return true;
    }
    return false;
  }

  function cleanAnchor(anchor) {
    if (!anchor || !anchor.href || !/^https?:/i.test(anchor.href)) return false;
    const result = QN.utils.cleanUrl(anchor.href, { preserve: preserveParamsForSite() });
    if (result.changed) {
      anchor.href = result.url;
      return true;
    }
    return false;
  }

  function cleanAnchorUrls(root = document) {
    const settings = QNC.settings();
    if (!QNC.isEnabled() || settings.cleanLinks === false) return 0;
    let count = 0;
    QNC.safeSelectorAll("a[href^='http']", root).forEach((anchor) => {
      if (cleanAnchor(anchor)) count += 1;
    });
    if (count) QNC.reportMetric({ linksCleaned: count });
    return count;
  }

  function cleanCopiedUrl(text) {
    return cleanTextUrls(text);
  }

  function onCopy(event) {
    const settings = QNC.settings();
    if (!QNC.isEnabled() || settings.cleanCopiedText === false) return;
    const selection = global.getSelection ? String(global.getSelection()) : "";
    if (!selection) return;
    const urlCleaned = cleanCopiedUrl(selection);
    let nextText = urlCleaned.text;
    if (settings.cleanCopiedLinks === false) {
      nextText = selection;
    }
    if (settings.cleanCopiedText !== false) {
      nextText = cleanAttribution(nextText);
    }
    if (nextText !== selection) {
      event.preventDefault();
      event.clipboardData.setData("text/plain", nextText);
      QNC.reportMetric({ copyCleaned: 1, linksCleaned: urlCleaned.changed ? 1 : 0 });
    }
  }

  function onClick(event) {
    const settings = QNC.settings();
    if (!QNC.isEnabled() || settings.cleanLinksBeforeOpening === false) return;
    const anchor = event.target && event.target.closest ? event.target.closest("a[href^='http']") : null;
    if (!anchor) return;
    const before = anchor.href;
    if (cleanAnchor(anchor) && before !== anchor.href) QNC.reportMetric({ linksCleaned: 1 });
  }

  function observeLinks() {
    if (linkObserver || !document.documentElement) return;
    linkObserver = new MutationObserver((mutations) => {
      let count = 0;
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) count += cleanAnchorUrls(node);
        });
      });
    });
    linkObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  QNC.onMessage(MESSAGE.CLEAN_LINKS_NOW, async () => {
    const current = cleanCurrentUrl();
    const anchors = cleanAnchorUrls(document);
    QNC.toast("Clean Links finished", `${anchors + (current ? 1 : 0)} links cleaned on this page.`);
    return { ok: true, cleaned: anchors + (current ? 1 : 0) };
  });

  QNC.onConfig(() => {
    cleanCurrentUrl();
    cleanAnchorUrls(document);
  });

  QNC.ready(() => {
    cleanCurrentUrl();
    cleanAnchorUrls(document);
    document.addEventListener("click", onClick, true);
    document.addEventListener("copy", onCopy, true);
    observeLinks();
  });

  global.QuietNetCleanCopy = {
    cleanAnchorUrls,
    cleanCopiedUrl,
    cleanCurrentUrl,
    removeTrackingParams: (url) => QN.utils.cleanUrl(url, { preserve: preserveParamsForSite() })
  };
})(globalThis);
