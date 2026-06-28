(function quietNetRulesManager(global) {
  const constants = () => global.QuietNet.constants;
  const storage = () => global.QuietNet.storage;
  const utils = () => global.QuietNet.utils;

  function dnr() {
    return global.chrome && chrome.declarativeNetRequest ? chrome.declarativeNetRequest : null;
  }

  function updateEnabledRulesets(options) {
    return new Promise((resolve) => {
      const api = dnr();
      if (!api || !api.updateEnabledRulesets) {
        resolve({ ok: false, error: "declarativeNetRequest unavailable" });
        return;
      }
      api.updateEnabledRulesets(options, () => {
        const error = chrome.runtime.lastError;
        resolve(error ? { ok: false, error: error.message } : { ok: true });
      });
    });
  }

  function getEnabledRulesets() {
    return new Promise((resolve) => {
      const api = dnr();
      if (!api || !api.getEnabledRulesets) {
        resolve([]);
        return;
      }
      api.getEnabledRulesets((rulesets) => resolve(rulesets || []));
    });
  }

  function updateDynamicRules(options) {
    return new Promise((resolve) => {
      const api = dnr();
      if (!api || !api.updateDynamicRules) {
        resolve({ ok: false, error: "Dynamic rules unavailable" });
        return;
      }
      api.updateDynamicRules(options, () => {
        const error = chrome.runtime.lastError;
        resolve(error ? { ok: false, error: error.message } : { ok: true });
      });
    });
  }

  function getDynamicRules() {
    return new Promise((resolve) => {
      const api = dnr();
      if (!api || !api.getDynamicRules) {
        resolve([]);
        return;
      }
      api.getDynamicRules((rules) => resolve(rules || []));
    });
  }

  async function enableDefaultBlocklists() {
    const settings = await storage().getSettings();
    const enabled = constants().DEFAULT_RULESETS.filter((rulesetId) => !(settings.disabledRulesets || []).includes(rulesetId));
    await storage().updateSettings({ enabledRulesets: enabled });
    return updateEnabledRulesets({
      enableRulesetIds: enabled,
      disableRulesetIds: constants().DEFAULT_RULESETS.filter((rulesetId) => !enabled.includes(rulesetId))
    });
  }

  async function disableRuleset(rulesetId) {
    const settings = await storage().getSettings();
    const disabledRulesets = Array.from(new Set([...(settings.disabledRulesets || []), rulesetId]));
    const enabledRulesets = constants().DEFAULT_RULESETS.filter((id) => !disabledRulesets.includes(id));
    await storage().updateSettings({ disabledRulesets, enabledRulesets });
    return updateEnabledRulesets({
      disableRulesetIds: [rulesetId],
      enableRulesetIds: enabledRulesets
    });
  }

  async function enableRuleset(rulesetId) {
    const settings = await storage().getSettings();
    const disabledRulesets = (settings.disabledRulesets || []).filter((id) => id !== rulesetId);
    const enabledRulesets = constants().DEFAULT_RULESETS.filter((id) => !disabledRulesets.includes(id));
    await storage().updateSettings({ disabledRulesets, enabledRulesets });
    return updateEnabledRulesets({
      enableRulesetIds: [rulesetId],
      disableRulesetIds: []
    });
  }

  async function setProtectionEnabled(enabled) {
    await storage().updateSettings({ protectionEnabled: Boolean(enabled) });
    if (enabled) {
      await enableDefaultBlocklists();
      return syncDynamicRules();
    }
    return updateEnabledRulesets({
      disableRulesetIds: constants().DEFAULT_RULESETS,
      enableRulesetIds: []
    });
  }

  function makeAllowRule(domain, reason = "support") {
    const cleanDomain = utils().normalizeDomain(domain);
    const ruleId = utils().ruleIdFromText(`allow:${reason}:${cleanDomain}`, reason === "support" ? 700000 : 720000, 19999);
    return {
      id: ruleId,
      priority: 100000,
      action: {
        type: "allow"
      },
      condition: {
        initiatorDomains: [cleanDomain, `www.${cleanDomain}`],
        resourceTypes: constants().RESOURCE_TYPES.filter((type) => type !== "main_frame")
      }
    };
  }

  function makeCustomBlockRule(domain) {
    const cleanDomain = utils().normalizeDomain(domain);
    return {
      id: utils().ruleIdFromText(`block:${cleanDomain}`, 760000, 39999),
      priority: 50000,
      action: {
        type: "block"
      },
      condition: {
        urlFilter: `||${cleanDomain}^`,
        resourceTypes: constants().RESOURCE_TYPES
      }
    };
  }

  function makeCleanUrlRule() {
    return {
      id: 650001,
      priority: 1,
      action: {
        type: "redirect",
        redirect: {
          transform: {
            queryTransform: {
              removeParams: constants().TRACKING_PARAMS.slice(0, 80)
            }
          }
        }
      },
      condition: {
        regexFilter: "^https?://.*[?&](utm_|fbclid|gclid|dclid|gbraid|wbraid|mc_cid|igshid|msclkid|yclid|twclid|spm|_hsenc|_hsmi|mkt_tok)",
        resourceTypes: ["main_frame"]
      }
    };
  }

  async function addDynamicBlockRule(domain) {
    const cleanDomain = utils().normalizeDomain(domain);
    if (!cleanDomain) return { ok: false, error: "Enter a valid domain." };
    const state = await storage().get(["customBlockRules"]);
    const customBlockRules = state.customBlockRules || {};
    customBlockRules[cleanDomain] = { domain: cleanDomain, createdAt: Date.now() };
    await storage().set({ customBlockRules });
    return syncDynamicRules();
  }

  async function removeDynamicBlockRule(domain) {
    const cleanDomain = utils().normalizeDomain(domain);
    const state = await storage().get(["customBlockRules"]);
    const customBlockRules = state.customBlockRules || {};
    delete customBlockRules[cleanDomain];
    await storage().set({ customBlockRules });
    return syncDynamicRules();
  }

  async function addAllowRule(domain) {
    const cleanDomain = utils().normalizeDomain(domain);
    if (!cleanDomain) return { ok: false, error: "Enter a valid domain." };
    const state = await storage().get(["customAllowRules"]);
    const customAllowRules = state.customAllowRules || {};
    customAllowRules[cleanDomain] = { domain: cleanDomain, createdAt: Date.now() };
    await storage().set({ customAllowRules });
    return syncDynamicRules();
  }

  async function removeAllowRule(domain) {
    const cleanDomain = utils().normalizeDomain(domain);
    const state = await storage().get(["customAllowRules"]);
    const customAllowRules = state.customAllowRules || {};
    delete customAllowRules[cleanDomain];
    await storage().set({ customAllowRules });
    return syncDynamicRules();
  }

  async function syncDynamicRules() {
    const state = await storage().get(["settings", "supportList", "pausedSites", "customBlockRules", "customAllowRules"]);
    const now = Date.now();
    const nextRules = [];

    Object.keys(state.supportList || {}).forEach((domain) => {
      nextRules.push(makeAllowRule(domain, "support"));
    });

    Object.entries(state.pausedSites || {}).forEach(([domain, pause]) => {
      if (!pause.until || pause.until > now) nextRules.push(makeAllowRule(domain, "pause"));
    });

    Object.keys(state.customAllowRules || {}).forEach((domain) => {
      nextRules.push(makeAllowRule(domain, "custom"));
    });

    Object.keys(state.customBlockRules || {}).forEach((domain) => {
      nextRules.push(makeCustomBlockRule(domain));
    });

    if (!state.settings || state.settings.cleanAddressBar !== false) {
      nextRules.push(makeCleanUrlRule());
    }

    const dynamicRules = await getDynamicRules();
    const managedIds = dynamicRules
      .filter((rule) => rule.id >= 650000 && rule.id < 900000)
      .map((rule) => rule.id);
    const addRules = [];
    const seen = new Set();
    nextRules.forEach((rule) => {
      if (seen.has(rule.id)) return;
      seen.add(rule.id);
      addRules.push(rule);
    });

    const result = await updateDynamicRules({
      removeRuleIds: managedIds,
      addRules
    });
    if (result.ok) {
      await storage().set({
        dynamicRuleIds: Object.fromEntries(addRules.map((rule) => [String(rule.id), { id: rule.id, priority: rule.priority }]))
      });
    }
    return result;
  }

  async function getMatchedRulesForTab(tabId) {
    return new Promise((resolve) => {
      const api = dnr();
      if (!api || !api.getMatchedRules || !tabId) {
        resolve([]);
        return;
      }
      api.getMatchedRules({ tabId }, (result) => {
        const error = chrome.runtime.lastError;
        if (error) {
          resolve([]);
          return;
        }
        resolve((result && result.rulesMatchedInfo) || []);
      });
    });
  }

  async function calculateBlockedRequestCount(tabId) {
    const matches = await getMatchedRulesForTab(tabId);
    return matches.length;
  }

  global.QuietNet = global.QuietNet || {};
  global.QuietNet.rules = {
    addAllowRule,
    addDynamicBlockRule,
    calculateBlockedRequestCount,
    disableRuleset,
    enableDefaultBlocklists,
    enableRuleset,
    getDynamicRules,
    getEnabledRulesets,
    getMatchedRulesForTab,
    removeAllowRule,
    removeDynamicBlockRule,
    setProtectionEnabled,
    syncDynamicRules,
    updateDynamicRules
  };
})(globalThis);
