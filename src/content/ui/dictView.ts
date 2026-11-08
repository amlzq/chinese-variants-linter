import { getSupportedVariants } from "../../core/rules";
import { escapeHtml } from "../../shared/dom";
import { getVariantLabel, t } from "../../shared/locale";
import {
  buildPhraseTemplateCsv,
  downloadTextFile,
  parsePhraseFile,
  serializePhraseCsv,
} from "../../shared/phraseCsv";
import {
  addPhrasePatch,
  clearPhrasesPatch,
  importPhrasesPatch,
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
}

export interface DictPageContext {
  getSettings: () => ExtensionSettings | null;
  getState: () => DictPageState;
  update: (patch: ExtensionSettingsPatch) => Promise<void>;
  rerender: () => void;
}

export function createDictPageState(variant: VariantCode): DictPageState {
  return { variant, editingId: null, menuOpen: false };
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

export function getDictPageMarkup(settings: ExtensionSettings, state: DictPageState): string {
  const phrases = settings.userDictionary.phrases[state.variant] ?? [];
  const adding = state.editingId === NEW_ITEM;

  const items = phrases.map((phrase) => {
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

  const body = items.length === 0
    ? `<div class="cvl-settings-empty cvl-dict-empty">${t("settings.dict.phraseEmpty")}</div>`
    : items.join("");

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
      <div class="cvl-settings-rule-list">${body}</div>
      ${adding ? "" : `
      <div class="cvl-dict-footer">
        <button class="cvl-settings-btn cvl-settings-btn-ghost cvl-settings-btn-sm" data-dict-action="addItem">+ ${t("settings.dict.addItem")}</button>
      </div>`}
    </section>
  `;
}

function pickCsvFile(onText: (text: string) => void, onError: () => void): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv,.txt,.tsv,text/csv,text/plain";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    file.text().then(onText, onError);
  });
  input.click();
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
    pickCsvFile(
      (text) => {
        const current = ctx.getSettings();
        const patch = current ? importPhrasesPatch(current, variant, parsePhraseFile(text)) : {};
        if (Object.keys(patch).length === 0) {
          window.alert(t("settings.dict.importEmpty"));
          return;
        }
        void ctx.update(patch);
      },
      () => window.alert(t("settings.dict.importFailed")),
    );
  }
}

export function bindDictPageEvents(body: HTMLElement, ctx: DictPageContext): void {
  const focusEditor = () => body.querySelector<HTMLInputElement>("[data-dict-input='editFrom']")?.focus();

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

  body.querySelector<HTMLButtonElement>("[data-dict-action='addItem']")?.addEventListener("click", () => {
    ctx.getState().editingId = NEW_ITEM;
    ctx.rerender();
    focusEditor();
  });

  body.querySelectorAll<HTMLButtonElement>("[data-dict-action='editItem']").forEach((btn) => {
    btn.addEventListener("click", () => {
      ctx.getState().editingId = btn.dataset.phraseId ?? null;
      ctx.rerender();
      focusEditor();
    });
  });

  body.querySelector<HTMLButtonElement>("[data-dict-action='cancelEdit']")?.addEventListener("click", () => {
    ctx.getState().editingId = null;
    ctx.rerender();
  });

  const save = async () => {
    const settings = ctx.getSettings();
    const state = ctx.getState();
    const row = body.querySelector<HTMLElement>(".cvl-dict-edit");
    const id = row?.dataset.phraseId;
    const from = body.querySelector<HTMLInputElement>("[data-dict-input='editFrom']")?.value ?? "";
    const to = body.querySelector<HTMLInputElement>("[data-dict-input='editTo']")?.value ?? "";
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

  body.querySelector<HTMLButtonElement>("[data-dict-action='saveItem']")?.addEventListener("click", () => void save());
  body.querySelectorAll<HTMLInputElement>("[data-dict-input='editFrom'], [data-dict-input='editTo']").forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void save();
      }
    });
  });

  body.querySelectorAll<HTMLButtonElement>("[data-dict-action='removePhrase']").forEach((btn) => {
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
