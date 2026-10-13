import type { ShortcutCombo } from "../../shared/types";
import { t } from "../../shared/locale";

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta", "AltGraph"]);

function normalizeKey(event: KeyboardEvent): string {
  if (event.key === " ") {
    return "Space";
  }
  if (event.key.length === 1) {
    return event.key.toUpperCase();
  }
  return event.key;
}

export function isModifierKey(event: KeyboardEvent): boolean {
  return MODIFIER_KEYS.has(event.key);
}

export function eventToCombo(event: KeyboardEvent): ShortcutCombo {
  return {
    ctrl: event.ctrlKey,
    meta: event.metaKey,
    alt: event.altKey,
    shift: event.shiftKey,
    key: normalizeKey(event),
  };
}

function sameKey(a: string, b: string): boolean {
  return a.toUpperCase() === b.toUpperCase();
}

export function matchCombo(event: KeyboardEvent, combo: ShortcutCombo | null): boolean {
  if (!combo) {
    return false;
  }

  const key = normalizeKey(event);
  if (!sameKey(key, combo.key)) {
    return false;
  }

  return (
    event.ctrlKey === combo.ctrl &&
    event.metaKey === combo.meta &&
    event.altKey === combo.alt &&
    event.shiftKey === combo.shift
  );
}

function labelForToken(token: string): string {
  if (token === "Control") {
    return "Ctrl";
  }
  if (token === "Meta") {
    return "⌘";
  }
  if (token === "Alt") {
    return "Alt";
  }
  if (token === "Shift") {
    return "Shift";
  }
  if (token === "Space") {
    return "Space";
  }
  return token;
}

export function comboToString(combo: ShortcutCombo | null): string {
  if (!combo) {
    return t("shortcut.unbound");
  }

  const tokens: string[] = [];
  if (combo.ctrl) {
    tokens.push("Control");
  }
  if (combo.meta) {
    tokens.push("Meta");
  }
  if (combo.alt) {
    tokens.push("Alt");
  }
  if (combo.shift) {
    tokens.push("Shift");
  }

  return [...tokens.map(labelForToken), labelForToken(combo.key)].join(" + ");
}

export function comboEquals(a: ShortcutCombo | null, b: ShortcutCombo | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }

  return (
    a.ctrl === b.ctrl &&
    a.meta === b.meta &&
    a.alt === b.alt &&
    a.shift === b.shift &&
    sameKey(a.key, b.key)
  );
}
