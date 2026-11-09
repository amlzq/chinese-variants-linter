import { getSupportedVariants } from "../../core/rules";
import { getSettings, isSiteEnabled, STORAGE_KEY } from "../../core/storage";
import { escapeHtml } from "../../shared/dom";
import { getShortcutActionLabel, getVariantLabel, t } from "../../shared/locale";
import { toggleSite as sendToggleSite, updateSettings as sendUpdateSettings } from "../../shared/settingsClient";
import {
  addPhrasePatch,
  allowPhrasesPatch,
  removeAllowPhrasePatch,
} from "../../shared/settingsHelpers";
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_ACTIONS,
  type DetectionLevel,
  type ExtensionSettings,
  type ExtensionSettingsPatch,
  type ShortcutAction,
  type ShortcutCombo,
  type VariantCode,
} from "../../shared/types";
import { comboToString, eventToCombo, isModifierKey } from "../shortcuts";
import {
  bindDictPageEvents,
  createDictPageState,
  getDictPageMarkup,
  getDictPageTitle,
  renderDictHeaderActions,
  type DictPageState,
} from "./dictView";
import { getMainPanelView, hideMainPanel, isMainPanelOpen, showReviewView } from "./mainPanel";
import { SETTINGS_VIEW_ID } from "./styles";
import { attachTooltip, hideTooltip } from "./tooltip";

let panel: HTMLDivElement | null = null;
let currentSettings: ExtensionSettings | null = null;
let recordingAction: ShortcutAction | null = null;
let page: "settings" | "dict" = "settings";
let dictState: DictPageState | null = null;

const VARIANTS = getSupportedVariants().map(
  (variant) => [variant, getVariantLabel(variant)] as [VariantCode, string],
);

function getBackIconMarkup(): string {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>
  `;
}

function getCloseIconMarkup(): string {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  `;
}

export function ensureSettingsView(): HTMLDivElement {
  if (panel) {
    return panel;
  }

  panel = document.createElement("div");
  panel.id = SETTINGS_VIEW_ID;
  // 设置视图样式已抽到 settings.css 并改为 .cvl-settings-view class 作用域
  // （与 popup 共用同一套）。页内浮层元素必须带上该 class 才能命中样式。
  panel.classList.add("cvl-settings-view");
  panel.innerHTML = `
    <div class="cvl-settings-header">
      <button class="cvl-settings-back" type="button" data-tooltip="${t("settings.aria.back")}" aria-label="${t("settings.aria.back")}">
        ${getBackIconMarkup()}
      </button>
      <h2 class="cvl-settings-title">${t("settings.title")}</h2>
      <button class="cvl-settings-close" type="button" data-tooltip="${t("settings.aria.close")}" aria-label="${t("settings.aria.close")}">
        ${getCloseIconMarkup()}
      </button>
    </div>
    <div class="cvl-settings-body"></div>
  `;

  // The settings view lives inside #cvl-main-panel; "back" returns to the
  // settings page from the dictionary list (otherwise to review), the close
  // button closes the whole panel.
  panel.querySelector<HTMLButtonElement>(".cvl-settings-back")?.addEventListener("click", goBack);
  panel.querySelector<HTMLButtonElement>(".cvl-settings-close")?.addEventListener("click", hideMainPanel);
  panel.querySelectorAll<HTMLButtonElement>(".cvl-settings-back, .cvl-settings-close").forEach((btn) => {
    attachTooltip(btn);
  });

  return panel;
}

function goBack(): void {
  if (page === "dict") {
    page = "settings";
    renderSettingsView();
    return;
  }
  showReviewView();
}

export function isSettingsViewOpen(): boolean {
  return isMainPanelOpen() && getMainPanelView() === "settings";
}

export async function showSettingsView(): Promise<void> {
  currentSettings = await getSettings();
  recordingAction = null;
  page = "settings";
  const view = ensureSettingsView();
  view.dataset.hidden = "false";
  renderSettingsView();
  document.addEventListener("keydown", onDocumentKeyDown, true);
  storageChanged()?.addListener(onStorageChanged);
}

