// 共享类型定义 — server 和 src 共同使用

export interface CardLibEntry {
  name?: string;
  phase: number;
  type: string;       // "sect" | "side-jobs" | "" | "fortune"
  category: string;   // "cloud-spirit" | "elixirist" | "body-forging" | ...
  "match-recommend": boolean;
  "deck-recommend"?: boolean;
}

export interface CardEntryFull {
  name: string;
  phase?: number;       // 卡牌所属境界 (1-6)
  category?: string;    // 门派/副职分类
  effect?: string;      // 卡牌效果描述
  rarity?: number;      // 合成等级 (0, 1, 2)
  level: number;        // 卡牌稀有度 (0=普通, 1=稀有, 2=史诗)
}

export interface CardCount {
  name: string;
  level: number;       // 卡牌稀有度 (0=普通, 1=稀有, 2=史诗)
  count: number;       // 持有数量
}

/** 单张卡牌条目（用于手牌/牌组数组） */
export interface CardEntry {
  name: string;
  level: number;       // 卡牌稀有度 (0=普通, 1=稀有, 2=史诗)
  rarity: number;     // 合成等级 (0, 1, 2)
}

export interface ArchetypeDefinition {
  id: string;
  name: string;           // 中文流派名称
  description: string;    // 流派描述
  coreCards: string[];    // 核心牌名称列表
  recommendCards: string[]; // 推荐牌名称列表
  category: string;       // 对应 card_lib 的 category
  type: "sect" | "side-jobs";
}

export interface ArchetypeMatch {
  archetype: ArchetypeDefinition;
  similarity: number;           // 0-1 相似度评分
  matchedCoreCards: string[];
  matchedRecommendCards: string[];
  totalCoreCards: number;
  totalRecommendCards: number;
}

export interface PlayerInfo {
  username: string;
  character: string;        // 英文 ID，如 "YeMingming"
  characterName: string;    // 中文名，如 "夜冥冥"
  sect: string;             // 门派 category，如 "duan-xuan"
  phase: number;            // 当前境界 1-5 (炼气/筑基/金丹/元婴/化神)
  sideJobs: string[];       // 副职列表，如 ["body-forging", "musician"]
}

export interface DeckGuide {
  id: string;               // 如 "1_1"
  sectId: number;           // 1-4
  deckId: number;           // 牌组编号
  title: string;            // 中文标题
  description: string;      // 总体描述
  sect: string;             // "cloud-spirit" | "heptastar" | "five-element" | "duan-xuan"
  isProPicked: boolean;     // 是否为高手精选 (deckId >= 6)
  characterHint: string;    // 高手精选的角色提示（从标题提取）
  phaseCards: Record<number, string[]>;  // 每个境界提到的卡牌名
  phaseDescs: Record<number, string[]>;  // 每个境界的描述文本
}

export interface GuideCardEntry {
  name: string;             // 卡牌名
  index: number;            // 在牌组中的位置（牌序）
  owned: boolean;           // 玩家是否持有
}

export interface DeckRecommendation {
  guide: DeckGuide;
  coverage: number;         // 0-1 持有覆盖度
  matchedCards: string[];   // 命中的卡牌名列表
  allGuideCards: GuideCardEntry[];  // 牌组牌序（保留顺序和重复）
  totalGuideCards: number;  // 推荐牌总张数
  phaseAdvice: string[];    // 当前境界的建议
}

export interface GameStatus {
  inGame: boolean;
  status: "waiting" | "in_game" | "idle";
  player?: PlayerInfo;
}

export interface DeckAnalysis {
  handCards: CardEntry[];
  deckCards: CardCount[];
  handCardCounts: CardEntryFull[];
  deckCardCounts: CardCount[];
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
  actionAgain?: number;
  chargeQi?: number;
  multiplier?: number;
  duration?: number;
  repeatCount?: number;     // 重复执行次数（服务端模拟内部使用）
  sourceLine?: number;      // effectRaw 中的来源行号（服务端模拟内部使用）
}

export interface BattleState {
  selfBuffs: Record<string, number>;
  selfBuffValues: Record<string, number>;
  enemyDebuffs: Record<string, number>;
  enemyDebuffValues: Record<string, number>;
  attackActions: number;
  totalHits: number;
  defenseActions: number;
  healActions: number;
  spiritGains: number;
  physiqueGains: number;
  actionAgainCount: number;    // 再次行动触发次数
  chargeQiTotal: number;       // 蓄灵总消耗
  totalAttackDamage: number;   // 总基础攻击伤害（未计算加成）
  totalDefense: number;        // 总防御值
  totalPhysique: number;       // 总体魄值
  totalSpirit: number;         // 总灵气获取
  totalJianYi: number;         // 总剑意值
  totalGuaXiang: number;       // 总卦象值
  totalHpCost: number;         // 总生命消耗
  estimatedRealDamage: number; // 考虑剑意加成后的估算伤害
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
  // battleSimulation 和 counterAnalysis 改为按需模拟，不再自动计算
}

// ===== 战斗模拟请求/响应 =====
export interface BattleResultData {
  battleSimulation: BattleSimulation;
  counterAnalysis: CounterAnalysis;
}

// 客户端→服务端消息
export interface PlayerOverride {
  character?: string;       // 英文 ID，如 "YeMingming"
  phase?: number;           // 境界 1-5
  sideJobs?: string[];      // 副职列表
}

export interface GameConnectionStatus {
  gameRunning: boolean;
  pid?: number;
  serverAddr?: string;
  serverPort?: number;
  connectionCount?: number;
}

// WebSocket 消息类型
export type WSMessage =
  | { type: "game_status"; data: GameStatus }
  | { type: "deck_analysis"; data: FullAnalysis }
  | { type: "battle_result"; data: BattleResultData }
  | { type: "version"; data: { version: string } }
  | { type: "error"; data: { message: string } }
  | { type: "game_connection_status"; data: GameConnectionStatus };

export type ClientWSMessage =
  | { type: "set_player_override"; data: PlayerOverride }
  | { type: "clear_player_override" }
  | { type: "simulate_battle"; data: { selectedCards: CardEntry[] } };
