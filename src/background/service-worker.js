importScripts(
  "../shared/constants.js",
  "../shared/utils.js",
  "../shared/scoring.js",
  "../shared/storage.js",
  "./stats-manager.js",
  "./rules-manager.js",
  "./update-manager.js"
);

const QN = globalThis.QuietNet;
const MESSAGE = QN.constants.MESSAGE;

async function getTabFromMessage(message) {
  if (message && message.tab && message.tab.id) return message.tab;
  const tabs = await new Promise((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, (result) => resolve(result || [])));
  return tabs[0] || null;
}

function tabDomain(tab) {
  return QN.utils.getDomainFromUrl((tab && tab.url) || "");
}

async function sendActionToTab(tab, type, payload = {}) {
  if (!tab || !tab.id || !QN.utils.isHttpUrl(tab.url || "")) {
    return { ok: false, error: "Open a normal web page first." };
  }
  return QN.utils.sendTabMessage(tab.id, { type, ...payload });
}

async function buildPopupState(tab) {
  const domain = tabDomain(tab);
  const [settings, siteConfig, pageStats, dailyStats, trend, state, enabledRulesets] = await Promise.all([
    QN.storage.getSettings(),
    QN.storage.getSiteConfig(domain),
    QN.stats.getPageStats(tab && tab.id, domain),
    QN.stats.getDailyStats(),
    QN.stats.getTrend(7),
    QN.storage.getAllState(),
    QN.rules.getEnabledRulesets()
  ]);

  return {
    ok: true,
    tab: tab
      ? {
          id: tab.id,
          url: tab.url,
          title: tab.title,
          domain
        }
      : null,
    settings,
    siteConfig,
    pageStats,
    dailyStats,
    trend,
    allTimeStats: state.allTimeStats,
    supportList: state.supportList,
    strictList: state.strictList,
    enabledRulesets,
    profiles: QN.constants.PROFILES
  };
}

async function buildDashboardData() {
  const [settings, state, dailyStats, trend, enabledRulesets, dynamicRules] = await Promise.all([
    QN.storage.getSettings(),
    QN.storage.getAllState(),
    QN.stats.getDailyStats(),
    QN.stats.getTrend(7),
    QN.rules.getEnabledRulesets(),
    QN.rules.getDynamicRules()
  ]);
  return {
    ok: true,
    settings,
    state,
    dailyStats,
    trend,
    enabledRulesets,
    dynamicRules,
    profiles: QN.constants.PROFILES
  };
}

async function setSitePause(tab, duration) {
  const domain = tabDomain(tab);
  if (!domain) return { ok: false, error: "No site domain found." };
  let pause = null;
  if (duration === "off") {
    pause = null;
  } else if (duration === "restart") {
    pause = { reason: "until browser restart", until: null, createdAt: Date.now() };
  } else {
    const minutes = Number(duration || 0);
    pause = { reason: `${minutes} minutes`, until: Date.now() + minutes * 60 * 1000, createdAt: Date.now() };
  }
  await QN.storage.setMapValue("pausedSites", domain, pause);
  await QN.rules.syncDynamicRules();
  if (tab && tab.id) await sendActionToTab(tab, MESSAGE.APPLY_SITE_CONFIG, { siteConfig: await QN.storage.getSiteConfig(domain) });
  return buildPopupState(tab);
}

async function supportSite(tab, mode, explicitDomain = "") {
  const domain = QN.utils.normalizeDomain(explicitDomain) || tabDomain(tab);
  if (!domain) return { ok: false, error: "No site domain found." };
  if (mode === "remove") {
    await QN.storage.setMapValue("supportList", domain, null);
  } else {
    await QN.storage.setMapValue("supportList", domain, {
      mode: mode || "whole-site",
      createdAt: Date.now()
    });
  }
  await QN.rules.syncDynamicRules();
  if (tab && tab.id) await sendActionToTab(tab, MESSAGE.APPLY_SITE_CONFIG, { siteConfig: await QN.storage.getSiteConfig(domain) });
  return buildPopupState(tab);
}

async function strictSite(tab, enabled, explicitDomain = "") {
  const domain = QN.utils.normalizeDomain(explicitDomain) || tabDomain(tab);
  if (!domain) return { ok: false, error: "No site domain found." };
  await QN.storage.setMapValue(
    "strictList",
    domain,
    enabled
      ? {
          createdAt: Date.now()
        }
      : null
  );
  await QN.storage.setMapValue("siteProfiles", domain, enabled ? "strict" : null);
  if (tab && tab.id) await sendActionToTab(tab, MESSAGE.APPLY_SITE_CONFIG, { siteConfig: await QN.storage.getSiteConfig(domain) });
  return buildPopupState(tab);
}

