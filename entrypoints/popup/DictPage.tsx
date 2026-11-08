import { useState } from "react";
import { getSupportedVariants } from "../../src/core/rules";
import { getVariantLabel, t } from "../../src/shared/locale";
import {
  buildPhraseTemplateCsv,
  downloadTextFile,
  parsePhraseFile,
  serializePhraseCsv,
} from "../../src/shared/phraseCsv";
import {
  addPhrasePatch,
  clearPhrasesPatch,
  importPhrasesPatch,
  removePhrasePatch,
  updatePhrasePatch,
} from "../../src/shared/settingsHelpers";
import type {
  ExtensionSettings,
  ExtensionSettingsPatch,
  VariantCode,
} from "../../src/shared/types";

const NEW_ITEM = "__new__";
const VARIANTS = getSupportedVariants();

interface DictPageProps {
  settings: ExtensionSettings;
  update: (patch: ExtensionSettingsPatch) => Promise<void>;
}

/**
 * 自定义词典二级页；头部由 App 共用。
 * 变体下拉只决定查看 / 编辑哪一份词典，初值取「I write in」，之后互不联动。
 */
export function DictPage({ settings, update }: DictPageProps) {
  const [variant, setVariant] = useState<VariantCode>(settings.defaultVariant);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");

  const phrases = settings.userDictionary.phrases[variant] ?? [];

  function startEdit(id: string, from: string, to: string): void {
    setEditingId(id);
    setDraftFrom(from);
    setDraftTo(to);
  }

  async function save(): Promise<void> {
    if (!editingId) {
      return;
    }
    const patch = editingId === NEW_ITEM
      ? addPhrasePatch(settings, variant, draftFrom, draftTo)
      : updatePhrasePatch(settings, variant, editingId, draftFrom, draftTo);
    if (Object.keys(patch).length === 0) {
      return;
    }
    setEditingId(null);
    await update(patch);
  }

  function onMenu(action: "import" | "export" | "template" | "clear"): void {
    setMenuOpen(false);
    if (action === "export") {
      downloadTextFile(`custom-phrases-${variant}.csv`, serializePhraseCsv(phrases));
    } else if (action === "template") {
      downloadTextFile("custom-phrases-template.csv", buildPhraseTemplateCsv());
    } else if (action === "clear") {
      if (window.confirm(t("settings.dict.clearConfirm", { variant: getVariantLabel(variant) }))) {
        void update(clearPhrasesPatch(variant));
      }
    } else {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".csv,.txt,.tsv,text/csv,text/plain";
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) {
          return;
        }
        file.text().then(
          (text) => {
            const patch = importPhrasesPatch(settings, variant, parsePhraseFile(text));
            if (Object.keys(patch).length === 0) {
              window.alert(t("settings.dict.importEmpty"));
              return;
            }
            void update(patch);
          },
          () => window.alert(t("settings.dict.importFailed")),
        );
      });
      input.click();
    }
  }

  function renderEditor(id: string) {
    return (
      <div key={id} className="cvl-settings-rule-item cvl-dict-edit">
        <input
          className="cvl-settings-input"
          autoFocus
          value={draftFrom}
          placeholder={t("settings.dict.phraseFrom")}
          onChange={(event) => setDraftFrom(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && void save()}
        />
        <input
          className="cvl-settings-input"
          value={draftTo}
          placeholder={t("settings.dict.phraseTo")}
          onChange={(event) => setDraftTo(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && void save()}
        />
        <div className="cvl-dict-edit-actions">
          <button className="cvl-settings-btn cvl-settings-btn-sm" type="button" onClick={() => void save()}>
            {t("settings.dict.save")}
          </button>
          <button
            className="cvl-settings-btn cvl-settings-btn-ghost cvl-settings-btn-sm"
            type="button"
            onClick={() => setEditingId(null)}>
            {t("settings.dict.cancel")}
          </button>
        </div>
      </div>
    );
  }

  const adding = editingId === NEW_ITEM;
  const empty = phrases.length === 0 && !adding;

  return (
    <section className="cvl-settings-section" onClick={() => menuOpen && setMenuOpen(false)}>
      <div className="cvl-dict-toolbar">
        <select
          className="cvl-settings-select cvl-dict-variant"
          value={variant}
          onChange={(event) => {
            setVariant(event.target.value as VariantCode);
            setEditingId(null);
          }}>
          {VARIANTS.map((value) => (
            <option key={value} value={value}>
              {getVariantLabel(value)}
            </option>
          ))}
        </select>
        <div className="cvl-dict-menu" onClick={(event) => event.stopPropagation()}>
          <button
            className="cvl-settings-btn cvl-settings-btn-ghost cvl-settings-btn-sm cvl-dict-menu-btn"
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={t("settings.dict.actions")}
            title={t("settings.dict.actions")}
            onClick={() => setMenuOpen(!menuOpen)}>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="16" height="16">
              <circle cx="5" cy="12" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="19" cy="12" r="1.8" />
            </svg>
          </button>
          {menuOpen && (
            <div className="cvl-dict-menu-list" role="menu">
              <button role="menuitem" type="button" onClick={() => onMenu("import")}>{t("settings.dict.import")}</button>
              <button role="menuitem" type="button" onClick={() => onMenu("export")}>{t("settings.dict.export")}</button>
              <button role="menuitem" type="button" onClick={() => onMenu("template")}>{t("settings.dict.template")}</button>
              <button role="menuitem" type="button" onClick={() => onMenu("clear")}>{t("settings.dict.clear")}</button>
            </div>
          )}
        </div>
      </div>

      <div className="cvl-settings-rule-list">
        {empty && <div className="cvl-settings-empty cvl-dict-empty">{t("settings.dict.phraseEmpty")}</div>}
        {phrases.map((phrase) =>
          editingId === phrase.id ? (
            renderEditor(phrase.id)
          ) : (
            <div key={phrase.id} className="cvl-settings-rule-item">
              <div className="cvl-settings-rule-text">
                <span className="cvl-settings-rule-from">{phrase.from}</span>
                <span className="cvl-settings-rule-arrow">→</span>
                <span className="cvl-settings-rule-to">{phrase.to}</span>
              </div>
              <div className="cvl-dict-item-actions">
                <button
                  className="cvl-settings-btn cvl-settings-btn-ghost cvl-settings-btn-sm"
                  type="button"
                  onClick={() => startEdit(phrase.id, phrase.from, phrase.to)}>
                  {t("settings.dict.edit")}
                </button>
                <button
                  className="cvl-settings-btn cvl-settings-btn-ghost cvl-settings-btn-sm"
                  type="button"
                  onClick={() => void update(removePhrasePatch(settings, variant, phrase.id))}>
                  {t("settings.dict.phraseDelete")}
                </button>
              </div>
            </div>
          ),
        )}
        {adding && renderEditor(NEW_ITEM)}
      </div>

      {!adding && (
        <div className="cvl-dict-footer">
          <button
            className="cvl-settings-btn cvl-settings-btn-ghost cvl-settings-btn-sm"
            type="button"
            onClick={() => startEdit(NEW_ITEM, "", "")}>
            + {t("settings.dict.addItem")}
          </button>
        </div>
      )}
    </section>
  );
}
