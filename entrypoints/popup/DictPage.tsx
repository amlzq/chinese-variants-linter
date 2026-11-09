import { useEffect, useRef, useState } from "react";
import { getSupportedVariants } from "../../src/core/rules";
import { getVariantLabel, t } from "../../src/shared/locale";
import {
  MAX_PHRASES_PER_VARIANT,
  PHRASE_PAGE_SIZE,
  buildPhraseTemplateCsv,
  downloadTextFile,
  filterPhrases,
  serializePhraseCsv,
} from "../../src/shared/phraseCsv";
import { importPhraseFile, pickPhraseFile } from "../../src/shared/phraseImport";
import {
  addPhrasePatch,
  clearPhrasesPatch,
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
  onBack: () => void;
}

/**
 * 自定义词典二级页：自带与设置页同样的头部（back + 标题），trailing 位置放 actions 菜单。
 * 变体下拉只决定查看 / 编辑哪一份词典，初值取「I write in」，之后互不联动。
 */
export function DictPage({ settings, update, onBack }: DictPageProps) {
  const [variant, setVariant] = useState<VariantCode>(settings.defaultVariant);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PHRASE_PAGE_SIZE);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // 展开后输入框才可见，等渲染提交后再聚焦。
  useEffect(() => {
    if (searchOpen) {
      searchRef.current?.focus();
    }
  }, [searchOpen]);

  const phrases = settings.userDictionary.phrases[variant] ?? [];
  const filtered = filterPhrases(phrases, query);
  const visible = filtered.slice(0, limit);
  const remaining = filtered.length - visible.length;

  function startEdit(id: string, from: string, to: string): void {
    if (id === NEW_ITEM) {
      // 新增草稿行出现在列表末尾，先清掉搜索并展开全部，保证新增后能看到它。
      setQuery("");
      setSearchOpen(false);
      setLimit(Number.MAX_SAFE_INTEGER);
    }
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
      pickPhraseFile((file) => {
        void importPhraseFile(file, settings, variant).then((patch) => patch && update(patch));
      });
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
          onKeyDown={(event) => event.key === "Enter" && !event.nativeEvent.isComposing && void save()}
        />
        <input
          className="cvl-settings-input"
          value={draftTo}
          placeholder={t("settings.dict.phraseTo")}
          onChange={(event) => setDraftTo(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && !event.nativeEvent.isComposing && void save()}
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
  const empty = visible.length === 0 && !adding;
  const full = phrases.length >= MAX_PHRASES_PER_VARIANT;

  return (
    <div className="cvl-settings-view" onClick={() => menuOpen && setMenuOpen(false)}>
      <div className="cvl-settings-header">
        <button
          className="cvl-settings-back"
          type="button"
          aria-label={t("settings.aria.back")}
          title={t("settings.aria.back")}
          onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <h2 className="cvl-settings-title">{t("settings.dict.phraseTitle")}</h2>
        <div className="cvl-settings-header-actions">
          <div className="cvl-dict-menu" onClick={(event) => event.stopPropagation()}>
            <button
              className="cvl-dict-menu-btn"
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
      </div>

      <div className="cvl-settings-body">
    <section className="cvl-settings-section">
      <div className="cvl-dict-toolbar" data-search={searchOpen || query ? "open" : "closed"}>
        <select
          className="cvl-settings-select cvl-dict-variant"
          value={variant}
          onChange={(event) => {
            setVariant(event.target.value as VariantCode);
            setEditingId(null);
            setQuery("");
            setSearchOpen(false);
            setLimit(PHRASE_PAGE_SIZE);
          }}>
          {VARIANTS.map((value) => (
            <option key={value} value={value}>
              {getVariantLabel(value)}
            </option>
          ))}
        </select>
        <button
          className="cvl-dict-search-btn"
          type="button"
          aria-label={t("settings.dict.searchPlaceholder")}
          title={t("settings.dict.searchPlaceholder")}
          onClick={() => setSearchOpen(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="16" height="16">
            <circle cx="11" cy="11" r="7" />
            <line x1="20" y1="20" x2="16.5" y2="16.5" />
          </svg>
        </button>
        <input
          ref={searchRef}
          className="cvl-settings-input cvl-dict-search"
          type="search"
          value={query}
          placeholder={t("settings.dict.searchPlaceholder")}
          aria-label={t("settings.dict.searchPlaceholder")}
          onChange={(event) => {
            setQuery(event.target.value);
            setLimit(PHRASE_PAGE_SIZE);
            setEditingId(null);
          }}
          onBlur={() => query === "" && setSearchOpen(false)}
        />
      </div>

      <div className="cvl-settings-rule-list">
        {empty && (
          <div className="cvl-settings-empty cvl-dict-empty">
            {t(phrases.length === 0 ? "settings.dict.phraseEmpty" : "settings.dict.searchEmpty")}
          </div>
        )}
        {visible.map((phrase) =>
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

      {remaining > 0 && (
        <div className="cvl-dict-more">
          <button
            className="cvl-settings-btn cvl-settings-btn-ghost cvl-settings-btn-sm"
            type="button"
            onClick={() => setLimit(limit + PHRASE_PAGE_SIZE)}>
            {t("settings.dict.showMore", { count: remaining })}
          </button>
        </div>
      )}

      {!adding && (
        <div className="cvl-dict-footer">
          <button
            className="cvl-settings-btn cvl-settings-btn-ghost cvl-settings-btn-sm"
            type="button"
            disabled={full}
            title={full ? t("settings.dict.limitReached", { max: MAX_PHRASES_PER_VARIANT }) : undefined}
            onClick={() => startEdit(NEW_ITEM, "", "")}>
            + {t("settings.dict.addItem")}
          </button>
        </div>
      )}
    </section>

      </div>
    </div>
  );
}
