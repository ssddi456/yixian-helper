import * as fs from "fs";
import * as path from "path";
import { watch } from "chokidar";
import {
  getGamePath,
  parseCardOperationLog,
  calculateDeckCards,
  calculateHandCards,
  parseBattleLog,
  isInGame,
  readPlayerFromBattleLog,
  refinePlayerFromCards,
} from "./logParser";
import { analyzeArchetypes } from "./archetypeAnalyzer";
import { loadDeckGuides, recommendDeckGuides } from "./deckGuideRecommender";
import { CardLibEntry, DeckAnalysis, GameStatus, WSMessage, PlayerInfo } from "./types";

// 加载卡牌库
const cardLibPath = path.join(__dirname, "..", "src", "data", "card_lib.json");
const seasonalLibPath = path.join(
  __dirname,
  "..",
  "src",
  "data",
  "seasonal_card_lib.json"
);
const cardDataPath = path.join(__dirname, "..", "src", "data", "card_data.json");

import type { CardDataEntry } from "./logParser";

let cardLib: Record<string, CardLibEntry> = {};
let cardData: Record<string, CardDataEntry> = {};
try {
  const main = JSON.parse(fs.readFileSync(cardLibPath, "utf-8"));
  const seasonal = JSON.parse(fs.readFileSync(seasonalLibPath, "utf-8"));
  cardLib = { ...main, ...seasonal };
  cardData = JSON.parse(fs.readFileSync(cardDataPath, "utf-8"));
  console.log(`[LogWatcher] 已加载 ${Object.keys(cardLib).length} 张卡牌库 + ${Object.keys(cardData).length} 张卡牌详情`);
  // 加载牌组指南
  loadDeckGuides(cardLib);
} catch (e) {
  console.error("[LogWatcher] 加载卡牌库失败:", e);
}

type BroadcastFn = (msg: WSMessage) => void;

let broadcast: BroadcastFn = () => {};
let watcher: ReturnType<typeof watch> | null = null;

// 文件变更追踪：记录上次处理时的 mtime
const fileMtimes: Record<string, number> = {};
// 缓存上次处理结果，避免无变更时重复计算
let cachedResult: { status: GameStatus; analysis: DeckAnalysis | null } | null = null;

/**
 * 检查监听文件是否有更新（比较 mtime）
 * 返回 true 表示有文件变更需要重新处理
 */
function checkFilesChanged(gamePath: string): boolean {
  const files = [
    path.join(gamePath, "CardOperationLog.json"),
    path.join(gamePath, "BattleLog.json"),
  ];

  let changed = false;
  for (const filePath of files) {
    try {
      const stat = fs.statSync(filePath);
      const mtime = stat.mtimeMs;
      if (fileMtimes[filePath] !== mtime) {
        fileMtimes[filePath] = mtime;
        changed = true;
      }
    } catch {
      // 文件不存在时，如果之前有记录则视为变更
      if (fileMtimes[filePath] !== undefined) {
        delete fileMtimes[filePath];
        changed = true;
      }
    }
  }
  return changed;
}

/**
 * 处理游戏日志变更，返回分析结果
 * @param force 强制重新解析（忽略 mtime 缓存）
 */