export function hideSettingsView(): void {
  const view = ensureSettingsView();
  view.dataset.hidden = "true";
  recordingAction = null;
  document.removeEventListener("keydown", onDocumentKeyDown, true);
  storageChanged()?.removeListener(onStorageChanged);
}

function storageChanged(): typeof browser.storage.onChanged | undefined {
  return typeof browser === "undefined" ? undefined : browser.storage?.onChanged;
}

/**
 * 其他标签页（或 popup）改了设置时，同步本面板持有的设置副本。
 * 写入补丁是用这份副本算出来的（如整份词组列表），副本过期会覆盖别处的改动。
 * 正在编辑词组或录制快捷键时只更新数据、不重绘，避免打断用户输入。
 */
function onStorageChanged(changes: Record<string, unknown>, areaName: string): void {
  if (areaName !== "local" || !changes[STORAGE_KEY]) {
    return;
  }
  void getSettings().then((next) => {
    if (!currentSettings || !isSettingsViewOpen()) {
      return;
    }
    if (JSON.stringify(next) === JSON.stringify(currentSettings)) {
      return;
    }
    currentSettings = next;
    const busy = recordingAction !== null || (page === "dict" && dictState?.editingId != null);
    if (!busy) {
      renderSettingsView();
    }
  });
}

function renderSettingsView(): void {
  hideTooltip(true);
  const view = ensureSettingsView();
  const body = view.querySelector<HTMLElement>(".cvl-settings-body");
  if (!body || !currentSettings) {
    return;
  }

  const title = view.querySelector<HTMLElement>(".cvl-settings-title");
  if (title) {
    title.textContent = page === "dict" ? getDictPageTitle() : t("settings.title");
  }

  const scrollTop = body.scrollTop;
  const header = view.querySelector<HTMLElement>(".cvl-settings-header");
  let actionsHost = header?.querySelector<HTMLElement>(".cvl-settings-header-actions") ?? null;

  if (page === "dict") {
    dictState ??= createDictPageState(currentSettings.defaultVariant);
    const ctx = {
      getSettings: () => currentSettings,
      getState: () => dictState!,
      update: updateSettings,
      rerender: renderSettingsView,
    };
    body.innerHTML = getDictPageMarkup(currentSettings, dictState);
    bindDictPageEvents(body, ctx);
    // 词典页的 actions 菜单放在标题栏 trailing 位置、关闭按钮左边。
    if (header && !actionsHost) {
      actionsHost = document.createElement("div");
      actionsHost.className = "cvl-settings-header-actions";
      header.append(actionsHost);
    }
    if (actionsHost) {
      renderDictHeaderActions(actionsHost, view, ctx);
    }
  } else {
    actionsHost?.remove();
    view.onclick = null;
    body.innerHTML = getBodyMarkup();
    bindEvents(body);
  }
  body.scrollTop = scrollTop;
}

function getBodyMarkup(): string {
  if (!currentSettings) {
    return "";
  }

  return `
    ${getVariantSection()}
    ${getDetectionSection()}
    ${getSitesSection()}
    ${getShowOnSelectionSection()}
    ${getEnabledSection()}
    ${getDictionarySection()}
    ${getShortcutsSection()}
    ${getPrivacySection()}
  `;
}

function getVariantSection(): string {
  const s = currentSettings!;
  return `
    <section class="cvl-settings-section">
      <div class="cvl-settings-section-head">
        <h3>${t("settings.iWriteIn")}</h3>
        <p>${t("settings.iWriteIn.desc")}</p>
      </div>
      <select class="cvl-settings-select" data-setting="defaultVariant">
        ${VARIANTS.map(
    ([value, label]) =>
      `<option value="${value}" ${value === s.defaultVariant ? "selected" : ""}>${label}</option>`,
  ).join("")}
      </select>
    </section>
  `;
}

