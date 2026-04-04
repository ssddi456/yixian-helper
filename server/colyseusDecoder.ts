/**
 * Colyseus 协议解码器
 * 解析 Colyseus SDK 的二进制 WebSocket 消息
 *
 * 协议格式参考:
 * - 第一字节为协议类型 (ColyseusProtocol)
 * - 后续字节为消息体 (MessagePack / Schema / raw bytes)
 */

// Colyseus 协议常量 (从 il2cpp dump 中提取)
export const ColyseusProtocol = {
  USER_ID: 1,
  JOIN_REQUEST: 9,
  JOIN_ROOM: 10,
  ERROR: 11,
  LEAVE_ROOM: 12,
  ROOM_DATA: 13,
  ROOM_STATE: 14,
  ROOM_STATE_PATCH: 15,
  ROOM_DATA_SCHEMA: 16,
  ROOM_LIST: 20,
  BAD_REQUEST: 50,
} as const;

export type ProtocolType = (typeof ColyseusProtocol)[keyof typeof ColyseusProtocol];

export interface DecodedMessage {
  protocol: ProtocolType;
  protocolName: string;
  direction: "client_to_server" | "server_to_client";
  payload: Uint8Array;
  /** msgpack-decoded data (when applicable) */
  decoded?: unknown;
  timestamp: number;
}

const protocolNames: Record<number, string> = {
  [ColyseusProtocol.USER_ID]: "USER_ID",
  [ColyseusProtocol.JOIN_REQUEST]: "JOIN_REQUEST",
  [ColyseusProtocol.JOIN_ROOM]: "JOIN_ROOM",
  [ColyseusProtocol.ERROR]: "ERROR",
  [ColyseusProtocol.LEAVE_ROOM]: "LEAVE_ROOM",
  [ColyseusProtocol.ROOM_DATA]: "ROOM_DATA",
  [ColyseusProtocol.ROOM_STATE]: "ROOM_STATE",
  [ColyseusProtocol.ROOM_STATE_PATCH]: "ROOM_STATE_PATCH",
  [ColyseusProtocol.ROOM_DATA_SCHEMA]: "ROOM_DATA_SCHEMA",
  [ColyseusProtocol.ROOM_LIST]: "ROOM_LIST",
  [ColyseusProtocol.BAD_REQUEST]: "BAD_REQUEST",
};

/**
 * 解析 Colyseus 协议消息
 */
export function decodeColyseusMessage(
  data: Uint8Array | Buffer,
  direction: "client_to_server" | "server_to_client"
): DecodedMessage | null {
  if (!data || data.length === 0) return null;

  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const protocol = bytes[0] as ProtocolType;
  const protocolName = protocolNames[protocol] || `UNKNOWN(${protocol})`;
  const payload = bytes.slice(1);

  const msg: DecodedMessage = {
    protocol,
    protocolName,
    direction,
    payload,
    timestamp: Date.now(),
  };

  // 尝试解码 MessagePack 数据
  try {
    if (
      protocol === ColyseusProtocol.ROOM_DATA ||
      protocol === ColyseusProtocol.JOIN_ROOM
    ) {
      msg.decoded = decodeMsgPack(payload);
    }
  } catch {
    // msgpack 解码失败，保留原始 payload
  }

  return msg;
}

/**
 * 简易 MessagePack 解码器
 * 支持 Colyseus 中常用的类型
 */
export function decodeMsgPack(data: Uint8Array): unknown {
  const reader = new MsgPackReader(data);
  return reader.read();
}

class MsgPackReader {
  private pos = 0;
  private view: DataView;
  private data: Uint8Array;

