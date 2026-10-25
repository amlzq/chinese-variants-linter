import type { ExtensionSettings, ExtensionSettingsPatch } from "../types";

export type RuntimeMessage =
  | { type: "popup/get-state" }
  | { type: "settings/update"; patch: ExtensionSettingsPatch }
  | { type: "site/toggle"; hostname: string; enabled: boolean }
  | { type: "feedback/open" }
  | { type: "settings/changed"; settings: ExtensionSettings };
