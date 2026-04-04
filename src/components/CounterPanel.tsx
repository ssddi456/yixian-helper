import React from "react";
import type { CounterAnalysis } from "../types";

interface Props {
  analysis: CounterAnalysis;
}

const CounterPanel: React.FC<Props> = ({ analysis }) => {
  return (
    <div className="counter-panel">
      {/* 当前牌组的优劣势 */}
      {(analysis.deckStrengths.length > 0 || analysis.deckWeaknesses.length > 0) && (
        <div className="counter-deck-analysis">
          {analysis.deckStrengths.length > 0 && (
            <div className="counter-section">
              <div className="counter-section-label strength">✅ 当前牌组优势</div>
              {analysis.deckStrengths.map((s, i) => (
                <div key={i} className="counter-trait strength">{s}</div>
              ))}
            </div>
          )}
          {analysis.deckWeaknesses.length > 0 && (
            <div className="counter-section">
              <div className="counter-section-label weakness">⚠️ 当前牌组弱点</div>
              {analysis.deckWeaknesses.map((w, i) => (
                <div key={i} className="counter-trait weakness">{w}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 克制关系矩阵 */}
      <div className="counter-matrix">
        <div className="counter-matrix-label">克制关系</div>
        {analysis.relations.map((rel) => (
          <div key={rel.id} className="counter-card">
            <div className="counter-card-header">
              <span className="counter-icon">{rel.icon}</span>
              <span className="counter-mechanism">{rel.mechanism}</span>
              <span className="counter-arrow">→</span>
              <span className="counter-target">克 {rel.counters}</span>
            </div>
            <div className="counter-desc">{rel.description}</div>
            <div className="counter-examples">
              {rel.examples.map((ex, i) => (
                <div key={i} className="counter-example">• {ex}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CounterPanel;