function getDetectionSection(): string {
  const s = currentSettings!;
  return `
    <section class="cvl-settings-section">
      <div class="cvl-settings-section-head">
        <h3>${t("settings.detection.title")}</h3>
        <p>${t("settings.detection.desc")}</p>
      </div>
      <select class="cvl-settings-select" data-setting="detectionLevel">
        <option value="standard" ${s.detectionLevel === "standard" ? "selected" : ""}>${t("level.standard")}</option>
        <option value="relaxed" ${s.detectionLevel === "relaxed" ? "selected" : ""}>${t("level.relaxed")}</option>
      </select>
    </section>
  `;
}

function getEnabledSection(): string {
  const s = currentSettings!;
  return `
    <section class="cvl-settings-section">
      <div class="cvl-settings-row">
        <div class="cvl-settings-row-info">
          <span class="cvl-settings-row-title">${t("settings.enabled.title")}</span>
          <span class="cvl-settings-row-desc">${t("settings.enabled.desc")}</span>
        </div>
        <label class="cvl-settings-toggle">
          <input type="checkbox" data-setting="enabled" ${s.enabled ? "checked" : ""} />
          <span class="cvl-settings-toggle-slider"></span>
        </label>
      </div>
    </section>
  `;
}

function getShowOnSelectionSection(): string {
  const s = currentSettings!;
  return `
    <section class="cvl-settings-section">
      <div class="cvl-settings-row">
        <div class="cvl-settings-row-info">
          <span class="cvl-settings-row-title">${t("settings.showSel.title")}</span>
          <span class="cvl-settings-row-desc">${t("settings.showSel.desc")}</span>
        </div>
        <label class="cvl-settings-toggle">
          <input type="checkbox" data-setting="showOnSelection" ${s.showOnSelection ? "checked" : ""} />
          <span class="cvl-settings-toggle-slider"></span>
        </label>
      </div>
    </section>
  `;
}

function getShortcutsSection(): string {
  const s = currentSettings!;
  return `
    <section class="cvl-settings-section">
      <div class="cvl-settings-section-head">
        <h3>${t("settings.shortcuts.title")}</h3>
        <p>${t("settings.shortcuts.desc")}</p>
      </div>
      <div class="cvl-settings-shortcut-list">
        ${SHORTCUT_ACTIONS.map((action) => {
    const combo = s.shortcuts[action];
    const isRecording = recordingAction === action;
    const comboStr = escapeHtml(comboToString(combo));
    if (isRecording) {
      return `
            <div class="cvl-settings-shortcut-row" data-action="${action}" data-recording="true">
              <div class="cvl-settings-sc-name">${getShortcutActionLabel(action)}</div>
              <div class="cvl-controls-row">
                <input
                  class="cvl-settings-input cvl-settings-sc-input"
                  data-action="${action}"
                  placeholder="${t("settings.shortcuts.recordPlaceholder")}"
                  readonly
                  autofocus
                />
                <button class="cvl-settings-btn cvl-settings-btn-sm cvl-settings-sc-confirm" data-action="${action}" data-shortcut-action="confirm" aria-label="确认">✓</button>
                <button class="cvl-settings-btn cvl-settings-btn-ghost cvl-settings-btn-sm cvl-settings-sc-cancel" data-action="${action}" data-shortcut-action="cancel">✕</button>
              </div>
            </div>`;
    }
    return `
            <div class="cvl-settings-shortcut-row" data-action="${action}">
              <div class="cvl-settings-sc-name">${getShortcutActionLabel(action)}</div>
              <div class="cvl-controls-row">
                ${combo
        ? `<span class="cvl-settings-sc-key">${comboStr}</span>`
        : `<span class="cvl-settings-sc-key" data-empty="true">${t("settings.shortcuts.unset")}</span>`
      }
                <button class="cvl-settings-btn cvl-settings-btn-ghost cvl-settings-btn-sm cvl-settings-sc-edit" data-action="${action}" data-shortcut-action="record">${t("settings.shortcuts.edit")}</button>
              </div>
            </div>`;
  }).join("")}
      </div>
    </section>
  `;
}

