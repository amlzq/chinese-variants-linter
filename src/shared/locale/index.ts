import type { ShortcutAction, VariantCode } from "../types";
import { messages } from "./messages";
import type { Region } from "./types";

export type { Region } from "./types";

/** 模块级当前地区，渲染前由调用方通过 setRegion 设定。 */
let currentRegion: Region = "CN";

export function setRegion(region: Region): void {
  currentRegion = region;
}

export function getRegion(): Region {
  return currentRegion;
}

/**
 * 根据浏览器/扩展界面语言推断初始地区。
 * - 中文（繁体体系：TW / HK / MO）与地区变体（SG / MY）按具体代码匹配。
 * - 其它中文（含 zh-CN 等简体）回退为 CN（简体中文）。
 * - 英文界面语言回退为 EN（英文界面）。
 * - 无法识别的语言回退为 CN。
 */
export function detectDefaultRegion(): Region {
  try {
    const lang =
      (typeof browser !== "undefined" && browser.i18n?.getUILanguage?.()) ||
      (typeof navigator !== "undefined" ? navigator.language : "") ||
      "";
    const lower = lang.toLowerCase();
    if (lower.startsWith("en")) return "EN";
    if (lower.includes("tw") || lower.includes("hant")) return "TW";
    if (lower.includes("hk")) return "HK";
    if (lower.includes("mo")) return "MO";
    if (lower.includes("sg")) return "SG";
    if (lower.includes("my")) return "MY";
    return "CN";
  } catch {
    return "CN";
  }
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

/**
 * 取当前地区的文案；缺失时回退到 CN；再缺失时返回 key 本身（便于发现遗漏）。
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const table = messages[currentRegion] ?? messages.CN;
  const value = table[key] ?? messages.CN[key] ?? key;
  return interpolate(value, params);
}

/**
 * 扩展的对外名称，唯一数据源为 manifest 的 `__MSG_extName__`（即 _locales 中的 extName）。
 * 弹窗标题、弹窗窗口标题均引用此处，避免与扩展名出现不一致。
 */
export function getExtensionName(): string {
  try {
    if (typeof browser !== "undefined") {
      const name = browser.i18n.getMessage("extName");
      if (name) return name;
    }
  } catch {
    // 忽略异常，使用回退值
  }
  return "Chinese Variants Linter";
}

/** 取目标转换变体的本地化名称。 */
export function getVariantLabel(code: VariantCode): string {
  return t(`variant.${code}`);
}

/** 取快捷键操作的本地化名称。 */
export function getShortcutActionLabel(action: ShortcutAction): string {
  return t(`shortcut.${action}.label`);
}

/** 取快捷键操作的本地化说明。 */
export function getShortcutDescription(action: ShortcutAction): string {
  return t(`shortcut.${action}.desc`);
}
