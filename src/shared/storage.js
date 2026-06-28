(function quietNetStorage(global) {
  const constants = () => global.QuietNet.constants;
  const utils = () => global.QuietNet.utils;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function storageArea() {
    return global.chrome && chrome.storage && chrome.storage.local ? chrome.storage.local : null;
  }

  function get(keys) {
    return new Promise((resolve) => {
      const area = storageArea();
      if (!area) {
        resolve({});
        return;
      }
      area.get(keys, (result) => resolve(result || {}));
    });
  }

  function set(values) {
    return new Promise((resolve) => {
      const area = storageArea();
      if (!area) {
        resolve(false);
        return;
      }
      area.set(values, () => resolve(true));
    });
  }

  function remove(keys) {
    return new Promise((resolve) => {
      const area = storageArea();
      if (!area) {
        resolve(false);
        return;
      }
      area.remove(keys, () => resolve(true));
    });
  }

  async function ensureStore() {
    const defaults = constants().DEFAULT_STORE;
    const existing = await get(Object.keys(defaults));
    const patch = {};
    Object.entries(defaults).forEach(([key, value]) => {
      if (typeof existing[key] === "undefined") {
        patch[key] = clone(value);
      } else if (key === "settings") {
        patch[key] = utils().mergeDeep(clone(defaults.settings), existing.settings || {});
      }
    });
    if (Object.keys(patch).length) await set(patch);
    return get(Object.keys(defaults));
  }

  async function getSettings() {
    const store = await ensureStore();
    return utils().mergeDeep(clone(constants().DEFAULT_SETTINGS), store.settings || {});
  }

  async function updateSettings(patch) {
    const settings = await getSettings();
    const next = utils().mergeDeep(settings, patch || {});
    await set({ settings: next });
    return next;
  }

  async function getAllState() {
    return ensureStore();
  }

  async function getSiteConfig(domain) {
    const cleanDomain = utils().normalizeDomain(domain);
    const baseDomain = utils().getBaseDomain(cleanDomain);
    const [settings, state] = await Promise.all([getSettings(), getAllState()]);
    const paused = state.pausedSites && state.pausedSites[cleanDomain];
    const now = Date.now();
    const pauseActive = paused && (!paused.until || paused.until > now);
    const supported = Boolean(state.supportList && state.supportList[cleanDomain]);
    const strict = Boolean(state.strictList && state.strictList[cleanDomain]);
    const profile = (state.siteProfiles && state.siteProfiles[cleanDomain]) || (strict ? "strict" : "balanced");

    const siteZaps = (state.zappedRules && state.zappedRules[cleanDomain]) || [];
    const similarZaps = (state.similarZappedRules && state.similarZappedRules[baseDomain]) || [];

    return {
      domain: cleanDomain,
      baseDomain,
      enabled: Boolean(settings.protectionEnabled && !pauseActive && !supported),
      globalEnabled: Boolean(settings.protectionEnabled),
      paused: Boolean(pauseActive),
      pause: pauseActive ? paused : null,
      supported,
      strict,
      profile,
      quietMode: settings.quietMode,
      settings,
      zappedRules: [...similarZaps, ...siteZaps]
    };
  }

  async function setMapValue(mapName, domain, value) {
    const cleanDomain = utils().normalizeDomain(domain);
    const state = await get([mapName]);
    const map = state[mapName] || {};
    if (value === null || typeof value === "undefined" || value === false) {
      delete map[cleanDomain];
    } else {
      map[cleanDomain] = value;
    }
    await set({ [mapName]: map });
    return map;
  }

  async function appendReport(report) {
    const state = await get(["reports"]);
    const reports = Array.isArray(state.reports) ? state.reports : [];
    reports.unshift({
      id: `report-${Date.now()}`,
      createdAt: Date.now(),
      ...report
    });
    await set({ reports: reports.slice(0, 100) });
    return reports[0];
  }

  async function saveZapperRule(domain, rule) {
    const cleanDomain = utils().normalizeDomain(domain);
    const baseDomain = utils().getBaseDomain(cleanDomain);
    const scope = rule.scope === "similar-sites" ? "similar-sites" : "site";
    const mapName = scope === "similar-sites" ? "similarZappedRules" : "zappedRules";
    const mapKey = scope === "similar-sites" ? baseDomain : cleanDomain;
    const state = await get([mapName]);
    const map = state[mapName] || {};
    const current = Array.isArray(map[mapKey]) ? map[mapKey] : [];
    const ruleId = rule.id || `zap-${Date.now()}`;
    const nextRule = {
      id: ruleId,
      selector: rule.selector,
      mode: rule.mode || "exact",
      scope,
      domain: cleanDomain,
      baseDomain,
      label: rule.label || "Zapped element",
      createdAt: Date.now(),
      hits: 0
    };
    map[mapKey] = [nextRule, ...current.filter((item) => item.selector !== nextRule.selector)].slice(0, 100);
    await set({ [mapName]: map });
    return nextRule;
  }

  async function removeZapperRule(domain, ruleId, scope = "site") {
    const cleanDomain = utils().normalizeDomain(domain);
    const baseDomain = utils().getBaseDomain(cleanDomain);
    const mapName = scope === "similar-sites" ? "similarZappedRules" : "zappedRules";
    const mapKey = scope === "similar-sites" ? baseDomain : cleanDomain;
    const state = await get([mapName]);
    const map = state[mapName] || {};
    map[mapKey] = (map[mapKey] || []).filter((rule) => rule.id !== ruleId);
    await set({ [mapName]: map });
    return map[mapKey];
  }

  async function removeZapperRuleEverywhere(domain, ruleId) {
    const cleanDomain = utils().normalizeDomain(domain);
    const baseDomain = utils().getBaseDomain(cleanDomain);
    const state = await get(["zappedRules", "similarZappedRules"]);
    const zappedRules = state.zappedRules || {};
    const similarZappedRules = state.similarZappedRules || {};
    zappedRules[cleanDomain] = (zappedRules[cleanDomain] || []).filter((rule) => rule.id !== ruleId);
    similarZappedRules[baseDomain] = (similarZappedRules[baseDomain] || []).filter((rule) => rule.id !== ruleId);
    await set({ zappedRules, similarZappedRules });
    return {
      site: zappedRules[cleanDomain],
      similar: similarZappedRules[baseDomain]
    };
  }

  global.QuietNet = global.QuietNet || {};
  global.QuietNet.storage = {
    appendReport,
    ensureStore,
    get,
    getAllState,
    getSettings,
    getSiteConfig,
    remove,
    removeZapperRule,
    removeZapperRuleEverywhere,
    saveZapperRule,
    set,
    setMapValue,
    updateSettings
  };
})(globalThis);
