import { getSettings, isSiteEnabled, setSiteEnabled, updateSettings } from "../src/core/storage";
import type { PopupState } from "../src/shared/types";

async function getActiveHostname(): Promise<string | null> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const url = tabs[0]?.url;
  if (!url) {
    return null;
  }

  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

async function broadcastSettingsChanged(): Promise<void> {
  const settings = await getSettings();
  const tabs = await browser.tabs.query({});

  await Promise.all(
    tabs
      .filter((tab) => typeof tab.id === "number")
      .map(async (tab) => {
        try {
          await browser.tabs.sendMessage(tab.id as number, {
            type: "settings/changed",
            settings,
          });
        } catch {
          // Ignore tabs without a matching content script.
        }
      }),
  );
}

async function getPopupState(): Promise<PopupState> {
  const settings = await getSettings();
  const hostname = await getActiveHostname();
  return {
    settings,
    hostname,
    siteEnabled: isSiteEnabled(settings, hostname),
  };
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, sender) => {
    // 仅接受来自本扩展自身上下文（popup / content script）的消息。
    // sender.id 在扩展自身上下文下等于 runtime.id；外部网页无法伪造（未声明 externally_connectable），
    // 以此防御外部页面冒充消息篡改用户设置。
    if (sender.id !== browser.runtime.id) {
      return undefined;
    }

    if (!message?.type) {
      return undefined;
    }

    switch (message.type) {
      case "popup/get-state":
        return getPopupState();
      case "settings/update":
        return updateSettings(message.patch).then(async (settings) => {
          await broadcastSettingsChanged();
          return settings;
        });
      case "site/toggle":
        return setSiteEnabled(message.hostname, message.enabled).then(async (settings) => {
          await broadcastSettingsChanged();
          return settings;
        });
      case "settings/changed":
        return broadcastSettingsChanged();
      default:
        return undefined;
    }
  });
});
