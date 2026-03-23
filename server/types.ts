// 服务器端类型定义

export interface CardLibEntry {
  name?: string;
  phase: number;
  type: string;
  category: string;
  "match-recommend": boolean;
  "deck-recommend"?: boolean;
}

export interface CardCount {
  count: number;
  phase?: number;       // 卡牌所属境界 (1-6)
  category?: string;    // 门派/副职分类
  effect?: string;      // 卡牌效果描述
}

export interface BattleLogCard {
  name: string;
  level: number;
  rarity: number;
}

export interface BattleLogPlayer {
  username: string;
  character: string;
  life: number;
  lifeDelta: number;
  maxHp: number;
  exp: number;
  level: number;
  opponentUsername: string;
  usedCards: BattleLogCard[];
  tiPo?: number;
  maxTiPo?: number;
}

export interface BattleLogRound {
  round: number;
  players: BattleLogPlayer[];
}

export interface CardOperation {
  operation: number; // 0=draw, 1=replace, 2=use
  round: number;
  srcCard: { name: string | null; level: number; rarity: number };
  dstCard: { name: string | null; level: number; rarity: number };
  cards: { name: string | null; level: number; rarity: number }[] | null;
}

export interface ArchetypeDefinition {
  id: string;
  name: string;
  description: string;
  coreCards: string[];
  recommendCards: string[];
  category: string;
  type: "sect" | "side-jobs";
}

export interface ArchetypeMatch {
  archetype: ArchetypeDefinition;
  similarity: number;
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
  handCards: Record<string, CardCount>;
  deckCards: Record<string, CardCount>;
  archetypeMatches: ArchetypeMatch[];
  deckRecommendations: DeckRecommendation[];
}

export type WSMessage =
  | { type: "game_status"; data: GameStatus }
  | { type: "deck_analysis"; data: DeckAnalysis }
  | { type: "error"; data: { message: string } };
