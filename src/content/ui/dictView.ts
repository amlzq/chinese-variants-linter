import { getSupportedVariants } from "../../core/rules";
import { escapeHtml } from "../../shared/dom";
import { getVariantLabel, t } from "../../shared/locale";
import {
  MAX_PHRASES_PER_VARIANT,
  PHRASE_PAGE_SIZE,
  buildPhraseTemplateCsv,
  downloadTextFile,
  filterPhrases,
  serializePhraseCsv,
} from "../../shared/phraseCsv";
import { importPhraseFile, pickPhraseFile } from "../../shared/phraseImport";
import {
  addPhrasePatch,
  clearPhrasesPatch,
  removePhrasePatch,
  updatePhrasePatch,
} from "../../shared/settingsHelpers";
import type { ExtensionSettings, ExtensionSettingsPatch, VariantCode } from "../../shared/types";

/**
 * 自定义词典二级页（自定义词组管理）。仅接收数据与回调，不依赖 settingsView，
 * 以避免循环引用；页面切换与共用头部由 settingsView 负责。
 *
 * 页内的变体下拉只决定查看 / 编辑哪一份词典，与外面的「I write in」互不联动。
 */
const NEW_ITEM = "__new__";

export interface DictPageState {
  variant: VariantCode;
  /** 正在编辑的词组 id；NEW_ITEM 表示底部新增中的草稿行。 */
  editingId: string | null;
  menuOpen: boolean;
  /** 搜索词（按原词或替换词匹配）。 */
  query: string;
  /** 当前最多渲染的条数，「显示更多」每次增加一批。 */
  limit: number;
}

export interface DictPageContext {
  getSettings: () => ExtensionSettings | null;
  getState: () => DictPageState;
  update: (patch: ExtensionSettingsPatch) => Promise<void>;
  rerender: () => void;
}

export function createDictPageState(variant: VariantCode): DictPageState {
  return { variant, editingId: null, menuOpen: false, query: "", limit: PHRASE_PAGE_SIZE };
}

export function getDictPageTitle(): string {
  return t("settings.dict.phraseTitle");
}

function getMenuIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="16" height="16"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>`;
}

function getEditRow(id: string, from: string, to: string): string {
  return `
    <div class="cvl-settings-rule-item cvl-dict-edit" data-phrase-id="${escapeHtml(id)}">
      <input class="cvl-settings-input" data-dict-input="editFrom" value="${escapeHtml(from)}" placeholder="${t("settings.dict.phraseFrom")}" />
      <input class="cvl-settings-input" data-dict-input="editTo" value="${escapeHtml(to)}" placeholder="${t("settings.dict.phraseTo")}" />
      <div class="cvl-dict-edit-actions">
        <button class="cvl-settings-btn cvl-settings-btn-sm" data-dict-action="saveItem">${t("settings.dict.save")}</button>
        <button class="cvl-settings-btn cvl-settings-btn-ghost cvl-settings-btn-sm" data-dict-action="cancelEdit">${t("settings.dict.cancel")}</button>
      </div>
    </div>`;
}

/** 搜索框以下的部分（列表、显示更多、页脚）；搜索与分批时只刷新这一块，输入框不会被重建。 */
function getResultsMarkup(settings: ExtensionSettings, state: DictPageState): string {
  const phrases = settings.userDictionary.phrases[state.variant] ?? [];
  const adding = state.editingId === NEW_ITEM;
  const full = phrases.length >= MAX_PHRASES_PER_VARIANT;
  const filtered = filterPhrases(phrases, state.query);
  const visible = filtered.slice(0, state.limit);

  const items = visible.map((phrase) => {
    if (state.editingId === phrase.id) {
      return getEditRow(phrase.id, phrase.from, phrase.to);
    }
    return `
      <div class="cvl-settings-rule-item" data-phrase-id="${escapeHtml(phrase.id)}">
        <div class="cvl-settings-rule-text">
          <span class="cvl-settings-rule-from">${escapeHtml(phrase.from)}</span>
          <span class="cvl-settings-rule-arrow">→</span>
          <span class="cvl-settings-rule-to">${escapeHtml(phrase.to)}</span>
        </div>
        <div class="cvl-dict-item-actions">
          <button class="cvl-settings-btn cvl-settings-btn-ghost cvl-settings-btn-sm" data-dict-action="editItem" data-phrase-id="${escapeHtml(phrase.id)}">${t("settings.dict.edit")}</button>
          <button class="cvl-settings-btn cvl-settings-btn-ghost cvl-settings-btn-sm" data-dict-action="removePhrase" data-phrase-id="${escapeHtml(phrase.id)}">${t("settings.dict.phraseDelete")}</button>
        </div>
      </div>`;
  });
  if (adding) {
    items.push(getEditRow(NEW_ITEM, "", ""));
  }

  let list = items.join("");
  if (items.length === 0) {
    list = `<div class="cvl-settings-empty cvl-dict-empty">${t(phrases.length === 0 ? "settings.dict.phraseEmpty" : "settings.dict.searchEmpty")}</div>`;
  }
  const remaining = filtered.length - visible.length;

  return `
    <div class="cvl-settings-rule-list">${list}</div>
    ${remaining > 0 ? `
    <div class="cvl-dict-more">
      <button class="cvl-settings-btn cvl-settings-btn-ghost cvl-settings-btn-sm" data-dict-action="showMore">${t("settings.dict.showMore", { count: remaining })}</button>
    </div>` : ""}
    ${adding ? "" : `
    <div class="cvl-dict-footer">
      <button class="cvl-settings-btn cvl-settings-btn-ghost cvl-settings-btn-sm" data-dict-action="addItem" ${full ? `disabled title="${t("settings.dict.limitReached", { max: MAX_PHRASES_PER_VARIANT })}"` : ""}>+ ${t("settings.dict.addItem")}</button>
    </div>`}
  `;
}

export function getDictPageMarkup(settings: ExtensionSettings, state: DictPageState): string {
  const options = getSupportedVariants()
    .map((value) => `<option value="${value}" ${value === state.variant ? "selected" : ""}>${getVariantLabel(value)}</option>`)
    .join("");

  return `
    <section class="cvl-settings-section">
      <div class="cvl-dict-toolbar">
        <select class="cvl-settings-select cvl-dict-variant" data-dict-input="dictVariant">${options}</select>
        <div class="cvl-dict-menu">
          <button class="cvl-settings-btn cvl-settings-btn-ghost cvl-settings-btn-sm cvl-dict-menu-btn" data-dict-action="toggleMenu" aria-haspopup="menu" aria-expanded="${state.menuOpen}" aria-label="${t("settings.dict.actions")}" title="${t("settings.dict.actions")}">${getMenuIcon()}</button>
          ${state.menuOpen ? `
          <div class="cvl-dict-menu-list" role="menu">
            <button role="menuitem" data-dict-menu="import">${t("settings.dict.import")}</button>
            <button role="menuitem" data-dict-menu="export">${t("settings.dict.export")}</button>
            <button role="menuitem" data-dict-menu="template">${t("settings.dict.template")}</button>
            <button role="menuitem" data-dict-menu="clear">${t("settings.dict.clear")}</button>
          </div>` : ""}
        </div>
      </div>
      <input class="cvl-settings-input cvl-dict-search" type="search" data-dict-input="dictSearch" value="${escapeHtml(state.query)}" placeholder="${t("settings.dict.searchPlaceholder")}" aria-label="${t("settings.dict.searchPlaceholder")}" />
      <div class="cvl-dict-results">${getResultsMarkup(settings, state)}</div>
    </section>
  `;
}

async function runMenuAction(action: string, ctx: DictPageContext): Promise<void> {
  const settings = ctx.getSettings();
  const state = ctx.getState();
  if (!settings) {
    return;
  }
  const variant = state.variant;

  if (action === "export") {
    downloadTextFile(
      `custom-phrases-${variant}.csv`,
      serializePhraseCsv(settings.userDictionary.phrases[variant] ?? []),
    );
  } else if (action === "template") {
    downloadTextFile("custom-phrases-template.csv", buildPhraseTemplateCsv());
  } else if (action === "clear") {
    if (window.confirm(t("settings.dict.clearConfirm", { variant: getVariantLabel(variant) }))) {
      await ctx.update(clearPhrasesPatch(variant));
    }
  } else if (action === "import") {
    pickPhraseFile((file) => {
      const current = ctx.getSettings();
      if (!current) {
        return;
      }
      void importPhraseFile(file, current, variant).then((patch) => patch && ctx.update(patch));
    });
  }
}

/** 绑定列表区（编辑 / 新增 / 删除 / 显示更多）的事件；列表区被刷新后需重新调用。 */
function bindResultsEvents(body: HTMLElement, ctx: DictPageContext): void {
  const results = body.querySelector<HTMLElement>(".cvl-dict-results");
  if (!results) {
    return;
  }
  const focusEditor = () => body.querySelector<HTMLInputElement>("[data-dict-input='editFrom']")?.focus();

  results.querySelector<HTMLButtonElement>("[data-dict-action='showMore']")?.addEventListener("click", () => {
    const state = ctx.getState();
    state.limit += PHRASE_PAGE_SIZE;
    refreshResults(body, ctx);
  });

  results.querySelector<HTMLButtonElement>("[data-dict-action='addItem']")?.addEventListener("click", () => {
    const state = ctx.getState();
    // 新增草稿行出现在列表末尾，先清掉搜索并展开全部，保证新增后能看到它。
    state.query = "";
    state.limit = Number.MAX_SAFE_INTEGER;
    state.editingId = NEW_ITEM;
    ctx.rerender();
    focusEditor();
  });

  results.querySelectorAll<HTMLButtonElement>("[data-dict-action='editItem']").forEach((btn) => {
    btn.addEventListener("click", () => {
      ctx.getState().editingId = btn.dataset.phraseId ?? null;
      ctx.rerender();
      focusEditor();
    });
  });

  results.querySelector<HTMLButtonElement>("[data-dict-action='cancelEdit']")?.addEventListener("click", () => {
    ctx.getState().editingId = null;
    ctx.rerender();
  });

  const save = async () => {
    const settings = ctx.getSettings();
    const state = ctx.getState();
    const row = results.querySelector<HTMLElement>(".cvl-dict-edit");
    const id = row?.dataset.phraseId;
    const from = results.querySelector<HTMLInputElement>("[data-dict-input='editFrom']")?.value ?? "";
    const to = results.querySelector<HTMLInputElement>("[data-dict-input='editTo']")?.value ?? "";
    if (!settings || !id) {
      return;
    }
    const patch = id === NEW_ITEM
      ? addPhrasePatch(settings, state.variant, from, to)
      : updatePhrasePatch(settings, state.variant, id, from, to);
    if (Object.keys(patch).length === 0) {
      return;
    }
    state.editingId = null;
    await ctx.update(patch);
  };

  results.querySelector<HTMLButtonElement>("[data-dict-action='saveItem']")?.addEventListener("click", () => void save());
  results.querySelectorAll<HTMLInputElement>("[data-dict-input='editFrom'], [data-dict-input='editTo']").forEach((input) => {
    input.addEventListener("keydown", (event) => {
      // 输入法选词时的回车不应触发保存。
      if (event.key === "Enter" && !event.isComposing) {
        event.preventDefault();
        void save();
      }
    });
  });

  results.querySelectorAll<HTMLButtonElement>("[data-dict-action='removePhrase']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.phraseId;
      const settings = ctx.getSettings();
      if (!id || !settings) {
        return;
      }
      await ctx.update(removePhrasePatch(settings, ctx.getState().variant, id));
    });
  });
}

function refreshResults(body: HTMLElement, ctx: DictPageContext): void {
  const results = body.querySelector<HTMLElement>(".cvl-dict-results");
  const settings = ctx.getSettings();
  if (!results || !settings) {
    return;
  }
  results.innerHTML = getResultsMarkup(settings, ctx.getState());
  bindResultsEvents(body, ctx);
}

export function bindDictPageEvents(body: HTMLElement, ctx: DictPageContext): void {
  // 点击菜单以外区域收起菜单。用属性赋值而非 addEventListener，避免重复渲染时叠加监听。
  body.onclick = (event) => {
    const state = ctx.getState();
    if (state.menuOpen && !(event.target as HTMLElement).closest(".cvl-dict-menu")) {
      state.menuOpen = false;
      ctx.rerender();
    }
  };

  body.querySelector<HTMLSelectElement>("[data-dict-input='dictVariant']")?.addEventListener("change", (event) => {
    const state = ctx.getState();
    state.variant = (event.target as HTMLSelectElement).value as VariantCode;
    state.editingId = null;
    state.menuOpen = false;
    state.query = "";
    state.limit = PHRASE_PAGE_SIZE;
    ctx.rerender();
  });

  body.querySelector<HTMLButtonElement>("[data-dict-action='toggleMenu']")?.addEventListener("click", () => {
    const state = ctx.getState();
    state.menuOpen = !state.menuOpen;
    ctx.rerender();
  });

  body.querySelectorAll<HTMLButtonElement>("[data-dict-menu]").forEach((btn) => {
    btn.addEventListener("click", () => {
      ctx.getState().menuOpen = false;
      ctx.rerender();
      void runMenuAction(btn.dataset.dictMenu ?? "", ctx);
    });
  });

  // 搜索只刷新列表区，输入框保持不动，输入法组合输入与光标都不受影响。
  body.querySelector<HTMLInputElement>("[data-dict-input='dictSearch']")?.addEventListener("input", (event) => {
    const state = ctx.getState();
    state.query = (event.target as HTMLInputElement).value;
    state.limit = PHRASE_PAGE_SIZE;
    state.editingId = null;
    refreshResults(body, ctx);
  });

  bindResultsEvents(body, ctx);
}
