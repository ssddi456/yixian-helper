import * as fs from "fs";
import * as path from "path";
import { DeckGuide, DeckRecommendation, CardCount, CardLibEntry, GuideCardEntry } from "./types";
import { normalizeCardName } from "./logParser";

interface DeckGuidesData {
  decks: Record<string, {
    id: string;
    sect_id: number;
    deck_id: number;
    sect: string;
    title: string;
    description: string;
    is_pro_picked: boolean;
    phases: Record<string, {
      cards: string[][];  // variants
      descs: string[];
    }>;
  }>;
}

let deckGuides: DeckGuide[] = [];

/**
 * 加载牌组指南数据（从 protobuf 解包生成的 deck_guides.json）
 */
export function loadDeckGuides(_cardLib: Record<string, CardLibEntry>): void {
  try {
    const dataPath = path.join(__dirname, "..", "src", "data", "deck_guides.json");
    const raw: DeckGuidesData = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

    deckGuides = [];
    for (const deck of Object.values(raw.decks)) {
      const phaseCards: Record<number, string[]> = {};
      const phaseDescs: Record<number, string[]> = {};

      for (const [phaseStr, phaseData] of Object.entries(deck.phases)) {
        const phase = parseInt(phaseStr);
        if (phaseData.cards.length > 0) {
          phaseCards[phase] = phaseData.cards[0].map((c) => normalizeCardName(c));
        }
        if (phaseData.descs.length > 0) {
          phaseDescs[phase] = phaseData.descs;
        }
      }

      deckGuides.push({
        id: deck.id,
        sectId: deck.sect_id,
        deckId: deck.deck_id,
        title: deck.title,
        description: deck.description,
        sect: deck.sect,
        isProPicked: deck.is_pro_picked,
        characterHint: deck.is_pro_picked ? deck.title : "",
        phaseCards,
        phaseDescs,
      });
    }

    console.log(`[DeckGuide] 已加载 ${deckGuides.length} 个牌组指南`);
  } catch (e) {
    console.error("[DeckGuide] 加载牌组指南失败:", e);
  }
}

/**
 * 获取牌组在当前境界的推荐卡牌（使用最近可用境界的牌列）
 */
function getGuideCardsForPhase(guide: DeckGuide, phase: number): string[] {
  for (let p = phase; p >= 1; p--) {
    if (guide.phaseCards[p] && guide.phaseCards[p].length > 0) {
      return guide.phaseCards[p];
    }
  }
  return [];
}

/**
 * 构建玩家卡牌计数表（标准化名称 → 持有数量）
 */
function buildPlayerCardCounts(playerCards: Record<string, CardCount>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const [name, card] of Object.entries(playerCards)) {
    const normalized = normalizeCardName(name);
    counts.set(normalized, (counts.get(normalized) || 0) + card.count);
  }
  return counts;
}

/**
 * 计算持有覆盖度：玩家持有的牌能覆盖推荐牌组多少张（考虑数量）
 * 返回 { coverage, cardEntries }
 *   coverage: 0-1，覆盖的张数 / 推荐总张数
 *   cardEntries: 每张牌的详细匹配信息（保持牌序）
 */
function computeCoverage(
  guideCards: string[],
  playerCounts: Map<string, number>
): { coverage: number; cardEntries: GuideCardEntry[] } {
  // 统计推荐牌组中每张牌需要几张（保留顺序和重复）
  const remaining = new Map<string, number>();
  for (const [name, count] of playerCounts) {
    remaining.set(name, count);
  }

  let matched = 0;
  const cardEntries: GuideCardEntry[] = guideCards.map((name, index) => {
    const have = remaining.get(name) || 0;
    const owned = have > 0;
    if (owned) {
      remaining.set(name, have - 1);
      matched++;
    }
    return { name, index, owned };
  });

  const coverage = guideCards.length > 0 ? (matched / guideCards.length) : 0;
  return { coverage, cardEntries };
}

/**
 * 推荐匹配的牌组指南
 * 以持有覆盖度（玩家持有牌覆盖推荐牌组的比例）作为推荐排序指标
 */
export function recommendDeckGuides(
  playerCards: Record<string, CardCount>,
  playerSect: string,
  playerPhase: number,
  characterName: string
): DeckRecommendation[] {
  if (deckGuides.length === 0) return [];

  const phase = Math.max(1, Math.min(5, playerPhase || 1));
  const playerCounts = buildPlayerCardCounts(playerCards);

  const candidates = deckGuides.filter((guide) => guide.sect === playerSect);
  if (candidates.length === 0) return [];

  const results: DeckRecommendation[] = [];

  for (const guide of candidates) {
    const guideCards = getGuideCardsForPhase(guide, phase);
    const phaseAdvice = guide.phaseDescs[phase] || [];

    if (guideCards.length === 0) {
      results.push({
        guide,
        coverage: 0,
        matchedCards: [],
        allGuideCards: [],
        totalGuideCards: 0,
        phaseAdvice,
      });
      continue;
    }

    const { coverage, cardEntries } = computeCoverage(guideCards, playerCounts);
    const matchedCards = cardEntries.filter((e) => e.owned).map((e) => e.name);

    let finalCoverage = coverage;
    // 高手精选且角色匹配时加分
    if (guide.isProPicked && characterName && guide.characterHint.includes(characterName)) {
      finalCoverage = Math.min(1, finalCoverage * 1.2 + 0.05);
    }

    results.push({
      guide,
      coverage: finalCoverage,
      matchedCards,
      allGuideCards: cardEntries,
      totalGuideCards: guideCards.length,
      phaseAdvice,
    });
  }

  results.sort((a, b) => b.coverage - a.coverage);
  return results.slice(0, 3);
}
