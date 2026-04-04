import type { CardDataEntry, CardStats } from "./logParser";
import type { CardCount, CardEffect, BattleState, SimulationStep, RoundSummary, BattleSimulation } from "./types";

// ===== Buff/Debuff 分类 =====

const SELF_BUFFS = new Set([
  "剑意", "加攻", "加防", "护体", "辟邪", "闪避", "聚灵",
  "蓄力", "剑气", "崩劲", "锻体", "连击", "灵感",
  "星力", "棋力", "道果", "灵田", "笔意",
]);

const ENEMY_DEBUFFS = new Set([
  "减攻", "减防", "虚弱", "碎防", "中毒", "灼烧", "流血",
  "封灵", "缠绕", "减速", "混乱", "禁疗",
]);

// ===== 效果解析（数值化） =====

/**
 * 从 CardStats 解析 effectRaw 模板，生成带数值的结构化效果
 */
export function parseCardEffects(effectRaw: string, stats?: CardStats): CardEffect[] {
  if (!effectRaw) return [];

  const effects: CardEffect[] = [];
  const lines = effectRaw.split("\\n");

  const attack = stats?.attack ?? 0;
  const attackCount = stats?.attackCount ?? 1;
  const def = stats?.def ?? 0;
  const jianYi = stats?.jianYi ?? 0;
  const guaXiang = stats?.guaXiang ?? 0;
  const physique = stats?.physique ?? 0;
  const anima = stats?.anima ?? 0;
  const hpCost = stats?.hpCost ?? 0;
  const randomAttack = stats?.randomAttack ?? 0;
  const randomDef = stats?.randomDef ?? 0;
  const otherParams = stats?.otherParams ?? [];

  for (const line of lines) {
    // 多段攻击: {attack}攻×{attackCount}
    if (/攻[×x]\{?attackCount|攻×/.test(line)) {
      const totalDmg = attack * attackCount;
      effects.push({
        type: "multi_attack",
        subType: "多段攻击",
        target: "enemy",
        description: attack ? `${attack}攻×${attackCount}=${totalDmg}` : line.replace(/\{[^}]*\}/g, "N"),
        value: totalDmg,
      });
      continue;
    }

    // 单次攻击: {attack}攻 (不带×)
    if (/\{?attack\}?攻|^\d*攻$/.test(line) && !/×/.test(line)) {
      const desc = attack
        ? (randomAttack ? `${attack}~${randomAttack}攻` : `${attack}攻`)
        : line.replace(/\{[^}]*\}/g, "N");
      effects.push({
        type: "attack",
        subType: "攻击",
        target: "enemy",
        description: desc,
        value: attack || (randomAttack ? Math.floor((attack + randomAttack) / 2) : 0),
      });
    }

    // 防御: [防]+{def}
    if (/防\]?\+|\[防\]/.test(line)) {
      const desc = def
        ? (randomDef ? `防+${def}~${randomDef}` : `防+${def}`)
        : line.replace(/\{[^}]*\}/g, "N");
      effects.push({
        type: "defense",
        subType: "防御",
        target: "self",
        description: desc,
        value: def || (randomDef ? Math.floor((def + randomDef) / 2) : 0),
      });
    }

    // 体魄
    if (/体魄/.test(line)) {
      effects.push({
        type: "physique",
        subType: "体魄",
        target: "self",
        description: physique ? `体魄+${physique}` : line.replace(/\{[^}]*\}/g, "N"),
        value: physique,
      });
    }

    // 灵气 (不含耗尽/消耗)
    if (/灵气/.test(line) && !/耗尽|消耗/.test(line)) {
      const val = anima < 0 ? Math.abs(anima) : anima;
      effects.push({
        type: "spirit",
        subType: "灵气",
        target: "self",
        description: val ? `灵气+${val}` : line.replace(/\{[^}]*\}/g, "N"),
        value: val,
      });
    }

    // 剑意
    if (/剑意/.test(line) && !effects.some(e => e.subType === "剑意")) {
      effects.push({
        type: "buff",
        subType: "剑意",
        target: "self",
        description: jianYi ? `剑意+${jianYi}` : line.replace(/\{[^}]*\}/g, "N"),
        value: jianYi,
      });
    }

    // 卦象
    if (/卦象/.test(line) && !effects.some(e => e.subType === "卦象")) {
      effects.push({
        type: "buff",
        subType: "卦象",
        target: "self",
        description: guaXiang ? `卦象+${guaXiang}` : line.replace(/\{[^}]*\}/g, "N"),
        value: guaXiang,
      });
    }

    // 回血/吸血
    if (/回血|吸血|吸取|回复|恢复.*生命|生命.*恢复/.test(line)) {
      effects.push({
        type: "heal",
        subType: "回复",
        target: "self",
        description: line.replace(/\{[^}]*\}/g, "N"),
      });
    }

    // 持续效果
    if (/\[?持续\]?/.test(line)) {
      effects.push({
        type: "continuous",
        subType: "持续",
        target: "self",
        description: line.replace(/\{[^}]*\}/g, "N"),
      });
    }

    // 自身 buff（剑意/卦象已特殊处理）
    for (const buff of SELF_BUFFS) {
      if (buff === "剑意" || buff === "卦象") continue;
      if (line.includes(buff) && !effects.some(e => e.subType === buff)) {
        // 尝试从 otherParams 或模板中提取数值
        const valMatch = line.match(new RegExp(`(\\{[^}]*\\}|\\d+).*${buff}|${buff}.*?(\\{[^}]*\\}|\\d+)`));
        let val = 0;
        if (valMatch) {
          const raw = valMatch[1] || valMatch[2];
          if (raw && /^\d+$/.test(raw)) val = parseInt(raw);
        }
        effects.push({
          type: "buff",
          subType: buff,
          target: "self",
          description: line.replace(/\{[^}]*\}/g, "N"),
          value: val,
        });
      }
    }

    // 敌方 debuff
    for (const debuff of ENEMY_DEBUFFS) {
      if (line.includes(debuff) && !effects.some(e => e.subType === debuff)) {
        effects.push({
          type: "debuff",
          subType: debuff,
          target: "enemy",
          description: line.replace(/\{[^}]*\}/g, "N"),
        });
      }
    }
  }

  // 负灵气 = 灵气回复（没有被上面捕获的情况）
  if (anima < 0 && !effects.some(e => e.subType === "灵气")) {
    effects.push({
      type: "spirit",
      subType: "灵气",
      target: "self",
      description: `灵气+${Math.abs(anima)}`,
      value: Math.abs(anima),
    });
  }

  // HP cost 作为效果记录
  if (hpCost > 0 && !effects.some(e => e.subType === "生命消耗")) {
    effects.push({
      type: "special",
      subType: "生命消耗",
      target: "self",
      description: `消耗${hpCost}生命`,
      value: hpCost,
    });
  }

  // 如果没有解析到任何效果，标记为特殊
  if (effects.length === 0 && effectRaw.trim()) {
    effects.push({
      type: "special",
      subType: "特殊",
      target: "self",
      description: effectRaw.replace(/\{[^}]*\}/g, "N").replace(/\\n/g, " | "),
    });
  }

  return effects;
}

