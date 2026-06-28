(function quietNetPopupFreezer(global) {
  const QNC = global.QuietNetContent;
  let freezeObserver = null;
  let freezeTimer = 0;

  const overlayWords = /newsletter|subscribe|sign up|signup|coupon|discount|spin|win|offer|notification|enable notifications|allow notifications|limited time|before you go|wait!|exclusive|join/i;
  const systemBaitWords = /your download is ready|download now|start now|play now|install|update required|system alert|scan now|continue|next page/i;

  function shouldFreeze() {
    const settings = QNC.settings();
    return QNC.isEnabled() && settings.popupFreeze !== false;
  }

  function isGoogleSearchSurface() {
    try {
      const url = new URL(global.location.href);
      const host = url.hostname.replace(/^www\./, "");
      const isGoogle = host === "google.com" || host.endsWith(".google.com") || /^google\.[a-z.]+$/.test(host);
      if (!isGoogle) return false;
      return url.pathname === "/search" || url.pathname === "/imgres" || url.searchParams.get("tbm") === "isch" || url.searchParams.get("udm") === "2";
    } catch (error) {
      return false;
    }
  }

  function isOverlayCandidate(element) {
    if (!element || !QNC.visible(element) || QNC.isCoreLayout(element)) return false;
    if (isGoogleSearchSurface()) return false;
    if (element.closest("[role='dialog'][aria-label], [role='dialog'][data-ved], [jsaction*='mouseover']")) return false;
    const style = getComputedStyle(element);
    if (style.position !== "fixed" && style.position !== "sticky") return false;
    const rect = element.getBoundingClientRect();
    const area = rect.width * rect.height;
    const viewportArea = Math.max(1, global.innerWidth * global.innerHeight);
    const centered = rect.width > 260 && rect.height > 120 && area > viewportArea * 0.08 && area < viewportArea * 0.7;
    const edgeInterrupt = rect.width > global.innerWidth * 0.48 && rect.height > 70 && (rect.bottom > global.innerHeight - 8 || rect.top < 8);
    const zIndex = Number.parseInt(style.zIndex, 10) || 0;
    const text = QNC.textOf(element);
    return (centered || edgeInterrupt || zIndex >= 1000) && overlayWords.test(text);
  }

  function freezePopups(root = document) {
    if (!shouldFreeze() || isGoogleSearchSurface()) return 0;
    let count = 0;
    QNC.safeSelectorAll("body *", root).forEach((element) => {
      if (isOverlayCandidate(element) && QNC.hideElement(element, "popup-frozen")) {
        count += 1;
      }
    });
    if (count) {
      QNC.reportMetric({ popups: count });
    }
    return count;
  }

  function shieldFakeButtons(root = document) {
    const settings = QNC.settings();
    if (!QNC.isEnabled() || settings.fakeButtonShield === false || isGoogleSearchSurface()) return 0;
    let count = 0;
    QNC.safeSelectorAll("a, button, [role='button']", root).forEach((button) => {
      if (!QNC.visible(button) || QNC.isCoreLayout(button)) return;
      const text = QNC.textOf(button);
      const href = button.href || button.getAttribute("data-href") || "";
      const rect = button.getBoundingClientRect();
      const parentText = QNC.textOf(button.closest("[class], [id], section, aside, div") || button);
      const looksSuspicious = systemBaitWords.test(text) && (/ad|sponsor|promo|download|offer|banner/i.test(parentText) || /ad|clk|aff|track|offer|download/i.test(href));
      const giantFake = systemBaitWords.test(text) && rect.width > 180 && rect.height > 48 && /linear-gradient|rgb\(.*255/.test(getComputedStyle(button).backgroundImage + getComputedStyle(button).backgroundColor);
      if ((looksSuspicious || giantFake) && QNC.hideElement(button, "fake-button")) {
        count += 1;
      }
    });
    if (count) {
      QNC.reportMetric({ fakeButtons: count });
    }
    return count;
  }

  function scheduleFreeze() {
    clearTimeout(freezeTimer);
    freezeTimer = setTimeout(() => {
      freezePopups(document);
      shieldFakeButtons(document);
    }, 360);
  }

  function observe() {
    if (freezeObserver || !document.documentElement) return;
    freezeObserver = new MutationObserver((mutations) => {
      if (!mutations.some((mutation) => mutation.addedNodes && mutation.addedNodes.length)) return;
      scheduleFreeze();
    });
    freezeObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  QNC.onConfig(() => scheduleFreeze());

  QNC.ready(() => {
    scheduleFreeze();
    observe();
  });

  global.QuietNetPopupFreezer = {
    freezePopups,
    shieldFakeButtons
  };
})(globalThis);
