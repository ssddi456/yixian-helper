import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import * as fs from "fs";
import * as path from "path";
import { startLogWatcher, getCurrentState, setPlayerOverride } from "./logWatcher";
import { handleSimulateBattle } from "./simulateBattleHandler";
import { WSMessage, ClientWSMessage, GameConnectionStatus } from "./types";
import { findGamePid, probeGameServer } from "./networkProbe";

const PORT = 12680;
const WS_PORT = 12681;

// 读取版本号
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8"));
const SERVER_VERSION: string = pkg.version;

// ========= HTTP 静态文件服务 =========
const httpServer = createServer((req, res) => {
  const distDir = path.join(__dirname, "..", "dist");
  let filePath = path.join(distDir, req.url === "/" ? "index.html" : req.url || "");

  // 安全检查
  if (!filePath.startsWith(distDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
  };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback
      fs.readFile(path.join(distDir, "index.html"), (err2, html) => {
        if (err2) {
          res.writeHead(404);
          res.end("Not Found");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(html);
      });
      return;
    }
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(data);
  });
});

// ========= WebSocket 服务 =========
const wss = new WebSocketServer({ port: WS_PORT });
const clients = new Set<WebSocket>();

wss.on("connection", (ws) => {
  console.log("[WS] 客户端已连接");
  clients.add(ws);

  // 发送版本号
  ws.send(JSON.stringify({ type: "version", data: { version: SERVER_VERSION } }));

  // 发送当前游戏连接状态
  ws.send(JSON.stringify({ type: "game_connection_status", data: lastConnectionStatus }));

  // 发送当前状态给新连接
  const currentState = getCurrentState();
  for (const msg of currentState) {
    ws.send(JSON.stringify(msg));
  }

  ws.on("close", () => {
    clients.delete(ws);
    console.log("[WS] 客户端已断开");
  });

  ws.on("message", (raw) => {
    try {
      const msg: ClientWSMessage = JSON.parse(raw.toString());
      switch (msg.type) {
        case "set_player_override":
          setPlayerOverride(msg.data);
          break;
        case "clear_player_override":
          setPlayerOverride(null);
          break;
        case "simulate_battle": {
          const result = handleSimulateBattle(msg.data.selectedCards);
          ws.send(JSON.stringify({ type: "battle_result", data: result }));
          break;
        }
      }
    } catch (e) {
      console.error("[WS] 解析客户端消息失败:", e);
    }
  });

  ws.on("error", (err) => {
    console.error("[WS] 错误:", err);
    clients.delete(ws);
  });
});

function broadcastMessage(msg: WSMessage) {
  const data = JSON.stringify(msg);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// ========= 游戏连接监控 =========
let lastConnectionStatus: GameConnectionStatus = { gameRunning: false };

/**
 * 启动游戏连接监控：
 * - 轮询检测游戏进程和服务器连接
 * - 游戏启动后广播连接信息
 * - 游戏退出后广播离线状态并停止轮询
 */
function startGameConnectionMonitor(intervalMs = 3000): void {
  let timer: ReturnType<typeof setInterval> | null = null;
  let wasRunning = false;

  function poll() {
    const pid = findGamePid();

    if (!pid) {
      if (wasRunning) {
        // 游戏刚退出 → 广播离线并停止轮询
        wasRunning = false;
        lastConnectionStatus = { gameRunning: false };
        broadcastMessage({ type: "game_connection_status", data: lastConnectionStatus });
        console.log("[GameMonitor] 游戏已退出，停止连接监控");
        if (timer !== null) {
          clearInterval(timer);
          timer = null;
        }
        // 游戏退出后重新等待游戏启动
        scheduleWaitForGame();
      }
      return;
    }

    // 游戏在运行
    const info = probeGameServer();
    const status: GameConnectionStatus = {
      gameRunning: true,
      pid,
      serverAddr: info?.serverAddr,
      serverPort: info?.serverPort,
      connectionCount: info?.connections.length ?? 0,
    };

    // 仅在状态发生变化时广播
    if (
      !wasRunning ||
      status.serverAddr !== lastConnectionStatus.serverAddr ||
      status.serverPort !== lastConnectionStatus.serverPort ||
      status.connectionCount !== lastConnectionStatus.connectionCount
    ) {
      lastConnectionStatus = status;
      broadcastMessage({ type: "game_connection_status", data: status });
      if (!wasRunning) {
        console.log(`[GameMonitor] 检测到游戏进程 PID=${pid}，开始监控连接`);
      }
    }

    wasRunning = true;
  }

  function scheduleWaitForGame() {
    console.log("[GameMonitor] 等待游戏启动...");
    timer = setInterval(() => {
      const pid = findGamePid();
      if (pid) {
        // 游戏启动了，切换到连接监控模式
        clearInterval(timer!);
        timer = null;
        wasRunning = false;
        poll();
        timer = setInterval(poll, intervalMs);
      }
    }, intervalMs);
  }

  // 立即检查一次
  const pid = findGamePid();
  if (pid) {
    wasRunning = false;
    poll();
    timer = setInterval(poll, intervalMs);
  } else {
    scheduleWaitForGame();
  }
}


httpServer.listen(PORT, () => {
  console.log(`[Server] HTTP 服务器运行在 http://localhost:${PORT}`);
});

console.log(`[Server] WebSocket 服务器运行在 ws://localhost:${WS_PORT}`);

// 启动日志监听
startLogWatcher(broadcastMessage);

// 启动游戏连接监控
startGameConnectionMonitor();

console.log("[Server] 弈仙牌对局辅助已启动");
