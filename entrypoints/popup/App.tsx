import { useEffect, useMemo, useState } from "react";
import {
  comboToString,
  eventToCombo,
  isModifierKey,
} from "../../src/content/shortcuts";
import { getSupportedVariants } from "../../src/core/rules";
import {
  SHORTCUT_ACTIONS,
  type ExtensionSettings,
  type ExtensionSettingsPatch,
  type PopupState,
  type ShortcutAction,
  type ShortcutCombo,
  type VariantCode,
} from "../../src/shared/types";
import {
  detectDefaultRegion,
  getExtensionName,
  getShortcutActionLabel,
  getVariantLabel,
  setRegion,
  t,
} from "../../src/shared/locale";
import { toggleSite as sendToggleSite, updateSettings as sendUpdateSettings } from "../../src/shared/settingsClient";
import {
  addForceRulePatch,
  allowTermsPatch,
  removeAllowTermPatch,
  removeForceRulePatch,
} from "../../src/shared/settingsHelpers";
import "../../src/content/ui/settings.css";
import { DictPage } from "./DictPage";

const VARIANTS = getSupportedVariants().map(
  (variant) => [variant, getVariantLabel(variant)] as [VariantCode, string],
);

function App() {
  const [popupState, setPopupState] = useState<PopupState | null>(null);
  const [loading, setLoading] = useState(true);
  const [newAllowTerm, setNewAllowTerm] = useState("");
  const [forceVariant, setForceVariant] = useState<VariantCode>("zh-TW");
  const [forceFrom, setForceFrom] = useState("");
  const [forceTo, setForceTo] = useState("");
  const [page, setPage] = useState<"settings" | "dict">("settings");

  useEffect(() => {
    void browser.runtime.sendMessage({ type: "popup/get-state" }).then((result: PopupState) => {
      setPopupState(result);
      setForceVariant(result.settings.defaultVariant);
      setLoading(false);
    });
  }, []);

  const settings = popupState?.settings;
  setRegion(detectDefaultRegion());
  const allowTerms = useMemo(() => {
    if (!settings) {
      return [];
    }

    return settings.userDictionary.allowTerms[settings.defaultVariant] ?? [];
  }, [settings]);
  const forceRules = settings?.userDictionary.forceReplaceRules ?? [];

  async function updateSettings(patch: ExtensionSettingsPatch): Promise<void> {
    const next = await sendUpdateSettings(patch);
    setPopupState((current) =>
      current
        ? {
          ...current,
          settings: next,
          siteEnabled: current.hostname
            ? next.siteEnabledMap[current.hostname] ?? next.defaultSiteEnabled
            : current.siteEnabled,
        }
        : current,
    );
  }

  async function toggleSite(enabled: boolean): Promise<void> {
    if (!popupState?.hostname) {
      return;
    }

    const next = await sendToggleSite(popupState.hostname, enabled);
    setPopupState((current) =>
      current
        ? {
          ...current,
          settings: next,
          siteEnabled: enabled,
        }
        : current,
    );
  }

  async function addAllowTerm(): Promise<void> {
    if (!settings || !newAllowTerm.trim()) {
      return;
    }

    const patch = allowTermsPatch(settings, newAllowTerm);
    if (Object.keys(patch).length > 0) {
      await updateSettings(patch);
    }
    setNewAllowTerm("");
  }

  async function removeAllowTerm(term: string): Promise<void> {
    if (!settings) {
      return;
    }

    await updateSettings(removeAllowTermPatch(settings, term));
  }

  async function addForceRule(): Promise<void> {
    if (!settings) {
      return;
    }

    const patch = addForceRulePatch(settings, forceVariant, forceFrom, forceTo);
    if (Object.keys(patch).length > 0) {
      await updateSettings(patch);
    }
    setForceFrom("");
    setForceTo("");
  }

  async function removeForceRule(id: string): Promise<void> {
    if (!settings) {
      return;
    }

    await updateSettings(removeForceRulePatch(settings, id));
  }

  const [recording, setRecording] = useState<ShortcutAction | null>(null);
  const [pendingCombo, setPendingCombo] = useState<ShortcutCombo | null>(null);

  useEffect(() => {
    if (!recording) {
      return;
    }

    function onCapture(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setPendingCombo(null);
        setRecording(null);
      }
    }

    window.addEventListener("keydown", onCapture, true);
    return () => window.removeEventListener("keydown", onCapture, true);
  }, [recording]);

  function startRecording(action: ShortcutAction): void {
    setRecording(action);
    setPendingCombo(null);
  }

  function cancelRecording(): void {
    setPendingCombo(null);
    setRecording(null);
  }

  function confirmCombo(action: ShortcutAction): void {
    if (!pendingCombo) {
      cancelRecording();
      return;
    }

    const combo = pendingCombo;
    setPendingCombo(null);
    setRecording(null);
    void updateSettings({ shortcuts: { [action]: combo } });
  }

  function onShortcutInputKeydown(event: KeyboardEvent): void {
    if (isModifierKey(event) || event.key === "Escape") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setPendingCombo(eventToCombo(event));
  }

  if (loading || !popupState || !settings) {
    return (
      <div className="cvl-settings-view">
        <div className="cvl-settings-body" style={{ padding: 16 }}>
          {t("popup.loading")}
        </div>
      </div>
    );
  }

  if (page === "dict") {
    return (
      <div className="cvl-settings-view">
        <div className="cvl-settings-header">
          <button
            className="cvl-settings-back"
            type="button"
            aria-label={t("settings.aria.back")}
            title={t("settings.aria.back")}
            onClick={() => setPage("settings")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <h2 className="cvl-settings-title">{t("settings.dict.forceTitle")}</h2>
        </div>

        <div className="cvl-settings-body">
          <DictPage rules={forceRules} onRemove={(id) => void removeForceRule(id)} />
        </div>
      </div>
    );
  }

  return (
    <div className="cvl-settings-view">
      <div className="cvl-settings-header">
        <h2 className="cvl-settings-title">{getExtensionName()}</h2>
      </div>

      <div className="cvl-settings-body">
        <section className="cvl-settings-section">
          <div className="cvl-settings-section-head">
            <h3>{t("settings.iWriteIn")}</h3>
            <p>{t("settings.iWriteIn.desc")}</p>
          </div>
          <select
            className="cvl-settings-select"
            value={settings.defaultVariant}
            onChange={(event) =>
              void updateSettings({ defaultVariant: event.target.value as VariantCode })
            }>
            {VARIANTS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </section>

        <section className="cvl-settings-section">
          <div className="cvl-settings-section-head">
            <h3>{t("settings.detection.title")}</h3>
            <p>{t("settings.detection.desc")}</p>
          </div>
          <select
            className="cvl-settings-select"
            value={settings.detectionLevel}
            onChange={(event) =>
              void updateSettings({
                detectionLevel: event.target.value as ExtensionSettings["detectionLevel"],
              })
            }>
            <option value="standard">{t("level.standard")}</option>
            <option value="relaxed">{t("level.relaxed")}</option>
          </select>
        </section>

        <section className="cvl-settings-section">
          <div className="cvl-settings-row">
            <div className="cvl-settings-row-info">
              <span className="cvl-settings-row-title">{t("settings.sites.defaultOn")}</span>
            </div>
            <label className="cvl-settings-toggle">
              <input
                type="checkbox"
                checked={settings.defaultSiteEnabled}
                onChange={(event) =>
                  void updateSettings({ defaultSiteEnabled: event.target.checked })
                }
              />
              <span className="cvl-settings-toggle-slider" />
            </label>
          </div>
        </section>

        {popupState.hostname ? (
          <section className="cvl-settings-section">
            <div className="cvl-settings-row">
              <div className="cvl-settings-row-info">
                <span className="cvl-settings-row-title">
                  {t("settings.sites.checkOn", { host: popupState.hostname })}
                </span>
              </div>
              <label className="cvl-settings-toggle">
                <input
                  type="checkbox"
                  checked={popupState.siteEnabled}
                  onChange={(event) => void toggleSite(event.target.checked)}
                />
                <span className="cvl-settings-toggle-slider" />
              </label>
            </div>
          </section>
        ) : (
          <section className="cvl-settings-section">
            <p className="cvl-settings-empty">{t("settings.sites.unknown")}</p>
          </section>
        )}

        <section className="cvl-settings-section">
          <div className="cvl-settings-row">
            <div className="cvl-settings-row-info">
              <span className="cvl-settings-row-title">{t("settings.showSel.title")}</span>
              <span className="cvl-settings-row-desc">{t("settings.showSel.desc")}</span>
            </div>
            <label className="cvl-settings-toggle">
              <input
                type="checkbox"
                checked={settings.showOnSelection}
                onChange={(event) => void updateSettings({ showOnSelection: event.target.checked })}
              />
              <span className="cvl-settings-toggle-slider" />
            </label>
          </div>
        </section>

        <section className="cvl-settings-section">
          <div className="cvl-settings-row">
            <div className="cvl-settings-row-info">
              <span className="cvl-settings-row-title">{t("settings.enabled.title")}</span>
              <span className="cvl-settings-row-desc">{t("settings.enabled.desc")}</span>
            </div>
            <label className="cvl-settings-toggle">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(event) => void updateSettings({ enabled: event.target.checked })}
              />
              <span className="cvl-settings-toggle-slider" />
            </label>
          </div>
        </section>

        <section className="cvl-settings-section">
          <div className="cvl-settings-section-head">
            <h3>{t("settings.dict.title")}</h3>
            <p>{t("settings.dict.desc", { variant: getVariantLabel(settings.defaultVariant) })}</p>
          </div>

          <div className="cvl-settings-dict-subsection">
            <div className="cvl-settings-dict-subhead">{t("settings.dict.allowTitle")}</div>
            <p className="cvl-settings-empty" style={{ marginBottom: 8 }}>
              {t("settings.dict.allowDesc")}
            </p>
            <div className="cvl-settings-inline-form">
              <input
                className="cvl-settings-input"
                value={newAllowTerm}
                onChange={(event) => setNewAllowTerm(event.target.value)}
                placeholder={t("settings.dict.allowPlaceholder")}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void addAllowTerm();
                  }
                }}
              />
              <button
                className="cvl-settings-btn cvl-settings-btn-sm"
                type="button"
                onClick={() => void addAllowTerm()}>
                {t("settings.dict.allowAdd")}
              </button>
            </div>
            <div className="cvl-settings-tag-list">
              {allowTerms.length === 0 ? (
                <span className="cvl-settings-empty">{t("settings.dict.allowEmpty")}</span>
              ) : (
                allowTerms.map((term) => (
                  <button
                    key={term}
                    className="cvl-settings-tag"
                    type="button"
                    onClick={() => void removeAllowTerm(term)}>
                    {term} ×
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="cvl-settings-dict-subsection">
            <div className="cvl-settings-dict-subhead">{t("settings.dict.forceTitle")}</div>
            <p className="cvl-settings-empty" style={{ marginBottom: 8 }}>
              {t("settings.dict.forceDesc")}
            </p>
            <div className="cvl-settings-force-grid">
              <select
                className="cvl-settings-select"
                value={forceVariant}
                style={{ gridColumn: "span 2" }}
                onChange={(event) => setForceVariant(event.target.value as VariantCode)}>
                {VARIANTS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                className="cvl-settings-input"
                value={forceFrom}
                onChange={(event) => setForceFrom(event.target.value)}
                placeholder={t("settings.dict.forceFrom")}
              />
              <input
                className="cvl-settings-input"
                value={forceTo}
                onChange={(event) => setForceTo(event.target.value)}
                placeholder={t("settings.dict.forceTo")}
              />
              <div className="cvl-settings-force-actions">
                <button
                  className="cvl-settings-btn cvl-settings-btn-sm"
                  type="button"
                  onClick={() => void addForceRule()}>
                  {t("settings.dict.forceAdd")}
                </button>
                <button
                  className="cvl-settings-btn cvl-settings-btn-ghost cvl-settings-btn-sm"
                  type="button"
                  onClick={() => setPage("dict")}>
                  {t("settings.dict.forceAll")}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="cvl-settings-section">
          <div className="cvl-settings-section-head">
            <h3>{t("settings.shortcuts.title")}</h3>
            <p>{t("settings.shortcuts.desc")}</p>
          </div>
          <div className="cvl-settings-shortcut-list">
            {SHORTCUT_ACTIONS.map((action) => {
              const combo = settings.shortcuts[action];
              const isRecording = recording === action;
              return (
                <div
                  className="cvl-settings-shortcut-row"
                  key={action}
                  data-recording={isRecording ? "true" : "false"}>
                  <div className="cvl-settings-sc-name">{getShortcutActionLabel(action)}</div>
                  <div className="cvl-controls-row">
                    {isRecording ? (
                      <>
                        <input
                          className="cvl-settings-input cvl-settings-sc-input"
                          data-action={action}
                          placeholder={t("settings.shortcuts.recordPlaceholder")}
                          readOnly
                          autoFocus
                          value={pendingCombo ? comboToString(pendingCombo) : ""}
                          onKeyDown={(event) => onShortcutInputKeydown(event.nativeEvent)}
                        />
                        <button
                          className="cvl-settings-btn cvl-settings-btn-sm cvl-settings-sc-confirm"
                          type="button"
                          data-action={action}
                          data-shortcut-action="confirm"
                          aria-label={t("settings.shortcuts.confirm")}
                          onClick={() => confirmCombo(action)}>
                          {t("settings.shortcuts.confirm")}
                        </button>
                        <button
                          className="cvl-settings-btn cvl-settings-btn-ghost cvl-settings-btn-sm cvl-settings-sc-cancel"
                          type="button"
                          data-action={action}
                          data-shortcut-action="cancel"
                          aria-label={t("settings.shortcuts.cancel")}
                          onClick={cancelRecording}>
                          {t("settings.shortcuts.cancel")}
                        </button>
                      </>
                    ) : (
                      <>
                        {combo ? (
                          <span className="cvl-settings-sc-key">{comboToString(combo)}</span>
                        ) : (
                          <span
                            className="cvl-settings-sc-key"
                            data-empty="true">
                            {t("settings.shortcuts.unset")}
                          </span>
                        )}
                        <button
                          className="cvl-settings-btn cvl-settings-btn-ghost cvl-settings-btn-sm cvl-settings-sc-edit"
                          type="button"
                          data-action={action}
                          data-shortcut-action="record"
                          onClick={() => startRecording(action)}>
                          {t("settings.shortcuts.edit")}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="cvl-settings-section">
          <div className="cvl-settings-section-head">
            <h3>{t("settings.privacy.title")}</h3>
            <p>{t("settings.privacy.desc")}</p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
