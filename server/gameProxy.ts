/**
 * WebSocket MITM 代理
 * 拦截游戏与 Colyseus 服务器之间的 WebSocket 通信
 *
 * 使用方式：
 * 1. 启动代理后，修改 hosts 文件将游戏服务器域名指向 127.0.0.1
 * 2. 或在游戏配置中将服务器地址改为本地代理
 * 3. 代理透明转发所有流量，同时捕获和解码 Colyseus 消息
 */

import { WebSocketServer, WebSocket } from "ws";
import * as http from "http";
import * as https from "https";
import {
  decodeColyseusMessage,
  formatMessage,
  ColyseusProtocol,
  type DecodedMessage,
} from "./colyseusDecoder";
import { probeGameServer } from "./networkProbe";

export interface ProxyConfig {
  /** 本地代理监听端口 */
  listenPort: number;
  /** 真实服务器地址 (自动探测或手动指定) */
  targetHost?: string;
  /** 真实服务器端口 */
  targetPort?: number;
  /** 是否使用 TLS 连接到目标服务器 */
  targetTls?: boolean;
  /** 消息回调 */
  onMessage?: (msg: DecodedMessage) => void;
  /** 连接状态回调 */
  onConnectionChange?: (connected: boolean, info?: string) => void;
}

interface ProxySession {
  clientWs: WebSocket;
  serverWs: WebSocket;
  roomId?: string;
  sessionId?: string;
}

export class GameProxy {
  private config: ProxyConfig;
  private httpServer: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private sessions: Map<string, ProxySession> = new Map();
  private capturedMessages: DecodedMessage[] = [];
  private running = false;

  constructor(config: ProxyConfig) {
    this.config = {
      listenPort: 2567,
      targetTls: true,
      ...config,
    };
  }

