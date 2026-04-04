import React, { useState, useMemo, useEffect } from "react";
import type { BattleSimulation, RoundSummary, BattleState, CardCount } from "../types";

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

function StateSummary({ state, label }: { state: BattleState; label: string }) {
  const buffEntries = Object.entries(state.selfBuffs).filter(([, v]) => v > 0);
  const debuffEntries = Object.entries(state.enemyDebuffs).filter(([, v]) => v > 0);

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
      </div>
      {buffEntries.length > 0 && (
        <div className="sim-buffs">
          <span className="sim-buff-label">自身增益:</span>
          {buffEntries.map(([name, count]) => (
            <span key={name} className="sim-buff-tag buff">
              {name} ×{count}
            </span>
          ))}
        </div>
      )}
      {debuffEntries.length > 0 && (
        <div className="sim-buffs">
          <span className="sim-buff-label">敌方减益:</span>
          {debuffEntries.map(([name, count]) => (
            <span key={name} className="sim-buff-tag debuff">
              {name} ×{count}
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
      <div className="sim-round-header">第 {roundNum} 轮手牌 ({round.steps.length} 张)</div>
      <div className="sim-steps">
        {round.steps.map((step, i) => (
          <div key={i} className="sim-step">
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
                    title={effect.description}
                  >
                    {EFFECT_ICONS[effect.type] || "◈"} {effect.description || effect.subType}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <StateSummary state={round.finalState} label={`第 ${roundNum} 轮结束`} />
    </div>
  );
}

// ===== 卡牌选择器（逐张选择） =====

interface CardPickerProps {
  handCards: Record<string, CardCount>;
  phase: number;
  onSimulate: (selectedCards: Record<string, number>) => void;
}

function CardPicker({ handCards, phase, onSimulate }: CardPickerProps) {
  const deckLimit = getDeckLimit(phase);

  // 按境界排序的卡牌列表
  const sortedCards = useMemo(() =>
    Object.entries(handCards)
      .map(([name, info]) => ({ name, ...info }))
      .sort((a, b) => (a.phase || 0) - (b.phase || 0)),
    [handCards]
  );

  // 上阵牌组：有序数组，每个元素是卡牌名
  const [slots, setSlots] = useState<string[]>([]);

  // 手牌变化时重置
  useEffect(() => {
    setSlots([]);
  }, [handCards]);

  // 计算每张卡已选数量
  const usedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const name of slots) {
      counts[name] = (counts[name] || 0) + 1;
    }
    return counts;
  }, [slots]);

  const isFull = slots.length >= deckLimit;

  const addCard = (name: string) => {
    if (isFull) return;
    const avail = (handCards[name]?.count || 0) - (usedCounts[name] || 0);
    if (avail <= 0) return;
    setSlots((prev) => [...prev, name]);
  };

  const removeSlot = (index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => setSlots([]);

  const handleSimulate = () => {
    const counts: Record<string, number> = {};
    for (const name of slots) {
      counts[name] = (counts[name] || 0) + 1;
    }
    onSimulate(counts);
  };

  return (
    <div className="card-picker">
      <div className="picker-header">
        <span className="picker-title">上阵牌组</span>
        <span className="picker-limit">
          {slots.length} / {deckLimit}
          <span className="picker-phase-hint">（{PHASE_NAMES[phase] || `P${phase}`}）</span>
        </span>
      </div>

      {/* 上阵槽位 */}
      <div className="picker-slots">
        {Array.from({ length: deckLimit }, (_, i) => {
          const cardName = slots[i];
          const cardInfo = cardName ? (handCards[cardName] || null) : null;
          return (
            <div
              key={i}
              className={`picker-slot ${cardName ? "filled" : "empty"} ${i === slots.length ? "next" : ""}`}
              onClick={() => cardName && removeSlot(i)}
              title={cardName ? `点击移除 ${cardName}` : `第 ${i + 1} 张`}
            >
              <span className="slot-index">{i + 1}</span>
              {cardName ? (
                <>
                  <span className="slot-name">{cardName}</span>
                  {cardInfo?.phase != null && cardInfo.phase > 0 && (
                    <span className="slot-phase">{PHASE_NAMES[cardInfo.phase] || `P${cardInfo.phase}`}</span>
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
        <button className="picker-btn" onClick={clearAll} disabled={slots.length === 0}>清空</button>
        <button
          className="picker-btn picker-sim-btn"
          disabled={slots.length === 0}
          onClick={handleSimulate}
        >
          模拟战斗
        </button>
      </div>

      {/* 手牌列表（点击添加） */}
      {!isFull && (
        <div className="picker-hand">
          <div className="picker-hand-label">点击添加第 {slots.length + 1} 张牌：</div>
          <div className="picker-hand-cards">
            {sortedCards.map((card) => {
              const remaining = card.count - (usedCounts[card.name] || 0);
              const disabled = remaining <= 0;
              return (
                <button
                  key={card.name}
                  className={`picker-hand-card ${disabled ? "exhausted" : ""}`}
                  onClick={() => !disabled && addCard(card.name)}
                  disabled={disabled}
                >
                  <span className="picker-hc-name">{card.name}</span>
                  {card.phase != null && card.phase > 0 && (
                    <span className="picker-hc-phase">{PHASE_NAMES[card.phase] || `P${card.phase}`}</span>
                  )}
                  <span className="picker-hc-remain">×{remaining}</span>
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
  handCards: Record<string, CardCount>;
  phase: number;
  simulation: BattleSimulation | null;
  onSimulate: (selectedCards: Record<string, number>) => void;
}

const BattleSimPanel: React.FC<Props> = ({ handCards, phase, simulation, onSimulate }) => {
  const [showRound, setShowRound] = useState<1 | 2>(1);

  const hasCards = Object.keys(handCards).length > 0;

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

      {simulation && simulation.handCardNames.length > 0 && (
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
