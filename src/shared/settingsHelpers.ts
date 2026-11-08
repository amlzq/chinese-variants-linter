import { MAX_PHRASES_PER_VARIANT } from "./phraseCsv";
import type {
  ExtensionSettings,
  ExtensionSettingsPatch,
  CustomPhrase,
  VariantCode,
} from "./types";

/**
 * 计算「设置变更补丁」的纯函数集合。
 * popup 与页面内设置视图共用，避免两侧各自维护重复的数组操作逻辑。
 * 返回空对象 `{}` 表示无需变更（调用方应据此跳过写入）。
 */

export function allowPhrasesPatch(settings: ExtensionSettings, term: string): ExtensionSettingsPatch {
  const variant = settings.defaultVariant;
  const terms = settings.userDictionary.allowPhrases[variant] ?? [];
  const next = term.trim();
  if (!next || terms.includes(next)) {
    return {};
  }
  return {
    userDictionary: {
      allowPhrases: { [variant]: Array.from(new Set([...terms, next])) },
    },
  };
}

export function removeAllowPhrasePatch(
  settings: ExtensionSettings,
  term: string,
): ExtensionSettingsPatch {
  const variant = settings.defaultVariant;
  const terms = settings.userDictionary.allowPhrases[variant] ?? [];
  return {
    userDictionary: {
      allowPhrases: { [variant]: terms.filter((t) => t !== term) },
    },
  };
}

function phrasesOf(settings: ExtensionSettings, variant: VariantCode): CustomPhrase[] {
  return settings.userDictionary.phrases[variant] ?? [];
}

function phrasesPatch(variant: VariantCode, phrases: CustomPhrase[]): ExtensionSettingsPatch {
  return { userDictionary: { phrases: { [variant]: phrases } } };
}

export function addPhrasePatch(
  settings: ExtensionSettings,
  variant: VariantCode,
  from: string,
  to: string,
): ExtensionSettingsPatch {
  const trimmedFrom = from.trim();
  const trimmedTo = to.trim();
  if (!trimmedFrom || !trimmedTo) {
    return {};
  }
  const current = phrasesOf(settings, variant);
  // 原词已存在时更新其替换词，避免同一原词出现两条。
  if (current.some((p) => p.from === trimmedFrom)) {
    return phrasesPatch(
      variant,
      current.map((p) => (p.from === trimmedFrom ? { ...p, to: trimmedTo } : p)),
    );
  }
  if (current.length >= MAX_PHRASES_PER_VARIANT) {
    return {};
  }
  const phrase: CustomPhrase = {
    id: `phrase-${Date.now()}`,
    from: trimmedFrom,
    to: trimmedTo,
    enabled: true,
  };
  return phrasesPatch(variant, [...current, phrase]);
}

/** 修改词组；改成与另一条相同的原词时，以当前这条为准并移除另一条。 */
export function updatePhrasePatch(
  settings: ExtensionSettings,
  variant: VariantCode,
  id: string,
  from: string,
  to: string,
): ExtensionSettingsPatch {
  const trimmedFrom = from.trim();
  const trimmedTo = to.trim();
  if (!trimmedFrom || !trimmedTo) {
    return {};
  }
  return phrasesPatch(
    variant,
    phrasesOf(settings, variant)
      .filter((p) => p.id === id || p.from !== trimmedFrom)
      .map((p) => (p.id === id ? { ...p, from: trimmedFrom, to: trimmedTo } : p)),
  );
}

export function removePhrasePatch(
  settings: ExtensionSettings,
  variant: VariantCode,
  id: string,
): ExtensionSettingsPatch {
  return phrasesPatch(
    variant,
    phrasesOf(settings, variant).filter((p) => p.id !== id),
  );
}

export function clearPhrasesPatch(variant: VariantCode): ExtensionSettingsPatch {
  return phrasesPatch(variant, []);
}

export interface PhraseImportResult {
  patch: ExtensionSettingsPatch;
  added: number;
  updated: number;
  /** 因超过每个变体的数量上限而被跳过的新词组数。 */
  skipped: number;
}

/**
 * 导入：同一原词已存在时更新其替换词，否则追加；超过上限的新词组被跳过并计数。
 * 没有任何变化（没有可导入的行）时 patch 为空对象。
 */
export function importPhrasesPatch(
  settings: ExtensionSettings,
  variant: VariantCode,
  rows: Array<{ from: string; to: string }>,
): PhraseImportResult {
  const next = [...phrasesOf(settings, variant)];
  const now = Date.now();
  let added = 0;
  let updated = 0;
  let skipped = 0;
  rows.forEach((row, index) => {
    const existing = next.findIndex((p) => p.from === row.from);
    if (existing >= 0) {
      next[existing] = { ...next[existing], to: row.to };
      updated += 1;
    } else if (next.length >= MAX_PHRASES_PER_VARIANT) {
      skipped += 1;
    } else {
      next.push({ id: `phrase-${now}-${index}`, from: row.from, to: row.to, enabled: true });
      added += 1;
    }
  });
  if (added + updated === 0) {
    return { patch: {}, added, updated, skipped };
  }
  return { patch: phrasesPatch(variant, next), added, updated, skipped };
}
