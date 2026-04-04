/**
 * 网络探测模块
 * 检测游戏进程的活跃网络连接，确定 Colyseus 服务器地址
 */

import { execSync } from "child_process";

export interface GameConnection {
  localAddr: string;
  localPort: number;
  remoteAddr: string;
  remotePort: number;
  state: string;
  pid: number;
}

/**
 * 查找弈仙牌游戏进程 PID
 */
export function findGamePid(): number | null {
  try {
    const output = execSync(
      'tasklist /FI "IMAGENAME eq YiXianPai.exe" /FO CSV /NH',
      { encoding: "utf-8" }
    );
    const match = output.match(/"YiXianPai\.exe","(\d+)"/i);
    if (match) return parseInt(match[1], 10);

    // 尝试其他可能的进程名
    const output2 = execSync(
      'tasklist /FI "IMAGENAME eq 弈仙牌.exe" /FO CSV /NH',
      { encoding: "utf-8" }
    );
    const match2 = output2.match(/"[^"]+","(\d+)"/);
    if (match2) return parseInt(match2[1], 10);

    return null;
  } catch {
    return null;
  }
}

/**
 * 获取指定 PID 的所有 TCP 连接
 */
export function getProcessConnections(pid: number): GameConnection[] {
  try {
    const output = execSync("netstat -ano -p TCP", { encoding: "utf-8" });
    const lines = output.split("\n");
    const connections: GameConnection[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("Proto") || trimmed.startsWith("Active"))
        continue;

      // TCP  192.168.1.100:12345  1.2.3.4:443  ESTABLISHED  1234
      const parts = trimmed.split(/\s+/);
      if (parts.length < 5 || parts[0] !== "TCP") continue;

      const linePid = parseInt(parts[4], 10);
      if (linePid !== pid) continue;

      const [localAddr, localPort] = splitAddress(parts[1]);
      const [remoteAddr, remotePort] = splitAddress(parts[2]);

      connections.push({
        localAddr,
        localPort,
        remoteAddr,
        remotePort,
        state: parts[3],
        pid: linePid,
      });
    }

    return connections;
  } catch {
    return [];
  }
}

function splitAddress(addr: string): [string, number] {
  const lastColon = addr.lastIndexOf(":");
  return [
    addr.substring(0, lastColon),
    parseInt(addr.substring(lastColon + 1), 10),
  ];
}

/**
 * 从游戏连接中识别 Colyseus 服务器连接
 * Colyseus 默认使用 WebSocket，通常连接到 443 (wss) 或 2567 (默认端口)
 */
export function identifyColyseusConnections(
  connections: GameConnection[]
): GameConnection[] {
  // 过滤 ESTABLISHED 连接，排除本地连接和已知非游戏端口
  return connections.filter((conn) => {
    if (conn.state !== "ESTABLISHED") return false;
    if (conn.remoteAddr === "127.0.0.1" || conn.remoteAddr === "0.0.0.0")
      return false;
    // 排除常见的非游戏端口 (Steam, analytics, etc)
    const excludePorts = [
      27015, 27017, // Steam
      80, 8080, // HTTP (unlikely for game state)
    ];
    if (excludePorts.includes(conn.remotePort)) return false;
    return true;
  });
}

/**
 * 探测游戏的 Colyseus 服务器地址
 */
export function probeGameServer(): {
  pid: number;
  connections: GameConnection[];
  serverAddr?: string;
  serverPort?: number;
} | null {
  const pid = findGamePid();
  if (!pid) {
    console.log("[NetworkProbe] 未找到游戏进程");
    return null;
  }

  console.log(`[NetworkProbe] 找到游戏进程 PID: ${pid}`);

  const allConns = getProcessConnections(pid);
  const gameConns = identifyColyseusConnections(allConns);

  console.log(
    `[NetworkProbe] 游戏总连接数: ${allConns.length}, 疑似 Colyseus 连接: ${gameConns.length}`
  );

  for (const conn of gameConns) {
    console.log(
      `[NetworkProbe]   ${conn.localAddr}:${conn.localPort} → ${conn.remoteAddr}:${conn.remotePort} (${conn.state})`
    );
  }

  // WebSocket 连接通常使用 443 (wss) 或特定端口
  const wsConn =
    gameConns.find((c) => c.remotePort === 443) ||
    gameConns.find((c) => c.remotePort === 2567) ||
    gameConns[0];

  if (wsConn) {
    return {
      pid,
      connections: gameConns,
      serverAddr: wsConn.remoteAddr,
      serverPort: wsConn.remotePort,
    };
  }

  return { pid, connections: gameConns };
}

/**
 * 持续监控游戏连接变化
 */
export function watchGameConnections(
  callback: (info: ReturnType<typeof probeGameServer>) => void,
  intervalMs = 5000
): () => void {
  let lastPid: number | null = null;
  let lastConnCount = 0;

  const timer = setInterval(() => {
    const info = probeGameServer();

    if (
      info?.pid !== lastPid ||
      (info?.connections.length ?? 0) !== lastConnCount
    ) {
      lastPid = info?.pid ?? null;
      lastConnCount = info?.connections.length ?? 0;
      callback(info);
    }
  }, intervalMs);

  // 立即执行一次
  const initial = probeGameServer();
  callback(initial);

  return () => clearInterval(timer);
}
