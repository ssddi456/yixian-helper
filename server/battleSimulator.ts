import type { CardDataEntry, CardStats } from "./logParser";
import type { CardEntry, CardEffect, BattleState, SimulationStep, RoundSummary, BattleSimulation } from "./types";

// ===== Buff/Debuff 分类 =====

const SELF_BUFFS = new Set([
  "剑意", "加攻", "加防", "护体", "辟邪", "闪避", "聚灵",
  "蓄力", "剑气", "崩劲", "锻体", "连击", "灵感",
  "星力", "棋力", "道果", "灵田", "笔意", "身法",
]);

// 身法阈值：每累计10点身法可触发一次额外行动
const SHENFA_ACTION_THRESHOLD = 10;

const ENEMY_DEBUFFS = new Set([
  "减攻", "减防", "虚弱", "碎防", "中毒", "灼烧", "流血",
  "封灵", "缠绕", "减速", "混乱", "禁疗",
]);

// ===== 效果解析（数值化） =====

/**
 * 从 CardStats 解析 effectRaw 模板，生成带数值的结构化效果
 */
/**
 * 替换 effectRaw 模板中的变量占位符为实际数值
 */
function substituteTemplate(text: string, stats: CardStats | undefined): string {
  if (!stats) return text.replace(/\{[^}]*\}/g, "N");
  const otherParams = stats.otherParams ?? [];
  return text
    .replace(/\{otherParams\[(\d+)\]\}/g, (_, idx) => {
      const i = parseInt(idx);
      return i < otherParams.length ? String(otherParams[i]) : "N";
    })
    .replace(/\{attack\}/g, String(stats.attack ?? 0))
    .replace(/\{attackCount\}/g, String(stats.attackCount ?? 1))
    .replace(/\{def\}/g, String(stats.def ?? 0))
    .replace(/\{jianYi\}/g, String(stats.jianYi ?? 0))
    .replace(/\{guaXiang\}/g, String(stats.guaXiang ?? 0))
    .replace(/\{physique\}/g, String(stats.physique ?? 0))
    .replace(/\{anima\}/g, String(stats.anima ?? 0))
    .replace(/\{hpCost\}/g, String(stats.hpCost ?? 0))
    .replace(/\{randomAttack\}/g, String(stats.randomAttack ?? 0))
    .replace(/\{randomDef\}/g, String(stats.randomDef ?? 0))
    .replace(/\{[^}]*\}/g, "N");
}

/**
 * 从描述文本中提取剑意倍率
 * 匹配 "受N倍[剑意]加成"、"N倍剑意" 等模式
 */
function extractJianYiMultiplier(text: string): number | undefined {
  const m = text.match(/(\d+(?:\.\d+)?)倍.*剑意|受(\d+(?:\.\d+)?)倍.*加成/);
  if (m) return parseFloat(m[1] || m[2]);
  return undefined;
}

/**
 * 从描述文本中提取持续回合数
 * 匹配 "持续N回合" 模式
 */
function extractDuration(text: string): number | undefined {
  const m = text.match(/持续(\d+)回合/);
  if (m) return parseInt(m[1]);
  return undefined;
}

/**
 * 从 CardStats 解析 effectRaw 模板，生成带数值的结构化效果
 */