// ===== 战斗模拟 =====

function createEmptyState(): BattleState {
  return {
    selfBuffs: {},
    enemyDebuffs: {},
    attackActions: 0,
    totalHits: 0,
    defenseActions: 0,
    healActions: 0,
    spiritGains: 0,
    physiqueGains: 0,
    totalAttackDamage: 0,
    totalDefense: 0,
    totalPhysique: 0,
    totalSpirit: 0,
    totalJianYi: 0,
    totalGuaXiang: 0,
    totalHpCost: 0,
  };
}

function cloneState(state: BattleState): BattleState {
  return {
    ...state,
    selfBuffs: { ...state.selfBuffs },
    enemyDebuffs: { ...state.enemyDebuffs },
  };
}

/**
 * 获取卡牌在指定稀有度下的数值
 */
function getCardStats(cd: CardDataEntry | undefined, rarity: number): CardStats | undefined {
  if (!cd?.stats) return undefined;
  // 尝试精确匹配，回退到 rarity 0
  return cd.stats[rarity.toString()] ?? cd.stats["0"];
}

/**
 * 应用一张卡牌的效果到当前状态（数值版本）
 */
function applyEffects(state: BattleState, effects: CardEffect[]): BattleState {
  const next = cloneState(state);

  for (const effect of effects) {
    const val = effect.value ?? 0;
    switch (effect.type) {
      case "attack":
        next.attackActions += 1;
        next.totalHits += 1;
        next.totalAttackDamage += val;
        break;
      case "multi_attack":
        next.attackActions += 1;
        // 从 description 解析实际 hit 次数 (e.g., "3攻×7=21")
        {
          const m = effect.description.match(/×(\d+)/);
          next.totalHits += m ? parseInt(m[1]) : 1;
        }
        next.totalAttackDamage += val;
        break;
      case "defense":
        next.defenseActions += 1;
        next.totalDefense += val;
        break;
      case "physique":
        next.physiqueGains += 1;
        next.totalPhysique += val;
        break;
      case "spirit":
        next.spiritGains += 1;
        next.totalSpirit += val;
        break;
      case "heal":
        next.healActions += 1;
        break;
      case "buff":
        next.selfBuffs[effect.subType] = (next.selfBuffs[effect.subType] || 0) + 1;
        if (effect.subType === "剑意") next.totalJianYi += val;
        if (effect.subType === "卦象") next.totalGuaXiang += val;
        break;
      case "debuff":
        next.enemyDebuffs[effect.subType] = (next.enemyDebuffs[effect.subType] || 0) + 1;
        break;
      case "special":
        if (effect.subType === "生命消耗") next.totalHpCost += val;
        break;
    }
  }

  return next;
}