  /**
   * 启动代理服务器
   */
  async start(): Promise<void> {
    if (this.running) return;

    // 如果没有指定目标服务器，尝试自动探测
    if (!this.config.targetHost) {
      console.log("[GameProxy] 尝试自动探测游戏服务器...");
      const probe = probeGameServer();
      if (probe?.serverAddr) {
        this.config.targetHost = probe.serverAddr;
        this.config.targetPort = probe.serverPort;
        console.log(
          `[GameProxy] 探测到服务器: ${probe.serverAddr}:${probe.serverPort}`
        );
      } else {
        console.warn("[GameProxy] 未探测到服务器，请手动指定 targetHost");
      }
    }

    this.httpServer = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("YiXian Helper - Colyseus Proxy\n");
    });

    this.wss = new WebSocketServer({ server: this.httpServer });

    this.wss.on("connection", (clientWs, req) => {
      this.handleClientConnection(clientWs, req);
    });

    return new Promise((resolve) => {
      this.httpServer!.listen(this.config.listenPort, () => {
        this.running = true;
        console.log(
          `[GameProxy] 代理已启动，监听端口 ${this.config.listenPort}`
        );
        if (this.config.targetHost) {
          console.log(
            `[GameProxy] 转发目标: ${this.config.targetTls ? "wss" : "ws"}://${this.config.targetHost}:${this.config.targetPort}`
          );
        }
        resolve();
      });
    });
  }

  /**
   * 处理来自游戏客户端的 WebSocket 连接
   */
  private handleClientConnection(
    clientWs: WebSocket,
    req: http.IncomingMessage
  ) {
    const requestUrl = req.url || "/";
    const sessionId = `session_${Date.now()}`;

    console.log(`[GameProxy] 游戏客户端连接: ${requestUrl}`);
    this.config.onConnectionChange?.(true, `客户端连接: ${requestUrl}`);

    if (!this.config.targetHost) {
      console.error("[GameProxy] 目标服务器未配置，断开连接");
      clientWs.close(1008, "No target server configured");
      return;
    }

    // 连接到真实服务器
    const targetUrl = `${this.config.targetTls ? "wss" : "ws"}://${this.config.targetHost}:${this.config.targetPort}${requestUrl}`;

    console.log(`[GameProxy] 连接到真实服务器: ${targetUrl}`);

    const serverWs = new WebSocket(targetUrl, {
      headers: {
        ...(req.headers as Record<string, string>),
        host: `${this.config.targetHost}:${this.config.targetPort}`,
      },
      rejectUnauthorized: false,
    });

    const session: ProxySession = { clientWs, serverWs };
    this.sessions.set(sessionId, session);

    // 服务器连接打开后开始转发
    serverWs.on("open", () => {
      console.log(`[GameProxy] 已连接到真实服务器`);
    });

    // 客户端 → 服务器
    clientWs.on("message", (data, isBinary) => {
      if (isBinary) {
        const bytes = new Uint8Array(
          data instanceof ArrayBuffer ? data : (data as Buffer)
        );
        const msg = decodeColyseusMessage(bytes, "client_to_server");
        if (msg) {
          this.handleCapturedMessage(msg);
        }
      }

      // 透明转发
      if (serverWs.readyState === WebSocket.OPEN) {
        serverWs.send(data, { binary: isBinary });
      }
    });

    // 服务器 → 客户端
    serverWs.on("message", (data, isBinary) => {
      if (isBinary) {
        const bytes = new Uint8Array(
          data instanceof ArrayBuffer ? data : (data as Buffer)
        );
        const msg = decodeColyseusMessage(bytes, "server_to_client");
        if (msg) {
          this.handleCapturedMessage(msg);
        }
      }

      // 透明转发
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data, { binary: isBinary });
      }
    });

    // 错误处理
    clientWs.on("error", (err) => {
      console.error(`[GameProxy] 客户端 WS 错误:`, err.message);
    });

    serverWs.on("error", (err) => {
      console.error(`[GameProxy] 服务器 WS 错误:`, err.message);
    });

    // 连接关闭
    clientWs.on("close", (code, reason) => {
      console.log(
        `[GameProxy] 客户端断开: ${code} ${reason.toString()}`
      );
      serverWs.close();
      this.sessions.delete(sessionId);
      this.config.onConnectionChange?.(false, "客户端断开");
    });

    serverWs.on("close", (code, reason) => {
      console.log(
        `[GameProxy] 服务器断开: ${code} ${reason.toString()}`
      );
      clientWs.close();
      this.sessions.delete(sessionId);
    });
  }

  /**
   * 处理捕获的 Colyseus 消息
   */
  private handleCapturedMessage(msg: DecodedMessage) {
    this.capturedMessages.push(msg);

    // 限制缓存大小
    if (this.capturedMessages.length > 10000) {
      this.capturedMessages = this.capturedMessages.slice(-5000);
    }

    // 日志
    console.log(formatMessage(msg));

    // 回调
    this.config.onMessage?.(msg);

    // 特别关注的消息类型
    switch (msg.protocol) {
      case ColyseusProtocol.ROOM_STATE:
        console.log(
          `[GameProxy] ⚡ 房间状态快照 (${msg.payload.length} bytes)`
        );
        this.analyzeRoomState(msg.payload);
        break;

      case ColyseusProtocol.ROOM_STATE_PATCH:
        // 状态增量更新
        break;

      case ColyseusProtocol.ROOM_DATA:
        console.log(
          `[GameProxy] 📦 房间数据消息${msg.decoded ? `: ${JSON.stringify(msg.decoded).slice(0, 100)}` : ""}`
        );
        this.analyzeRoomData(msg);
        break;

      case ColyseusProtocol.JOIN_ROOM:
        console.log(`[GameProxy] 🚪 加入房间`);
        break;

      case ColyseusProtocol.LEAVE_ROOM:
        console.log(`[GameProxy] 🚪 离开房间`);
        break;
    }
  }

  /**
   * 分析房间状态快照（尝试提取卡组信息）
   */
  private analyzeRoomState(payload: Uint8Array) {
    // Colyseus Schema 格式的完整状态
    // 这里记录原始数据以供后续分析
    console.log(
      `[GameProxy] 房间状态原始数据 (前 64 bytes): ${Array.from(payload.slice(0, 64))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ")}`
    );
  }

  /**
   * 分析房间数据消息（可能包含 ProtobufData）
   */
  private analyzeRoomData(msg: DecodedMessage) {
    if (!msg.decoded) return;

    // Colyseus ROOM_DATA 格式: [messageType, ...payload]
    // messageType 可以是 string 或 number
    const decoded = msg.decoded as unknown[];
    if (Array.isArray(decoded) && decoded.length >= 2) {
      const msgType = decoded[0];
      const msgPayload = decoded[1];
      console.log(
        `[GameProxy] 房间数据类型: ${msgType}, 内容: ${JSON.stringify(msgPayload).slice(0, 200)}`
      );
    }
  }

  /**
   * 获取捕获的消息历史
   */
  getCapturedMessages(): DecodedMessage[] {
    return [...this.capturedMessages];
  }

  /**
   * 获取指定类型的消息
   */
  getMessagesByType(protocol: number): DecodedMessage[] {
    return this.capturedMessages.filter((m) => m.protocol === protocol);
  }

  /**
   * 停止代理
   */
  stop(): void {
    if (!this.running) return;

    for (const [, session] of this.sessions) {
      session.clientWs.close();
      session.serverWs.close();
    }
    this.sessions.clear();

    this.wss?.close();
    this.httpServer?.close();
    this.running = false;
    console.log("[GameProxy] 代理已停止");
  }

  isRunning(): boolean {
    return this.running;
  }
}

/**
 * 创建并启动游戏代理（便捷函数）
 */
export async function startGameProxy(
  onMessage?: (msg: DecodedMessage) => void
): Promise<GameProxy> {
  const proxy = new GameProxy({
    listenPort: 2567,
    onMessage,
    onConnectionChange: (connected, info) => {
      console.log(
        `[GameProxy] 连接状态: ${connected ? "已连接" : "断开"} ${info || ""}`
      );
    },
  });
  await proxy.start();
  return proxy;
}
