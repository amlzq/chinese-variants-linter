import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_SHORTCUTS, type ShortcutCombo } from "../../shared/types";
import { setRegion } from "../../shared/locale";
import {
  comboEquals,
  comboToString,
  eventToCombo,
  isModifierKey,
  matchCombo,
} from "./index";

function createEvent(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent("keydown", init);
}

afterEach(() => {
  setRegion("CN");
});

describe("isModifierKey", () => {
  it("识别修饰键", () => {
    for (const key of ["Control", "Shift", "Alt", "Meta", "AltGraph"]) {
      expect(isModifierKey(createEvent({ key }))).toBe(true);
    }
  });

  it("普通字符不算修饰键", () => {
    expect(isModifierKey(createEvent({ key: "u" }))).toBe(false);
  });
});

describe("eventToCombo", () => {
  it("单字符按键统一转为大写", () => {
    expect(eventToCombo(createEvent({ key: "u", ctrlKey: true, shiftKey: true }))).toEqual({
      ctrl: true,
      meta: false,
      alt: false,
      shift: true,
      key: "U",
    });
  });

  it("空格映射为 Space", () => {
    expect(eventToCombo(createEvent({ key: " " })).key).toBe("Space");
  });

  it("功能键保持原样", () => {
    expect(eventToCombo(createEvent({ key: "F5" })).key).toBe("F5");
  });
});

describe("matchCombo", () => {
  it("组合键完全匹配时返回 true", () => {
    const combo = DEFAULT_SHORTCUTS.toggleEnabled;
    expect(matchCombo(createEvent({ key: "u", ctrlKey: true, shiftKey: true }), combo)).toBe(true);
  });

  it("按键大小写不敏感", () => {
    const event = createEvent({ key: "U", ctrlKey: true, shiftKey: true });
    expect(matchCombo(event, DEFAULT_SHORTCUTS.toggleEnabled)).toBe(true);
  });

  it("缺少或多出修饰键时不匹配", () => {
    expect(matchCombo(createEvent({ key: "u", ctrlKey: true }), DEFAULT_SHORTCUTS.toggleEnabled)).toBe(
      false,
    );
    expect(
      matchCombo(
        createEvent({ key: "u", ctrlKey: true, shiftKey: true, altKey: true }),
        DEFAULT_SHORTCUTS.toggleEnabled,
      ),
    ).toBe(false);
  });

  it("未绑定（null）时永不匹配", () => {
    expect(matchCombo(createEvent({ key: "u" }), null)).toBe(false);
  });
});

describe("comboToString", () => {
  it("按 Ctrl / ⌘ / Alt / Shift / 按键顺序拼接", () => {
    expect(comboToString(DEFAULT_SHORTCUTS.toggleEnabled)).toBe("Ctrl + Shift + U");
  });

  it("Meta 显示为 ⌘，空格显示为 Space", () => {
    const combo: ShortcutCombo = { ctrl: false, meta: true, alt: true, shift: false, key: "Space" };
    expect(comboToString(combo)).toBe("⌘ + Alt + Space");
  });

  it("未绑定时返回本地化文案", () => {
    expect(comboToString(null)).toBe("未绑定");
    setRegion("EN");
    expect(comboToString(null)).toBe("Unbound");
  });
});

describe("comboEquals", () => {
  const base: ShortcutCombo = { ctrl: true, meta: false, alt: false, shift: true, key: "U" };

  it("忽略按键大小写", () => {
    expect(comboEquals(base, { ...base, key: "u" })).toBe(true);
  });

  it("修饰键不同则不相等", () => {
    expect(comboEquals(base, { ...base, alt: true })).toBe(false);
  });

  it("两个 null 相等，null 与非 null 不等", () => {
    expect(comboEquals(null, null)).toBe(true);
    expect(comboEquals(null, base)).toBe(false);
    expect(comboEquals(base, null)).toBe(false);
  });
});
