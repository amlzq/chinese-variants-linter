import { useEffect } from "react";
import { getLegalHtml, type LegalKind } from "../../src/shared/legal";
import { t } from "../../src/shared/locale";

interface LegalPageProps {
  kind: LegalKind;
  onBack: () => void;
}

/** 服务条款 / 隐私权政策二级页：与设置页同样的头部（back + 标题），正文来自 TERMS.md / PRIVACY.md。 */
export function LegalPage({ kind, onBack }: LegalPageProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        onBack();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onBack]);

  return (
    <div className="cvl-settings-view">
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
        <h2 className="cvl-settings-title">{t(kind === "terms" ? "settings.legal.terms" : "settings.legal.privacy")}</h2>
      </div>

      <div className="cvl-settings-body">
        {/* 内容来自随扩展打包的 Markdown，渲染前已转义，链接只放行 http(s) 与 mailto。 */}
        <section className="cvl-settings-section cvl-legal" dangerouslySetInnerHTML={{ __html: getLegalHtml(kind) }} />
      </div>
    </div>
  );
}
