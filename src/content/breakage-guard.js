(function quietNetBreakageGuard(global) {
  const QN = global.QuietNet;
  const QNC = global.QuietNetContent;
  const MESSAGE = QN.constants.MESSAGE;
  let checked = false;

  function shouldRun() {
    const settings = QNC.settings();
    return QNC.isEnabled() && settings.breakageGuard !== false && !checked;
  }

  function visibleControls() {
    return QNC.safeSelectorAll("a[href], button, input, select, textarea, [role='button'], video").filter((element) => QNC.visible(element)).length;
  }

  function detectPageBreakage() {
    if (!document.body) return null;
    const text = QNC.textOf(document.body);
    const controls = visibleControls();
    const bodyRect = document.body.getBoundingClientRect();
    const mostlyBlank = text.length < 140 && controls < 3 && bodyRect.height > 300;
    const checkoutLike = /checkout|cart|payment|login|sign in|subscribe|watch|play/i.test(document.title + " " + global.location.href);
    const missingCriticalControls = checkoutLike && controls < 2 && text.length < 500;
    const brokenStyles = bodyRect.width < global.innerWidth * 0.5 && text.length > 300;
    if (mostlyBlank) return "The page looks mostly blank.";
    if (missingCriticalControls) return "A login, checkout, or player control may be missing.";
    if (brokenStyles) return "The layout looks collapsed.";
    return null;
  }

  function relaxBlocking() {
    QN.utils.sendMessage({
      type: MESSAGE.RELAX_SITE,
      domain: QNC.domain()
    });
  }

  function reportIssue(reason) {
    QN.utils.sendMessage({
      type: MESSAGE.REPORT_BROKEN_SITE,
      note: reason || "Breakage Guard detected possible breakage"
    });
  }

  function compareBeforeAfterLayout() {
    if (!shouldRun()) return;
    checked = true;
    const reason = detectPageBreakage();
    if (!reason) return;
    QNC.reportMetric({ risky: 1 });
  }

  function detectPageBreakageLater() {
    setTimeout(compareBeforeAfterLayout, 3600);
    setTimeout(compareBeforeAfterLayout, 7200);
  }

  QNC.onConfig(() => {
    checked = false;
    detectPageBreakageLater();
  });

  QNC.ready(() => detectPageBreakageLater());

  global.QuietNetBreakageGuard = {
    compareBeforeAfterLayout,
    detectPageBreakage,
    relaxRulesForSite: relaxBlocking,
    submitBrokenSiteReport: reportIssue,
    temporarilyDisableCosmeticFilters: relaxBlocking
  };
})(globalThis);
