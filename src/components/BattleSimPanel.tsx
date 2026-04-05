import React, { useState, useMemo, useEffect } from "react";
import type { BattleSimulation, RoundSummary, BattleState, CardEntry } from "../types";

const PHASE_NAMES: Record<number, string> = {
  1: "炼气", 2: "筑基", 3: "金丹", 4: "元婴", 5: "化神",
};

/** 各境界上阵牌数上限 */
function getDeckLimit(phase: number): number {
  if (phase <= 1) return 3;
  if (phase === 2) return 6;
  return 8;
}

const EFFECT_COLORS: Record<string, string> = {
  attack: "var(--red)",
  multi_attack: "var(--red)",
  defense: "var(--accent-light)",
  physique: "var(--green)",
  spirit: "var(--orange)",
  buff: "var(--green)",
  debuff: "var(--red)",
  heal: "var(--green)",
  continuous: "var(--accent-light)",
  special: "var(--text-muted)",
};

const EFFECT_ICONS: Record<string, string> = {
  attack: "⚔",
  multi_attack: "⚔×",
  defense: "🛡",
  physique: "💪",
  spirit: "✨",
  buff: "⬆",
  debuff: "⬇",
  heal: "💚",
  continuous: "🔄",
  special: "◈",
};

/** 格式化 buff 显示：名称 +数值 ×次数 */
function formatBuff(name: string, count: number, values?: Record<string, number>): string {
  const val = values?.[name];
  if (val && val > 0) {
    return count > 1 ? `${name}+${val} ×${count}` : `${name}+${val}`;
  }
  return `${name} ×${count}`;
}

