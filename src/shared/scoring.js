(function quietNetScoring(global) {
  function calculateNoiseScore(input) {
    const values = {
      adRequests: Number(input && input.adRequests ? input.adRequests : input && input.ads ? input.ads : 0),
      trackerRequests: Number(input && input.trackerRequests ? input.trackerRequests : input && input.trackers ? input.trackers : 0),
      popups: Number(input && input.popups ? input.popups : 0),
      stickyElements: Number(input && input.stickyElements ? input.stickyElements : 0),
      autoplayElements: Number(input && input.autoplayElements ? input.autoplayElements : 0),
      cosmeticMatches: Number(input && input.cosmeticMatches ? input.cosmeticMatches : input && input.leftovers ? input.leftovers : 0),
      fakeButtons: Number(input && input.fakeButtons ? input.fakeButtons : 0),
      malware: Number(input && input.malware ? input.malware : 0)
    };

    const raw =
      values.adRequests * 1.4 +
      values.trackerRequests * 1.8 +
      values.popups * 8 +
      values.stickyElements * 4 +
      values.autoplayElements * 6 +
      values.cosmeticMatches * 1.2 +
      values.fakeButtons * 5 +
      values.malware * 9;

    return Math.max(0, Math.min(100, Math.round(raw)));
  }

  function noiseLabel(score) {
    if (score <= 20) return "Clean";
    if (score <= 40) return "Mild noise";
    if (score <= 60) return "Distracting";
    if (score <= 80) return "Loud";
    return "Chaos";
  }

  function classifyRuleset(rulesetId) {
    if (rulesetId === "ads") return "ads";
    if (rulesetId === "trackers") return "trackers";
    if (rulesetId === "annoyances") return "annoyances";
    if (rulesetId === "malware") return "malware";
    if (rulesetId === "regional-us") return "ads";
    return "ads";
  }

  function classifyRequestType(details = {}) {
    if (details.rulesetId) return classifyRuleset(details.rulesetId);
    const url = String(details.url || "").toLowerCase();
    if (/doubleclick|googlesyndication|googleadservices|adservice|prebid|taboola|outbrain|adnxs|rubicon|pubmatic|openx|criteo|adsystem|adserver|adroll|revcontent|bidswitch|sharethrough|yieldmo/.test(url)) {
      return "ads";
    }
    if (/analytics|collect|pixel|facebook\.net\/tr|hotjar|fullstory|segment|amplitude|mixpanel|heap|clarity|mouseflow|scorecardresearch|quantserve|chartbeat|parsely/.test(url)) {
      return "trackers";
    }
    if (/cookie|consent|newsletter|push|popup|optin|klaviyo|onesignal|justuno|privy|wisepops|sleeknote/.test(url)) {
      return "annoyances";
    }
    if (/adf\.ly|shorte\.st|linkbucks|popcash|popads|onclickads|propellerads|adsterra|exoclick|installcore|opencandy/.test(url)) {
      return "malware";
    }
    return "ads";
  }

  function detectTrackingPixel(elementOrUrl) {
    if (!elementOrUrl) return false;
    if (typeof elementOrUrl === "string") {
      return /pixel|collect|analytics|\/tr\?|beacon|track/i.test(elementOrUrl);
    }
    const rect = elementOrUrl.getBoundingClientRect ? elementOrUrl.getBoundingClientRect() : { width: 0, height: 0 };
    const src = elementOrUrl.currentSrc || elementOrUrl.src || "";
    return (rect.width <= 2 && rect.height <= 2 && /pixel|collect|analytics|track|beacon/i.test(src)) || /facebook\.net\/tr|google-analytics|scorecardresearch/i.test(src);
  }

  function detectFingerprintingScript(textOrUrl) {
    const text = String(textOrUrl || "").toLowerCase();
    return /canvasfingerprint|fingerprintjs|audiofingerprint|getclientrects|enumeratedevices|webgl_debug_renderer_info/.test(text);
  }

  global.QuietNet = global.QuietNet || {};
  global.QuietNet.scoring = {
    calculateNoiseScore,
    classifyRequestType,
    detectFingerprintingScript,
    detectTrackingPixel,
    noiseLabel
  };
})(globalThis);