export function parseCardEffects(effectRaw: string, stats?: CardStats): CardEffect[] {
  if (!effectRaw) return [];

  const effects: CardEffect[] = [];
  const lines = effectRaw.split("\\n");
  const pushEffect = (effect: CardEffect, sourceLine: number) => {
    effects.push({
      ...effect,
      sourceLine,
    });
  };

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
  const actionAgain = stats?.actionAgain ?? 0;
  const chargeQi = stats?.chargeQi ?? 0;

  for (const [lineIndex, line] of lines.entries()) {
    const resolved = substituteTemplate(line, stats);
    const duration = extractDuration(resolved);

    const repeatMatch = resolved.match(/重复(\d+)次/);
    if (repeatMatch) {
      pushEffect({
        type: "special",
        subType: "重复",
        target: "self",
        description: resolved,
        repeatCount: parseInt(repeatMatch[1]),
      }, lineIndex);
    }

    // 多段攻击: {attack}攻×{attackCount}
    if (/攻[×x]\{?attackCount|攻×/.test(line)) {
      const totalDmg = attack * attackCount;
      const multiplier = extractJianYiMultiplier(resolved);
      pushEffect({
        type: "multi_attack",
        subType: "多段攻击",
        target: "enemy",
        description: attack ? `${attack}攻×${attackCount}=${totalDmg}` : resolved,
        value: totalDmg,
        multiplier,
        duration,
      }, lineIndex);
      continue;
    }

    // 单次攻击: {attack}攻 (不带×)
    if (/\{?attack\}?攻|^\d*攻$/.test(line) && !/×/.test(line)) {
      const desc = attack
        ? (randomAttack ? `${attack}~${randomAttack}攻` : `${attack}攻`)
        : resolved;
      const multiplier = extractJianYiMultiplier(resolved);
      pushEffect({
        type: "attack",
        subType: "攻击",
        target: "enemy",
        description: desc,
        value: attack || (randomAttack ? Math.floor((attack + randomAttack) / 2) : 0),
        multiplier,
        duration,
      }, lineIndex);
    }

    // 防御: [防]+{def}
    if (/防\]?\+|\[防\]/.test(line)) {
      const desc = def
        ? (randomDef ? `防+${def}~${randomDef}` : `防+${def}`)
        : resolved;
      pushEffect({
        type: "defense",
        subType: "防御",
        target: "self",
        description: desc,
        value: def || (randomDef ? Math.floor((def + randomDef) / 2) : 0),
        duration,
      }, lineIndex);
    }

    // 体魄
    if (/体魄/.test(line)) {
      pushEffect({
        type: "physique",
        subType: "体魄",
        target: "self",
        description: physique ? `体魄+${physique}` : resolved,
        value: physique,
        duration,
      }, lineIndex);
    }

    // 灵气 (不含耗尽/消耗)
    if (/灵气/.test(line) && !/耗尽|消耗/.test(line)) {
      const val = anima < 0 ? Math.abs(anima) : anima;
      pushEffect({
        type: "spirit",
        subType: "灵气",
        target: "self",
        description: val ? `灵气+${val}` : resolved,
        value: val,
        duration,
      }, lineIndex);
    }

    // 剑意
    if (/剑意/.test(line) && !effects.some(e => e.subType === "剑意")) {
      const multiplier = extractJianYiMultiplier(resolved);
      // 从 otherParams 提取剑意数值（如果模板中有 otherParams 引用）
      let jianYiVal = jianYi;
      if (!jianYiVal && /otherParams/.test(line) && otherParams.length > 0) {
        const paramMatch = line.match(/\{otherParams\[(\d+)\]\}/);
        if (paramMatch) {
          const idx = parseInt(paramMatch[1]);
          if (idx < otherParams.length) jianYiVal = otherParams[idx];
        }
      }
      pushEffect({
        type: "buff",
        subType: "剑意",
        target: "self",
        description: jianYiVal ? `剑意+${jianYiVal}` : resolved,
        value: jianYiVal,
        multiplier,
        duration,
      }, lineIndex);
    }

    // 卦象
    if (/卦象/.test(line) && !effects.some(e => e.subType === "卦象")) {
      let guaVal = guaXiang;
      if (!guaVal && /otherParams/.test(line) && otherParams.length > 0) {
        const paramMatch = line.match(/\{otherParams\[(\d+)\]\}/);
        if (paramMatch) {
          const idx = parseInt(paramMatch[1]);
          if (idx < otherParams.length) guaVal = otherParams[idx];
        }
      }
      pushEffect({
        type: "buff",
        subType: "卦象",
        target: "self",
        description: guaVal ? `卦象+${guaVal}` : resolved,
        value: guaVal,
        duration,
      }, lineIndex);
    }

    // 回血/吸血
    if (/回血|吸血|吸取|回复|恢复.*生命|生命.*恢复/.test(line)) {
      pushEffect({
        type: "heal",
        subType: "回复",
        target: "self",
        description: resolved,
        duration,
      }, lineIndex);
    }

    // 再次行动
    if (/再次行动/.test(line)) {
      pushEffect({
        type: "special",
        subType: "再次行动",
        target: "self",
        description: resolved,
        actionAgain: 1,
      }, lineIndex);
    }

    // 持续效果（不是再次行动的持续）
    if (/\[?持续\]?/.test(line) && !/再次行动/.test(line)) {
      pushEffect({
        type: "continuous",
        subType: "持续",
        target: "self",
        description: resolved,
        duration,
      }, lineIndex);
    }

    // 自身 buff（剑意/卦象已特殊处理）
    for (const buff of SELF_BUFFS) {
      if (buff === "剑意" || buff === "卦象") continue;
      if (line.includes(buff) && !effects.some(e => e.subType === buff)) {
        let val = 0;
        // 优先从 otherParams 提取数值
        const paramMatch = line.match(/\{otherParams\[(\d+)\]\}/);
        if (paramMatch) {
          const idx = parseInt(paramMatch[1]);
          if (idx < otherParams.length) val = otherParams[idx];
        }
        // 回退：从已替换文本中提取数字
        if (!val) {
          const numMatch = resolved.match(new RegExp(`(\\d+).*${buff}|${buff}.*?(\\d+)`));
          if (numMatch) val = parseInt(numMatch[1] || numMatch[2]) || 0;
        }
        pushEffect({
          type: "buff",
          subType: buff,
          target: "self",
          description: resolved,
          value: val,
          duration,
        }, lineIndex);
      }
    }

    // 敌方 debuff
    for (const debuff of ENEMY_DEBUFFS) {
      if (line.includes(debuff) && !effects.some(e => e.subType === debuff)) {
        let val = 0;
        const paramMatch = line.match(/\{otherParams\[(\d+)\]\}/);
        if (paramMatch) {
          const idx = parseInt(paramMatch[1]);
          if (idx < otherParams.length) val = otherParams[idx];
        }
        if (!val) {
          const numMatch = resolved.match(new RegExp(`(\\d+).*${debuff}|${debuff}.*?(\\d+)`));
          if (numMatch) val = parseInt(numMatch[1] || numMatch[2]) || 0;
        }
        pushEffect({
          type: "debuff",
          subType: debuff,
          target: "enemy",
          description: resolved,
          value: val,
          duration,
        }, lineIndex);
      }
    }
  }

  // actionAgain 标志（即使 effectRaw 中没有明确写"再次行动"）
  if (actionAgain > 0 && !effects.some(e => e.actionAgain)) {
    effects.push({
      type: "special",
      subType: "再次行动",
      target: "self",
      description: "再次行动",
      actionAgain: 1,
    });
  }

  // chargeQi 蓄灵消耗
  if (chargeQi > 0) {
    effects.push({
      type: "special",
      subType: "蓄灵",
      target: "self",
      description: `蓄灵消耗${chargeQi}`,
      chargeQi,
    });
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
      description: substituteTemplate(effectRaw, stats).replace(/\\n/g, " | "),
    });
  }

  return effects;
}

