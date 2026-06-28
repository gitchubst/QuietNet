(function quietNetContentUtils(global) {
  const QN = global.QuietNet;
  const MESSAGE = QN.constants.MESSAGE;
  const handlers = new Map();
  const configListeners = new Set();
  const metricBuffer = {};
  let siteConfig = null;
  let stylesReady = false;
  let toastRoot = null;
  let metricTimer = 0;

  function domain() {
    return QN.utils.getDomainFromUrl(global.location.href);
  }

  function ready(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  function isEnabled() {
    return Boolean(siteConfig && siteConfig.enabled && siteConfig.settings && siteConfig.settings.protectionEnabled);
  }

  function settings() {
    return (siteConfig && siteConfig.settings) || QN.constants.DEFAULT_SETTINGS;
  }

  function profile() {
    return (siteConfig && siteConfig.profile) || "balanced";
  }

  function cleanupLevel() {
    const profileKey = profile();
    const profileInfo = QN.constants.PROFILES[profileKey] || QN.constants.PROFILES.balanced;
    const quietMode = settings().quietMode || "normal";
    let level = profileInfo.cleanupLevel || 1;
    if (quietMode === "quiet") level = Math.max(level, 2);
    if (quietMode === "ultra") level = Math.max(level, 3);
    return level;
  }

  async function refreshConfig() {
    const response = await QN.utils.sendMessage({
      type: MESSAGE.GET_SITE_CONFIG,
      domain: domain()
    });
    if (response && response.ok && response.siteConfig) {
      siteConfig = response.siteConfig;
      configListeners.forEach((listener) => listener(siteConfig));
    }
    return siteConfig;
  }

  function onConfig(callback) {
    configListeners.add(callback);
    if (siteConfig) callback(siteConfig);
  }

  function ensureStyles() {
    if (stylesReady || !document.documentElement) return;
    stylesReady = true;
    const style = document.createElement("style");
    style.id = "quietnet-content-style";
    style.textContent = `
      [data-quietnet-hidden="true"] {
        display: none !important;
        visibility: hidden !important;
      }

      ytd-rich-item-renderer:has(ytd-ad-slot-renderer),
      ytd-rich-item-renderer:has(ytd-display-ad-renderer),
      ytd-rich-item-renderer:has(ytd-in-feed-ad-layout-renderer),
      ytd-rich-item-renderer:has(ytd-promoted-sparkles-web-renderer),
      ytd-rich-section-renderer:has(ytd-ad-slot-renderer),
      ytd-rich-section-renderer:has(ytd-display-ad-renderer),
      ytd-shelf-renderer:has(ytd-ad-slot-renderer),
      ytd-ad-slot-renderer,
      ytd-display-ad-renderer,
      ytd-in-feed-ad-layout-renderer,
      ytd-promoted-sparkles-web-renderer,
      ytd-promoted-video-renderer,
      ytd-compact-promoted-video-renderer,
      ytd-player-legacy-desktop-watch-ads-renderer,
      #masthead-ad,
      #player-ads {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
        min-height: 0 !important;
        height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      html.quietnet-zapper-active,
      html.quietnet-zapper-active * {
        cursor: crosshair !important;
      }

      .quietnet-toast-root {
        position: fixed !important;
        z-index: 2147483647 !important;
        right: 18px !important;
        bottom: 18px !important;
        display: grid !important;
        gap: 10px !important;
        pointer-events: none !important;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      }

      .quietnet-toast {
        min-width: 218px !important;
        max-width: 330px !important;
        padding: 12px 13px !important;
        border: 1px solid rgba(20, 184, 166, 0.26) !important;
        border-radius: 16px !important;
        color: #0f172a !important;
        background: rgba(255, 255, 255, 0.96) !important;
        box-shadow: 0 18px 50px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(204, 251, 241, 0.6) inset !important;
        backdrop-filter: blur(16px) saturate(1.2) !important;
        pointer-events: auto !important;
        animation: quietnet-slide-in 150ms ease-out !important;
      }

      .quietnet-toast-title {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        margin: 0 0 3px !important;
        font-size: 13px !important;
        font-weight: 800 !important;
        line-height: 1.2 !important;
      }

      .quietnet-toast-title::before {
        content: "" !important;
        width: 9px !important;
        height: 9px !important;
        border-radius: 99px !important;
        background: linear-gradient(135deg, #14b8a6, #38bdf8) !important;
        box-shadow: 0 0 12px rgba(20, 184, 166, 0.55) !important;
        flex: none !important;
      }

      .quietnet-toast-body {
        margin: 0 !important;
        color: #475569 !important;
        font-size: 12px !important;
        font-weight: 600 !important;
        line-height: 1.35 !important;
      }

      .quietnet-toast-actions {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 7px !important;
        margin-top: 10px !important;
      }

      .quietnet-toast-action {
        appearance: none !important;
        border: 1px solid #99f6e4 !important;
        border-radius: 999px !important;
        background: #effffa !important;
        color: #0f766e !important;
        padding: 7px 10px !important;
        font: 800 11px/1 Inter, ui-sans-serif, system-ui !important;
      }

      .quietnet-zapper-highlight {
        position: fixed !important;
        z-index: 2147483646 !important;
        border: 2px solid #14b8a6 !important;
        border-radius: 10px !important;
        pointer-events: none !important;
        box-shadow: 0 0 0 99999px rgba(8, 47, 73, 0.12), 0 8px 35px rgba(20, 184, 166, 0.28) !important;
        background: rgba(20, 184, 166, 0.08) !important;
      }

      .quietnet-zapper-dialog {
        position: fixed !important;
        z-index: 2147483647 !important;
        left: 50% !important;
        bottom: 22px !important;
        transform: translateX(-50%) !important;
        width: min(420px, calc(100vw - 28px)) !important;
        padding: 14px !important;
        border: 1px solid rgba(20, 184, 166, 0.26) !important;
        border-radius: 18px !important;
        color: #0f172a !important;
        background: rgba(255, 255, 255, 0.98) !important;
        box-shadow: 0 24px 80px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(204, 251, 241, 0.75) inset !important;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      }

      .quietnet-zapper-dialog h2 {
        margin: 0 0 7px !important;
        font-size: 15px !important;
        line-height: 1.2 !important;
      }

      .quietnet-zapper-dialog p {
        margin: 0 0 10px !important;
        color: #64748b !important;
        font-size: 12px !important;
        line-height: 1.4 !important;
      }

      .quietnet-zapper-selector {
        padding: 8px 10px !important;
        border-radius: 12px !important;
        background: #f4fffc !important;
        border: 1px solid #ccfbf1 !important;
        color: #0f766e !important;
        font: 700 11px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
        word-break: break-all !important;
      }

      .quietnet-zapper-control {
        display: grid !important;
        gap: 7px !important;
        margin-top: 10px !important;
      }

      .quietnet-zapper-control label,
      .quietnet-zapper-toggle {
        color: #0f172a !important;
        font: 800 12px/1.25 Inter, ui-sans-serif, system-ui !important;
      }

      .quietnet-zapper-control small,
      .quietnet-zapper-warning {
        color: #64748b !important;
        font: 700 11px/1.35 Inter, ui-sans-serif, system-ui !important;
      }

      .quietnet-zapper-slider {
        width: 100% !important;
        accent-color: #14b8a6 !important;
      }

      .quietnet-zapper-toggle {
        display: flex !important;
        align-items: center !important;
        gap: 9px !important;
        margin-top: 10px !important;
        padding: 9px 10px !important;
        border: 1px solid #ccfbf1 !important;
        border-radius: 13px !important;
        background: #f8fffd !important;
      }

      .quietnet-zapper-toggle input {
        width: 18px !important;
        height: 18px !important;
        accent-color: #14b8a6 !important;
      }

      .quietnet-zapper-actions {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 8px !important;
        margin-top: 12px !important;
      }

      .quietnet-zapper-actions button {
        appearance: none !important;
        border: 1px solid #99f6e4 !important;
        border-radius: 999px !important;
        background: #ffffff !important;
        color: #0f766e !important;
        padding: 10px 12px !important;
        font: 800 12px/1 Inter, ui-sans-serif, system-ui !important;
      }

      .quietnet-zapper-actions button[data-primary="true"] {
        border: 0 !important;
        color: #052e2b !important;
        background: linear-gradient(135deg, #2fffd0 0%, #38bdf8 100%) !important;
      }

      @keyframes quietnet-slide-in {
        from {
          transform: translateY(8px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    `;
    (document.head || document.documentElement).append(style);
  }

  function ensureToastRoot() {
    ensureStyles();
    if (toastRoot && document.documentElement.contains(toastRoot)) return toastRoot;
    toastRoot = document.createElement("div");
    toastRoot.className = "quietnet-toast-root";
    (document.body || document.documentElement).append(toastRoot);
    return toastRoot;
  }

  function toast(title, body, actions = []) {
    ready(() => {
      const root = ensureToastRoot();
      const node = document.createElement("div");
      node.className = "quietnet-toast";
      const actionHtml = actions.length
        ? `<div class="quietnet-toast-actions">${actions
            .map((action, index) => `<button type="button" class="quietnet-toast-action" data-action="${index}">${escapeHtml(action.label)}</button>`)
            .join("")}</div>`
        : "";
      node.innerHTML = `
        <div class="quietnet-toast-title">${escapeHtml(title)}</div>
        ${body ? `<p class="quietnet-toast-body">${escapeHtml(body)}</p>` : ""}
        ${actionHtml}
      `;
      node.querySelectorAll("[data-action]").forEach((button) => {
        button.addEventListener("click", () => {
          const action = actions[Number(button.dataset.action)];
          if (action && action.onClick) action.onClick();
          node.remove();
        });
      });
      root.append(node);
      setTimeout(() => node.remove(), actions.length ? 8500 : 3400);
    });
  }

  function escapeHtml(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function visible(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 2 && rect.height > 2;
  }

  function elementArea(element) {
    const rect = element.getBoundingClientRect();
    return Math.max(0, rect.width) * Math.max(0, rect.height);
  }

  function isCoreLayout(element) {
    if (!element || element === document.body || element === document.documentElement) return true;
    const tag = element.tagName ? element.tagName.toLowerCase() : "";
    if (["html", "body", "main", "article"].includes(tag)) return true;
    if (["header", "footer", "nav"].includes(tag) && elementArea(element) > global.innerWidth * 80) return true;
    return false;
  }

  function hideElement(element, reason = "cleanup") {
    if (!element || isCoreLayout(element) || element.dataset.quietnetHidden === "true") return false;
    element.dataset.quietnetHidden = "true";
    element.dataset.quietnetReason = reason;
    element.style.setProperty("display", "none", "important");
    element.style.setProperty("visibility", "hidden", "important");
    return true;
  }

  function safeSelectorAll(selector, root = document) {
    try {
      return Array.from(root.querySelectorAll(selector));
    } catch (error) {
      return [];
    }
  }

  function textOf(element) {
    return String((element && (element.innerText || element.textContent)) || "").trim().replace(/\s+/g, " ");
  }

  function reportMetric(metrics) {
    Object.entries(metrics || {}).forEach(([key, value]) => {
      metricBuffer[key] = (metricBuffer[key] || 0) + Number(value || 0);
    });
    clearTimeout(metricTimer);
    metricTimer = setTimeout(() => {
      const payload = { ...metricBuffer };
      Object.keys(metricBuffer).forEach((key) => delete metricBuffer[key]);
      QN.utils.sendMessage({
        type: MESSAGE.CONTENT_METRIC,
        domain: domain(),
        metrics: payload
      });
    }, 900);
  }

  function onMessage(type, handler) {
    handlers.set(type, handler);
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !handlers.has(message.type)) return false;
    Promise.resolve(handlers.get(message.type)(message, sender))
      .then((response) => sendResponse(response || { ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
    return true;
  });

  onMessage(MESSAGE.APPLY_SITE_CONFIG, async (message) => {
    siteConfig = message.siteConfig || (await refreshConfig());
    configListeners.forEach((listener) => listener(siteConfig));
    return { ok: true, siteConfig };
  });

  global.QuietNetContent = {
    cleanupLevel,
    domain,
    escapeHtml,
    hideElement,
    isCoreLayout,
    isEnabled,
    onConfig,
    onMessage,
    profile,
    ready,
    refreshConfig,
    reportMetric,
    safeSelectorAll,
    settings,
    siteConfig: () => siteConfig,
    textOf,
    toast,
    visible
  };

  refreshConfig();
})(globalThis);
