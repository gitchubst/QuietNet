(function quietNetYouTubeAdSkipper(global) {
  const QNC = global.QuietNetContent;
  let observer = null;
  let intervalId = 0;
  let scanTimer = 0;
  let lastMetricAt = 0;
  const managedVideos = new WeakMap();
  const onYouTubeNavigate = () => schedule(document);

  const skipButtonSelectors = [
    ".ytp-ad-skip-button",
    ".ytp-ad-skip-button-modern",
    ".ytp-skip-ad-button",
    "button[class*='ytp-ad-skip']",
    "button[id*='skip-button']"
  ];

  const companionAdSelectors = [
    "ytd-player-legacy-desktop-watch-ads-renderer",
    "ytd-companion-slot-renderer",
    "ytd-action-companion-ad-renderer",
    "ytd-display-ad-renderer",
    "ytd-promoted-sparkles-web-renderer",
    "#player-ads",
    "#masthead-ad",
    ".ytp-ad-overlay-container",
    ".ytp-ad-player-overlay",
    ".ytp-ad-survey",
    ".ytp-ad-image-overlay",
    ".ytp-ad-text-overlay"
  ];

  function isYouTube() {
    const domain = QNC.domain();
    return domain === "youtube.com" || domain.endsWith(".youtube.com") || domain === "youtu.be";
  }

  function shouldRun() {
    return isYouTube() && QNC.isEnabled() && QNC.settings().blockPromotions !== false;
  }

  function isVisibleButton(button) {
    if (!button || button.disabled || !QNC.visible(button)) return false;
    const rect = button.getBoundingClientRect();
    return rect.width >= 10 && rect.height >= 10;
  }

  function clickButton(button) {
    try {
      button.click();
    } catch (error) {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: global }));
    }
  }

  function playerIsShowingAd(player) {
    if (!player) return false;
    const classes = String(player.className || "");
    return /\bad-(showing|interrupting|created|playing)\b/.test(classes) || Boolean(player.querySelector(".ytp-ad-preview-container, .ytp-ad-player-overlay"));
  }

  function restoreFinishedVideos() {
    QNC.safeSelectorAll("video").forEach((video) => {
      const prior = managedVideos.get(video);
      if (!prior) return;
      const player = video.closest(".html5-video-player");
      if (playerIsShowingAd(player)) return;
      try {
        video.playbackRate = prior.playbackRate;
        video.muted = prior.muted;
      } catch (error) {
        // Ignore player state races while YouTube swaps video nodes.
      }
      managedVideos.delete(video);
    });
  }

  function hurryAdVideo(player) {
    if (!playerIsShowingAd(player)) return 0;
    const video = player.querySelector("video");
    if (!video) return 0;
    if (!managedVideos.has(video)) {
      managedVideos.set(video, {
        muted: video.muted,
        playbackRate: video.playbackRate || 1
      });
    }
    try {
      video.muted = true;
      video.playbackRate = Math.max(video.playbackRate || 1, 16);
      if (Number.isFinite(video.duration) && video.duration > 0 && video.currentTime < video.duration - 0.2) {
        video.currentTime = Math.max(video.currentTime, video.duration - 0.08);
      }
      return 1;
    } catch (error) {
      return 0;
    }
  }

  function clickSkipButtons(root = document) {
    let count = 0;
    skipButtonSelectors.forEach((selector) => {
      QNC.safeSelectorAll(selector, root).forEach((button) => {
        if (!isVisibleButton(button)) return;
        clickButton(button);
        count += 1;
      });
    });
    return count;
  }

  function hideCompanionAds(root = document) {
    let count = 0;
    companionAdSelectors.forEach((selector) => {
      QNC.safeSelectorAll(selector, root).forEach((element) => {
        if (QNC.hideElement(element, "youtube-video-ad")) count += 1;
      });
    });
    return count;
  }

  function reportAdWork(amount) {
    if (!amount) return;
    const now = Date.now();
    if (now - lastMetricAt < 1200) return;
    lastMetricAt = now;
    QNC.reportMetric({ ads: amount });
  }

  function scan(root = document) {
    if (!shouldRun()) {
      restoreFinishedVideos();
      document.documentElement.removeAttribute("data-quietnet-youtube-video-ad");
      return;
    }

    const skipped = clickSkipButtons(root);
    let hurried = 0;
    let activeAd = false;
    QNC.safeSelectorAll(".html5-video-player").forEach((player) => {
      if (!playerIsShowingAd(player)) return;
      activeAd = true;
      hurried += hurryAdVideo(player);
    });

    const hidden = hideCompanionAds(root);
    restoreFinishedVideos();
    document.documentElement.toggleAttribute("data-quietnet-youtube-video-ad", activeAd);
    reportAdWork(skipped + hurried + hidden);
  }

  function schedule(root = document) {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => scan(root), 120);
  }

  function start() {
    if (!document.documentElement || observer) return;
    observer = new MutationObserver((mutations) => {
      if (!mutations.some((mutation) => mutation.addedNodes && mutation.addedNodes.length)) return;
      schedule(document);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    intervalId = global.setInterval(() => scan(document), 450);
    document.addEventListener("yt-navigate-finish", onYouTubeNavigate, true);
    scan(document);
  }

  function stop() {
    if (observer) observer.disconnect();
    observer = null;
    if (intervalId) global.clearInterval(intervalId);
    intervalId = 0;
    document.removeEventListener("yt-navigate-finish", onYouTubeNavigate, true);
    clearTimeout(scanTimer);
    restoreFinishedVideos();
    if (document.documentElement) document.documentElement.removeAttribute("data-quietnet-youtube-video-ad");
  }

  QNC.onConfig(() => {
    if (shouldRun()) start();
    else stop();
  });

  QNC.ready(() => {
    if (shouldRun()) start();
  });

  global.QuietNetYouTubeAdSkipper = {
    scan,
    start,
    stop
  };
})(globalThis);