// ===== 战斗模拟 =====

function createEmptyState(): BattleState {
  return {
    selfBuffs: {},
    selfBuffValues: {},
    enemyDebuffs: {},
    enemyDebuffValues: {},
    attackActions: 0,
    totalHits: 0,
    defenseActions: 0,
    healActions: 0,
    spiritGains: 0,
    physiqueGains: 0,
    actionAgainCount: 0,
    chargeQiTotal: 0,
    totalAttackDamage: 0,
    totalDefense: 0,
    totalPhysique: 0,
    totalSpirit: 0,
    totalJianYi: 0,
    totalGuaXiang: 0,
    totalHpCost: 0,
    estimatedRealDamage: 0,
  };
}

function cloneState(state: BattleState): BattleState {
  return {
    ...state,
    selfBuffs: { ...state.selfBuffs },
    selfBuffValues: { ...state.selfBuffValues },
    enemyDebuffs: { ...state.enemyDebuffs },
    enemyDebuffValues: { ...state.enemyDebuffValues },
  };
}

/**
 * 获取卡牌在指定稀有度下的数值
 */
function getCardStats(cd: CardDataEntry | undefined, level: number): CardStats | undefined {
  if (!cd?.stats) return undefined;
  // 尝试精确匹配，回退到 level 0
  return cd.stats[level.toString()] ?? cd.stats["0"];
}

