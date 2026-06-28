(function quietNetDashboard(global) {
  const QN = global.QuietNet;
  const MESSAGE = QN.constants.MESSAGE;
  let state = null;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const els = {
    globalToggle: $("#globalToggle"),
    blockedToday: $("#blockedToday"),
    blockedAllTime: $("#blockedAllTime"),
    dataSaved: $("#dataSaved"),
    timeSaved: $("#timeSaved"),
    trendTotal: $("#trendTotal"),
    trendChart: $("#trendChart"),
    siteRadar: $("#siteRadar"),
    inspectorTable: $("#inspectorTable"),
    filterList: $("#filterList"),
    blockForm: $("#blockForm"),
    blockDomain: $("#blockDomain"),
    allowForm: $("#allowForm"),
    allowDomain: $("#allowDomain"),
    customBlockList: $("#customBlockList"),
    customAllowList: $("#customAllowList"),
    zappedRules: $("#zappedRules"),
    supportList: $("#supportList"),
    strictList: $("#strictList"),
    profileForm: $("#profileForm"),
    profileDomain: $("#profileDomain"),
    profileChoice: $("#profileChoice"),
    profileRules: $("#profileRules"),
    brokenReports: $("#brokenReports"),
    privacyToggles: $("#privacyToggles"),
    exportButton: $("#exportButton"),
    importInput: $("#importInput"),
    clearStatsButton: $("#clearStatsButton")
  };

  const filterMeta = [
    ["ads", "Ad blocking", "Banner ads, prebid scripts, auctions, and sponsored widgets."],
    ["trackers", "Tracker blocking", "Pixels, analytics, replay tools, and behavioral trackers."],
    ["annoyances", "Annoyance blocking", "Cookie nags, newsletter popups, push spam, and modals."],
    ["malware", "Malvertising domains", "Suspicious ad redirects and fake download networks."],
    ["regional-us", "Regional US filters", "Extra US ad-tech and annoyance domains."]
  ];

  const privacyMeta = [
    ["localStats", "Store local stats", "Page and daily counts stay on this browser."],
    ["dailyReport", "Daily Calm Report", "Keep daily trend, noisiest site, and cleanest site summaries."],
    ["trackerCategorization", "Tracker categories", "Classify blocked requests into ads, trackers, annoyances, and risk."],
    ["cleanCopiedText", "Clean copied text", "Remove forced attribution snippets and junk spacing."],
    ["cleanCopiedLinks", "Clean copied links", "Remove tracking parameters from copied URLs."],
    ["blockPromotions", "Block Promotions", "Hide promotional banners and mini video popups."],
    ["popupFreeze", "Popup Freeze", "Freeze newsletter, coupon, notification, and exit overlays."],
    ["fakeButtonShield", "Fake Button Shield", "Hide deceptive download, play, and start buttons."],
    ["breakageGuard", "Breakage Guard", "Silently detect pages that may have broken."]
  ];

  function totalBlocked(stats) {
    return (stats.ads || 0) + (stats.trackers || 0) + (stats.annoyances || 0) + (stats.malware || 0) + (stats.risky || 0);
  }

  function empty(message) {
    const node = document.createElement("p");
    node.className = "empty";
    node.textContent = message;
    return node;
  }

  async function loadDashboard() {
    const response = await QN.utils.sendMessage({ type: MESSAGE.GET_DASHBOARD_DATA });
    if (!response || !response.ok) return;
    state = response;
    render();
  }

  function render() {
    const settings = state.settings || {};
    const daily = state.dailyStats || {};
    const allTime = state.state.allTimeStats || {};
    els.globalToggle.textContent = settings.protectionEnabled ? "Protection ON" : "Protection OFF";
    els.globalToggle.classList.toggle("is-off", !settings.protectionEnabled);
    els.blockedToday.textContent = QN.utils.formatInteger(totalBlocked(daily));
    els.blockedAllTime.textContent = QN.utils.formatInteger(totalBlocked(allTime));
    els.dataSaved.textContent = QN.utils.formatBytes(allTime.bytesSaved || daily.bytesSaved || 0);
    els.timeSaved.textContent = QN.utils.formatDuration(allTime.secondsSaved || daily.secondsSaved || 0);
    renderTrend();
    renderSiteRadar();
    renderInspector();
    renderFilters();
    renderRules();
    renderSites();
    renderPrivacy();
    renderProfiles();
  }

  function renderTrend() {
    const trend = state.trend || [];
    const max = Math.max(1, ...trend.map((day) => day.total || 0));
    const sum = trend.reduce((total, day) => total + (day.total || 0), 0);
    els.trendTotal.textContent = `${QN.utils.formatInteger(sum)} total`;
    els.trendChart.innerHTML = "";
    trend.forEach((day) => {
      const wrap = document.createElement("div");
      wrap.className = "trend-bar-wrap";
      const bar = document.createElement("div");
      bar.className = "trend-bar";
      bar.style.height = `${Math.max(16, Math.round(((day.total || 0) / max) * 190))}px`;
      bar.textContent = day.total ? QN.utils.formatInteger(day.total) : "";
      const label = document.createElement("div");
      label.className = "trend-label";
      label.textContent = day.date.slice(5);
      wrap.append(bar, label);
      els.trendChart.append(wrap);
    });
  }

  function renderSiteRadar() {
    const domains = Object.values((state.dailyStats && state.dailyStats.domains) || {})
      .sort((a, b) => (b.noiseScore || 0) - (a.noiseScore || 0))
      .slice(0, 8);
    els.siteRadar.innerHTML = "";
    if (!domains.length) {
      els.siteRadar.append(empty("No site stats yet today."));
      return;
    }
    domains.forEach((site) => {
      const row = document.createElement("div");
      row.className = "radar-row";
      row.innerHTML = `
        <div><strong>${site.domain}</strong><br><span>${QN.utils.scoreLabel(site.noiseScore || 0)} · ${QN.utils.formatInteger(totalBlocked(site))} blocked</span></div>
        <span class="soft-pill">${site.noiseScore || 0}/100</span>
      `;
      els.siteRadar.append(row);
    });
  }

  function renderInspector() {
    const items = [];
    Object.entries(state.state.blockedItems || {}).forEach(([tabKey, list]) => {
      (list || []).slice(0, 12).forEach((item) => items.push({ ...item, tabKey }));
    });
    items.sort((a, b) => (b.time || 0) - (a.time || 0));
    els.inspectorTable.innerHTML = "";
    if (!items.length) {
      els.inspectorTable.append(empty("No blocked requests recorded yet. Browse a noisy page with QuietNet on."));
      return;
    }
    items.slice(0, 16).forEach((item) => {
      const row = document.createElement("div");
      row.className = "inspector-row";
      row.innerHTML = `
        <div><strong>${item.type}</strong><br><span>${QN.utils.shortUrl(item.url || "", 96)}</span></div>
        <button class="tiny-button" type="button" data-copy="${encodeURIComponent(item.url || "")}">Copy URL</button>
      `;
      els.inspectorTable.append(row);
    });
  }

  function renderFilters() {
    const disabled = new Set((state.settings && state.settings.disabledRulesets) || []);
    els.filterList.innerHTML = "";
    filterMeta.forEach(([id, title, description]) => {
      const enabled = !disabled.has(id);
      const row = document.createElement("div");
      row.className = "toggle-row";
      row.innerHTML = `
        <div><strong>${title}</strong><br><span>${description}</span></div>
        <button class="toggle-switch" type="button" aria-pressed="${enabled}" data-ruleset="${id}" aria-label="Toggle ${title}"></button>
      `;
      els.filterList.append(row);
    });
  }

  function removablePill(domain, actionType) {
    const row = document.createElement("div");
    row.className = "domain-pill";
    row.innerHTML = `
      <div><strong>${domain}</strong><br><span>${actionType.includes("ALLOW") ? "Allowed domain" : actionType.includes("SUPPORT") ? "Support List" : "Custom rule"}</span></div>
      <button class="tiny-button" type="button">Remove</button>
    `;
    row.querySelector("button").addEventListener("click", async () => {
      await QN.utils.sendMessage({ type: actionType, domain });
      loadDashboard();
    });
    return row;
  }

  function renderRules() {
    els.customBlockList.innerHTML = "";
    Object.keys(state.state.customBlockRules || {}).forEach((domain) => {
      els.customBlockList.append(removablePill(domain, MESSAGE.REMOVE_CUSTOM_BLOCK));
    });
    if (!els.customBlockList.children.length) els.customBlockList.append(empty("No custom blocked domains yet."));

    els.customAllowList.innerHTML = "";
    Object.keys(state.state.customAllowRules || {}).forEach((domain) => {
      els.customAllowList.append(removablePill(domain, MESSAGE.REMOVE_CUSTOM_ALLOW));
    });
    if (!els.customAllowList.children.length) els.customAllowList.append(empty("No custom allowed domains yet."));

    els.zappedRules.innerHTML = "";
    const zapped = {
      ...(state.state.zappedRules || {}),
      ...(state.state.similarZappedRules || {})
    };
    Object.entries(zapped).forEach(([domain, rules]) => {
      (rules || []).forEach((rule) => {
        const row = document.createElement("div");
        row.className = "rule-row";
        row.innerHTML = `
          <div><strong>${domain}</strong><br><span>${rule.selector}</span></div>
          <div>
            <span class="soft-pill">${rule.scope === "similar-sites" ? "Similar sites" : rule.mode || "exact"}</span>
            <button class="tiny-button" type="button" data-remove-zap="${rule.id}" data-zap-domain="${rule.domain || domain}">Remove</button>
          </div>
        `;
        els.zappedRules.append(row);
      });
    });
    if (!els.zappedRules.children.length) els.zappedRules.append(empty("No zapped elements saved yet. Use Zapper from the popup."));
  }

  function renderSites() {
    els.supportList.innerHTML = "";
    Object.keys(state.state.supportList || {}).forEach((domain) => {
      els.supportList.append(removablePill(domain, MESSAGE.REMOVE_SUPPORT_SITE));
    });
    if (!els.supportList.children.length) els.supportList.append(empty("No supported sites yet."));

    els.strictList.innerHTML = "";
    Object.keys(state.state.strictList || {}).forEach((domain) => {
      const row = document.createElement("div");
      row.className = "domain-pill";
      row.innerHTML = `<div><strong>${domain}</strong><br><span>Strict profile</span></div><button class="tiny-button" type="button">Remove</button>`;
      row.querySelector("button").addEventListener("click", async () => {
        await QN.utils.sendMessage({ type: MESSAGE.STRICT_SITE, domain, enabled: false });
        loadDashboard();
      });
      els.strictList.append(row);
    });
    if (!els.strictList.children.length) els.strictList.append(empty("No strict sites yet."));

    els.profileRules.innerHTML = "";
    Object.entries(state.state.siteProfiles || {}).forEach(([domain, profile]) => {
      const label = state.profiles[profile] ? state.profiles[profile].label : profile;
      const row = document.createElement("div");
      row.className = "rule-row";
      row.innerHTML = `<div><strong>${domain}</strong><br><span>${label}</span></div><span class="soft-pill">Profile</span>`;
      els.profileRules.append(row);
    });
    if (!els.profileRules.children.length) els.profileRules.append(empty("No per-site profiles yet."));

    els.brokenReports.innerHTML = "";
    (state.state.reports || []).slice(0, 10).forEach((report) => {
      const row = document.createElement("div");
      row.className = "rule-row";
      row.innerHTML = `<div><strong>${report.domain || "Unknown site"}</strong><br><span>${report.note || "Broken site report"}</span></div><span class="soft-pill">${new Date(report.createdAt).toLocaleDateString()}</span>`;
      els.brokenReports.append(row);
    });
    if (!els.brokenReports.children.length) els.brokenReports.append(empty("No broken-site reports."));
  }

  function renderProfiles() {
    els.profileChoice.innerHTML = "";
    Object.entries(state.profiles || {}).forEach(([key, value]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = value.label;
      els.profileChoice.append(option);
    });
  }

  function renderPrivacy() {
    els.privacyToggles.innerHTML = "";
    privacyMeta.forEach(([key, title, description]) => {
      const enabled = state.settings[key] !== false;
      const row = document.createElement("div");
      row.className = "toggle-row";
      row.innerHTML = `
        <div><strong>${title}</strong><br><span>${description}</span></div>
        <button class="toggle-switch" type="button" aria-pressed="${enabled}" data-setting="${key}" aria-label="Toggle ${title}"></button>
      `;
      els.privacyToggles.append(row);
    });
  }

  function bindEvents() {
    $$(".nav-button").forEach((button) => {
      button.addEventListener("click", () => {
        $$(".nav-button").forEach((item) => item.classList.toggle("is-active", item === button));
        $$(".section").forEach((section) => section.classList.toggle("is-active", section.id === button.dataset.section));
      });
    });

    els.globalToggle.addEventListener("click", async () => {
      await QN.utils.sendMessage({ type: MESSAGE.SET_PROTECTION, enabled: !state.settings.protectionEnabled });
      loadDashboard();
    });

    els.filterList.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-ruleset]");
      if (!button) return;
      const disabled = new Set((state.settings && state.settings.disabledRulesets) || []);
      if (button.getAttribute("aria-pressed") === "true") disabled.add(button.dataset.ruleset);
      else disabled.delete(button.dataset.ruleset);
      await QN.utils.sendMessage({ type: MESSAGE.SET_SETTING, key: "disabledRulesets", value: Array.from(disabled) });
      loadDashboard();
    });

    els.privacyToggles.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-setting]");
      if (!button) return;
      await QN.utils.sendMessage({
        type: MESSAGE.SET_SETTING,
        key: button.dataset.setting,
        value: button.getAttribute("aria-pressed") !== "true"
      });
      loadDashboard();
    });

    els.blockForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await QN.utils.sendMessage({ type: MESSAGE.ADD_CUSTOM_BLOCK, domain: els.blockDomain.value });
      els.blockDomain.value = "";
      loadDashboard();
    });

    els.allowForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await QN.utils.sendMessage({ type: MESSAGE.ADD_CUSTOM_ALLOW, domain: els.allowDomain.value });
      els.allowDomain.value = "";
      loadDashboard();
    });

    els.profileForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await QN.utils.sendMessage({
        type: MESSAGE.SET_SITE_PROFILE,
        domain: els.profileDomain.value,
        profile: els.profileChoice.value
      });
      els.profileDomain.value = "";
      loadDashboard();
    });

    els.inspectorTable.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-copy]");
      if (!button) return;
      const url = decodeURIComponent(button.dataset.copy);
      await navigator.clipboard.writeText(url);
      button.textContent = "Copied";
      setTimeout(() => {
        button.textContent = "Copy URL";
      }, 1000);
    });

    els.zappedRules.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-remove-zap]");
      if (!button) return;
      await QN.utils.sendMessage({
        type: MESSAGE.REMOVE_ZAPPER_RULE,
        domain: button.dataset.zapDomain,
        ruleId: button.dataset.removeZap
      });
      loadDashboard();
    });

    els.exportButton.addEventListener("click", async () => {
      const response = await QN.utils.sendMessage({ type: MESSAGE.EXPORT_SETTINGS });
      const blob = new Blob([JSON.stringify(response.export, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `quietnet-settings-${QN.utils.todayKey()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    });

    els.importInput.addEventListener("change", async () => {
      const file = els.importInput.files && els.importInput.files[0];
      if (!file) return;
      const payload = JSON.parse(await file.text());
      await QN.utils.sendMessage({ type: MESSAGE.IMPORT_SETTINGS, payload });
      loadDashboard();
    });

    els.clearStatsButton.addEventListener("click", async () => {
      await QN.utils.sendMessage({ type: MESSAGE.CLEAR_STATS });
      loadDashboard();
    });
  }

  bindEvents();
  loadDashboard();
})(globalThis);
