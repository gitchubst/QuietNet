(function quietNetElementZapper(global) {
  const QN = global.QuietNet;
  const QNC = global.QuietNetContent;
  const MESSAGE = QN.constants.MESSAGE;
  let active = false;
  let highlight = null;
  let selectedElement = null;
  let selectedChain = [];
  let selectedIndex = 0;
  let lastZap = null;
  let dialog = null;
  let preview = null;

  function cssEscape(value) {
    if (global.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
  }

  function uniqueSelector(selector) {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch (error) {
      return false;
    }
  }

  function stableClasses(element) {
    return Array.from(element.classList || [])
      .filter((className) => className.length > 2 && className.length < 36 && !/[0-9]{4,}|active|selected|hover|focus|show|hide|open|closed/i.test(className))
      .slice(0, 3);
  }

  function generateCssSelector(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return "";
    if (element.id && !/[0-9]{4,}|:|\.|\[|\]/.test(element.id)) {
      const idSelector = `#${cssEscape(element.id)}`;
      if (uniqueSelector(idSelector)) return idSelector;
    }

    const dataKeys = ["testid", "test-id", "qa", "component", "module"];
    for (const key of dataKeys) {
      const attr = `data-${key}`;
      const value = element.getAttribute(attr);
      if (value) {
        const selector = `${element.tagName.toLowerCase()}[${attr}="${cssEscape(value)}"]`;
        if (uniqueSelector(selector)) return selector;
      }
    }

    const parts = [];
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body && parts.length < 6) {
      const tag = current.tagName.toLowerCase();
      const classes = stableClasses(current);
      let part = tag + classes.map((className) => `.${cssEscape(className)}`).join("");
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }
      parts.unshift(part);
      const selector = parts.join(" > ");
      if (uniqueSelector(selector)) return selector;
      current = parent;
    }
    return parts.join(" > ");
  }

  function generateSimilarSelector(element) {
    const tag = element.tagName.toLowerCase();
    const classes = stableClasses(element);
    if (classes.length) return `${tag}.${classes.map(cssEscape).join(".")}`;
    const role = element.getAttribute("role");
    if (role) return `${tag}[role="${cssEscape(role)}"]`;
    const aria = element.getAttribute("aria-label");
    if (aria && aria.length < 48) return `${tag}[aria-label="${cssEscape(aria)}"]`;
    return tag;
  }

  function selectorRisk(selector) {
    if (!selector || /^(html|body|main|article)$/i.test(selector)) return { broad: true, count: 999, message: "This selector is too broad." };
    let count = 0;
    try {
      count = document.querySelectorAll(selector).length;
    } catch (error) {
      return { broad: true, count: 0, message: "This selector is invalid." };
    }
    if (count > 24) return { broad: true, count, message: `This would affect ${count} elements.` };
    return { broad: false, count, message: count === 1 ? "This targets one element." : `This targets ${count} similar elements.` };
  }

  function elementLabel(element) {
    const text = QNC.textOf(element);
    if (text) return text.slice(0, 70);
    const aria = element.getAttribute("aria-label");
    if (aria) return aria.slice(0, 70);
    return `${element.tagName.toLowerCase()} element`;
  }

  function buildElementChain(element) {
    const chain = [];
    const viewportArea = Math.max(1, global.innerWidth * global.innerHeight);
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body && current !== document.documentElement) {
      if (QNC.visible(current) && !QNC.isCoreLayout(current)) {
        chain.push(current);
      }
      const parent = current.parentElement;
      if (!parent || QNC.isCoreLayout(parent)) break;
      const rect = parent.getBoundingClientRect();
      if (rect.width * rect.height > viewportArea * 0.72) break;
      current = parent;
    }
    return chain.length ? chain : [element];
  }

  function currentElement() {
    return selectedChain[selectedIndex] || selectedElement;
  }

  function ensureHighlight() {
    if (highlight && document.documentElement.contains(highlight)) return highlight;
    highlight = document.createElement("div");
    highlight.className = "quietnet-zapper-highlight";
    document.documentElement.append(highlight);
    return highlight;
  }

  function moveHighlight(element) {
    if (!element || element === highlight || element.closest(".quietnet-zapper-dialog")) return;
    selectedElement = element;
    const box = ensureHighlight();
    const rect = element.getBoundingClientRect();
    box.style.left = `${rect.left}px`;
    box.style.top = `${rect.top}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
  }

  function clearUi() {
    finishPreview();
    if (highlight) highlight.remove();
    highlight = null;
    if (dialog) dialog.remove();
    dialog = null;
    document.documentElement.classList.remove("quietnet-zapper-active");
  }

  function stopElementPicker() {
    active = false;
    document.removeEventListener("mousemove", onMouseMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
    clearUi();
  }

  function onMouseMove(event) {
    if (!active || dialog) return;
    const target = event.target;
    if (!target || target.closest(".quietnet-toast-root")) return;
    moveHighlight(target);
  }

  function onKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      stopElementPicker();
      QNC.toast("Zapper canceled", "No page changes were saved.");
    }
  }

  function onClick(event) {
    if (!active) return;
    const target = event.target;
    if (!target) return;
    if (target.closest(".quietnet-zapper-dialog")) return;
    if (dialog) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    selectedElement = target;
    selectedChain = buildElementChain(target);
    selectedIndex = 0;
    showChoiceDialog();
  }

  function updateDialogState() {
    if (!dialog) return;
    const element = currentElement();
    moveHighlight(element);
    const exact = generateCssSelector(element);
    const similar = generateSimilarSelector(element);
    const exactRisk = selectorRisk(exact);
    const similarRisk = selectorRisk(similar);
    const selectorNode = dialog.querySelector("[data-selector-preview]");
    const warningNode = dialog.querySelector("[data-warning]");
    const frameNode = dialog.querySelector("[data-frame-label]");
    if (selectorNode) selectorNode.textContent = exact;
    if (warningNode) warningNode.textContent = `${exactRisk.message} ${similarRisk.broad ? "Remove All Similar may be too broad." : ""}`.trim();
    if (frameNode) frameNode.textContent = selectedIndex === 0 ? "Current element" : `Parent container ${selectedIndex}`;
    dialog.dataset.exactSelector = exact;
    dialog.dataset.similarSelector = similar;
    dialog.dataset.exactBroad = String(exactRisk.broad);
    dialog.dataset.similarBroad = String(similarRisk.broad);
  }

  function showChoiceDialog() {
    if (dialog) dialog.remove();
    const element = currentElement();
    const max = Math.max(0, selectedChain.length - 1);
    dialog = document.createElement("div");
    dialog.className = "quietnet-zapper-dialog";
    dialog.innerHTML = `
      <h2>Remove this page noise?</h2>
      <p>${QNC.escapeHtml(elementLabel(element))}</p>
      <div class="quietnet-zapper-selector" data-selector-preview></div>
      <div class="quietnet-zapper-control">
        <label for="quietnet-zapper-frame">Adjust the slider to resize the frame</label>
        <input class="quietnet-zapper-slider" id="quietnet-zapper-frame" type="range" min="0" max="${max}" value="0" step="1">
        <small data-frame-label>Current element</small>
      </div>
      <label class="quietnet-zapper-toggle">
        <input type="checkbox" data-similar-sites>
        <span>Remove for Similar Sites</span>
      </label>
      <p class="quietnet-zapper-warning" data-warning></p>
      <div class="quietnet-zapper-actions">
        <button type="button" data-action="once" data-primary="true">Remove Once</button>
        <button type="button" data-action="always">Remove Every Time</button>
        <button type="button" data-action="similar">Remove All Similar</button>
        <button type="button" data-action="preview">Preview</button>
        <button type="button" data-action="another">Select Another Element</button>
        <button type="button" data-action="cancel">Cancel</button>
      </div>
    `;
    dialog.querySelector("#quietnet-zapper-frame").addEventListener("input", (event) => {
      finishPreview();
      selectedIndex = Number(event.target.value || 0);
      updateDialogState();
    });
    dialog.querySelector("[data-action='once']").addEventListener("click", () => removeOnce(currentElement()));
    dialog.querySelector("[data-action='always']").addEventListener("click", () => saveRuleAndRemove(currentElement(), dialog.dataset.exactSelector, "exact"));
    dialog.querySelector("[data-action='similar']").addEventListener("click", () => {
      if (dialog.dataset.similarBroad === "true") {
        QNC.toast("Selector too broad", "QuietNet avoided a similar-elements rule that might break the page.");
        return;
      }
      saveRuleAndRemove(currentElement(), dialog.dataset.similarSelector, "similar");
    });
    dialog.querySelector("[data-action='preview']").addEventListener("click", (event) => togglePreview(event.currentTarget));
    dialog.querySelector("[data-action='another']").addEventListener("click", selectAnotherElement);
    dialog.querySelector("[data-action='cancel']").addEventListener("click", () => stopElementPicker());
    document.documentElement.append(dialog);
    updateDialogState();
  }

  function selectedScope() {
    return dialog && dialog.querySelector("[data-similar-sites]") && dialog.querySelector("[data-similar-sites]").checked ? "similar-sites" : "site";
  }

  function rememberAndHide(elements, reason) {
    const previous = [];
    elements.forEach((element) => {
      if (!element || QNC.isCoreLayout(element)) return;
      previous.push({
        element,
        display: element.style.display,
        visibility: element.style.visibility,
        hidden: element.dataset.quietnetHidden
      });
      QNC.hideElement(element, reason);
    });
    return previous;
  }

  function restorePrevious(previous) {
    (previous || []).forEach((item) => {
      item.element.dataset.quietnetHidden = item.hidden || "false";
      if (!item.hidden) item.element.removeAttribute("data-quietnet-hidden");
      item.element.style.display = item.display || "";
      item.element.style.visibility = item.visibility || "";
    });
  }

  function finishPreview() {
    if (!preview) return;
    restorePrevious(preview.previous);
    if (preview.button && document.documentElement.contains(preview.button)) preview.button.textContent = "Preview";
    preview = null;
  }

  function togglePreview(button) {
    if (preview) {
      finishPreview();
      return;
    }
    const element = currentElement();
    const previous = rememberAndHide([element], "zapper-preview");
    preview = { previous, button };
    button.textContent = "Finish Preview";
    QNC.toast("Previewing removal", "Click Finish Preview to bring it back before saving.");
  }

  function selectAnotherElement() {
    finishPreview();
    if (dialog) dialog.remove();
    dialog = null;
    selectedElement = null;
    selectedChain = [];
    selectedIndex = 0;
    QNC.toast("Select another element", "Hover a new element, then click it.");
  }

  function toastAfterBlock(title, body) {
    QNC.toast(title, body, [
      {
        label: "Undo",
        onClick: undoLastZap
      },
      {
        label: "Dashboard",
        onClick: () => QN.utils.sendMessage({ type: MESSAGE.OPEN_DASHBOARD })
      }
    ]);
  }

  function removeOnce(element) {
    finishPreview();
    if (!element || QNC.isCoreLayout(element)) {
      QNC.toast("Zapper skipped it", "That element is too important to remove safely.");
      stopElementPicker();
      return;
    }
    const previous = rememberAndHide([element], "zapped-once");
    if (previous.length) {
      lastZap = { previous, rule: null };
      QNC.reportMetric({ leftovers: 1 });
      toastAfterBlock("Removed once", "QuietNet zapped that element.");
    }
    stopElementPicker();
  }

  async function saveRuleAndRemove(element, selector, mode) {
    finishPreview();
    const risk = selectorRisk(selector);
    if (!selector || risk.broad || QNC.isCoreLayout(element)) {
      QNC.toast("Selector too broad", risk.message || "QuietNet avoided saving a rule that might break the page.");
      return;
    }
    const scope = selectedScope();
    const matches = QNC.safeSelectorAll(selector);
    const previous = rememberAndHide(matches.length ? matches : [element], "zapped-rule");
    const response = await QN.utils.sendMessage({
      type: MESSAGE.SAVE_ZAPPER_RULE,
      domain: QNC.domain(),
      rule: {
        selector,
        mode,
        scope,
        label: elementLabel(element)
      }
    });
    if (response && response.ok) {
      lastZap = { previous, rule: response.rule };
      QNC.reportMetric({ leftovers: Math.max(1, previous.length) });
      toastAfterBlock("Zapper rule saved", scope === "similar-sites" ? "This rule will also apply on similar sites." : "This rule will run every time on this site.");
    } else {
      restorePrevious(previous);
      QNC.toast("Could not save rule", (response && response.error) || "Try again on this page.");
    }
    stopElementPicker();
  }

  async function undoLastZap() {
    if (!lastZap || !lastZap.previous) return { ok: false };
    restorePrevious(lastZap.previous);
    if (lastZap.rule && lastZap.rule.id) {
      await QN.utils.sendMessage({
        type: MESSAGE.REMOVE_ZAPPER_RULE,
        domain: QNC.domain(),
        ruleId: lastZap.rule.id
      });
    }
    lastZap = null;
    QNC.toast("Undo complete", "The element is back and the saved Zapper rule was removed.");
    return { ok: true };
  }

  function startElementPicker() {
    if (!QNC.isEnabled()) {
      QNC.toast("QuietNet is paused", "Turn protection back on before using Zapper.");
      return { ok: false };
    }
    if (active) return { ok: true };
    active = true;
    document.documentElement.classList.add("quietnet-zapper-active");
    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    QNC.toast("Zapper ready", "Hover an annoying element, then click to remove it.");
    return { ok: true };
  }

  function applyZapperRules() {
    if (global.QuietNetCleaner && global.QuietNetCleaner.applyUserCosmeticRules) {
      return global.QuietNetCleaner.applyUserCosmeticRules();
    }
    return 0;
  }

  QNC.onMessage(MESSAGE.START_ZAPPER, async () => startElementPicker());
  QNC.onMessage(MESSAGE.UNDO_LAST_ZAP, async () => undoLastZap());
  QNC.onConfig(() => applyZapperRules());
  QNC.ready(() => applyZapperRules());

  global.QuietNetZapper = {
    activateZapper: startElementPicker,
    applyUserCosmeticRules: applyZapperRules,
    generateCssSelector,
    highlightHoveredElement: moveHighlight,
    previewElementRemoval: showChoiceDialog,
    saveCosmeticRule: saveRuleAndRemove,
    startElementPicker,
    undoLastZap
  };
})(globalThis);