/**
 * 应用一张卡牌的效果到当前状态（增强数值版本）
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
        if (val > 0) {
          next.selfBuffValues[effect.subType] = (next.selfBuffValues[effect.subType] || 0) + val;
        }
        if (effect.subType === "剑意") next.totalJianYi += val;
        if (effect.subType === "卦象") next.totalGuaXiang += val;
        break;
      case "debuff":
        next.enemyDebuffs[effect.subType] = (next.enemyDebuffs[effect.subType] || 0) + 1;
        if (val > 0) {
          next.enemyDebuffValues[effect.subType] = (next.enemyDebuffValues[effect.subType] || 0) + val;
        }
        break;
      case "special":
        if (effect.subType === "生命消耗") next.totalHpCost += val;
        if (effect.chargeQi) next.chargeQiTotal += effect.chargeQi;
        break;
    }
  }

  return next;
}

/**
 * 计算估算真实伤害（考虑剑意加成）
 * 剑意加成：每点剑意值增加1点攻击伤害，如有倍率则乘以倍率
 */
function calculateEstimatedDamage(state: BattleState, allEffects: CardEffect[]): number {
  let damage = state.totalAttackDamage;
  const jianYiValue = state.selfBuffValues["剑意"] || state.totalJianYi || 0;

  if (jianYiValue > 0) {
    // 找最大的剑意倍率
    let maxMultiplier = 1;
    for (const effect of allEffects) {
      if (effect.multiplier && effect.multiplier > maxMultiplier) {
        maxMultiplier = effect.multiplier;
      }
    }
    damage += jianYiValue * maxMultiplier;
  }

  // 减攻 debuff 减少敌方输出（这里记录我方对敌方的减攻效果）
  const jianGongValue = state.enemyDebuffValues["减攻"] || 0;
  if (jianGongValue > 0) {
    // 减攻是减少敌方攻击力，不影响我方伤害，但作为参考记录
  }

  return damage;
}

/**
 * 执行一次卡牌打出并记录步骤
 */
function playCard(
  cardName: string,
  cd: CardDataEntry | undefined,
  level: number,
  currentState: BattleState,
  steps: SimulationStep[],
  allEffects: CardEffect[],
  label?: string,
): { state: BattleState; effects: CardEffect[] } {
  const effectRaw = cd?.effectRaw || "";
  const stats = getCardStats(cd, level);
  const effects = parseCardEffects(effectRaw, stats);
  return playResolvedEffects(cardName, cd?.phase || 0, effects, currentState, steps, allEffects, label);
}

function playResolvedEffects(
  cardName: string,
  cardPhase: number,
  effects: CardEffect[],
  currentState: BattleState,
  steps: SimulationStep[],
  allEffects: CardEffect[],
  label?: string,
): { state: BattleState; effects: CardEffect[] } {
  const newState = applyEffects(currentState, effects);
  allEffects.push(...effects);

  steps.push({
    cardName: label || cardName,
    cardPhase,
    effects,
    stateAfter: cloneState(newState),
  });

  return { state: newState, effects };
}

/**
 * 检查并消耗身法触发额外行动
 * 当身法值 >= 10 时，消耗 10 点身法并返回 true
 */