function StateSummary({ state, label }: { state: BattleState; label: string }) {
  const buffEntries = Object.entries(state.selfBuffs).filter(([, v]) => v > 0);
  const debuffEntries = Object.entries(state.enemyDebuffs).filter(([, v]) => v > 0);
  const hasRealDmg = state.estimatedRealDamage > 0 && state.estimatedRealDamage !== state.totalAttackDamage;

  return (
    <div className="sim-summary">
      <div className="sim-summary-label">{label}</div>
      <div className="sim-stats">
        <div className="sim-stat">
          <span className="sim-stat-icon" style={{ color: "var(--red)" }}>⚔</span>
          <span className="sim-stat-value">{state.attackActions}次攻击</span>
          <span className="sim-stat-detail">
            ({state.totalHits}段{state.totalAttackDamage > 0 ? ` ≈${state.totalAttackDamage}伤` : ""})
          </span>
        </div>
        {hasRealDmg && (
          <div className="sim-stat">
            <span className="sim-stat-icon" style={{ color: "var(--red)" }}>💥</span>
            <span className="sim-stat-value">估算真伤 ≈{state.estimatedRealDamage}</span>
            <span className="sim-stat-detail">(含加成)</span>
          </div>
        )}
        {state.totalDefense > 0 && (
          <div className="sim-stat">
            <span className="sim-stat-icon" style={{ color: "var(--accent-light)" }}>🛡</span>
            <span className="sim-stat-value">{state.defenseActions}次防御</span>
            <span className="sim-stat-detail">(+{state.totalDefense}防)</span>
          </div>
        )}
        {state.totalDefense === 0 && state.defenseActions > 0 && (
          <div className="sim-stat">
            <span className="sim-stat-icon" style={{ color: "var(--accent-light)" }}>🛡</span>
            <span className="sim-stat-value">{state.defenseActions}次防御</span>
          </div>
        )}
        {state.totalPhysique > 0 && (
          <div className="sim-stat">
            <span className="sim-stat-icon" style={{ color: "var(--green)" }}>💪</span>
            <span className="sim-stat-value">体魄+{state.totalPhysique}</span>
          </div>
        )}
        {state.physiqueGains > 0 && state.totalPhysique === 0 && (
          <div className="sim-stat">
            <span className="sim-stat-icon" style={{ color: "var(--green)" }}>💪</span>
            <span className="sim-stat-value">{state.physiqueGains}次体魄</span>
          </div>
        )}
        {state.totalSpirit > 0 && (
          <div className="sim-stat">
            <span className="sim-stat-icon" style={{ color: "var(--orange)" }}>✨</span>
            <span className="sim-stat-value">灵气+{state.totalSpirit}</span>
          </div>
        )}
        {state.spiritGains > 0 && state.totalSpirit === 0 && (
          <div className="sim-stat">
            <span className="sim-stat-icon" style={{ color: "var(--orange)" }}>✨</span>
            <span className="sim-stat-value">{state.spiritGains}次灵气</span>
          </div>
        )}
        {state.totalJianYi > 0 && (
          <div className="sim-stat">
            <span className="sim-stat-icon" style={{ color: "var(--green)" }}>🗡</span>
            <span className="sim-stat-value">剑意+{state.totalJianYi}</span>
          </div>
        )}
        {state.totalGuaXiang > 0 && (
          <div className="sim-stat">
            <span className="sim-stat-icon" style={{ color: "var(--green)" }}>☯</span>
            <span className="sim-stat-value">卦象+{state.totalGuaXiang}</span>
          </div>
        )}
        {state.healActions > 0 && (
          <div className="sim-stat">
            <span className="sim-stat-icon" style={{ color: "var(--green)" }}>💚</span>
            <span className="sim-stat-value">{state.healActions}次回复</span>
          </div>
        )}
        {state.totalHpCost > 0 && (
          <div className="sim-stat">
            <span className="sim-stat-icon" style={{ color: "var(--red)" }}>💔</span>
            <span className="sim-stat-value">消耗{state.totalHpCost}生命</span>
          </div>
        )}
        {state.actionAgainCount > 0 && (
          <div className="sim-stat">
            <span className="sim-stat-icon" style={{ color: "var(--accent-light)" }}>🔁</span>
            <span className="sim-stat-value">{state.actionAgainCount}次额外行动</span>
          </div>
        )}
        {state.chargeQiTotal > 0 && (
          <div className="sim-stat">
            <span className="sim-stat-icon" style={{ color: "var(--orange)" }}>🔋</span>
            <span className="sim-stat-value">蓄灵消耗{state.chargeQiTotal}</span>
          </div>
        )}
      </div>
      {buffEntries.length > 0 && (
        <div className="sim-buffs">
          <span className="sim-buff-label">自身增益:</span>
          {buffEntries.map(([name, count]) => (
            <span key={name} className="sim-buff-tag buff">
              {formatBuff(name, count, state.selfBuffValues)}
            </span>
          ))}
        </div>
      )}
      {debuffEntries.length > 0 && (
        <div className="sim-buffs">
          <span className="sim-buff-label">敌方减益:</span>
          {debuffEntries.map(([name, count]) => (
            <span key={name} className="sim-buff-tag debuff">
              {formatBuff(name, count, state.enemyDebuffValues)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function RoundDetail({ round, roundNum }: { round: RoundSummary; roundNum: number }) {
  return (
    <div className="sim-round">
      <div className="sim-round-header">第 {roundNum} 轮手牌 ({round.steps.length} 步)</div>
      <div className="sim-steps">
        {round.steps.map((step, i) => {
          const isReplay = /\(再次行动\)|\(身法\)|\(重复\d+\/\d+\)/.test(step.cardName);
          return (
            <div key={i} className={`sim-step ${isReplay ? "sim-step-replay" : ""}`}>
              <div className="sim-step-index">{i + 1}</div>
              <div className="sim-step-main">
                <div className="sim-step-card">
                  <span className="sim-card-name">{step.cardName}</span>
                  {step.cardPhase > 0 && (
                    <span className="sim-card-phase">
                      {PHASE_NAMES[step.cardPhase] || `P${step.cardPhase}`}
                    </span>
                  )}
                </div>
                <div className="sim-step-effects">
                  {step.effects.map((effect, j) => (
                    <span
                      key={j}
                      className="sim-effect-tag"
                      style={{ color: EFFECT_COLORS[effect.type] || "var(--text-muted)" }}
                      title={[
                        effect.description,
                        effect.multiplier ? `${effect.multiplier}倍加成` : "",
                        effect.duration ? `持续${effect.duration}回合` : "",
                        effect.actionAgain ? "再次行动" : "",
                        effect.chargeQi ? `蓄灵${effect.chargeQi}` : "",
                      ].filter(Boolean).join(" | ")}
                    >
                      {EFFECT_ICONS[effect.type] || "◈"} {effect.description || effect.subType}
                      {effect.multiplier ? ` (${effect.multiplier}×)` : ""}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <StateSummary state={round.finalState} label={`第 ${roundNum} 轮结束`} />
    </div>
  );
}

// ===== 最近牌组缓存 =====

const RECENT_DECKS_KEY = "yixian_sim_recent_decks";
const RECENT_MAX = 10;

interface RecentDeck {
  cards: CardEntry[];
  ts: number;
}

function deckKey(cards: CardEntry[]): string {
  return cards.filter(c => c)
    .sort((a, b) => a.name.localeCompare(b.name) || a.level - b.level)
    .map(c => `${c.name}:${c.level}`)
    .join("|");
}

function loadRecentDecks(): RecentDeck[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_DECKS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecentDeck(cards: CardEntry[], existing: RecentDeck[]): RecentDeck[] {
  const key = deckKey(cards);
  const filtered = existing.filter(d => deckKey(d.cards) !== key);
  const updated = [{ cards, ts: Date.now() }, ...filtered].slice(0, RECENT_MAX);
  localStorage.setItem(RECENT_DECKS_KEY, JSON.stringify(updated));
  return updated;
}

// ===== 卡牌选择器（逐张选择） =====

interface CardPickerProps {
  handCards: CardEntry[];
  phase: number;
  onSimulate: (selectedCards: CardEntry[]) => void;
}

function CardPicker({ handCards, phase, onSimulate }: CardPickerProps) {
  const deckLimit = getDeckLimit(phase);

  // 上阵槽位：存储 handCards 的索引
  const [slotIndices, setSlotIndices] = useState<number[]>(Array(deckLimit).fill(-1));
  const [recentDecks, setRecentDecks] = useState<RecentDeck[]>(loadRecentDecks);
  const [showRecent, setShowRecent] = useState(false);

  // 手牌变化时重置
  useEffect(() => {
    setSlotIndices(Array(deckLimit).fill(-1));
  }, [handCards]);

  const usedSet = useMemo(() => new Set(slotIndices), [slotIndices]);

  const slots = useMemo(() => slotIndices.map(i => handCards[i]), [slotIndices, handCards]);

  const isFull = slotIndices.length >= deckLimit;

  const addCard = (index: number) => {
    if (isFull || usedSet.has(index)) return;
    setSlotIndices(prev => [...prev, index]);
  };

  const removeSlot = (slotPos: number) => {
    setSlotIndices(prev => prev.filter((_, i) => i !== slotPos));
  };

  const clearAll = () => setSlotIndices([]);

  const handleSimulate = () => {
    if (slots.length === 0) return;
    setRecentDecks(prev => saveRecentDeck(slots, prev));
    const realCards = slotIndices.map(i => {
      const c = handCards[i];
      if (c) {
        return c;
      }
      return {
        name: "普通攻击",
        level: 0,
        rarity: 0,
      }
    });
    onSimulate(realCards);
  };

  /** 从历史牌组中找到在当前手牌里匹配的索引 */
  const loadDeck = (cards: CardEntry[]) => {
    const used = new Set<number>();
    const indices: number[] = Array(deckLimit).fill(-1);
    for (let j = 0; j < cards.length; j++) {
      const target = cards[j];
      for (let i = 0; i < handCards.length; i++) {
        if (!used.has(i) && handCards[i].name === target.name) {
          used.add(i);
          indices[j] = i;
          break;
        }
      }
    }
    setSlotIndices(indices.slice(0, deckLimit));
    setShowRecent(false);
  };

  /** 统计历史牌组中在当前手牌可以载入的张数 */
  const countAvailable = (cards: CardEntry[]): number => {
    const used = new Set<number>();
    let count = 0;
    for (const target of cards) {
      for (let i = 0; i < handCards.length; i++) {
        if (!used.has(i) && handCards[i].name === target.name) {
          used.add(i);
          count++;
          break;
        }
      }
    }
    return count;
  };

  return (
    <div className="card-picker">
      <div className="picker-header">
        <span className="picker-title">上阵牌组</span>
        <span className="picker-limit">
          {slotIndices.filter(x => x !== -1).length} / {deckLimit}
          <span className="picker-phase-hint">（{PHASE_NAMES[phase] || `P${phase}`}）</span>
        </span>
      </div>

      {/* 上阵槽位 */}
      <div className="picker-slots">
        {Array.from({ length: deckLimit }, (_, i) => {
          const card = slots[i];
          return (
            <div
              key={i}
              className={`picker-slot ${card ? "filled" : "empty"} ${i === slotIndices.length ? "next" : ""}`}
              onClick={() => card && removeSlot(i)}
              title={card ? `点击移除 ${card.name}` : `第 ${i + 1} 张`}
            >
              <span className="slot-index">{i + 1}</span>
              {card ? (
                <>
                  <span className="slot-name">{card.name}</span>
                  {card.level != null && card.level > 0 && (
                    <span className="slot-phase">{PHASE_NAMES[card.level] || `P${card.level}`}</span>
                  )}
                  <span className="slot-remove">×</span>
                </>
              ) : (
                <span className="slot-empty-text">空</span>
              )}
            </div>
          );
        })}
      </div>

      {/* 操作按钮 */}
      <div className="picker-actions">
        <button className="picker-btn" onClick={clearAll} disabled={slotIndices.length === 0}>清空</button>
        {recentDecks.length > 0 && (
          <button
            className={`picker-btn picker-recent-btn ${showRecent ? "active" : ""}`}
            onClick={() => setShowRecent(v => !v)}
          >
            最近牌组 ({recentDecks.length})
          </button>
        )}
        <button
          className="picker-btn picker-sim-btn"
          disabled={slotIndices.length === 0}
          onClick={handleSimulate}
        >
          模拟战斗
        </button>
      </div>

      {/* 最近提交的牌组列表 */}
      {showRecent && (
        <div className="picker-recent">
          <div className="picker-recent-label">最近牌组（点击载入）</div>
          {recentDecks.map((deck, di) => {
            const avail = countAvailable(deck.cards);
            const total = deck.cards.length;
            return (
              <div
                key={di}
                className={`picker-recent-item ${avail === 0 ? "unavailable" : ""}`}
                onClick={() => avail > 0 && loadDeck(deck.cards)}
                title={avail < total ? `当前手牌仅含 ${avail}/${total} 张` : deck.cards.map(c => c.name).join("、")}
              >
                <span className="picker-recent-cards">
                  {deck.cards.map(c => c.name).join(" · ")}
                </span>
                <span className={`picker-recent-avail ${avail < total ? "partial" : ""}`}>
                  {avail}/{total}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* 手牌列表（点击添加，逐张展示） */}
      {!isFull && (
        <div className="picker-hand">
          <div className="picker-hand-label">点击添加第 {slotIndices.length + 1} 张牌：</div>
          <div className="picker-hand-cards">
            {handCards.map((card, index) => {
              const disabled = usedSet.has(index);
              return (
                <button
                  key={index}
                  className={`picker-hand-card ${disabled ? "exhausted" : ""}`}
                  onClick={() => !disabled && addCard(index)}
                  disabled={disabled}
                >
                  <span className="picker-hc-name">{card.name}</span>
                  {card.level != null && card.level > 0 && (
                    <span className="picker-hc-phase">{PHASE_NAMES[card.level] || `P${card.level}`}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== 主面板 =====

interface Props {
  handCards: CardEntry[];
  phase: number;
  simulation: BattleSimulation | null;
  onSimulate: (selectedCards: CardEntry[]) => void;
}

const BattleSimPanel: React.FC<Props> = ({ handCards, phase, simulation, onSimulate }) => {
  const [showRound, setShowRound] = useState<1 | 2>(1);

  const hasCards = handCards.length > 0;

  if (!hasCards) {
    return (
      <div className="sim-panel">
        <div className="card-list-empty">暂无手牌，无法模拟</div>
      </div>
    );
  }

  return (
    <div className="sim-panel">
      <CardPicker handCards={handCards} phase={phase} onSimulate={onSimulate} />
        {simulation && (
          <>
            <div className="sim-round-toggle">
              <button
                className={`sim-toggle-btn ${showRound === 1 ? "active" : ""}`}
                onClick={() => setShowRound(1)}
              >
                第1轮
              </button>
              <button
                className={`sim-toggle-btn ${showRound === 2 ? "active" : ""}`}
                onClick={() => setShowRound(2)}
              >
                第2轮 (累计)
              </button>
            </div>
            <RoundDetail
              round={showRound === 1 ? simulation.round1 : simulation.round2}
              roundNum={showRound}
            />
          </>
        )}
    </div>
  );
};

export default BattleSimPanel;
