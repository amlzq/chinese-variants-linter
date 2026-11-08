import {
  DEFAULT_SHORTCUTS,
  type ExtensionSettings,
  type ExtensionSettingsPatch,
  type CustomPhrase,
  type ShortcutMap,
  type UserDictionary,
  type VariantCode,
} from "../../shared/types";
export const STORAGE_KEY = "extension-settings";

export const VARIANT_LABELS: Record<VariantCode, string> = {
  "zh-CN": "简体中文",
  "zh-TW": "中文（台湾）",
  "zh-HK": "中文（香港）",
  "zh-Hant": "繁体中文",
};

export const DEFAULT_USER_DICTIONARY: UserDictionary = {
  allowTerms: {
    "zh-CN": [],
    "zh-TW": [],
    "zh-HK": [],
    "zh-Hant": [],
  },
  phrases: {
    "zh-CN": [],
    "zh-TW": [],
    "zh-HK": [],
    "zh-Hant": [],
  },
};

/**
 * 根据 navigator.language 推断默认目标变体。
 * 无法识别或非中文时回退到 zh-CN（简体中文）。
 */
function detectDefaultVariant(): VariantCode {
  try {
    const lang = (navigator.language || "").toLowerCase();
    if (lang.startsWith("zh")) {
      if (lang.includes("tw")) return "zh-TW";
      if (lang.includes("hk") || lang.includes("mo")) return "zh-HK";
      if (lang.includes("hant")) return "zh-Hant";
      return "zh-CN";
    }
  } catch {
    // navigator.language 不可用
  }
  return "zh-CN";
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: true,
  defaultVariant: detectDefaultVariant(),
  detectionLevel: "standard",
  // 全站点默认关闭检查，用户可整体开启或按站点单独覆盖。
  defaultSiteEnabled: false,
  // 站点级显式开关；未出现的站点跟随 defaultSiteEnabled。
  siteEnabledMap: {},
  userDictionary: DEFAULT_USER_DICTIONARY,
  showOnSelection: true,
  shortcuts: { ...DEFAULT_SHORTCUTS },
};

const VARIANT_CODES: readonly VariantCode[] = ["zh-CN", "zh-TW", "zh-HK", "zh-Hant"];
const MAX_DICTIONARY_TERMS = 1000;
const MAX_DICTIONARY_PHRASES = 1000;

/**
 * 将任意存储值收拢为字符串数组（纵深防御）：
 * - 仅接受数组，忽略被污染存储中可能写入的字符串 / 数字等。
 * - 仅保留非空字符串，去前后空白、去重、截断上限。
 * 避免旧实现对非数组调用 `new Set(...)` 抛错或将字符串拆成单字符。
 */
function coerceStringList(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of input) {
    if (typeof item !== "string") {
      continue;
    }
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= MAX_DICTIONARY_TERMS) {
      break;
    }
  }
  return out;
}

function normalizeAllowTerms(dictionary?: Partial<UserDictionary>): UserDictionary["allowTerms"] {
  return {
    "zh-CN": coerceStringList(dictionary?.allowTerms?.["zh-CN"]),
    "zh-TW": coerceStringList(dictionary?.allowTerms?.["zh-TW"]),
    "zh-HK": coerceStringList(dictionary?.allowTerms?.["zh-HK"]),
    "zh-Hant": coerceStringList(dictionary?.allowTerms?.["zh-Hant"]),
  };
}

/**
 * 深度防御已保存的自定义词组（纵深防御）：
 * - 仅接受对象数组；逐条校验 from/to 为字符串（忽略非字符串，避免 `.trim()` 抛错）。
 * - 丢弃 from 为空的词组；trim 两端空白。
 * - 截断词组数量上限，避免超大数组造成内存 / 性能问题。
 */
function normalizePhraseList(items?: unknown): CustomPhrase[] {
  if (!Array.isArray(items)) {
    return [];
  }
  const out: CustomPhrase[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const candidate = item as Partial<CustomPhrase>;
    const from = typeof candidate.from === "string" ? candidate.from.trim() : "";
    const to = typeof candidate.to === "string" ? candidate.to.trim() : "";
    if (!from) {
      continue;
    }
    out.push({
      id: typeof candidate.id === "string" && candidate.id ? candidate.id : `phrase-${out.length}`,
      from,
      to,
      enabled: candidate.enabled !== false,
    });
    if (out.length >= MAX_DICTIONARY_PHRASES) {
      break;
    }
  }
  return out;
}

