import React, { useState } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import DeckGuidePanel from "./components/DeckGuidePanel";
import CardList from "./components/CardList";
import StatusBar from "./components/StatusBar";
import "./App.css";

type TabKey = "guide" | "hand" | "deck";

const App: React.FC = () => {
  const { connected, gameStatus, deckAnalysis } = useWebSocket();
  const [activeTab, setActiveTab] = useState<TabKey>("guide");

  return (
    <div className="app">
      <header className="app-header">
        <h1>弈仙牌 · 对局辅助</h1>
      </header>

      <StatusBar connected={connected} gameStatus={gameStatus} />

      <main className="app-main">
        {gameStatus.status === "in_game" && deckAnalysis ? (
          <div className="card-tabs-container">
            <div className="tab-bar">
              <button
                className={`tab-btn ${activeTab === "guide" ? "active" : ""}`}
                onClick={() => setActiveTab("guide")}
              >
                推荐卡组
                <span className="tab-count">{(deckAnalysis.deckRecommendations || []).length}</span>
              </button>
              <button
                className={`tab-btn ${activeTab === "hand" ? "active" : ""}`}
                onClick={() => setActiveTab("hand")}
              >
                当前手牌
                <span className="tab-count">{Object.keys(deckAnalysis.handCards).length}</span>
              </button>
              <button
                className={`tab-btn ${activeTab === "deck" ? "active" : ""}`}
                onClick={() => setActiveTab("deck")}
              >
                牌库消耗
                <span className="tab-count">{Object.keys(deckAnalysis.deckCards).length}</span>
              </button>
            </div>
            <div className="tab-content">
              {activeTab === "guide" && (
                <DeckGuidePanel recommendations={deckAnalysis.deckRecommendations || []} />
              )}
              {activeTab === "hand" && (
                <CardList cards={deckAnalysis.handCards} />
              )}
              {activeTab === "deck" && (
                <CardList cards={deckAnalysis.deckCards} />
              )}
            </div>
          </div>
        ) : (
          <div className="waiting-container">
            <div className="waiting-icon">🎴</div>
            <div className="waiting-text">
              {!connected
                ? "正在连接服务器..."
                : "等待弈仙牌对局开始..."}
            </div>
            <div className="waiting-hint">
              请确保弈仙牌已启动并进入对局
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
