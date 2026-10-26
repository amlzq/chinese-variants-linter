import type { VariantCode, VariantTermRule } from "../../shared/types";

/**
 * 一组同义的地区用词。`zh-Hant`（通用繁体）沿用台湾用词。
 *
 * 字形差异由 OpenCC 处理，这里只收录「用词」不同的条目；每条都要求在
 * 子串匹配下也不易误报（例如不收「内存」，因为会命中「国内存在」）。
 */
interface TermEntry {
  id: string;
  cn: string;
  tw: string;
  hk: string;
  /** 大陆用词的繁体字形（如「服務器」），与 tw / hk 都不同时才需填写，用于识别繁体文本中的大陆用词。 */
  cnTrad?: string;
  /** 只从大陆用词转出：台港用词在大陆同样通行或有歧义（如「番茄」「澳洲」「連結」）时使用。 */
  oneWay?: true;
  /** 大陆用词有其他义项（如「支持」也指支持某人），所有方向均为中置信度。 */
  ambiguous?: true;
  /** 仅反向（台港 → 大陆）有歧义，如「影片」在大陆也指电影。 */
  ambiguousReverse?: true;
  tags?: string[];
}

const TERM_ENTRIES: TermEntry[] = [
  // MVP 必须覆盖的样例
  { id: "software", cn: "软件", tw: "軟體", hk: "軟件", tags: ["required-sample"] },
  { id: "video", cn: "视频", tw: "影片", hk: "影片", cnTrad: "視頻", ambiguousReverse: true },
  { id: "taxi", cn: "出租车", tw: "計程車", hk: "的士", cnTrad: "出租車" },
  { id: "noodle", cn: "面条", tw: "麵條", hk: "麪條" },
  { id: "mouse", cn: "鼠标", tw: "滑鼠", hk: "滑鼠", cnTrad: "鼠標" },
  { id: "login", cn: "登录", tw: "登入", hk: "登入", cnTrad: "登錄" },
  { id: "support", cn: "支持", tw: "支援", hk: "支援", ambiguous: true },
  { id: "default", cn: "默认", tw: "預設", hk: "預設", cnTrad: "默認", ambiguousReverse: true },

  // 网络与软硬件
  { id: "network", cn: "网络", tw: "網路", hk: "網絡" },
  { id: "internet", cn: "互联网", tw: "網際網路", hk: "互聯網" },
  { id: "lan", cn: "局域网", tw: "區域網路", hk: "區域網絡", cnTrad: "局域網" },
  { id: "broadband", cn: "宽带", tw: "寬頻", hk: "寬頻", cnTrad: "寬帶" },
  { id: "database", cn: "数据库", tw: "資料庫", hk: "數據庫" },
  { id: "server", cn: "服务器", tw: "伺服器", hk: "伺服器", cnTrad: "服務器" },
  { id: "hardware", cn: "硬件", tw: "硬體", hk: "硬件" },
  { id: "harddisk", cn: "硬盘", tw: "硬碟", hk: "硬碟", cnTrad: "硬盤" },
  { id: "usbdrive", cn: "U盘", tw: "隨身碟", hk: "USB手指", cnTrad: "U盤" },
  { id: "optical", cn: "光盘", tw: "光碟", hk: "光碟", cnTrad: "光盤" },
  { id: "chip", cn: "芯片", tw: "晶片", hk: "晶片" },
  { id: "gpu", cn: "显卡", tw: "顯示卡", hk: "顯示卡", cnTrad: "顯卡" },
  { id: "motherboard", cn: "主板", tw: "主機板", hk: "主板" },
  { id: "nic", cn: "网卡", tw: "網路卡", hk: "網卡" },
  { id: "printer", cn: "打印机", tw: "印表機", hk: "打印機" },
  { id: "print", cn: "打印", tw: "列印", hk: "打印" },
  { id: "screen", cn: "屏幕", tw: "螢幕", hk: "屏幕" },
  { id: "cursor", cn: "光标", tw: "游標", hk: "光標" },
  { id: "folder", cn: "文件夹", tw: "資料夾", hk: "文件夾" },
  { id: "os", cn: "操作系统", tw: "作業系統", hk: "操作系統" },
  { id: "font", cn: "字体", tw: "字型", hk: "字體", oneWay: true },
  { id: "paste", cn: "粘贴", tw: "貼上", hk: "貼上", cnTrad: "粘貼", ambiguousReverse: true },
  { id: "search", cn: "搜索", tw: "搜尋", hk: "搜尋" },
  { id: "link", cn: "链接", tw: "連結", hk: "連結", cnTrad: "鏈接", oneWay: true },
  { id: "blog", cn: "博客", tw: "部落格", hk: "網誌" },
  { id: "programmer", cn: "程序员", tw: "程式設計師", hk: "程式員", cnTrad: "程序員" },
  { id: "cloud", cn: "云计算", tw: "雲端運算", hk: "雲端運算", cnTrad: "雲計算" },
  { id: "ai", cn: "人工智能", tw: "人工智慧", hk: "人工智能" },
  { id: "social", cn: "社交媒体", tw: "社群媒體", hk: "社交媒體" },
  { id: "hd", cn: "高清", tw: "高畫質", hk: "高清" },
  { id: "smartphone", cn: "智能手机", tw: "智慧型手機", hk: "智能手機" },
  { id: "laptop", cn: "笔记本电脑", tw: "筆記型電腦", hk: "手提電腦", cnTrad: "筆記本電腦" },
  { id: "sms", cn: "短信", tw: "簡訊", hk: "短訊" },
  { id: "laser", cn: "激光", tw: "雷射", hk: "激光" },
  // 「用户」会命中「使用户」，因此为中置信度。
  { id: "user", cn: "用户", tw: "使用者", hk: "用戶", oneWay: true, ambiguous: true },

  // 日常生活
  { id: "bus", cn: "公交车", tw: "公車", hk: "巴士", cnTrad: "公交車", oneWay: true },
  { id: "bicycle", cn: "自行车", tw: "腳踏車", hk: "單車", cnTrad: "自行車", oneWay: true },
  { id: "pineapple", cn: "菠萝", tw: "鳳梨", hk: "菠蘿", oneWay: true },
  { id: "tomato", cn: "西红柿", tw: "番茄", hk: "番茄", cnTrad: "西紅柿", oneWay: true },
  { id: "instant-noodle", cn: "方便面", tw: "泡麵", hk: "即食麵", cnTrad: "方便麪" },
  { id: "aircon", cn: "空调", tw: "冷氣", hk: "冷氣", cnTrad: "空調", oneWay: true },
  { id: "kindergarten", cn: "幼儿园", tw: "幼稚園", hk: "幼稚園", cnTrad: "幼兒園", oneWay: true },

  // 地名
  { id: "new-zealand", cn: "新西兰", tw: "紐西蘭", hk: "新西蘭" },
  { id: "sydney", cn: "悉尼", tw: "雪梨", hk: "悉尼", oneWay: true },
  { id: "italy", cn: "意大利", tw: "義大利", hk: "意大利" },
  { id: "australia", cn: "澳大利亚", tw: "澳洲", hk: "澳洲", cnTrad: "澳大利亞", oneWay: true },
];

