import React from "react";
import type { ArchetypeMatch } from "../types";

interface Props {
  matches: ArchetypeMatch[];
}

const ArchetypePanel: React.FC<Props> = ({ matches }) => {
  if (matches.length === 0) {
    return (
      <div className="archetype-panel empty">
        <div className="empty-hint">等待对局数据...</div>
      </div>
    );
  }

  return (
    <div className="archetype-panel">
      <div className="panel-title">流派分析</div>
      <div className="archetype-list">
        {matches.map((match) => (
          <div
            key={match.archetype.id}
            className={`archetype-card ${match.similarity >= 0.3 ? "high" : match.similarity >= 0.1 ? "medium" : "low"}`}
          >
            <div className="archetype-header">
              <span className="archetype-name">{match.archetype.name}</span>
              <SimilarityBadge value={match.similarity} />
            </div>
            <div className="archetype-desc">{match.archetype.description}</div>

            {match.matchedCoreCards.length > 0 && (
              <div className="card-section">
                <div className="section-label">
                  核心牌 ({match.matchedCoreCards.length}/{match.totalCoreCards})
                </div>
                <div className="card-tags">
                  {match.archetype.coreCards.map((card) => (
                    <span
                      key={card}
                      className={`card-tag ${match.matchedCoreCards.includes(card) ? "matched" : "unmatched"}`}
                    >
                      {card}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {match.matchedRecommendCards.length > 0 && (
              <div className="card-section">
                <div className="section-label">
                  推荐牌 ({match.matchedRecommendCards.length}/{match.totalRecommendCards})
                </div>
                <div className="card-tags">
                  {match.archetype.recommendCards.map((card) => (
                    <span
                      key={card}
                      className={`card-tag ${match.matchedRecommendCards.includes(card) ? "matched" : "unmatched"}`}
                    >
                      {card}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const SimilarityBadge: React.FC<{ value: number }> = ({ value }) => {
  const percent = Math.round(value * 100);
  const color =
    percent >= 50 ? "#4caf50" : percent >= 20 ? "#ff9800" : "#9e9e9e";
  return (
    <span className="similarity-badge" style={{ backgroundColor: color }}>
      {percent}%
    </span>
  );
};

export default ArchetypePanel;
