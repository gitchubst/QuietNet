(function quietNetUtils(global) {
  const constants = () => global.QuietNet.constants;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
  }

  function now() {
    return Date.now();
  }

  function todayKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function normalizeDomain(domain) {
    if (!domain) return "";
    return String(domain)
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .split(":")[0]
      .replace(/\.$/, "");
  }

  function getDomainFromUrl(url) {
    try {
      return normalizeDomain(new URL(url).hostname);
    } catch (error) {
      return "";
    }
  }

  function isHttpUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch (error) {
      return false;
    }
  }

  function sameOrSubdomain(domain, parent) {
    const cleanDomain = normalizeDomain(domain);
    const cleanParent = normalizeDomain(parent);
    return cleanDomain === cleanParent || cleanDomain.endsWith(`.${cleanParent}`);
  }

  function getBaseDomain(domain) {
    const cleanDomain = normalizeDomain(domain);
    const parts = cleanDomain.split(".").filter(Boolean);
    if (parts.length <= 2) return cleanDomain;
    const last = parts[parts.length - 1];
    const secondLast = parts[parts.length - 2];
    const commonSecondLevel = new Set(["co", "com", "net", "org", "gov", "edu", "ac"]);
    if (last.length === 2 && commonSecondLevel.has(secondLast) && parts.length >= 3) {
      return parts.slice(-3).join(".");
    }
    return parts.slice(-2).join(".");
  }

  function hashString(input) {
    let hash = 2166136261;
    const text = String(input || "");
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return Math.abs(hash >>> 0);
  }

  function ruleIdFromText(text, base, maxSpan = 99999) {
    return base + (hashString(text) % maxSpan);
  }

  function formatInteger(value) {
    return new Intl.NumberFormat("en-US").format(Math.max(0, Math.round(value || 0)));
  }

  function formatBytes(bytes) {
    const value = Math.max(0, Number(bytes || 0));
    if (value < 1024) return `${Math.round(value)} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(value > 10240 ? 0 : 1)} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(value > 10 * 1024 * 1024 ? 0 : 1)} MB`;
    return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Number(seconds || 0));
    if (total < 60) return `${Math.round(total)} sec`;
    if (total < 3600) return `${Math.round(total / 60)} min`;
    return `${(total / 3600).toFixed(1)} hr`;
  }

  function shortUrl(url, maxLength = 64) {
    if (!url) return "";
    const text = String(url);
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 18))}...${text.slice(-15)}`;
  }

  function mergeDeep(base, override) {
    const output = Array.isArray(base) ? base.slice() : { ...(base || {}) };
    Object.entries(override || {}).forEach(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
        output[key] = mergeDeep(output[key] || {}, value);
      } else {
        output[key] = value;
      }
    });
    return output;
  }

  function debounce(fn, delay) {
    let timer = 0;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function throttle(fn, delay) {
    let last = 0;
    let timer = 0;
    return (...args) => {
      const remaining = delay - (now() - last);
      if (remaining <= 0) {
        clearTimeout(timer);
        last = now();
        fn(...args);
      } else if (!timer) {
        timer = setTimeout(() => {
          last = now();
          timer = 0;
          fn(...args);
        }, remaining);
      }
    };
  }

  function cleanUrl(url, options = {}) {
    const preserve = new Set((options.preserve || []).map((item) => item.toLowerCase()));
    const trackingParams = new Set((constants().TRACKING_PARAMS || []).map((item) => item.toLowerCase()));
    try {
      const parsed = new URL(url);
      let changed = false;
      Array.from(parsed.searchParams.keys()).forEach((key) => {
        const normalized = key.toLowerCase();
        const looksLikeClickId = /(^|_)(clickid|clid|cid|eid|aff|affiliate|campaign|partner)(_|\d|$)/i.test(key);
        if (!preserve.has(normalized) && (trackingParams.has(normalized) || looksLikeClickId)) {
          parsed.searchParams.delete(key);
          changed = true;
        }
      });
      return {
        changed,
        url: parsed.toString()
      };
    } catch (error) {
      return {
        changed: false,
        url
      };
    }
  }

  function sendMessage(message) {
    return new Promise((resolve) => {
      if (!global.chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
        resolve({ ok: false, error: "Chrome runtime unavailable" });
        return;
      }
      try {
        chrome.runtime.sendMessage(message, (response) => {
          const error = chrome.runtime.lastError;
          if (error) {
            resolve({ ok: false, error: error.message });
            return;
          }
          resolve(response || { ok: true });
        });
      } catch (error) {
        resolve({ ok: false, error: error.message });
      }
    });
  }

  function sendTabMessage(tabId, message) {
    return new Promise((resolve) => {
      if (!global.chrome || !chrome.tabs || !chrome.tabs.sendMessage) {
        resolve({ ok: false, error: "Chrome tabs API unavailable" });
        return;
      }
      chrome.tabs.sendMessage(tabId, message, (response) => {
        const error = chrome.runtime.lastError;
        if (error) {
          resolve({ ok: false, error: error.message });
          return;
        }
        resolve(response || { ok: true });
      });
    });
  }

  function getActiveTab() {
    return new Promise((resolve) => {
      if (!global.chrome || !chrome.tabs) {
        resolve(null);
        return;
      }
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs && tabs[0] ? tabs[0] : null);
      });
    });
  }

  function scoreLabel(score) {
    const value = Number(score || 0);
    if (value <= 20) return "Clean";
    if (value <= 40) return "Mild noise";
    if (value <= 60) return "Distracting";
    if (value <= 80) return "Loud";
    return "Chaos";
  }

  function scoreTone(score) {
    const value = Number(score || 0);
    if (value <= 20) return "clean";
    if (value <= 40) return "mild";
    if (value <= 60) return "medium";
    if (value <= 80) return "loud";
    return "chaos";
  }

  function getLastDays(count) {
    const days = [];
    for (let offset = count - 1; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      days.push(todayKey(date));
    }
    return days;
  }

  global.QuietNet = global.QuietNet || {};
  global.QuietNet.utils = {
    clamp,
    cleanUrl,
    debounce,
    formatBytes,
    formatDuration,
    formatInteger,
    getActiveTab,
    getBaseDomain,
    getDomainFromUrl,
    getLastDays,
    hashString,
    isHttpUrl,
    mergeDeep,
    normalizeDomain,
    now,
    ruleIdFromText,
    sameOrSubdomain,
    scoreLabel,
    scoreTone,
    sendMessage,
    sendTabMessage,
    shortUrl,
    throttle,
    todayKey
  };
})(globalThis);