const TERM_PRIORITY = 600;

function getTargetForms(entry: TermEntry): Record<VariantCode, string> {
  return { "zh-CN": entry.cn, "zh-TW": entry.tw, "zh-HK": entry.hk, "zh-Hant": entry.tw };
}

function buildRules(entry: TermEntry): VariantTermRule[] {
  const forms = getTargetForms(entry);
  const sources: Array<{ suffix: string; term: string; reverse: boolean }> = [
    { suffix: "cn", term: entry.cn, reverse: false },
  ];
  if (entry.cnTrad) {
    sources.push({ suffix: "cn-trad", term: entry.cnTrad, reverse: false });
  }
  if (!entry.oneWay) {
    sources.push({ suffix: "tw", term: entry.tw, reverse: true });
    sources.push({ suffix: "hk", term: entry.hk, reverse: true });
  }

  const seen = new Set<string>();
  const rules: VariantTermRule[] = [];
  for (const source of sources) {
    if (seen.has(source.term)) {
      continue;
    }
    seen.add(source.term);

    const targets: Partial<Record<VariantCode, string>> = {};
    for (const [variant, form] of Object.entries(forms) as Array<[VariantCode, string]>) {
      if (form !== source.term) {
        targets[variant] = form;
      }
    }
    if (Object.keys(targets).length === 0) {
      continue;
    }

    rules.push({
      id: `term-${entry.id}-${source.suffix}`,
      kind: "variant_term",
      sourceTerm: source.term,
      targets,
      safe: !entry.ambiguous && !(source.reverse && entry.ambiguousReverse),
      enabled: true,
      priority: TERM_PRIORITY,
      source: "builtin",
      ...(entry.tags ? { tags: entry.tags } : {}),
    });
  }

  return rules;
}

export const TERM_RULES: VariantTermRule[] = TERM_ENTRIES.flatMap(buildRules);