function getPrivacySection(): string {
  return `
    <section class="cvl-settings-section">
      <div class="cvl-settings-section-head">
        <h3>${t("settings.privacy.title")}</h3>
        <p>${t("settings.privacy.desc")}</p>
      </div>
    </section>
  `;
}

function getSitesSection(): string {
  const s = currentSettings!;
  const hostname = location.hostname;

  // 「全站点默认开启检查」位于站点开关上方，决定未单独配置站点的默认值。
  const defaultSection = `
    <section class="cvl-settings-section">
      <div class="cvl-settings-row">
        <div class="cvl-settings-row-info">
          <span class="cvl-settings-row-title">${t("settings.sites.defaultOn")}</span>
        </div>
        <label class="cvl-settings-toggle">
          <input type="checkbox" data-default-site ${s.defaultSiteEnabled ? "checked" : ""} />
          <span class="cvl-settings-toggle-slider"></span>
        </label>
      </div>
    </section>`;

  if (!hostname) {
    return `
      ${defaultSection}
      <section class="cvl-settings-section">
        <p class="cvl-settings-empty">${t("settings.sites.unknown")}</p>
      </section>`;
  }

  const siteEnabled = isSiteEnabled(s, hostname);
  return `
    ${defaultSection}
    <section class="cvl-settings-section">
      <div class="cvl-settings-row">
        <div class="cvl-settings-row-info">
          <span class="cvl-settings-row-title">${t("settings.sites.checkOn", { host: escapeHtml(hostname) })}</span>
        </div>
        <label class="cvl-settings-toggle">
          <input type="checkbox" data-site="${escapeHtml(hostname)}" ${siteEnabled ? "checked" : ""} />
          <span class="cvl-settings-toggle-slider"></span>
        </label>
      </div>
    </section>
  `;
}