  constructor(data: Uint8Array) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  read(): unknown {
    if (this.pos >= this.data.length) return undefined;

    const byte = this.data[this.pos++];

    // positive fixint (0x00 - 0x7f)
    if (byte <= 0x7f) return byte;

    // fixmap (0x80 - 0x8f)
    if (byte >= 0x80 && byte <= 0x8f) return this.readMap(byte & 0x0f);

    // fixarray (0x90 - 0x9f)
    if (byte >= 0x90 && byte <= 0x9f) return this.readArray(byte & 0x0f);

    // fixstr (0xa0 - 0xbf)
    if (byte >= 0xa0 && byte <= 0xbf) return this.readString(byte & 0x1f);

    // negative fixint (0xe0 - 0xff)
    if (byte >= 0xe0) return byte - 256;

    switch (byte) {
      case 0xc0: return null;       // nil
      case 0xc2: return false;      // false
      case 0xc3: return true;       // true

      // bin 8/16/32
      case 0xc4: return this.readBin(this.readUint8());
      case 0xc5: return this.readBin(this.readUint16());
      case 0xc6: return this.readBin(this.readUint32());

      // ext 8/16/32
      case 0xc7: { const len = this.readUint8(); const type = this.readInt8(); return { type, data: this.readBin(len) }; }
      case 0xc8: { const len = this.readUint16(); const type = this.readInt8(); return { type, data: this.readBin(len) }; }
      case 0xc9: { const len = this.readUint32(); const type = this.readInt8(); return { type, data: this.readBin(len) }; }

      // float 32/64
      case 0xca: return this.readFloat32();
      case 0xcb: return this.readFloat64();

      // uint 8/16/32/64
      case 0xcc: return this.readUint8();
      case 0xcd: return this.readUint16();
      case 0xce: return this.readUint32();
      case 0xcf: return this.readUint64();

      // int 8/16/32/64
      case 0xd0: return this.readInt8();
      case 0xd1: return this.readInt16();
      case 0xd2: return this.readInt32();
      case 0xd3: return this.readInt64();

      // fixext 1/2/4/8/16
      case 0xd4: { const type = this.readInt8(); return { type, data: this.readBin(1) }; }
      case 0xd5: { const type = this.readInt8(); return { type, data: this.readBin(2) }; }
      case 0xd6: { const type = this.readInt8(); return { type, data: this.readBin(4) }; }
      case 0xd7: { const type = this.readInt8(); return { type, data: this.readBin(8) }; }
      case 0xd8: { const type = this.readInt8(); return { type, data: this.readBin(16) }; }

      // str 8/16/32
      case 0xd9: return this.readString(this.readUint8());
      case 0xda: return this.readString(this.readUint16());
      case 0xdb: return this.readString(this.readUint32());

      // array 16/32
      case 0xdc: return this.readArray(this.readUint16());
      case 0xdd: return this.readArray(this.readUint32());

      // map 16/32
      case 0xde: return this.readMap(this.readUint16());
      case 0xdf: return this.readMap(this.readUint32());

      default:
        throw new Error(`Unknown MsgPack type: 0x${byte.toString(16)} at offset ${this.pos - 1}`);
    }
  }

  private readUint8(): number {
    return this.data[this.pos++];
  }

  private readInt8(): number {
    const val = this.view.getInt8(this.pos);
    this.pos += 1;
    return val;
  }

  private readUint16(): number {
    const val = this.view.getUint16(this.pos);
    this.pos += 2;
    return val;
  }

  private readInt16(): number {
    const val = this.view.getInt16(this.pos);
    this.pos += 2;
    return val;
  }

  private readUint32(): number {
    const val = this.view.getUint32(this.pos);
    this.pos += 4;
    return val;
  }

  private readInt32(): number {
    const val = this.view.getInt32(this.pos);
    this.pos += 4;
    return val;
  }

  private readUint64(): number {
    const hi = this.view.getUint32(this.pos);
    const lo = this.view.getUint32(this.pos + 4);
    this.pos += 8;
    return hi * 0x100000000 + lo;
  }

  private readInt64(): number {
    const hi = this.view.getInt32(this.pos);
    const lo = this.view.getUint32(this.pos + 4);
    this.pos += 8;
    return hi * 0x100000000 + lo;
  }

  private readFloat32(): number {
    const val = this.view.getFloat32(this.pos);
    this.pos += 4;
    return val;
  }

  private readFloat64(): number {
    const val = this.view.getFloat64(this.pos);
    this.pos += 8;
    return val;
  }

  private readString(length: number): string {
    const bytes = this.data.slice(this.pos, this.pos + length);
    this.pos += length;
    return new TextDecoder().decode(bytes);
  }

  private readBin(length: number): Uint8Array {
    const bytes = this.data.slice(this.pos, this.pos + length);
    this.pos += length;
    return bytes;
  }

  private readArray(length: number): unknown[] {
    const arr: unknown[] = [];
    for (let i = 0; i < length; i++) {
      arr.push(this.read());
    }
    return arr;
  }

  private readMap(length: number): Record<string, unknown> {
    const map: Record<string, unknown> = {};
    for (let i = 0; i < length; i++) {
      const key = String(this.read());
      map[key] = this.read();
    }
    return map;
  }
}

/**
 * MsgPack 编码器 (用于代理转发时可能需要的消息重编码)
 */
export function encodeMsgPack(value: unknown): Uint8Array {
  const parts: number[] = [];
  encodeTo(value, parts);
  return new Uint8Array(parts);
}

