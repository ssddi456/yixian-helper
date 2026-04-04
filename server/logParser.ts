import * as fs from "fs";
import * as path from "path";
import { CardOperation, CardCount, CardLibEntry, BattleLogRound, PlayerInfo } from "./types";

/**
 * 获取游戏日志路径
 */
export function getGamePath(): string {
  return process.platform === "darwin"
    ? path.join(
        process.env.HOME || "",
        "Library/Containers/com.darksun.yixianpai"
      )
    : path.join(
        process.env.USERPROFILE || "",
        "AppData",
        "LocalLow",
        "DarkSunStudio",
        "YiXianPai"
      );
}

/**
 * 解析 CardOperationLog.json 中的操作记录
 */
export function parseCardOperationLog(content: string): CardOperation[] | null {
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // 跳过首行（通常是格式标记）
  const jsonLines = lines.slice(1);
  if (jsonLines.length === 0) return null;

  try {
    return jsonLines.map((line) => JSON.parse(line));
  } catch {
    return null;
  }
}

/**
 * 从操作记录计算已从牌库抽出的牌（牌库消耗）
 */
export function calculateDeckCards(
  operations: CardOperation[]
): Record<string, CardCount> {
  const counts: Record<string, CardCount> = {};

  for (const op of operations) {
    if (op.operation === 0 && op.cards) {
      // 抽牌: 从牌库中取出
      for (const card of op.cards) {
        if (card.name) {
          if (!counts[card.name]) counts[card.name] = { count: 0 };
          counts[card.name].count += 1;
        }
      }
    }
    if (op.operation === 1) {
      // 换牌: srcCard 从牌库多消耗, dstCard 从牌库消耗
      if (op.dstCard.name && !op.dstCard.name.includes("梦•")) {
        if (op.srcCard.name) {
          if (!counts[op.srcCard.name]) counts[op.srcCard.name] = { count: 0 };
          counts[op.srcCard.name].count += 2;
        }
        if (op.dstCard.name) {
          if (!counts[op.dstCard.name])
            counts[op.dstCard.name] = { count: 0 };
          counts[op.dstCard.name].count += 1;
        }
      }
    }
  }
  return counts;
}

/**
 * 从操作记录计算当前手牌
 */
export function calculateHandCards(
  operations: CardOperation[]
): Record<string, CardCount> {
  const hand: Record<string, { count: number; rarity: number }> = {};

  for (const op of operations) {
    if (op.operation === 0 && op.cards) {
      for (const card of op.cards) {
        if (card.name) {
          if (!hand[card.name]) hand[card.name] = { count: 0, rarity: card.rarity || 0 };
          hand[card.name].count += 1;
          hand[card.name].rarity = card.rarity || hand[card.name].rarity;
        }
      }
    }
    if (op.operation === 1) {
      if (op.srcCard.name) {
        if (!hand[op.srcCard.name]) hand[op.srcCard.name] = { count: 0, rarity: 0 };
        hand[op.srcCard.name].count -= 1;
      }
      if (op.dstCard.name) {
        if (!hand[op.dstCard.name]) hand[op.dstCard.name] = { count: 0, rarity: op.dstCard.rarity || 0 };
        hand[op.dstCard.name].count += 1;
        hand[op.dstCard.name].rarity = op.dstCard.rarity || hand[op.dstCard.name].rarity;
      }
    }
    if (op.operation === 2) {
      if (op.srcCard.name) {
        if (!hand[op.srcCard.name]) hand[op.srcCard.name] = { count: 0, rarity: 0 };
        hand[op.srcCard.name].count -= 1;
      }
    }
  }

  const result: Record<string, CardCount> = {};
  for (const [name, info] of Object.entries(hand)) {
    if (info.count > 0) result[name] = { count: info.count, rarity: info.rarity };
  }
  return result;
}

/**
 * 解析 BattleLog.json
 */
export function parseBattleLog(content: string): BattleLogRound[] | null {
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const jsonLines = lines.slice(1);
  if (jsonLines.length === 0) return null;

  try {
    return jsonLines.map((line) => JSON.parse(line));
  } catch {
    return null;
  }
}

/**
 * 判断是否在对局中（CardOperationLog 是否有有效数据）
 */
