(function quietNetUpdateManager(global) {
  const storage = () => global.QuietNet.storage;
  const rules = () => global.QuietNet.rules;

  async function pruneOldStats() {
    const settings = await storage().getSettings();
    const keepDays = Math.max(1, Number(settings.statsRetentionDays || 30));
    const state = await storage().get(["dailyStats"]);
    const dailyStats = state.dailyStats || {};
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - keepDays);
    Object.keys(dailyStats).forEach((key) => {
      const date = new Date(`${key}T00:00:00`);
      if (date < cutoff) delete dailyStats[key];
    });
    await storage().set({ dailyStats });
  }

  async function runMaintenance() {
    await storage().ensureStore();
    await pruneOldStats();
    await rules().syncDynamicRules();
  }

  global.QuietNet = global.QuietNet || {};
  global.QuietNet.update = {
    pruneOldStats,
    runMaintenance
  };
})(globalThis);