function tryShenFaAction(state: BattleState): boolean {
  const shenfa = state.selfBuffValues["身法"] || 0;
  if (shenfa >= SHENFA_ACTION_THRESHOLD) {
    state.selfBuffValues["身法"] = shenfa - SHENFA_ACTION_THRESHOLD;
    state.actionAgainCount += 1;
    return true;
  }
  return false;
}

/**
 * 模拟一轮手牌打出
 *
 * 打出顺序逻辑：
 * 1. 按 phase 排序依次打出每张卡
 * 2. 如果前一张牌触发了"再次行动"，则当前牌先额外处理一次（该额外处理不再触发再次行动）
 * 3. 如果当前身法 >= 10，消耗 10 点身法，再次打出该卡（此次也不触发再次行动）
 * 4. 如果卡牌有"重复使用xN次"状态效果，额外执行 N 次效果
 */
function simulateRound(
  handCardEntries: { name: string; level: number }[],
  cardData: Record<string, CardDataEntry>,
  initialState: BattleState,
): RoundSummary {
  const steps: SimulationStep[] = [];
  let currentState = cloneState(initialState);
  const allEffects: CardEffect[] = [];
  
  for (let index = 0; index < handCardEntries.length; index++) {
    ({ currentState } = singleCardMove(handCardEntries, index, cardData, currentState, steps, allEffects));
    if (currentState.actionAgainCount) {
      ({ currentState } = singleCardMove(handCardEntries, index, cardData, currentState, steps, allEffects));
      currentState.actionAgainCount = 0;
      index += 1;
    }
  }

  // 回合结束时计算估算真实伤害
  currentState.estimatedRealDamage = calculateEstimatedDamage(currentState, allEffects);

  return { steps, finalState: currentState };
}

function singleCardMove(handCardEntries: { name: string; level: number; }[], index: number, cardData: Record<string, CardDataEntry>, currentState: BattleState, steps: SimulationStep[], allEffects: CardEffect[]) {
  const entry = handCardEntries[index];
  const cd = cardData[entry.name];

  // 正常打出
  const result = playCard(entry.name, cd, entry.level, currentState, steps, allEffects);
  currentState = result.state;
  const effects = result.effects;

  // 检查"重复使用xN次"效果：只执行该描述后面的效果，不重播整张牌
  for (const eff of effects) {
    if (!eff.repeatCount || eff.sourceLine === undefined) continue;

    const repeatedEffects = effects.filter(effect => effect.subType !== "重复"
      && effect.sourceLine !== undefined
      && effect.sourceLine > (eff.sourceLine || 0)
    );

    if (repeatedEffects.length === 0) continue;

    for (let r = 0; r < eff.repeatCount; r++) {
      const rr = playResolvedEffects(
        entry.name,
        cd?.phase || 0,
        repeatedEffects,
        currentState,
        steps,
        allEffects,
        `${entry.name}(重复${r + 1}/${eff.repeatCount})`
      );
      currentState = rr.state;
    }
  }

  // 再次行动：给下一张牌增加一次额外处理机会
  if (effects.some(e => e.actionAgain)) {
    currentState.actionAgainCount += 1;
  }

  if (currentState.actionAgainCount == 0) {
    // 身法额外行动：身法 >= 10 时消耗 10 点，再次行动
    tryShenFaAction(currentState)
  }
  return { currentState };
}

/**
 * 执行完整战斗模拟（两轮手牌）
 * 使用从卡牌数据解析的真实数值进行计算
 */
export function simulateBattle(
  handCards: CardEntry[],
  cardData: Record<string, CardDataEntry>,
): BattleSimulation {


  // 第一轮
  const round1 = simulateRound(handCards, cardData, createEmptyState());

  // 第二轮（基于第一轮结束状态继续，但重置 estimatedRealDamage）
  const r2InitState = cloneState(round1.finalState);
  r2InitState.estimatedRealDamage = 0;
  const round2 = simulateRound(handCards, cardData, r2InitState);

  return { round1, round2 };
}