/**
 * 按变体归一化自定义词组，并迁移旧版 `forceReplaceRules`
 * （扁平数组、每条带 variant）：新版 `phrases` 为空的变体才吸收旧数据，
 * 迁移后旧字段不再写回。
 */
function normalizePhrases(dictionary?: unknown): UserDictionary["phrases"] {
  const source = (dictionary ?? {}) as {
    phrases?: Partial<Record<VariantCode, unknown>>;
    forceReplaceRules?: unknown;
  };
  const out = {} as UserDictionary["phrases"];
  for (const variant of VARIANT_CODES) {
    out[variant] = normalizePhraseList(source.phrases?.[variant]);
  }
  if (Array.isArray(source.forceReplaceRules)) {
    for (const legacy of source.forceReplaceRules) {
      const variant = (legacy as { variant?: unknown } | null)?.variant;
      if (!VARIANT_CODES.includes(variant as VariantCode)) {
        continue;
      }
      const key = variant as VariantCode;
      if (source.phrases?.[key] !== undefined) {
        continue;
      }
      out[key] = normalizePhraseList([...out[key], legacy]);
    }
  }
  return out;
}

export function normalizeSettings(settings?: Partial<ExtensionSettings> | null): ExtensionSettings {
  return {
    enabled: settings?.enabled ?? DEFAULT_SETTINGS.enabled,
    defaultVariant: settings?.defaultVariant ?? DEFAULT_SETTINGS.defaultVariant,
    detectionLevel: settings?.detectionLevel ?? DEFAULT_SETTINGS.detectionLevel,
    defaultSiteEnabled: settings?.defaultSiteEnabled ?? DEFAULT_SETTINGS.defaultSiteEnabled,
    siteEnabledMap: settings?.siteEnabledMap ?? {},
    userDictionary: {
      allowTerms: normalizeAllowTerms(settings?.userDictionary),
      phrases: normalizePhrases(settings?.userDictionary),
    },
    showOnSelection: settings?.showOnSelection ?? DEFAULT_SETTINGS.showOnSelection,
    shortcuts: { ...DEFAULT_SHORTCUTS, ...settings?.shortcuts },
  };
}

export function mergeSettings(
  current: ExtensionSettings,
  patch: ExtensionSettingsPatch,
): ExtensionSettings {
  return normalizeSettings({
    ...current,
    ...patch,
    siteEnabledMap: {
      ...current.siteEnabledMap,
      ...(patch.siteEnabledMap ?? {}),
    },
    userDictionary: {
      allowTerms: {
        ...current.userDictionary.allowTerms,
        ...(patch.userDictionary?.allowTerms ?? {}),
      },
      phrases: {
        ...current.userDictionary.phrases,
        ...(patch.userDictionary?.phrases ?? {}),
      },
    },
    shortcuts: {
      ...current.shortcuts,
      ...(patch.shortcuts ?? {}),
    } as ShortcutMap,
  });
}

export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  return normalizeSettings(stored[STORAGE_KEY] as Partial<ExtensionSettings> | undefined);
}

export async function saveSettings(settings: ExtensionSettings): Promise<ExtensionSettings> {
  const normalized = normalizeSettings(settings);
  await browser.storage.local.set({ [STORAGE_KEY]: normalized });
  return normalized;
}

export async function updateSettings(
  patch: ExtensionSettingsPatch,
): Promise<ExtensionSettings> {
  const current = await getSettings();
  const next = mergeSettings(current, patch);
  return saveSettings(next);
}

export async function setSiteEnabled(
  hostname: string,
  enabled: boolean,
): Promise<ExtensionSettings> {
  const current = await getSettings();
  const next = mergeSettings(current, {
    siteEnabledMap: {
      [hostname]: enabled,
    },
  });
  return saveSettings(next);
}

export function isSiteEnabled(settings: ExtensionSettings, hostname: string | null): boolean {
  if (!hostname) {
    return settings.defaultSiteEnabled;
  }

  // 站点级开关优先；未单独配置的站点跟随「全站点默认开启检查」。
  return settings.siteEnabledMap[hostname] ?? settings.defaultSiteEnabled;
}