function getDictionarySection(): string {
  const s = currentSettings!;
  const variant = s.defaultVariant;
  const allowPhrases = s.userDictionary.allowPhrases[variant] ?? [];
  return `
    <section class="cvl-settings-section">
      <div class="cvl-settings-section-head">
        <h3>${t("settings.dict.title")}</h3>
        <p>${t("settings.dict.desc", { variant: getVariantLabel(variant) })}</p>
      </div>

      <div class="cvl-settings-dict-subsection">
        <div class="cvl-settings-dict-subhead">${t("settings.dict.allowTitle")}</div>
        <p class="cvl-settings-empty" style="margin-bottom: 8px;">${t("settings.dict.allowDesc")}</p>
        <div class="cvl-settings-inline-form">
          <input class="cvl-settings-input" data-dict-input="allowPhrase" placeholder="${t("settings.dict.allowPlaceholder")}" />
          <button class="cvl-settings-btn cvl-settings-btn-sm" data-dict-action="addAllowPhrase">${t("settings.dict.allowAdd")}</button>
        </div>
        <div class="cvl-settings-tag-list">
          ${allowPhrases.length === 0
      ? `<span class="cvl-settings-empty">${t("settings.dict.allowEmpty")}</span>`
      : allowPhrases.map((term) => `
              <button class="cvl-settings-tag" data-dict-action="removeAllowPhrase" data-term="${escapeHtml(term)}">${escapeHtml(term)} ×</button>
            `).join("")
    }
        </div>
      </div>

      <div class="cvl-settings-dict-subsection">
        <div class="cvl-settings-dict-subhead">${t("settings.dict.phraseTitle")}</div>
        <p class="cvl-settings-empty" style="margin-bottom: 8px;">${t("settings.dict.phraseDesc")}</p>
        <div class="cvl-settings-phrase-grid">
          <input class="cvl-settings-input" data-dict-input="phraseFrom" placeholder="${t("settings.dict.phraseFrom")}" />
          <input class="cvl-settings-input" data-dict-input="phraseTo" placeholder="${t("settings.dict.phraseTo")}" />
          <div class="cvl-settings-phrase-actions">
            <button class="cvl-settings-btn cvl-settings-btn-sm" data-dict-action="addPhrase">${t("settings.dict.phraseAdd")}</button>
            <button class="cvl-settings-btn cvl-settings-btn-ghost cvl-settings-btn-sm" data-dict-action="openDictList">${t("settings.dict.phraseAll")}</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function bindEvents(body: HTMLElement): void {
  bindToggleEvents(body);
  bindSelectEvents(body);
  bindShortcutEvents(body);
  bindSiteEvents(body);
  bindDictionaryEvents(body);
}

function bindToggleEvents(body: HTMLElement): void {
  body.querySelectorAll<HTMLInputElement>("input[type='checkbox'][data-setting]").forEach((input) => {
    input.addEventListener("change", () => {
      const setting = input.dataset.setting;
      if (setting === "enabled" || setting === "showOnSelection") {
        void updateSettings({ [setting]: input.checked });
      }
    });
  });
}

function bindSelectEvents(body: HTMLElement): void {
  body.querySelectorAll<HTMLSelectElement>("select[data-setting]").forEach((select) => {
    select.addEventListener("change", () => {
      const setting = select.dataset.setting;
      if (setting === "defaultVariant") {
        void updateSettings({ defaultVariant: select.value as VariantCode });
      } else if (setting === "detectionLevel") {
        void updateSettings({ detectionLevel: select.value as DetectionLevel });
      }
    });
  });
}

function bindShortcutEvents(body: HTMLElement): void {
  body.querySelectorAll<HTMLButtonElement>("[data-shortcut-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action as ShortcutAction | undefined;
      if (!action) {
        return;
      }
      const op = btn.dataset.shortcutAction;
      if (op === "record" || op === "confirm") {
        // "Edit" starts recording; "✓" confirms the captured combo.
        if (recordingAction && op === "confirm" && recordingAction === action) {
          commitRecordedCombo(action);
          return;
        }
        startRecording(action);
      } else if (op === "cancel") {
        cancelRecording();
      } else if (op === "clear") {
        void setShortcut(action, null);
      } else if (op === "reset") {
        void setShortcut(action, DEFAULT_SHORTCUTS[action]);
      }
    });
  });

  // Recording input captures keystrokes.
  body.querySelectorAll<HTMLInputElement>(".cvl-settings-sc-input").forEach((input) => {
    input.addEventListener("keydown", onShortcutInputKeydown);
  });
}

let pendingCombo: ShortcutCombo | null = null;

function onShortcutInputKeydown(event: KeyboardEvent): void {
  if (!recordingAction || isModifierKey(event)) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  pendingCombo = eventToCombo(event);
  const input = event.target as HTMLInputElement;
  input.value = comboToString(pendingCombo);
}

function commitRecordedCombo(action: ShortcutAction): void {
  if (!pendingCombo) {
    cancelRecording();
    return;
  }

  const combo = pendingCombo;
  pendingCombo = null;
  // Exit recording state so the row switches back to the display view;
  // setShortcut() triggers a re-render that now reflects the committed combo.
  recordingAction = null;
  void setShortcut(action, combo);
}

function bindSiteEvents(body: HTMLElement): void {
  body
    .querySelectorAll<HTMLInputElement>("input[type='checkbox'][data-default-site]")
    .forEach((input) => {
      input.addEventListener("change", () => {
        void updateSettings({ defaultSiteEnabled: input.checked });
      });
    });

  body.querySelectorAll<HTMLInputElement>("input[type='checkbox'][data-site]").forEach((input) => {
    input.addEventListener("change", () => {
      const site = input.dataset.site;
      if (site) {
        void toggleSite(site, input.checked);
      }
    });
  });
}

function bindDictionaryEvents(body: HTMLElement): void {
  body.querySelector<HTMLButtonElement>("[data-dict-action='addAllowPhrase']")?.addEventListener("click", async () => {
    const input = body.querySelector<HTMLInputElement>("[data-dict-input='allowPhrase']");
    const term = input?.value.trim();
    if (!term || !currentSettings) {
      return;
    }
    const patch = allowPhrasesPatch(currentSettings, term);
    if (Object.keys(patch).length > 0) {
      await updateSettings(patch);
    }
  });

  body.querySelectorAll<HTMLButtonElement>("[data-dict-action='removeAllowPhrase']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const term = btn.dataset.term;
      if (!term || !currentSettings) {
        return;
      }
      await updateSettings(removeAllowPhrasePatch(currentSettings, term));
    });
  });

  body.querySelector<HTMLButtonElement>("[data-dict-action='addPhrase']")?.addEventListener("click", async () => {
    const fromInput = body.querySelector<HTMLInputElement>("[data-dict-input='phraseFrom']");
    const toInput = body.querySelector<HTMLInputElement>("[data-dict-input='phraseTo']");
    const from = fromInput?.value.trim();
    const to = toInput?.value.trim();
    if (!from || !to || !currentSettings) {
      return;
    }
    const patch = addPhrasePatch(currentSettings, currentSettings.defaultVariant, from, to);
    if (Object.keys(patch).length > 0) {
      await updateSettings(patch);
    }
  });

  body.querySelector<HTMLButtonElement>("[data-dict-action='openDictList']")?.addEventListener("click", () => {
    page = "dict";
    // 词典页的变体下拉从「I write in」取初值，之后互不联动。
    dictState = createDictPageState(currentSettings?.defaultVariant ?? "zh-CN");
    body.scrollTop = 0;
    renderSettingsView();
  });

  body.querySelectorAll<HTMLInputElement>("[data-dict-input]").forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        const name = input.dataset.dictInput;
        if (name === "allowPhrase") {
          body.querySelector<HTMLButtonElement>("[data-dict-action='addAllowPhrase']")?.click();
        } else if (name === "phraseFrom" || name === "phraseTo") {
          body.querySelector<HTMLButtonElement>("[data-dict-action='addPhrase']")?.click();
        }
      }
    });
  });
}

async function updateSettings(patch: ExtensionSettingsPatch): Promise<void> {
  const next = await sendUpdateSettings(patch);
  currentSettings = next;
  renderSettingsView();
}

async function toggleSite(hostname: string, enabled: boolean): Promise<void> {
  const next = await sendToggleSite(hostname, enabled);
  currentSettings = next;
  renderSettingsView();
}


async function setShortcut(action: ShortcutAction, combo: ShortcutCombo | null): Promise<void> {
  await updateSettings({ shortcuts: { [action]: combo } });
}

function startRecording(action: ShortcutAction): void {
  recordingAction = action;
  pendingCombo = null;
  renderSettingsView();
  // autofocus attribute does not work on innerHTML-inserted nodes,
  // so focus the recording input manually so keystrokes are captured.
  const input = ensureSettingsView()
    .querySelector<HTMLInputElement>(`.cvl-settings-sc-input[data-action="${action}"]`);
  input?.focus();
}

function cancelRecording(): void {
  pendingCombo = null;
  recordingAction = null;
  renderSettingsView();
}

function onDocumentKeyDown(event: KeyboardEvent): void {
  if (!isSettingsViewOpen()) {
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    if (recordingAction) {
      cancelRecording();
    } else {
      goBack();
    }
    return;
  }

  // During recording, keystrokes are captured by the input's own keydown
  // handler (onShortcutInputKeydown) and only committed when the user
  // clicks the confirm (✓) button. The document handler does not
  // auto-commit, so Esc is the only document-level shortcut here.
}
