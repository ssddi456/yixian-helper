import { simulateBattle } from "./battleSimulator";
import { analyzeCounters, inferDeckTraits } from "./counterMatrix";
import { CardEntry, BattleResultData } from "./types";
import { getCardData } from "./logWatcher";

const CACHE_MAX_SIZE = 20;
const simulationCache = new Map<string, BattleResultData>();

function getDeckKey(cards: { name: string; level: number }[]): string {
  return [...cards]
    .sort((a, b) => a.name.localeCompare(b.name) || a.level - b.level)
    .map(c => `${c.name}:${c.level}`)
    .join("|");
}

/**
 * 处理战斗模拟请求：根据用户选择的上阵卡牌执行模拟。
 * 结果按牌组指纹缓存，相同牌组重复提交时直接返回缓存。
 */
export function handleSimulateBattle(
  selectedCards: { name: string; level: number }[],
): BattleResultData {
  const cacheKey = getDeckKey(selectedCards);

  const cached = simulationCache.get(cacheKey);
  if (cached) {
    console.log(`[SimulateBattle] 命中缓存: ${selectedCards.map(c => c.name).join(", ")}`);
    return cached;
  }

  const simCards: CardEntry[] = selectedCards.map(c => ({
    name: c.name,
    level: c.level,
  }));

  const cardData = getCardData();
  const battleSimulation = simulateBattle(simCards, cardData);
  const deckTraits = inferDeckTraits(battleSimulation);
  const counterAnalysis = analyzeCounters(deckTraits);

  console.log(`[SimulateBattle] 战斗模拟: ${simCards.map(c => c.name).join(", ")}`);

  const result: BattleResultData = { battleSimulation, counterAnalysis };

  // FIFO eviction when cache is full
  if (simulationCache.size >= CACHE_MAX_SIZE) {
    simulationCache.delete(simulationCache.keys().next().value!);
  }
  simulationCache.set(cacheKey, result);

  return result;
}
