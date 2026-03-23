import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import * as fs from "fs";
import * as path from "path";
import { startLogWatcher, getCurrentState } from "./logWatcher";
import { WSMessage } from "./types";

const PORT = 12680;
const WS_PORT = 12681;

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

  // 发送当前状态给新连接
  const currentState = getCurrentState();
  for (const msg of currentState) {
    ws.send(JSON.stringify(msg));
  }

  ws.on("close", () => {
    clients.delete(ws);
    console.log("[WS] 客户端已断开");
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
