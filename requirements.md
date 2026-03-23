# 弈仙牌对局流派辅助 (yixian-helper)

基于 [yixian-card-counter](https://github.com/jiangy10/yixian-card-counter) 的日志解析能力，实现弈仙牌对局流派分析辅助工具。

## 功能

- 监听游戏日志文件（`CardOperationLog.json`、`BattleLog.json`），自动检测是否进入对局。
- 对局开始后解析手牌和牌库消耗，分析当前牌组匹配的流派。
- 使用内置流派定义表（核心牌 + 推荐牌），通过加权相似度算法（核心牌 70%、推荐牌 30%）计算匹配度。
- 内置 11 个流派：4 门派（云灵剑宗、七星阁、五行宗、段玄宗）+ 7 副职（炼丹师、符箓师、乐师、画师、阵法师、植修、卜师）。
- 流派定义基于 `card_lib.json` 中的实际卡牌数据，核心牌取 P4-P5 高阶关键牌，推荐牌取中低阶常用牌。

## 技术栈

- **前端**: React 18 + TypeScript，使用 Rspack 1.7.9 构建。
- **后端**: Bun 运行 TypeScript 服务器，使用 chokidar 监听文件变化。
- **通信**: WebSocket 协议实时推送游戏状态和流派分析结果，自动重连。
- **卡牌数据**: 移植自 yixian-card-counter 的 `card_lib.json`（536 张卡牌）和 `seasonal_card_lib.json`。

## 项目结构

```
yixian-helper/
├── server/                     # Bun 后端
│   ├── index.ts                # HTTP(12680) + WebSocket(12681) 服务器
│   ├── logWatcher.ts           # chokidar 监听游戏日志 + 定时轮询兜底
│   ├── logParser.ts            # 解析 BattleLog / CardOperationLog，计算手牌和牌库消耗
│   ├── archetypeAnalyzer.ts    # 流派相似度分析引擎
│   ├── archetypes.ts           # 内置流派定义表（11 个流派的核心牌和推荐牌）
│   └── types.ts                # 服务端类型定义
├── src/                        # React 前端
│   ├── index.tsx               # 入口
│   ├── App.tsx                 # 主应用（状态栏 + 流派面板 + 卡牌列表）
│   ├── App.css                 # 暗色主题样式，简洁紧凑
│   ├── types.ts                # 前端类型定义
│   ├── hooks/
│   │   └── useWebSocket.ts     # WebSocket 连接 hook（自动重连）
│   ├── components/
│   │   ├── ArchetypePanel.tsx   # 流派分析面板（流派名称、相似度、核心牌/推荐牌匹配）
│   │   ├── CardList.tsx         # 卡牌列表（手牌/牌库消耗）
│   │   └── StatusBar.tsx        # 连接状态 + 对局状态指示
│   └── data/
│       ├── card_lib.json        # 主卡牌库
│       └── seasonal_card_lib.json  # 赛季卡牌库
├── public/
│   └── index.html
├── rspack.config.ts            # Rspack 构建配置（SWC + React Refresh + CSS）
├── tsconfig.json               # 前端 TypeScript 配置
├── tsconfig.server.json        # 服务端 TypeScript 配置
└── package.json
```

## 运行方式

```bash
# 同时启动前后端（开发模式）
npm start

# 或分别启动
bun run server/index.ts    # 后端：HTTP :12680, WebSocket :12681
npx rspack serve           # 前端开发服务器 :3000

# 构建生产版本
npx rspack build           # 输出到 dist/，后端 HTTP 服务器直接提供静态文件
```

## 界面说明

- 暗色主题，简洁紧凑风格。
- 顶部状态栏显示连接状态（已连接/断开）和对局状态（对局中/等待/空闲）。
- 对局中显示流派分析面板：按相似度降序排列，每个流派卡片包含名称、描述、相似度百分比、核心牌匹配情况、推荐牌匹配情况。
- 匹配的卡牌以高亮标签展示，未匹配的以灰色展示。
- 流派卡片左侧边框颜色表示匹配度：绿色（≥30%）、橙色（≥10%）、灰色（<10%）。
- 下方两栏分别展示当前手牌和牌库消耗情况。

## WebSocket 消息协议

服务端向客户端推送以下消息类型：

```typescript
// 游戏状态
{ type: "game_status", data: { inGame: boolean, status: "waiting" | "in_game" | "idle" } }

// 流派分析结果
{ type: "deck_analysis", data: {
  handCards: Record<string, { count: number }>,       // 当前手牌
  deckCards: Record<string, { count: number }>,       // 牌库消耗
  archetypeMatches: Array<{                           // 流派匹配列表（按相似度降序）
    archetype: { id, name, description, coreCards, recommendCards, category, type },
    similarity: number,              // 0-1 加权相似度
    matchedCoreCards: string[],      // 匹配的核心牌
    matchedRecommendCards: string[], // 匹配的推荐牌
    totalCoreCards: number,
    totalRecommendCards: number
  }>
}}
```

## 游戏日志路径

- **Windows**: `%USERPROFILE%\AppData\LocalLow\DarkSunStudio\YiXianPai\`
- **macOS**: `~/Library/Containers/com.darksun.yixianpai/`