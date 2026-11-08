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
  const phrase: CustomPhrase = {
    id: `phrase-${Date.now()}`,
    from: trimmedFrom,
    to: trimmedTo,
    enabled: true,
  };
  return phrasesPatch(variant, [...phrasesOf(settings, variant), phrase]);
}

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
    phrasesOf(settings, variant).map((p) =>
      p.id === id ? { ...p, from: trimmedFrom, to: trimmedTo } : p,
    ),
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

/** 导入：同一原词已存在时更新其替换词，否则追加；返回空补丁表示没有可导入的行。 */
export function importPhrasesPatch(
  settings: ExtensionSettings,
  variant: VariantCode,
  rows: Array<{ from: string; to: string }>,
): ExtensionSettingsPatch {
  if (rows.length === 0) {
    return {};
  }
  const next = [...phrasesOf(settings, variant)];
  const now = Date.now();
  rows.forEach((row, index) => {
    const existing = next.findIndex((p) => p.from === row.from);
    if (existing >= 0) {
      next[existing] = { ...next[existing], to: row.to };
    } else {
      next.push({ id: `phrase-${now}-${index}`, from: row.from, to: row.to, enabled: true });
    }
  });
  return phrasesPatch(variant, next);
}
