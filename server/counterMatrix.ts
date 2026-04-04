/**
 * 流派克制关系矩阵
 * 基于游戏机制的克制逻辑
 */

export interface CounterRelation {
  id: string;
  mechanism: string;       // 克制机制名
  description: string;     // 描述
  counters: string;        // 克制的对象
  examples: string[];      // 具体例子
  icon: string;            // 显示图标
}

export const COUNTER_RELATIONS: CounterRelation[] = [
  {
    id: "shield-vs-burst",
    mechanism: "星弈断 / 护体",
    description: "高额护体或星弈断可抵消单发高伤，让对手的大招打不出预期伤害",
    counters: "单发高伤",
    examples: [
      "星弈•断 — 触发时免疫一次攻击",
      "护体 — 叠层吸收大额单次伤害",
      "辟邪 — 免疫负面效果的同时保护血线",
    ],
    icon: "🛡️",
  },
  {
    id: "reduce-atk-vs-multi",
    mechanism: "减功",
    description: "每段攻击都受减攻影响，多段打击受减攻的惩罚被放大N倍",
    counters: "多段输出",
    examples: [
      "减攻层数 × 攻击段数 = 实际减伤总量",
      "万花迷魂阵 — 持续施加减攻",
      "弱体符 — 降低对手攻击力",
    ],
    icon: "⚔️",
  },
  {
    id: "burst-vs-growth",
    mechanism: "爆发",
    description: "在对手发育完成前以高爆发击杀，不给堆叠Buff的机会",
    counters: "发育型",
    examples: [
      "早期高攻卡快速打出伤害",
      "百杀破境掌 — 高额即时伤害",
      "五雷轰顶 — 直接爆发",
    ],
    icon: "💥",
  },
  {
    id: "drain-vs-spirit",
    mechanism: "减灵气",
    description: "消耗或封锁对手灵气，让依赖灵气的高阶技能无法释放",
    counters: "依赖灵气",
    examples: [
      "封灵 — 阻止灵气获取",
      "吸灵符 — 夺取对手灵气",
      "耗尽灵气类卡牌的效果被削弱",
    ],
    icon: "🌀",
  },
];

export interface CounterAnalysis {
  relations: CounterRelation[];
  deckStrengths: string[];    // 当前牌组的优势克制
  deckWeaknesses: string[];   // 当前牌组的弱点
}

/**
 * 分析当前手牌的克制关系
 */
export function analyzeCounters(
  handEffectSummary: {
    hasShield: boolean;        // 有护体/辟邪
    hasReduceAtk: boolean;     // 有减攻
    hasBurst: boolean;         // 有高爆发
    hasDrainSpirit: boolean;   // 有减灵气/封灵
    isMultiHit: boolean;       // 多段输出型
    isSingleBurst: boolean;    // 单发高伤型
    isGrowth: boolean;         // 发育型（多buff堆叠）
    needsSpirit: boolean;      // 依赖灵气
  }
): CounterAnalysis {
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (handEffectSummary.hasShield) {
    strengths.push("护体/星弈断 → 克制单发高伤");
  }
  if (handEffectSummary.hasReduceAtk) {
    strengths.push("减功 → 克制多段输出");
  }
  if (handEffectSummary.hasBurst) {
    strengths.push("高爆发 → 克制发育型");
  }
  if (handEffectSummary.hasDrainSpirit) {
    strengths.push("减灵气 → 克制灵气依赖型");
  }

  if (handEffectSummary.isMultiHit) {
    weaknesses.push("多段输出 → 被减功克制");
  }
  if (handEffectSummary.isSingleBurst) {
    weaknesses.push("单发高伤 → 被护体/星弈断克制");
  }
  if (handEffectSummary.isGrowth) {
    weaknesses.push("发育型 → 被高爆发克制");
  }
  if (handEffectSummary.needsSpirit) {
    weaknesses.push("依赖灵气 → 被减灵气克制");
  }

  return {
    relations: COUNTER_RELATIONS,
    deckStrengths: strengths,
    deckWeaknesses: weaknesses,
  };
}

/**
 * 从战斗模拟结果推断牌组特征
 */
export function inferDeckTraits(simulation: {
  round1: {
    finalState: {
      selfBuffs: Record<string, number>;
      enemyDebuffs: Record<string, number>;
      attackActions: number;
      totalHits: number;
      spiritGains: number;
      totalAttackDamage?: number;
      totalDefense?: number;
      totalJianYi?: number;
      totalGuaXiang?: number;
      totalHpCost?: number;
    };
    steps: Array<{ effects: Array<{ type: string; subType: string }> }>;
  };
}) {
  const s = simulation.round1.finalState;
  const buffCount = Object.values(s.selfBuffs).reduce((a, b) => a + b, 0);
  const totalDmg = s.totalAttackDamage ?? 0;
  const totalDef = s.totalDefense ?? 0;

  // 检查是否有灵气消耗类效果
  const hasSpritConsume = simulation.round1.steps.some(step =>
    step.effects.some(e => e.subType === "灵气" || /灵气/.test(e.subType))
  );

  return {
    hasShield: (s.selfBuffs["护体"] || 0) > 0 || (s.selfBuffs["辟邪"] || 0) > 0,
    hasReduceAtk: (s.enemyDebuffs["减攻"] || 0) > 0 || (s.enemyDebuffs["虚弱"] || 0) > 0,
    hasBurst: s.attackActions >= 3 && buffCount < 3,
    hasDrainSpirit: (s.enemyDebuffs["封灵"] || 0) > 0,
    isMultiHit: s.totalHits > s.attackActions * 1.5,
    isSingleBurst: s.attackActions <= 2 && s.totalHits <= 3,
    isGrowth: buffCount >= 5,
    needsSpirit: s.spiritGains >= 3 || hasSpritConsume,
    isHighDamage: totalDmg >= 40,
    isHighDefense: totalDef >= 20,
    isJianYiFocused: (s.totalJianYi ?? 0) >= 4,
    isGuaXiangFocused: (s.totalGuaXiang ?? 0) >= 3,
  };
}
