(function quietNetStatsManager(global) {
  const storage = () => global.QuietNet.storage;
  const utils = () => global.QuietNet.utils;
  const scoring = () => global.QuietNet.scoring;

  const ESTIMATED_BYTES = {
    ads: 36000,
    trackers: 9000,
    annoyances: 12000,
    malware: 48000,
    popups: 0,
    leftovers: 0,
    fakeButtons: 0,
    risky: 32000
  };

  const ESTIMATED_SECONDS = {
    ads: 0.25,
    trackers: 0.12,
    annoyances: 0.8,
    malware: 1.4,
    popups: 3,
    leftovers: 0.35,
    fakeButtons: 1.5,
    risky: 1
  };

  function pageKey(tabId) {
    return `tab:${tabId}`;
  }

  function emptyPageStats(domain = "") {
    return {
      domain,
      ads: 0,
      trackers: 0,
      annoyances: 0,
      malware: 0,
      popups: 0,
      leftovers: 0,
      stickyElements: 0,
      autoplayElements: 0,
      fakeButtons: 0,
      linksCleaned: 0,
      copyCleaned: 0,
      risky: 0,
      bytesSaved: 0,
      secondsSaved: 0,
      noiseScore: 0,
      noiseLabel: "Clean",
      updatedAt: Date.now()
    };
  }

  function emptyDailyStats() {
    return {
      ads: 0,
      trackers: 0,
      annoyances: 0,
      malware: 0,
      popups: 0,
      leftovers: 0,
      fakeButtons: 0,
      linksCleaned: 0,
      copyCleaned: 0,
      risky: 0,
      bytesSaved: 0,
      secondsSaved: 0,
      noisiestSite: null,
      cleanestSite: null,
      domains: {}
    };
  }

  function recalculateNoise(pageStats) {
    const noiseScore = scoring().calculateNoiseScore({
      ads: pageStats.ads,
      trackers: pageStats.trackers,
      popups: pageStats.popups,
      stickyElements: pageStats.stickyElements,
      autoplayElements: pageStats.autoplayElements,
      leftovers: pageStats.leftovers,
      fakeButtons: pageStats.fakeButtons,
      malware: pageStats.malware
    });
    pageStats.noiseScore = noiseScore;
    pageStats.noiseLabel = scoring().noiseLabel(noiseScore);
    return pageStats;
  }

  function addMetric(bucket, metric, amount = 1) {
    const key = metric || "ads";
    bucket[key] = Math.max(0, Number(bucket[key] || 0) + amount);
    bucket.bytesSaved = Math.max(0, Number(bucket.bytesSaved || 0) + (ESTIMATED_BYTES[key] || 0) * amount);
    bucket.secondsSaved = Math.max(0, Number(bucket.secondsSaved || 0) + (ESTIMATED_SECONDS[key] || 0) * amount);
  }

  async function recordBlockedRequest(tabId, details = {}) {
    const type = scoring().classifyRequestType(details);
    const domain = utils().getDomainFromUrl(details.documentUrl || details.initiator || details.url || "") || details.domain || "";
    const state = await storage().get(["settings", "pageStats", "dailyStats", "allTimeStats", "blockedItems"]);
    if (state.settings && state.settings.localStats === false) return null;

    const pageStats = state.pageStats || {};
    const key = pageKey(tabId || "unknown");
    const page = pageStats[key] || emptyPageStats(domain);
    page.domain = page.domain || domain;
    addMetric(page, type, 1);
    page.updatedAt = Date.now();
    recalculateNoise(page);
    pageStats[key] = page;

    const dayKey = utils().todayKey();
    const dailyStats = state.dailyStats || {};
    const today = dailyStats[dayKey] || emptyDailyStats();
    addMetric(today, type, 1);
    if (domain) {
      today.domains[domain] = today.domains[domain] || emptyPageStats(domain);
      addMetric(today.domains[domain], type, 1);
      recalculateNoise(today.domains[domain]);
      updateDailyDomainHighlights(today);
    }
    dailyStats[dayKey] = today;

    const allTimeStats = state.allTimeStats || {};
    addMetric(allTimeStats, type, 1);

    const blockedItems = state.blockedItems || {};
    const itemKey = key;
    const list = blockedItems[itemKey] || [];
    if (details.url) {
      list.unshift({
        type,
        url: details.url,
        resourceType: details.resourceType || "other",
        rulesetId: details.rulesetId || "",
        time: Date.now()
      });
      blockedItems[itemKey] = list.slice(0, 80);
    }

    await storage().set({ pageStats, dailyStats, allTimeStats, blockedItems });
    return page;
  }

  async function recordPageMetric(tabId, domain, metrics = {}) {
    const state = await storage().get(["settings", "pageStats", "dailyStats", "allTimeStats"]);
    if (state.settings && state.settings.localStats === false) return null;
    const cleanDomain = utils().normalizeDomain(domain);
    const pageStats = state.pageStats || {};
    const key = pageKey(tabId || "unknown");
    const page = pageStats[key] || emptyPageStats(cleanDomain);
    page.domain = page.domain || cleanDomain;

    Object.entries(metrics).forEach(([metric, value]) => {
      const amount = Math.max(0, Number(value || 0));
      if (!amount) return;
      if (metric === "stickyElements" || metric === "autoplayElements") {
        page[metric] = Math.max(0, Number(page[metric] || 0) + amount);
      } else {
        addMetric(page, metric, amount);
      }
    });
    page.updatedAt = Date.now();
    recalculateNoise(page);
    pageStats[key] = page;

    const dayKey = utils().todayKey();
    const dailyStats = state.dailyStats || {};
    const today = dailyStats[dayKey] || emptyDailyStats();
    Object.entries(metrics).forEach(([metric, value]) => {
      const amount = Math.max(0, Number(value || 0));
      if (!amount) return;
      if (metric === "stickyElements" || metric === "autoplayElements") {
        today[metric] = Math.max(0, Number(today[metric] || 0) + amount);
      } else {
        addMetric(today, metric, amount);
      }
      if (cleanDomain) {
        today.domains[cleanDomain] = today.domains[cleanDomain] || emptyPageStats(cleanDomain);
        if (metric === "stickyElements" || metric === "autoplayElements") {
          today.domains[cleanDomain][metric] = Math.max(0, Number(today.domains[cleanDomain][metric] || 0) + amount);
        } else {
          addMetric(today.domains[cleanDomain], metric, amount);
        }
        recalculateNoise(today.domains[cleanDomain]);
      }
    });
    updateDailyDomainHighlights(today);
    dailyStats[dayKey] = today;

    const allTimeStats = state.allTimeStats || {};
    Object.entries(metrics).forEach(([metric, value]) => {
      const amount = Math.max(0, Number(value || 0));
      if (!amount) return;
      addMetric(allTimeStats, metric, amount);
    });

    await storage().set({ pageStats, dailyStats, allTimeStats });
    return page;
  }

  function updateDailyDomainHighlights(today) {
    const domains = Object.values(today.domains || {});
    if (!domains.length) return;
    const sortedNoise = domains.slice().sort((a, b) => (b.noiseScore || 0) - (a.noiseScore || 0));
    today.noisiestSite = sortedNoise[0]
      ? { domain: sortedNoise[0].domain, noiseScore: sortedNoise[0].noiseScore }
      : null;
    const eligibleClean = domains.filter((item) => (item.ads || 0) + (item.trackers || 0) + (item.annoyances || 0) > 0);
    const sortedClean = eligibleClean.slice().sort((a, b) => (a.noiseScore || 0) - (b.noiseScore || 0));
    today.cleanestSite = sortedClean[0]
      ? { domain: sortedClean[0].domain, noiseScore: sortedClean[0].noiseScore }
      : null;
  }

  async function resetPageStats(tabId, domain = "") {
    const state = await storage().get(["pageStats", "blockedItems"]);
    const pageStats = state.pageStats || {};
    const blockedItems = state.blockedItems || {};
    pageStats[pageKey(tabId)] = emptyPageStats(domain);
    blockedItems[pageKey(tabId)] = [];
    await storage().set({ pageStats, blockedItems });
  }

  async function getPageStats(tabId, domain = "") {
    const state = await storage().get(["pageStats", "blockedItems"]);
    const key = pageKey(tabId || "unknown");
    const page = recalculateNoise(state.pageStats && state.pageStats[key] ? state.pageStats[key] : emptyPageStats(domain));
    return {
      ...page,
      blockedItems: (state.blockedItems && state.blockedItems[key]) || []
    };
  }

  async function getDailyStats() {
    const state = await storage().get(["dailyStats"]);
    const dayKey = utils().todayKey();
    return (state.dailyStats && state.dailyStats[dayKey]) || emptyDailyStats();
  }

  async function getTrend(days = 7) {
    const state = await storage().get(["dailyStats"]);
    const keys = utils().getLastDays(days);
    return keys.map((key) => {
      const day = (state.dailyStats && state.dailyStats[key]) || emptyDailyStats();
      return {
        date: key,
        ads: day.ads || 0,
        trackers: day.trackers || 0,
        annoyances: day.annoyances || 0,
        total: (day.ads || 0) + (day.trackers || 0) + (day.annoyances || 0) + (day.malware || 0),
        bytesSaved: day.bytesSaved || 0
      };
    });
  }

  async function clearStats() {
    await storage().set({
      pageStats: {},
      dailyStats: {},
      allTimeStats: global.QuietNet.constants.DEFAULT_STORE.allTimeStats,
      blockedItems: {}
    });
  }

  global.QuietNet = global.QuietNet || {};
  global.QuietNet.stats = {
    clearStats,
    emptyDailyStats,
    emptyPageStats,
    getDailyStats,
    getPageStats,
    getTrend,
    recordBlockedRequest,
    recordPageMetric,
    resetPageStats
  };
})(globalThis);
