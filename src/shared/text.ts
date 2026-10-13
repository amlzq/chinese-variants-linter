/**
 * 判断文本是否含有汉字（CJK 统一表意文字及其扩展 A）。
 * 用于决定是否显示与中文变体相关的 UI（启动器、选区工具条等）。
 */
export function containsCjk(text: string): boolean {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text);
}