function encodeTo(value: unknown, out: number[]): void {
  if (value === null || value === undefined) {
    out.push(0xc0);
    return;
  }

  if (typeof value === "boolean") {
    out.push(value ? 0xc3 : 0xc2);
    return;
  }

  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      if (value >= 0 && value <= 0x7f) {
        out.push(value);
      } else if (value < 0 && value >= -32) {
        out.push(value + 256);
      } else if (value >= 0 && value <= 0xff) {
        out.push(0xcc, value);
      } else if (value >= 0 && value <= 0xffff) {
        out.push(0xcd, (value >> 8) & 0xff, value & 0xff);
      } else if (value >= 0 && value <= 0xffffffff) {
        out.push(0xce, (value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff);
      } else if (value >= -128 && value <= 127) {
        out.push(0xd0, value < 0 ? value + 256 : value);
      } else if (value >= -32768 && value <= 32767) {
        const v = value < 0 ? value + 65536 : value;
        out.push(0xd1, (v >> 8) & 0xff, v & 0xff);
      } else {
        const v = value < 0 ? value + 0x100000000 : value;
        out.push(0xd2, (v >> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff);
      }
    } else {
      // float64
      const buf = new ArrayBuffer(8);
      new DataView(buf).setFloat64(0, value);
      out.push(0xcb, ...new Uint8Array(buf));
    }
    return;
  }

  if (typeof value === "string") {
    const encoded = new TextEncoder().encode(value);
    const len = encoded.length;
    if (len <= 31) {
      out.push(0xa0 | len);
    } else if (len <= 0xff) {
      out.push(0xd9, len);
    } else if (len <= 0xffff) {
      out.push(0xda, (len >> 8) & 0xff, len & 0xff);
    } else {
      out.push(0xdb, (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff);
    }
    for (const b of encoded) out.push(b);
    return;
  }

  if (value instanceof Uint8Array) {
    const len = value.length;
    if (len <= 0xff) {
      out.push(0xc4, len);
    } else if (len <= 0xffff) {
      out.push(0xc5, (len >> 8) & 0xff, len & 0xff);
    } else {
      out.push(0xc6, (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff);
    }
    for (const b of value) out.push(b);
    return;
  }

  if (Array.isArray(value)) {
    const len = value.length;
    if (len <= 15) {
      out.push(0x90 | len);
    } else if (len <= 0xffff) {
      out.push(0xdc, (len >> 8) & 0xff, len & 0xff);
    } else {
      out.push(0xdd, (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff);
    }
    for (const item of value) encodeTo(item, out);
    return;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    const len = entries.length;
    if (len <= 15) {
      out.push(0x80 | len);
    } else if (len <= 0xffff) {
      out.push(0xde, (len >> 8) & 0xff, len & 0xff);
    } else {
      out.push(0xdf, (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff);
    }
    for (const [k, v] of entries) {
      encodeTo(k, out);
      encodeTo(v, out);
    }
  }
}

/**
 * Colyseus Schema 变更操作码
 */
export const SchemaOperation = {
  ADD: 0,
  REPLACE: 1,
  DELETE: 2,
  DELETE_AND_ADD: 3,
  CLEAR: 10,
  REVERSE: 15,
} as const;

/**
 * 解析 Colyseus Schema 状态补丁 (ROOM_STATE_PATCH)
 * 返回变更列表，包含字段索引和新值
 */
export interface SchemaPatch {
  fieldIndex: number;
  operation: number;
  value: Uint8Array;
}

export function decodeSchemaPatches(data: Uint8Array): SchemaPatch[] {
  const patches: SchemaPatch[] = [];
  let offset = 0;

  while (offset < data.length) {
    const fieldIndex = data[offset++];
    if (fieldIndex === undefined || offset >= data.length) break;

    const operation = data[offset++];

    // 剩余数据作为值的原始字节（完整解析需要 schema 定义）
    const remaining = data.slice(offset);
    patches.push({ fieldIndex, operation, value: remaining });

    // 没有 schema 定义时无法确定值的长度，仅记录第一个 patch
    break;
  }

  return patches;
}

/**
 * 将消息格式化为可读的日志字符串
 */
export function formatMessage(msg: DecodedMessage): string {
  const dir = msg.direction === "client_to_server" ? "→" : "←";
  const size = msg.payload.length;
  let detail = "";

  if (msg.decoded) {
    try {
      detail = ` | ${JSON.stringify(msg.decoded).slice(0, 200)}`;
    } catch {
      detail = " | [decode error]";
    }
  }

  return `[Colyseus] ${dir} ${msg.protocolName} (${size}B)${detail}`;
}
