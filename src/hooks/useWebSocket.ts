import { useState, useEffect, useRef, useCallback } from "react";
import type { WSMessage, GameStatus, FullAnalysis, ClientWSMessage, BattleResultData } from "../types";

const WS_URL = "ws://localhost:12681";
const RECONNECT_DELAY = 3000;

declare const __APP_VERSION__: string;
const CLIENT_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [gameStatus, setGameStatus] = useState<GameStatus>({
    inGame: false,
    status: "waiting",
  });
  const [deckAnalysis, setDeckAnalysis] = useState<FullAnalysis | null>(null);
  const [battleResult, setBattleResult] = useState<BattleResultData | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WS] 已连接");
        setConnected(true);
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);
          switch (msg.type) {
            case "game_status":
              setGameStatus(msg.data);
              break;
            case "deck_analysis":
              setDeckAnalysis(msg.data);
              setBattleResult(null); // 新的分析数据到达时清除旧模拟结果
              break;
            case "battle_result":
              setBattleResult(msg.data);
              break;
            case "version":
              if (CLIENT_VERSION !== "dev" && msg.data.version !== CLIENT_VERSION) {
                console.log(`[WS] 版本不匹配: 客户端=${CLIENT_VERSION}, 服务端=${msg.data.version}，刷新页面`);
                window.location.reload();
                return;
              }
              break;
            case "error":
              console.error("[WS] 服务器错误:", msg.data.message);
              break;
          }
        } catch (e) {
          console.error("[WS] 消息解析失败:", e);
        }
      };

      ws.onclose = () => {
        console.log("[WS] 已断开，准备重连...");
        setConnected(false);
        wsRef.current = null;
        reconnectTimerRef.current = window.setTimeout(connect, RECONNECT_DELAY);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      reconnectTimerRef.current = window.setTimeout(connect, RECONNECT_DELAY);
    }
  }, []);

  const sendMessage = useCallback((msg: ClientWSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected, gameStatus, deckAnalysis, battleResult, sendMessage };
}