export function isInGame(gamePath: string): boolean {
  try {
    const opLogPath = path.join(gamePath, "CardOperationLog.json");
    if (!fs.existsSync(opLogPath)) return false;
    const content = fs.readFileSync(opLogPath, "utf-8");
    const ops = parseCardOperationLog(content);
    return ops !== null && ops.length > 0;
  } catch {
    return false;
  }
}

/**
 * 标准化卡牌名称（处理 · 和 • 不一致）
 */
export function normalizeCardName(name: string): string {
  return name.replace(/·/g, "•");
}

/**
 * 角色英文ID到中文名的映射
 */
export const CHARACTER_NAMES: Record<string, string> = {
  MuYifeng: "慕一峰",
  YanXue: "燕雪",
  LongYao: "龙瑶",
  LinXiaoyue: "林小月",
  LuJianxin: "陆剑心",
  LiChengyun: "李承云",
  TanShuyan: "谭书言",
  YanChen: "严尘",
  YaoLing: "妖灵",
  JiangXiming: "姜熙明",
  WuCe: "无策",
  WuXingzhi: "吴行之",
  DuLingyuan: "杜灵鸢",
  HuaQinrui: "花沁蕊",
  MuHu: "穆虎",
  XiaoBu: "小布",
  TuKui: "屠魁",
  YeMingming: "夜冥冥",
  JiFangsheng: "纪方生",
  LiMan: "黎曼",
  QiWangyou: "齐忘忧",
  FengXu: "风虚",
};

/**
 * 角色所属门派映射
 */
export const CHARACTER_SECTS: Record<string, string> = {
  MuYifeng: "cloud-spirit",
  YanXue: "cloud-spirit",
  LongYao: "cloud-spirit",
  LinXiaoyue: "cloud-spirit",
  LuJianxin: "cloud-spirit",
  LiChengyun: "cloud-spirit",
  TanShuyan: "cloud-spirit",
  YanChen: "heptastar",
  YaoLing: "heptastar",
  JiangXiming: "heptastar",
  WuCe: "heptastar",
  WuXingzhi: "five-element",
  DuLingyuan: "five-element",
  HuaQinrui: "five-element",
  MuHu: "five-element",
  XiaoBu: "duan-xuan",
  TuKui: "duan-xuan",
  YeMingming: "duan-xuan",
  JiFangsheng: "duan-xuan",
  LiMan: "duan-xuan",
  QiWangyou: "duan-xuan",
  FengXu: "duan-xuan",
};

/**
 * 从 BattleLog 中读取当前玩家角色信息
 */
export function readPlayerFromBattleLog(gamePath: string): PlayerInfo | null {
  try {
    const battleLogPath = path.join(gamePath, "BattleLog.json");
    if (!fs.existsSync(battleLogPath)) return null;

    const content = fs.readFileSync(battleLogPath, "utf-8").trim();
    if (!content) return null;

    const rounds = parseBattleLog(content);
    if (!rounds || rounds.length === 0) return null;

    // 取最新一回合的第一个玩家（通常是自己）
    const latestRound = rounds.reduce((a, b) => (a.round > b.round ? a : b));
    const player = latestRound.players[0];
    if (!player) return null;

    const character = player.character || "";
    return {
      username: player.username,
      character,
      characterName: CHARACTER_NAMES[character] || character,
      sect: CHARACTER_SECTS[character] || "unknown",
      phase: (player.level || 0) + 1,
      sideJobs: [],
    };
  } catch {
    return null;
  }
}

/**
 * 从手牌/牌库中推断角色（通过个人专属牌）
 */
export function inferCharacterFromCards(
  cards: Record<string, CardCount>,
  cardLib: Record<string, CardLibEntry>
): PlayerInfo | null {
  for (const cardName of Object.keys(cards)) {
    const normalized = normalizeCardName(cardName);
    const entry = cardLib[cardName] || cardLib[normalized];
    if (entry && entry.type === "personal") {
      const character = entry.category;
      return {
        username: "",
        character,
        characterName: CHARACTER_NAMES[character] || character,
        sect: CHARACTER_SECTS[character] || "unknown",
        phase: 1,
        sideJobs: [],
      };
    }
  }
  return null;
}

export interface CardStats {
  attack?: number;
  randomAttack?: number;
  attackCount?: number;
  def?: number;
  randomDef?: number;
  anima?: number;
  jianYi?: number;
  guaXiang?: number;
  physique?: number;
  hpCost?: number;
  chargeQi?: number;
  actionAgain?: boolean;
  otherParams?: number[];
}

