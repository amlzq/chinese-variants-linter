import { escapeHtml } from "../../shared/dom";
import { getVariantLabel, t } from "../../shared/locale";
import { removeForceRulePatch } from "../../shared/settingsHelpers";
import type { ExtensionSettings, ExtensionSettingsPatch } from "../../shared/types";

/**
 * 自定义词典二级页（替换规则列表）。仅接收数据与回调，不依赖 settingsView，
 * 以避免循环引用；页面切换与共用头部由 settingsView 负责。
 */
export function getDictPageTitle(): string {
  return t("settings.dict.forceTitle");
}

export function getDictPageMarkup(settings: ExtensionSettings): string {
  const forceRules = settings.userDictionary.forceReplaceRules;
  return `
    <section class="cvl-settings-section">
      <div class="cvl-settings-rule-list">
        ${forceRules.length === 0
      ? `<span class="cvl-settings-empty">${t("settings.dict.forceEmpty")}</span>`
      : forceRules.map((rule) => `
          <div class="cvl-settings-rule-item">
            <div class="cvl-settings-rule-text">
              <span class="cvl-settings-rule-variant">${getVariantLabel(rule.variant)}</span>
              <span class="cvl-settings-rule-from">${escapeHtml(rule.from)}</span>
              <span class="cvl-settings-rule-arrow">→</span>
              <span class="cvl-settings-rule-to">${escapeHtml(rule.to)}</span>
            </div>
            <button class="cvl-settings-btn cvl-settings-btn-ghost cvl-settings-btn-sm" data-dict-action="removeForceRule" data-rule-id="${escapeHtml(rule.id)}">${t("settings.dict.forceDelete")}</button>
          </div>
        `).join("")
    }
      </div>
    </section>
  `;
}

export function bindDictPageEvents(
  body: HTMLElement,
  getSettings: () => ExtensionSettings | null,
  update: (patch: ExtensionSettingsPatch) => Promise<void>,
): void {
  body.querySelectorAll<HTMLButtonElement>("[data-dict-action='removeForceRule']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.ruleId;
      const settings = getSettings();
      if (!id || !settings) {
        return;
      }
      await update(removeForceRulePatch(settings, id));
    });
  });
}
