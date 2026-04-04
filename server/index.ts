import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import * as fs from "fs";
import * as path from "path";
import { startLogWatcher, getCurrentState, setPlayerOverride, handleSimulateBattle } from "./logWatcher";
import { WSMessage, ClientWSMessage } from "./types";

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

// ========= 启动 =========
httpServer.listen(PORT, () => {
  console.log(`[Server] HTTP 服务器运行在 http://localhost:${PORT}`);
});

console.log(`[Server] WebSocket 服务器运行在 ws://localhost:${WS_PORT}`);

// 启动日志监听
startLogWatcher(broadcastMessage);

console.log("[Server] 弈仙牌对局辅助已启动");
