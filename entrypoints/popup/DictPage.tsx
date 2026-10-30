import { getVariantLabel, t } from "../../src/shared/locale";
import type { ForceReplaceRule } from "../../src/shared/types";

interface DictPageProps {
  rules: ForceReplaceRule[];
  onRemove: (id: string) => void;
}

/** 自定义词典二级页（替换规则列表）；头部由 App 共用。 */
export function DictPage({ rules, onRemove }: DictPageProps) {
  return (
    <section className="cvl-settings-section">
      <div className="cvl-settings-rule-list">
        {rules.length === 0 ? (
          <span className="cvl-settings-empty">{t("settings.dict.forceEmpty")}</span>
        ) : (
          rules.map((rule) => (
            <div key={rule.id} className="cvl-settings-rule-item">
              <div className="cvl-settings-rule-text">
                <span className="cvl-settings-rule-variant">{getVariantLabel(rule.variant)}</span>
                <span className="cvl-settings-rule-from">{rule.from}</span>
                <span className="cvl-settings-rule-arrow">→</span>
                <span className="cvl-settings-rule-to">{rule.to}</span>
              </div>
              <button
                className="cvl-settings-btn cvl-settings-btn-ghost cvl-settings-btn-sm"
                type="button"
                onClick={() => onRemove(rule.id)}>
                {t("settings.dict.forceDelete")}
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
