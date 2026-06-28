(function quietNetConstants(global) {
  const RESOURCE_TYPES = [
    "main_frame",
    "sub_frame",
    "stylesheet",
    "script",
    "image",
    "font",
    "object",
    "xmlhttprequest",
    "ping",
    "csp_report",
    "media",
    "websocket",
    "other"
  ];

  const DEFAULT_RULESETS = ["ads", "trackers", "annoyances", "malware", "regional-us"];

  const TRACKING_PARAMS = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "utm_id",
    "utm_reader",
    "utm_name",
    "utm_social",
    "utm_brand",
    "fbclid",
    "gclid",
    "dclid",
    "gbraid",
    "wbraid",
    "mc_cid",
    "mc_eid",
    "igshid",
    "msclkid",
    "yclid",
    "twclid",
    "li_fat_id",
    "vero_id",
    "spm",
    "ref",
    "ref_src",
    "source",
    "campaign",
    "affid",
    "affiliate",
    "ranMID",
    "ranEAID",
    "sscid",
    "_hsenc",
    "_hsmi",
    "mkt_tok",
    "oly_enc_id",
    "oly_anon_id"
  ];

  const DEFAULT_SETTINGS = {
    version: 1,
    protectionEnabled: true,
    theme: "light",
    blockingStrength: "balanced",
    quietMode: "normal",
    compactPopup: false,
    glowIntensity: 0.42,
    cleanLinks: true,
    cleanCopiedLinks: true,
    cleanCopiedText: true,
    cleanAddressBar: true,
    cleanLinksBeforeOpening: true,
    showCleanToast: true,
    cosmeticCleanup: true,
    adLeftoverScrubber: true,
    blockPromotions: true,
    popupFreeze: true,
    fakeButtonShield: true,
    breakageGuard: true,
    localStats: true,
    sync: false,
    dailyReport: true,
    trackerCategorization: true,
    statsRetentionDays: 30,
    enabledRulesets: DEFAULT_RULESETS.slice(),
    disabledRulesets: [],
    regionalFilters: {
      "regional-us": true
    }
  };

  const DEFAULT_STORE = {
    settings: DEFAULT_SETTINGS,
    supportList: {},
    strictList: {},
    brokenSites: {},
    pausedSites: {},
    siteProfiles: {},
    customBlockRules: {},
    customAllowRules: {},
    zappedRules: {},
    similarZappedRules: {},
    cleanLinkAllowlist: {},
    dynamicRuleIds: {},
    reports: [],
    blockedItems: {},
    pageStats: {},
    dailyStats: {},
    allTimeStats: {
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
      secondsSaved: 0
    }
  };

  const PROFILES = {
    balanced: {
      label: "Balanced",
      cleanupLevel: 1,
      networkLevel: 1,
      description: "Strong blocking with low breakage risk."
    },
    strict: {
      label: "Strict",
      cleanupLevel: 2,
      networkLevel: 2,
      description: "More aggressive against trackers, popups, and leftovers."
    },
    ultraQuiet: {
      label: "Ultra Quiet",
      cleanupLevel: 3,
      networkLevel: 3,
      description: "Maximum page quieting; reversible per site."
    },
    videoFriendly: {
      label: "Video Friendly",
      cleanupLevel: 1,
      networkLevel: 1,
      description: "Keeps players stable while blocking known ad and tracker calls."
    },
    shoppingSafe: {
      label: "Shopping Safe",
      cleanupLevel: 1,
      networkLevel: 1,
      description: "Preserves carts, checkout, and coupon flows."
    },
    newsReading: {
      label: "News Reading",
      cleanupLevel: 2,
      networkLevel: 2,
      description: "Removes sticky clutter, newsletter boxes, and clickbait grids."
    },
    custom: {
      label: "Custom",
      cleanupLevel: 2,
      networkLevel: 2,
      description: "Your per-site rule mix."
    }
  };

  const MESSAGE = {
    GET_POPUP_STATE: "QUIETNET_GET_POPUP_STATE",
    GET_DASHBOARD_DATA: "QUIETNET_GET_DASHBOARD_DATA",
    SET_PROTECTION: "QUIETNET_SET_PROTECTION",
    SET_SETTING: "QUIETNET_SET_SETTING",
    SET_SITE_PAUSE: "QUIETNET_SET_SITE_PAUSE",
    SET_SITE_PROFILE: "QUIETNET_SET_SITE_PROFILE",
    SUPPORT_SITE: "QUIETNET_SUPPORT_SITE",
    REMOVE_SUPPORT_SITE: "QUIETNET_REMOVE_SUPPORT_SITE",
    STRICT_SITE: "QUIETNET_STRICT_SITE",
    REMOVE_STRICT_SITE: "QUIETNET_REMOVE_STRICT_SITE",
    ADD_CUSTOM_BLOCK: "QUIETNET_ADD_CUSTOM_BLOCK",
    REMOVE_CUSTOM_BLOCK: "QUIETNET_REMOVE_CUSTOM_BLOCK",
    ADD_CUSTOM_ALLOW: "QUIETNET_ADD_CUSTOM_ALLOW",
    REMOVE_CUSTOM_ALLOW: "QUIETNET_REMOVE_CUSTOM_ALLOW",
    START_ZAPPER: "QUIETNET_START_ZAPPER",
    SCRUB_LEFTOVERS: "QUIETNET_SCRUB_LEFTOVERS",
    CLEAN_LINKS_NOW: "QUIETNET_CLEAN_LINKS_NOW",
    APPLY_SITE_CONFIG: "QUIETNET_APPLY_SITE_CONFIG",
    GET_SITE_CONFIG: "QUIETNET_GET_SITE_CONFIG",
    CONTENT_METRIC: "QUIETNET_CONTENT_METRIC",
    SAVE_ZAPPER_RULE: "QUIETNET_SAVE_ZAPPER_RULE",
    REMOVE_ZAPPER_RULE: "QUIETNET_REMOVE_ZAPPER_RULE",
    UNDO_LAST_ZAP: "QUIETNET_UNDO_LAST_ZAP",
    REPORT_BROKEN_SITE: "QUIETNET_REPORT_BROKEN_SITE",
    RELAX_SITE: "QUIETNET_RELAX_SITE",
    OPEN_DASHBOARD: "QUIETNET_OPEN_DASHBOARD",
    EXPORT_SETTINGS: "QUIETNET_EXPORT_SETTINGS",
    IMPORT_SETTINGS: "QUIETNET_IMPORT_SETTINGS",
    CLEAR_STATS: "QUIETNET_CLEAR_STATS"
  };

  const ROUTES = {
    popup: "src/popup/popup.html",
    dashboard: "src/dashboard/dashboard.html"
  };

  global.QuietNet = global.QuietNet || {};
  global.QuietNet.constants = {
    DEFAULT_RULESETS,
    DEFAULT_SETTINGS,
    DEFAULT_STORE,
    MESSAGE,
    PROFILES,
    RESOURCE_TYPES,
    ROUTES,
    TRACKING_PARAMS
  };
})(globalThis);
