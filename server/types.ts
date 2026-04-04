// 服务器端类型定义
export * from "../shared/types";

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
