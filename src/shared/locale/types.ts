/**
 * 界面地区（UI locale）。与「目标转换变体」(VariantCode) 相互独立：
 * - Region 决定界面显示的语言/地区（CN / TW / HK / MO / SG / MY / EN）。
 * - VariantCode 决定文本被转换成的目标中文变体。
 * - EN 表示英文界面，不绑定具体中文地区。
 */
export type Region = "CN" | "TW" | "HK" | "MO" | "SG" | "MY" | "EN";
