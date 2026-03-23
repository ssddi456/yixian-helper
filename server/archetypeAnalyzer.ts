import { CardCount, CardLibEntry, ArchetypeMatch } from "./types";
import { ArchetypeDefinition, ARCHETYPES } from "./archetypes";
import { normalizeCardName } from "./logParser";

/**
 * 流派分析引擎
 * 根据当前手牌和牌库消耗情况，分析最匹配的流派
 */

/**
 * 计算流派相似度
 * 算法：
 *   - 核心牌权重 0.7，推荐牌权重 0.3
 *   - 相似度 = (匹配核心牌数/总核心牌数) * 0.7 + (匹配推荐牌数/总推荐牌数) * 0.3
 */
export function calculateArchetypeSimilarity(
  archetype: ArchetypeDefinition,
  playerCards: Set<string>,
  cardLib: Record<string, CardLibEntry>
): ArchetypeMatch {
  const normalizedPlayerCards = new Set<string>();
  for (const card of playerCards) {
    normalizedPlayerCards.add(card);
    normalizedPlayerCards.add(normalizeCardName(card));
  }

  const matchedCoreCards: string[] = [];
  const matchedRecommendCards: string[] = [];

  for (const coreName of archetype.coreCards) {
    if (
      normalizedPlayerCards.has(coreName) ||
      normalizedPlayerCards.has(normalizeCardName(coreName))
    ) {
      matchedCoreCards.push(coreName);
    }
  }

  for (const recName of archetype.recommendCards) {
    if (
      normalizedPlayerCards.has(recName) ||
      normalizedPlayerCards.has(normalizeCardName(recName))
    ) {
      matchedRecommendCards.push(recName);
    }
  }

  const totalCore = archetype.coreCards.length || 1;
  const totalRec = archetype.recommendCards.length || 1;

  const coreSimilarity = matchedCoreCards.length / totalCore;
  const recSimilarity = matchedRecommendCards.length / totalRec;

  // 加权: 核心牌 70%, 推荐牌 30%
  const similarity = coreSimilarity * 0.7 + recSimilarity * 0.3;

  return {
    archetype,
    similarity: Math.round(similarity * 1000) / 1000,
    matchedCoreCards,
    matchedRecommendCards,
    totalCoreCards: archetype.coreCards.length,
    totalRecommendCards: archetype.recommendCards.length,
  };
}

/**
 * 分析所有流派，返回按相似度降序排列的结果
 */
export function analyzeArchetypes(
  handCards: Record<string, CardCount>,
  deckCards: Record<string, CardCount>,
  cardLib: Record<string, CardLibEntry>
): ArchetypeMatch[] {
  // 合并手牌和牌库消耗牌作为玩家当前拥有/使用的牌
  const allPlayerCards = new Set<string>();

  for (const name of Object.keys(handCards)) {
    allPlayerCards.add(name);
  }
  for (const name of Object.keys(deckCards)) {
    allPlayerCards.add(name);
  }

  // 同时根据 card_lib 的 category 添加已知门派/副职牌
  for (const name of allPlayerCards) {
    const normalized = normalizeCardName(name);
    if (cardLib[normalized]) {
      allPlayerCards.add(normalized);
    }
  }

  const results: ArchetypeMatch[] = [];

  for (const archetype of ARCHETYPES) {
    const match = calculateArchetypeSimilarity(archetype, allPlayerCards, cardLib);
    // 只返回有匹配的流派
    if (match.similarity > 0) {
      results.push(match);
    }
  }

  // 按相似度降序
  results.sort((a, b) => b.similarity - a.similarity);

  return results;
}

/**
 * 基于 card_lib 的 category 推断玩家可能的门派和副职
 */
export function inferPlayerAffinities(
  cards: Record<string, CardCount>,
  cardLib: Record<string, CardLibEntry>
): { sect: string; sideJobs: string[] } {
  const sectCounts: Record<string, number> = {};
  const sideJobSet = new Set<string>();

  for (const [name, info] of Object.entries(cards)) {
    const normalized = normalizeCardName(name);
    const entry = cardLib[name] || cardLib[normalized];
    if (!entry) continue;

    if (entry.type === "sect") {
      sectCounts[entry.category] =
        (sectCounts[entry.category] || 0) + info.count;
    }
    if (entry.type === "side-jobs") {
      sideJobSet.add(entry.category);
    }
  }

  const sect =
    Object.keys(sectCounts).length > 0
      ? Object.entries(sectCounts).reduce((a, b) => (a[1] >= b[1] ? a : b))[0]
      : "unknown";

  return { sect, sideJobs: Array.from(sideJobSet) };
}
