import React, { useState } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import DeckGuidePanel from "./components/DeckGuidePanel";
import CardList from "./components/CardList";
import BattleSimPanel from "./components/BattleSimPanel";
import CounterPanel from "./components/CounterPanel";
import StatusBar from "./components/StatusBar";
import "./App.css";

type TabKey = "guide" | "hand" | "deck" | "sim" | "counter";

const App: React.FC = () => {
  const { connected, gameStatus, deckAnalysis, battleResult, sendMessage } = useWebSocket();
  const [activeTab, setActiveTab] = useState<TabKey>("guide");

  return (
    <div className="app">
      <header className="app-header">
        <h1>弈仙牌 · 对局辅助</h1>
      </header>

      <StatusBar connected={connected} gameStatus={gameStatus} onSendMessage={sendMessage} />

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
              <button
                className={`tab-btn ${activeTab === "sim" ? "active" : ""}`}
                onClick={() => setActiveTab("sim")}
              >
                战斗模拟
              </button>
              <button
                className={`tab-btn ${activeTab === "counter" ? "active" : ""}`}
                onClick={() => setActiveTab("counter")}
              >
                克制关系
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
              {activeTab === "sim" && (
                <BattleSimPanel
                  handCards={deckAnalysis.handCards}
                  phase={gameStatus.player?.phase || 1}
                  simulation={battleResult?.battleSimulation ?? null}
                  onSimulate={(selectedCards) => sendMessage({ type: "simulate_battle", data: { selectedCards } })}
                />
              )}
              {activeTab === "counter" && (
                battleResult?.counterAnalysis
                  ? <CounterPanel analysis={battleResult.counterAnalysis} />
                  : <div className="card-list-empty">请先在「战斗模拟」中选择卡牌并模拟</div>
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