export interface CardDataEntry {
  name: string;
  phase: number;
  category: string;
  type: string;       // "sect" | "side-job" | "character" | ""
  effect: string;
  effectRaw: string;
  stats?: Record<string, CardStats>;  // rarity → numeric stats
}

// 中文角色名 → 英文ID 的反向映射
const CHARACTER_NAME_REVERSE: Record<string, string> = {};
for (const [id, cn] of Object.entries(CHARACTER_NAMES)) {
  CHARACTER_NAME_REVERSE[cn] = id;
}

// 门派 category 列表
const SECT_CATEGORIES = new Set(["cloud-spirit", "heptastar", "five-element", "duan-xuan"]);
// 副职 category 列表
const SIDE_JOB_CATEGORIES = new Set([
  "elixirist", "fortune", "musician", "painter",
  "array-master", "body-forging", "beast-tamer",
]);

/**
 * 根据手牌信息修正角色检测结果
 * 使用 cardData（protobuf 解析的精确数据）分析手牌中的门派牌、副职牌、角色专属牌和境界
 */
export function refinePlayerFromCards(
  player: PlayerInfo | null,
  handCards: Record<string, CardCount>,
  cardData: Record<string, CardDataEntry>,
  cardLib: Record<string, CardLibEntry>,
): PlayerInfo {
  const sectCounts: Record<string, number> = {};
  const sideJobCounts: Record<string, number> = {};
  let detectedCharacter: string | null = null;
  let maxPhase = 0;

  for (const [cardName, info] of Object.entries(handCards)) {
    const normalized = normalizeCardName(cardName);
    const cd = cardData[cardName] || cardData[normalized];
    const lib = cardLib[cardName] || cardLib[normalized];

    const type = cd?.type || lib?.type || "";
    const category = cd?.category || lib?.category || "";
    const phase = cd?.phase || lib?.phase || 0;

    if (phase > maxPhase) maxPhase = phase;

    if (type === "sect" && SECT_CATEGORIES.has(category)) {
      sectCounts[category] = (sectCounts[category] || 0) + info.count;
    } else if (type === "side-job" && SIDE_JOB_CATEGORIES.has(category)) {
      sideJobCounts[category] = (sideJobCounts[category] || 0) + info.count;
    } else if (type === "character" || type === "personal") {
      // cardData 中 type="character", category 是角色英文名 (如 "JiangXiming")
      // cardLib 中 type="personal", category 是角色英文名
      if (!detectedCharacter) {
        detectedCharacter = category;
      }
    }
  }

  // 推断门派：手牌中数量最多的门派牌
  const inferredSect = Object.keys(sectCounts).length > 0
    ? Object.entries(sectCounts).reduce((a, b) => (a[1] >= b[1] ? a : b))[0]
    : null;

  // 推断副职：按牌数排序
  const inferredSideJobs = Object.entries(sideJobCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);

  // 构建最终结果
  const base: PlayerInfo = player || {
    username: "",
    character: "",
    characterName: "",
    sect: "unknown",
    phase: 1,
    sideJobs: [],
  };

  // 修正角色名：如果手牌中有角色专属牌且基础信息缺失或不一致
  let character = base.character;
  let characterName = base.characterName;
  let sect = base.sect;

  if (detectedCharacter) {
    const charCN = CHARACTER_NAMES[detectedCharacter];
    if (charCN) {
      // 如果 BattleLog 没有检测到角色，或角色不一致，用手牌修正
      if (!character || character !== detectedCharacter) {
        character = detectedCharacter;
        characterName = charCN;
      }
      // 从角色修正门派
      const charSect = CHARACTER_SECTS[detectedCharacter];
      if (charSect) sect = charSect;
    }
  }

  // 修正门派：如果 BattleLog 没有给出门派或为 unknown，用手牌推断
  if (sect === "unknown" && inferredSect) {
    sect = inferredSect;
  }

  // 修正境界：取 BattleLog 境界与手牌最高境界中较大的
  const phase = Math.max(base.phase, maxPhase);

  // 修正副职：合并 BattleLog 和手牌推断的副职
  const sideJobSet = new Set([...base.sideJobs, ...inferredSideJobs]);
  const sideJobs = Array.from(sideJobSet);

  return {
    username: base.username,
    character,
    characterName,
    sect,
    phase,
    sideJobs,
  };
}
