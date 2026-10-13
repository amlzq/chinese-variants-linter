export type IssueType = "script" | "variant_term";
export type Confidence = "high" | "medium";
export type IssueStatus = "active" | "ignored-once" | "resolved";
export type VariantCode = "zh-CN" | "zh-TW" | "zh-HK" | "zh-Hant";
export type DetectionLevel = "standard" | "relaxed";

export interface Suggestion {
    value: string;
    label: string;
    explanation?: string;
    isDefault: boolean;
}

export interface Issue {
    id: string;
    type: IssueType;
    subtype: string;
    sourceText: string;
    targetVariant: VariantCode;
    start: number;
    end: number;
    confidence: Confidence;
    message: string;
    explanation?: string;
    suggestions: Suggestion[];
    ruleId: string;
    replaceMode: "single-only";
    status: IssueStatus;
}

export interface ForceReplaceRule {
    id: string;
    variant: VariantCode;
    from: string;
    to: string;
    enabled: boolean;
}

export interface UserDictionary {
    allowTerms: Record<VariantCode, string[]>;
    forceReplaceRules: ForceReplaceRule[];
}

export type ShortcutAction = "toggleEnabled" | "toggleReviewView" | "convertSelection" | "acceptNext";

export interface ShortcutCombo {
    ctrl: boolean;
    meta: boolean;
    alt: boolean;
    shift: boolean;
    key: string;
}

export type ShortcutMap = Record<ShortcutAction, ShortcutCombo | null>;

export const SHORTCUT_ACTIONS: ShortcutAction[] = [
    "toggleEnabled",
    "toggleReviewView",
    "convertSelection",
    "acceptNext",
];

// 快捷键名称/说明改为运行时本地化，见 src/shared/locale 的
// getShortcutActionLabel / getShortcutDescription。

export const DEFAULT_SHORTCUTS: ShortcutMap = {
    toggleEnabled: { ctrl: true, meta: false, alt: false, shift: true, key: "U" },
    toggleReviewView: { ctrl: true, meta: false, alt: false, shift: true, key: "Y" },
    convertSelection: { ctrl: true, meta: false, alt: false, shift: true, key: "K" },
    acceptNext: { ctrl: true, meta: false, alt: false, shift: true, key: "L" },
};

export interface ExtensionSettings {
    enabled: boolean;
    defaultVariant: VariantCode;
    detectionLevel: DetectionLevel;
    siteEnabledMap: Record<string, boolean>;
    userDictionary: UserDictionary;
    showOnSelection: boolean;
    shortcuts: ShortcutMap;
}

export interface ExtensionSettingsPatch {
    enabled?: boolean;
    defaultVariant?: VariantCode;
    detectionLevel?: DetectionLevel;
    siteEnabledMap?: Record<string, boolean>;
    userDictionary?: {
        allowTerms?: Partial<Record<VariantCode, string[]>>;
        forceReplaceRules?: ForceReplaceRule[];
    };
    showOnSelection?: boolean;
    shortcuts?: Partial<ShortcutMap>;
}

export interface BaseRule {
    id: string;
    enabled: boolean;
    priority: number;
    source: "builtin" | "user";
    tags?: string[];
}

export interface ScriptRule extends BaseRule {
    kind: "script";
    from: string;
    toByVariant: Partial<Record<VariantCode, string>>;
    contextSensitive: boolean;
}

export interface VariantTermRule extends BaseRule {
    kind: "variant_term";
    sourceTerm: string;
    targets: Partial<Record<VariantCode, string>>;
    safe: boolean;
}

export type Rule = ScriptRule | VariantTermRule;

export interface PopupState {
    settings: ExtensionSettings;
    hostname: string | null;
    siteEnabled: boolean;
}

export interface DetectTextOptions {
    text: string;
    settings: ExtensionSettings;
    ignoredIssueIds?: string[];
}