function processGameState(force = false): { status: GameStatus; analysis: DeckAnalysis | null } {
  const gamePath = getGamePath();

  // 检查文件是否有变更，无变更时返回缓存
  if (!force && cachedResult && !checkFilesChanged(gamePath)) {
    return cachedResult;
  }

  if (!isInGame(gamePath)) {
    const result = {
      status: { inGame: false, status: "waiting" as const },
      analysis: null,
    };
    // 仅在状态变化时打印日志
    if (cachedResult?.status.inGame !== false || cachedResult?.status.status !== "waiting") {
      console.log("[LogWatcher] 当前不在对局中");
    }
    cachedResult = result;
    return result;
  }

  try {
    // 解析 CardOperationLog
    const opLogPath = path.join(gamePath, "CardOperationLog.json");
    const opContent = fs.readFileSync(opLogPath, "utf-8");
    const operations = parseCardOperationLog(opContent);

    if (!operations) {
      return {
        status: { inGame: false, status: "waiting" },
        analysis: null,
      };
    }

    const handCards = calculateHandCards(operations);
    const deckCards = calculateDeckCards(operations);

    // 给卡牌补充境界、分类、效果信息
    const enrichWithPhase = (cards: Record<string, { count: number }>) => {
      const result: Record<string, { count: number; phase?: number; category?: string; effect?: string }> = {};
      for (const [name, info] of Object.entries(cards)) {
        const cd = cardData[name];
        const libEntry = cardLib[name];
        result[name] = {
          count: info.count,
          phase: cd?.phase || libEntry?.phase,
          category: cd?.category || libEntry?.category,
          effect: cd?.effect,
        };
      }
      return result;
    };
    const handCardsEnriched = enrichWithPhase(handCards);
    const deckCardsEnriched = enrichWithPhase(deckCards);

    // 读取角色信息：BattleLog 为基础，手牌信息修正门派/副职/角色名/境界
    const allCards = { ...handCards, ...deckCards };
    const basePlayer = readPlayerFromBattleLog(gamePath);
    const player = refinePlayerFromCards(basePlayer, allCards, cardData, cardLib);

    // 流派分析
    const archetypeMatches = analyzeArchetypes(handCards, deckCards, cardLib);

    console.log(`[LogWatcher] 状态更新: ${player.characterName || "未知"} (${player.sect}, ${player.phase}境界, 副职: ${player.sideJobs.join("/") || "无"}) 手牌${Object.keys(handCards).length}种 消耗${Object.keys(deckCards).length}种`);

    // 牌组指南推荐（仅对比当前手牌）
    const deckRecommendations = recommendDeckGuides(handCards, player.sect, player.phase, player.characterName);

    const analysis: DeckAnalysis = {
      handCards: handCardsEnriched,
      deckCards: deckCardsEnriched,
      archetypeMatches,
      deckRecommendations,
    };

    const result = {
      status: { inGame: true, status: "in_game" as const, player },
      analysis,
    };
    cachedResult = result;
    return result;
  } catch (e) {
    console.error("[LogWatcher] 处理游戏状态出错:", e);
    const result = {
      status: { inGame: false, status: "idle" as const },
      analysis: null,
    };
    cachedResult = result;
    return result;
  }
}

/**
 * 推送当前状态给所有客户端
 * @param force 强制重新解析并推送
 */
function pushCurrentState(force = false) {
  const prev = cachedResult;
  const { status, analysis } = processGameState(force);

  // 轮询时如果结果未变化则不推送（减少无意义 WS 消息）
  if (!force && prev === cachedResult) return;

  broadcast({ type: "game_status", data: status });
  if (analysis) {
    broadcast({ type: "deck_analysis", data: analysis });
  }
}

/**
 * 启动日志文件监听
 */
export function startLogWatcher(broadcastFn: BroadcastFn) {
  broadcast = broadcastFn;
  const gamePath = getGamePath();

  console.log(`[LogWatcher] 监听游戏路径: ${gamePath}`);

  // 确保目录存在
  if (!fs.existsSync(gamePath)) {
    console.warn(`[LogWatcher] 游戏路径不存在: ${gamePath}`);
    // 仍然启动定时轮询
  }

  const watchFiles = [
    path.join(gamePath, "CardOperationLog.json"),
    path.join(gamePath, "BattleLog.json"),
  ];

  // 使用 chokidar 监听文件变化
  watcher = watch(watchFiles, {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100,
    },
  });

  watcher.on("change", (filePath) => {
    console.log(`[LogWatcher] 文件变更: ${path.basename(filePath)}`);
    pushCurrentState(true);
  });

  watcher.on("add", (filePath) => {
    console.log(`[LogWatcher] 文件出现: ${path.basename(filePath)}`);
    pushCurrentState(true);
  });

  // 定时轮询兜底（每 2 秒），仅在文件 mtime 变化时重新处理
  setInterval(() => {
    pushCurrentState();
  }, 2000);

  // 初始推送
  setTimeout(() => pushCurrentState(true), 500);
}

/**
 * 获取当前状态（用于新连接时发送）
 */
export function getCurrentState(): WSMessage[] {
  const { status, analysis } = processGameState();
  const messages: WSMessage[] = [{ type: "game_status", data: status }];
  if (analysis) {
    messages.push({ type: "deck_analysis", data: analysis });
  }
  return messages;
}

export function stopLogWatcher() {
  watcher?.close();
}