async function handleMessage(message, sender) {
  const type = message && message.type;
  const tab = (message && message.tab) || (sender && sender.tab) || (await getTabFromMessage(message));
  const domain = tabDomain(tab) || (message && message.domain) || "";

  switch (type) {
    case MESSAGE.GET_POPUP_STATE:
      return buildPopupState(tab);
    case MESSAGE.GET_DASHBOARD_DATA:
      return buildDashboardData();
    case MESSAGE.GET_SITE_CONFIG:
      return { ok: true, siteConfig: await QN.storage.getSiteConfig(message.domain || domain) };
    case MESSAGE.SET_PROTECTION:
      await QN.rules.setProtectionEnabled(Boolean(message.enabled));
      return buildPopupState(tab);
    case MESSAGE.SET_SETTING: {
      const settings = await QN.storage.updateSettings({ [message.key]: message.value });
      if (message.key === "disabledRulesets" || message.key === "enabledRulesets") {
        if (settings.protectionEnabled) await QN.rules.enableDefaultBlocklists();
      }
      if (message.key === "cleanAddressBar" || message.key === "protectionEnabled") await QN.rules.syncDynamicRules();
      if (tab && tab.id && domain) await sendActionToTab(tab, MESSAGE.APPLY_SITE_CONFIG, { siteConfig: await QN.storage.getSiteConfig(domain) });
      return { ok: true, settings };
    }
    case MESSAGE.SET_SITE_PAUSE:
      return setSitePause(tab, message.duration);
    case MESSAGE.SUPPORT_SITE:
      return supportSite(tab, message.mode, message.domain);
    case MESSAGE.REMOVE_SUPPORT_SITE:
      return supportSite(tab, "remove", message.domain);
    case MESSAGE.STRICT_SITE:
      return strictSite(tab, Boolean(message.enabled), message.domain);
    case MESSAGE.SET_SITE_PROFILE:
      await QN.storage.setMapValue("siteProfiles", message.domain || domain, message.profile || "balanced");
      if (tab && tab.id) await sendActionToTab(tab, MESSAGE.APPLY_SITE_CONFIG, { siteConfig: await QN.storage.getSiteConfig(message.domain || domain) });
      return buildPopupState(tab);
    case MESSAGE.ADD_CUSTOM_BLOCK:
      return QN.rules.addDynamicBlockRule(message.domain);
    case MESSAGE.REMOVE_CUSTOM_BLOCK:
      return QN.rules.removeDynamicBlockRule(message.domain);
    case MESSAGE.ADD_CUSTOM_ALLOW:
      return QN.rules.addAllowRule(message.domain);
    case MESSAGE.REMOVE_CUSTOM_ALLOW:
      return QN.rules.removeAllowRule(message.domain);
    case MESSAGE.START_ZAPPER:
      return sendActionToTab(tab, MESSAGE.START_ZAPPER);
    case MESSAGE.SCRUB_LEFTOVERS:
      return sendActionToTab(tab, MESSAGE.SCRUB_LEFTOVERS);
    case MESSAGE.CLEAN_LINKS_NOW:
      return sendActionToTab(tab, MESSAGE.CLEAN_LINKS_NOW);
    case MESSAGE.CONTENT_METRIC:
      return { ok: true, pageStats: await QN.stats.recordPageMetric((sender.tab && sender.tab.id) || message.tabId, message.domain || domain, message.metrics || {}) };
    case MESSAGE.SAVE_ZAPPER_RULE:
      return { ok: true, rule: await QN.storage.saveZapperRule(message.domain || domain, message.rule) };
    case MESSAGE.REMOVE_ZAPPER_RULE:
      return { ok: true, rules: await QN.storage.removeZapperRuleEverywhere(message.domain || domain, message.ruleId) };
    case MESSAGE.UNDO_LAST_ZAP:
      return sendActionToTab(tab, MESSAGE.UNDO_LAST_ZAP);
    case MESSAGE.REPORT_BROKEN_SITE:
      return { ok: true, report: await QN.storage.appendReport({ domain, url: tab && tab.url, title: tab && tab.title, note: message.note || "Broken site report" }) };
    case MESSAGE.RELAX_SITE:
      await QN.storage.setMapValue("pausedSites", domain, { reason: "relaxed for this session", until: null, createdAt: Date.now() });
      await QN.rules.syncDynamicRules();
      if (tab && tab.id) await chrome.tabs.reload(tab.id);
      return { ok: true };
    case MESSAGE.OPEN_DASHBOARD:
      await chrome.tabs.create({ url: chrome.runtime.getURL(QN.constants.ROUTES.dashboard) });
      return { ok: true };
    case MESSAGE.EXPORT_SETTINGS:
      return { ok: true, export: await QN.storage.getAllState() };
    case MESSAGE.IMPORT_SETTINGS:
      await QN.storage.set(message.payload || {});
      await QN.rules.syncDynamicRules();
      return { ok: true };
    case MESSAGE.CLEAR_STATS:
      await QN.stats.clearStats();
      return buildDashboardData();
    default:
      return { ok: false, error: `Unknown QuietNet message: ${type}` };
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await QN.storage.ensureStore();
  await QN.rules.enableDefaultBlocklists();
  await QN.rules.syncDynamicRules();
  chrome.alarms.create("quietnet-maintenance", { periodInMinutes: 60 });
});

chrome.runtime.onStartup.addListener(async () => {
  await QN.update.runMaintenance();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "quietnet-maintenance") {
    QN.update.runMaintenance();
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading" && tab && tab.url && QN.utils.isHttpUrl(tab.url)) {
    QN.stats.resetPageStats(tabId, QN.utils.getDomainFromUrl(tab.url));
  }
});

if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    const request = info.request || {};
    const rule = info.rule || {};
    QN.stats.recordBlockedRequest(request.tabId || -1, {
      url: request.url,
      documentUrl: request.documentUrl,
      initiator: request.initiator,
      resourceType: request.type,
      rulesetId: rule.rulesetId,
      ruleId: rule.ruleId
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((response) => sendResponse(response))
    .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
  return true;
});