/**
 * 模拟一轮手牌打出
 */
function simulateRound(
  handCardEntries: { name: string; rarity: number }[],
  cardData: Record<string, CardDataEntry>,
  initialState: BattleState,
): RoundSummary {
  const steps: SimulationStep[] = [];
  let currentState = cloneState(initialState);

  for (const entry of handCardEntries) {
    const cd = cardData[entry.name];
    const effectRaw = cd?.effectRaw || "";
    const stats = getCardStats(cd, entry.rarity);
    const effects = parseCardEffects(effectRaw, stats);
    currentState = applyEffects(currentState, effects);

    steps.push({
      cardName: entry.name,
      cardPhase: cd?.phase || 0,
      effects,
      stateAfter: cloneState(currentState),
    });
  }

  return { steps, finalState: currentState };
}

/**
 * 执行完整战斗模拟（两轮手牌）
 * 使用从 DLL 逆向得到的真实数值进行计算
 */
export function simulateBattle(
  handCards: Record<string, CardCount>,
  cardData: Record<string, CardDataEntry>,
): BattleSimulation {
  // 按 phase 排序手牌（低境界先打），保留 rarity 信息
  const sorted = Object.entries(handCards)
    .flatMap(([name, info]) => {
      const cd = cardData[name];
      const phase = cd?.phase || info.phase || 0;
      const rarity = info.rarity ?? 0;
      return Array(info.count).fill({ name, phase, rarity });
    })
    .sort((a: { phase: number }, b: { phase: number }) => a.phase - b.phase);

  const handCardNames = sorted.map((c: { name: string }) => c.name);

  // 第一轮
  const round1 = simulateRound(sorted, cardData, createEmptyState());

  // 第二轮（基于第一轮结束状态继续）
  const round2 = simulateRound(sorted, cardData, round1.finalState);

  return { round1, round2, handCardNames };
}
