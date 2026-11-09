import { getLegalHtml, type LegalKind } from "../../shared/legal";
import { t } from "../../shared/locale";

/**
 * 服务条款 / 隐私权政策二级页。正文来自 TERMS.md / PRIVACY.md（构建时内联），
 * 由 settingsView 放进共用头部下面的 body。
 */
export function getLegalPageTitle(kind: LegalKind): string {
  return t(kind === "terms" ? "settings.legal.terms" : "settings.legal.privacy");
}

export function getLegalPageMarkup(kind: LegalKind): string {
  return `<section class="cvl-settings-section cvl-legal">${getLegalHtml(kind)}</section>`;
}

export function getChevronIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="16" height="16"><polyline points="9 6 15 12 9 18"/></svg>`;
}
