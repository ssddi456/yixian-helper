// 共享类型定义 - 服务器和前端都使用

export interface CardLibEntry {
  name?: string;
  phase: number;
  type: string;       // "sect" | "side-jobs" | "" | "fortune"
  category: string;   // "cloud-spirit" | "elixirist" | "body-forging" | ...
  "match-recommend": boolean;
  "deck-recommend"?: boolean;
}

export interface CardCount {
  count: number;
  phase?: number;
  category?: string;
  effect?: string;
  rarity?: number;
}

export interface HandCard {
  name: string;
  count: number;
}

export interface ArchetypeDefinition {
  id: string;
  name: string;           // 中文流派名称
  description: string;    // 流派描述
  coreCards: string[];     // 核心牌名称列表
  recommendCards: string[]; // 推荐牌名称列表
  category: string;        // 对应 card_lib 的 category
  type: "sect" | "side-jobs";
}

export interface ArchetypeMatch {
  archetype: ArchetypeDefinition;
  similarity: number;      // 0-1 相似度评分
  matchedCoreCards: string[];
  matchedRecommendCards: string[];
  totalCoreCards: number;
  totalRecommendCards: number;
}

export interface PlayerInfo {
  username: string;
  character: string;
  characterName: string;
  sect: string;
  phase: number;
  sideJobs: string[];
}

export interface DeckGuide {
  id: string;
  sectId: number;
  deckId: number;
  title: string;
  description: string;
  sect: string;
  isProPicked: boolean;
  characterHint: string;
  phaseCards: Record<number, string[]>;
  phaseDescs: Record<number, string[]>;
}

export interface GuideCardEntry {
  name: string;
  index: number;
  owned: boolean;
}

export interface DeckRecommendation {
  guide: DeckGuide;
  coverage: number;
  matchedCards: string[];
  allGuideCards: GuideCardEntry[];
  totalGuideCards: number;
  phaseAdvice: string[];
}

export interface GameStatus {
  inGame: boolean;
  status: "waiting" | "in_game" | "idle";
  player?: PlayerInfo;
}

export interface DeckAnalysis {
  handCards: Record<string, CardCount>;
  deckCards: Record<string, CardCount>;
  archetypeMatches: ArchetypeMatch[];
  deckRecommendations: DeckRecommendation[];
}

// ===== 战斗模拟类型 =====
export interface CardEffect {
  type: string;
  subType: string;
  target: "self" | "enemy";
  description: string;
  value?: number;
}

export interface BattleState {
  selfBuffs: Record<string, number>;
  enemyDebuffs: Record<string, number>;
  attackActions: number;
  totalHits: number;
  defenseActions: number;
  healActions: number;
  spiritGains: number;
  physiqueGains: number;
  totalAttackDamage: number;
  totalDefense: number;
  totalPhysique: number;
  totalSpirit: number;
  totalJianYi: number;
  totalGuaXiang: number;
  totalHpCost: number;
}

export interface SimulationStep {
  cardName: string;
  cardPhase: number;
  effects: CardEffect[];
  stateAfter: BattleState;
}

export interface RoundSummary {
  steps: SimulationStep[];
  finalState: BattleState;
}

export interface BattleSimulation {
  round1: RoundSummary;
  round2: RoundSummary;
  handCardNames: string[];
}

// ===== 克制关系类型 =====
export interface CounterRelation {
  id: string;
  mechanism: string;
  description: string;
  counters: string;
  examples: string[];
  icon: string;
}

export interface CounterAnalysis {
  relations: CounterRelation[];
  deckStrengths: string[];
  deckWeaknesses: string[];
}

// ===== 完整分析（含模拟和克制）=====
export interface FullAnalysis extends DeckAnalysis {
  // battleSimulation 和 counterAnalysis 改为按需模拟
}

// ===== 战斗模拟结果 =====
export interface BattleResultData {
  battleSimulation: BattleSimulation;
  counterAnalysis: CounterAnalysis;
}

// 客户端→服务端消息
export interface PlayerOverride {
  character?: string;
  phase?: number;
  sideJobs?: string[];
}

// WebSocket 消息类型
export type WSMessage =
  | { type: "game_status"; data: GameStatus }
  | { type: "deck_analysis"; data: FullAnalysis }
  | { type: "battle_result"; data: BattleResultData }
  | { type: "version"; data: { version: string } }
  | { type: "error"; data: { message: string } };

export type ClientWSMessage =
  | { type: "set_player_override"; data: PlayerOverride }
  | { type: "clear_player_override" }
  | { type: "simulate_battle"; data: { selectedCards: Record<string, number> } };
