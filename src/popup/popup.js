(function quietNetPopup(global) {
  const QN = global.QuietNet;
  const MESSAGE = QN.constants.MESSAGE;
  let currentState = null;

  const elements = {
    closeButton: document.getElementById("closeButton"),
    protectionToggle: document.getElementById("protectionToggle"),
    promotionsToggle: document.getElementById("promotionsToggle"),
    protectionLabel: document.getElementById("protectionLabel"),
    protectionSubtext: document.getElementById("protectionSubtext"),
    promotionsLabel: document.getElementById("promotionsLabel"),
    promotionsSubtext: document.getElementById("promotionsSubtext"),
    domainName: document.getElementById("domainName"),
    cleanupStatus: document.getElementById("cleanupStatus"),
    scoreNumber: document.getElementById("scoreNumber"),
    scoreStatus: document.getElementById("scoreStatus"),
    scoreRing: document.getElementById("scoreRing"),
    scoreRingValue: document.getElementById("scoreRingValue"),
    adsBlocked: document.getElementById("adsBlocked"),
    trackersStopped: document.getElementById("trackersStopped"),
    popupsFrozen: document.getElementById("popupsFrozen"),
    leftoversCleaned: document.getElementById("leftoversCleaned"),
    zapperButton: document.getElementById("zapperButton"),
    quietModeButton: document.getElementById("quietModeButton"),
    quietModeLabel: document.getElementById("quietModeLabel"),
    cleanLinksButton: document.getElementById("cleanLinksButton"),
    pauseButton: document.getElementById("pauseButton"),
    pauseMenu: document.getElementById("pauseMenu"),
    scrubButton: document.getElementById("scrubButton"),
    scrubStatus: document.getElementById("scrubStatus"),
    profileTitle: document.getElementById("profileTitle"),
    profileSelect: document.getElementById("profileSelect"),
    supportButton: document.getElementById("supportButton"),
    reportButton: document.getElementById("reportButton"),
    todayBlocked: document.getElementById("todayBlocked"),
    dataSaved: document.getElementById("dataSaved"),
    timeSaved: document.getElementById("timeSaved"),
    miniChart: document.getElementById("miniChart"),
    blockedList: document.getElementById("blockedList"),
    blockedItemsButton: document.getElementById("blockedItemsButton"),
    dashboardButton: document.getElementById("dashboardButton")
  };

  function toneColor(score) {
    if (score <= 20) return "#22c55e";
    if (score <= 60) return "#fbbf24";
    if (score <= 80) return "#fb7185";
    return "#a855f7";
  }

  function activeTabPayload() {
    return currentState && currentState.tab ? { tab: currentState.tab } : {};
  }

  async function requestState(extra = {}) {
    const response = await QN.utils.sendMessage({
      type: MESSAGE.GET_POPUP_STATE,
      ...extra
    });
    if (response && response.ok) {
      currentState = response;
      render(response);
    } else {
      renderError(response && response.error ? response.error : "QuietNet could not read this tab.");
    }
  }

  function renderError(message) {
    elements.domainName.textContent = "Unavailable";
    elements.cleanupStatus.textContent = "Paused";
    elements.scrubStatus.textContent = message;
  }

  function renderProfiles(profiles, selected) {
    elements.profileSelect.innerHTML = "";
    Object.entries(profiles || {}).forEach(([key, value]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = value.label;
      option.selected = key === selected;
      elements.profileSelect.append(option);
    });
  }

  function renderTrend(trend) {
    const values = (trend || []).map((day) => day.total || 0);
    const max = Math.max(1, ...values);
    elements.miniChart.innerHTML = "";
    (trend || []).forEach((day) => {
      const bar = document.createElement("div");
      bar.className = "bar";
      bar.style.height = `${Math.max(10, Math.round(((day.total || 0) / max) * 54))}px`;
      bar.title = `${day.date}: ${QN.utils.formatInteger(day.total || 0)} blocked`;
      elements.miniChart.append(bar);
    });
  }

  function renderBlockedItems(items) {
    const list = (items || []).slice(0, 4);
    if (!list.length) {
      elements.blockedList.innerHTML = '<p class="empty-state">No blocked items recorded for this tab yet.</p>';
      return;
    }
    elements.blockedList.innerHTML = "";
    list.forEach((item) => {
      const row = document.createElement("div");
      row.className = "blocked-item";
      row.innerHTML = `
        <strong>${item.type || "blocked"}</strong>
        <span>${QN.utils.shortUrl(item.url || "", 58)}</span>
      `;
      elements.blockedList.append(row);
    });
  }

  function render(state) {
    const stats = state.pageStats || {};
    const settings = state.settings || {};
    const config = state.siteConfig || {};
    const daily = state.dailyStats || {};
    const score = stats.noiseScore || 0;
    const enabled = Boolean(config.enabled);
    const paused = config.paused || config.supported || !settings.protectionEnabled;
    const profileInfo = state.profiles && state.profiles[config.profile] ? state.profiles[config.profile] : { label: "Balanced" };

    elements.domainName.textContent = (state.tab && state.tab.domain) || "This page";
    elements.cleanupStatus.textContent = enabled ? "Active" : paused ? "Paused" : "Off";
    elements.cleanupStatus.classList.toggle("is-disabled", !enabled);

    elements.protectionToggle.classList.toggle("is-off", !settings.protectionEnabled);
    elements.protectionToggle.setAttribute("aria-pressed", String(Boolean(settings.protectionEnabled)));
    elements.protectionLabel.textContent = settings.protectionEnabled ? "Protection ON" : "Protection OFF";
    if (config.supported) {
      elements.protectionSubtext.textContent = "Support List is allowing this site.";
    } else if (config.paused) {
      elements.protectionSubtext.textContent = "Paused on this site.";
    } else {
      elements.protectionSubtext.textContent = enabled ? "This page is calmer now." : "QuietNet is currently paused.";
    }

    elements.promotionsToggle.classList.toggle("is-off", settings.blockPromotions === false);
    elements.promotionsToggle.setAttribute("aria-pressed", String(settings.blockPromotions !== false));
    elements.promotionsLabel.textContent = settings.blockPromotions === false ? "Block Promotions OFF" : "Block Promotions ON";
    elements.promotionsSubtext.textContent = settings.blockPromotions === false ? "Promotional banners and mini videos are allowed." : "Hide promotional banners and mini video popups.";

    elements.scoreNumber.textContent = score;
    elements.scoreStatus.textContent = `${QN.utils.scoreLabel(score)} site`;
    elements.scoreRingValue.textContent = score;
    elements.scoreRing.style.setProperty("--score", score);
    elements.scoreRing.style.setProperty("--ring-color", toneColor(score));

    elements.adsBlocked.textContent = QN.utils.formatInteger(stats.ads || 0);
    elements.trackersStopped.textContent = QN.utils.formatInteger(stats.trackers || 0);
    elements.popupsFrozen.textContent = QN.utils.formatInteger(stats.popups || 0);
    elements.leftoversCleaned.textContent = QN.utils.formatInteger(stats.leftovers || 0);
    elements.todayBlocked.textContent = QN.utils.formatInteger((daily.ads || 0) + (daily.trackers || 0) + (daily.annoyances || 0) + (daily.malware || 0));
    elements.dataSaved.textContent = QN.utils.formatBytes(daily.bytesSaved || 0);
    elements.timeSaved.textContent = `${QN.utils.formatDuration(daily.secondsSaved || 0)} saved`;
    elements.quietModeLabel.textContent = settings.quietMode === "ultra" ? "Ultra Quiet" : settings.quietMode === "quiet" ? "Quiet On" : "Quiet Mode";
    elements.profileTitle.textContent = profileInfo.label;
    elements.supportButton.textContent = config.supported ? "Remove from Support List" : "Support this site";
    elements.pauseButton.querySelector("span").textContent = config.paused ? "Resume Site" : "Pause Site";

    renderProfiles(state.profiles, config.profile);
    renderTrend(state.trend || []);
    renderBlockedItems(stats.blockedItems || []);
  }

  async function runTabAction(type, statusMessage) {
    elements.scrubStatus.textContent = statusMessage || "Working...";
    const response = await QN.utils.sendMessage({ type, ...activeTabPayload() });
    if (response && response.ok) {
      elements.scrubStatus.textContent = response.cleaned || response.cleaned === 0 ? `Cleaned ${response.cleaned} items.` : "Done.";
    } else {
      elements.scrubStatus.textContent = (response && response.error) || "This action needs a normal web page.";
    }
    setTimeout(() => requestState(), 450);
  }

  function cycleQuietMode() {
    const current = currentState && currentState.settings ? currentState.settings.quietMode : "normal";
    const next = current === "normal" ? "quiet" : current === "quiet" ? "ultra" : "normal";
    return QN.utils.sendMessage({
      type: MESSAGE.SET_SETTING,
      key: "quietMode",
      value: next,
      ...activeTabPayload()
    }).then(() => requestState());
  }

  function bindEvents() {
    elements.closeButton.addEventListener("click", () => global.close());
    elements.protectionToggle.addEventListener("click", async () => {
      const enabled = !(currentState && currentState.settings && currentState.settings.protectionEnabled);
      await QN.utils.sendMessage({ type: MESSAGE.SET_PROTECTION, enabled, ...activeTabPayload() });
      requestState();
    });
    elements.promotionsToggle.addEventListener("click", async () => {
      const enabled = !(currentState && currentState.settings && currentState.settings.blockPromotions !== false);
      await QN.utils.sendMessage({
        type: MESSAGE.SET_SETTING,
        key: "blockPromotions",
        value: enabled,
        ...activeTabPayload()
      });
      requestState();
    });
    elements.zapperButton.addEventListener("click", async () => {
      await QN.utils.sendMessage({ type: MESSAGE.START_ZAPPER, ...activeTabPayload() });
      global.close();
    });
    elements.quietModeButton.addEventListener("click", cycleQuietMode);
    elements.cleanLinksButton.addEventListener("click", () => runTabAction(MESSAGE.CLEAN_LINKS_NOW, "Cleaning tracking links..."));
    elements.scrubButton.addEventListener("click", () => runTabAction(MESSAGE.SCRUB_LEFTOVERS, "Scrubbing empty ad spaces..."));
    elements.pauseButton.addEventListener("click", () => {
      const hidden = elements.pauseMenu.hidden;
      elements.pauseMenu.hidden = !hidden;
      elements.pauseButton.setAttribute("aria-expanded", String(hidden));
    });
    elements.pauseMenu.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-pause]");
      if (!button) return;
      await QN.utils.sendMessage({ type: MESSAGE.SET_SITE_PAUSE, duration: button.dataset.pause, ...activeTabPayload() });
      elements.pauseMenu.hidden = true;
      requestState();
    });
    elements.profileSelect.addEventListener("change", async () => {
      await QN.utils.sendMessage({
        type: MESSAGE.SET_SITE_PROFILE,
        profile: elements.profileSelect.value,
        domain: currentState && currentState.tab ? currentState.tab.domain : "",
        ...activeTabPayload()
      });
      requestState();
    });
    elements.supportButton.addEventListener("click", async () => {
      const supported = currentState && currentState.siteConfig && currentState.siteConfig.supported;
      await QN.utils.sendMessage({ type: supported ? MESSAGE.REMOVE_SUPPORT_SITE : MESSAGE.SUPPORT_SITE, mode: "whole-site", ...activeTabPayload() });
      requestState();
    });
    elements.reportButton.addEventListener("click", async () => {
      await QN.utils.sendMessage({ type: MESSAGE.REPORT_BROKEN_SITE, note: "Reported from popup", ...activeTabPayload() });
      elements.scrubStatus.textContent = "Broken-site report saved.";
    });
    elements.blockedItemsButton.addEventListener("click", () => QN.utils.sendMessage({ type: MESSAGE.OPEN_DASHBOARD }));
    elements.dashboardButton.addEventListener("click", () => QN.utils.sendMessage({ type: MESSAGE.OPEN_DASHBOARD }));
  }

  bindEvents();
  requestState();
})(globalThis);
