import React from "react";
import type { DeckRecommendation } from "../types";

interface Props {
  recommendations: DeckRecommendation[];
}

const DeckGuidePanel: React.FC<Props> = ({ recommendations }) => {
  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div className="deck-guide-panel">
      <div className="deck-guide-list">
        {recommendations.map((rec, index) => {
          const ownedCount = rec.matchedCards.length;
          const total = rec.totalGuideCards;
          const pct = Math.round(rec.coverage * 100);

          return (
            <div
              key={rec.guide.id}
              className={`deck-guide-card ${
                pct >= 50 ? "high" : pct >= 20 ? "medium" : "low"
              }`}
            >
              <div className="deck-guide-header">
                <span className="deck-guide-rank">#{index + 1}</span>
                <span className="deck-guide-title">
                  {rec.guide.title}
                  {rec.guide.isProPicked && (
                    <span className="pro-badge">精选</span>
                  )}
                </span>
                <span className="match-count">
                  {ownedCount}/{total}
                </span>
                <CoverageBadge value={pct} />
              </div>

              {rec.allGuideCards.length > 0 && (
                <div className="guide-cards-section">
                  <div className="card-sequence">
                    {rec.allGuideCards.map((entry) => (
                      <div
                        key={entry.index}
                        className={`seq-card ${entry.owned ? "owned" : "missing"}`}
                      >
                        <span className="seq-index">{entry.index + 1}</span>
                        <span className="seq-name">{entry.name}</span>
                        <span className="seq-status">
                          {entry.owned ? "✓" : "✗"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {rec.phaseAdvice.length > 0 && (
                <div className="phase-advice">
                  <div className="section-label">当前境界建议</div>
                  {rec.phaseAdvice.map((advice, i) => (
                    <div key={i} className="advice-text">
                      {advice}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CoverageBadge: React.FC<{ value: number }> = ({ value }) => {
  const color =
    value >= 50 ? "#4caf50" : value >= 20 ? "#ff9800" : "#9e9e9e";
  return (
    <span className="similarity-badge" style={{ backgroundColor: color }}>
      {value}%
    </span>
  );
};

export default DeckGuidePanel;
