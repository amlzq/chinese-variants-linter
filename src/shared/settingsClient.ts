import type { ExtensionSettings, ExtensionSettingsPatch } from "./types";

/**
 * 设置写入的轻量客户端，统一走后台消息，
 * 以便 popup 与原生 DOM 的页面内设置视图共用同一份写入逻辑，
 * 并触发多标签页的实时同步（background 会 broadcast settings/changed）。
 */

export function updateSettings(patch: ExtensionSettingsPatch): Promise<ExtensionSettings> {
  return browser.runtime.sendMessage({ type: "settings/update", patch });
}

export function toggleSite(hostname: string, enabled: boolean): Promise<ExtensionSettings> {
  return browser.runtime.sendMessage({ type: "site/toggle", hostname, enabled });
}
