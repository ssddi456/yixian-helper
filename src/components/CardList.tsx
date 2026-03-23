import React, { useRef } from "react";
import type { CardCount } from "../types";

const PHASE_NAMES: Record<number, string> = {
  1: "炼气",
  2: "筑基",
  3: "金丹",
  4: "元婴",
  5: "化神",
  6: "大乘",
};

const CATEGORY_NAMES: Record<string, string> = {
  // 门派
  "cloud-spirit": "云灵",
  "heptastar": "七星",
  "five-element": "五行",
  "duan-xuan": "断玄",
  // 副职
  "elixirist": "丹修",
  "musician": "琴修",
  "painter": "画修",
  "array-master": "阵修",
  "fortune": "占卜",
  "beast-tamer": "驭兽",
  "body-forging": "锻体",
};

const SECT_CATEGORIES = new Set([
  "cloud-spirit", "heptastar", "five-element", "duan-xuan",
]);

const SIDE_JOB_CATEGORIES = new Set([
  "elixirist", "musician", "painter", "array-master",
  "fortune", "beast-tamer", "body-forging",
]);

// 角色英文 ID → 中文名
const CHARACTER_NAMES: Record<string, string> = {
  MuYifeng: "慕逸风", YanXue: "颜雪", LongYao: "龙瑶",
  LinXiaoyue: "林小月", LuJianxin: "陆剑心", LiChengyun: "李承运",
  TanShuyan: "谈书言", YanChen: "严尘", YaoLing: "姚灵",
  JiangXiming: "姜袭明", WuCe: "吴策", WuXingzhi: "吴行之",
  DuLingyuan: "杜伶鸳", HuaQinrui: "花沁蕊", MuHu: "慕虎",
  XiaoBu: "小布", TuKui: "涂魁", YeMingming: "夜冥冥",
  JiFangsheng: "姬方生", LiMan: "黎蛮", QiWangyou: "齐望幽",
  FengXu: "风旭",
};

interface Props {
  cards: Record<string, CardCount>;
}

const CardList: React.FC<Props> = ({ cards }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const entries = Object.entries(cards).sort((a, b) => b[1].count - a[1].count);

  if (entries.length === 0) {
    return <div className="card-list-empty">暂无卡牌</div>;
  }

  // 按境界分组，未知境界归到 0
  const groups = new Map<number, [string, CardCount][]>();
  for (const entry of entries) {
    const phase = entry[1].phase || 0;
    if (!groups.has(phase)) groups.set(phase, []);
    groups.get(phase)!.push(entry);
  }

  // 排序：按境界升序，未知在最后
  const sortedPhases = [...groups.keys()].sort((a, b) => {
    if (a === 0) return 1;
    if (b === 0) return -1;
    return a - b;
  });

  const scrollToPhase = (phase: number) => {
    const el = containerRef.current?.querySelector(`[data-phase="${phase}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="card-list-grouped" ref={containerRef}>
      {/* 境界锚点导航 */}
      <div className="phase-nav">
        {sortedPhases.map((phase) => (
          <button
            key={phase}
            className="phase-nav-btn"
            onClick={() => scrollToPhase(phase)}
          >
            {PHASE_NAMES[phase] || "其他"}
            <span className="phase-nav-count">{groups.get(phase)!.length}</span>
          </button>
        ))}
      </div>

      {/* 按境界分组的卡牌列表 */}
      {sortedPhases.map((phase) => {
        const phaseCards = groups.get(phase)!;
        return (
          <div key={phase} className="phase-group" data-phase={phase}>
            <div className="phase-group-header">
              <span className="phase-group-label">
                {PHASE_NAMES[phase] || "其他"}
              </span>
              <span className="phase-group-count">{phaseCards.length}张</span>
            </div>
            <div className="card-grid">
              {phaseCards.map(([name, info]) => {
                const cat = info.category || "";
                const isSect = SECT_CATEGORIES.has(cat);
                const isSideJob = SIDE_JOB_CATEGORIES.has(cat);
                const isCharacter = !isSect && !isSideJob && !!CHARACTER_NAMES[cat];
                const badgeLabel = CATEGORY_NAMES[cat] || CHARACTER_NAMES[cat] || "";
                const badgeClass = isSect ? "sect" : isSideJob ? "sidejob" : isCharacter ? "character" : "";

                return (
                  <div key={name} className="card-item">
                    <div className="card-item-main">
                      <span className="card-name">{name}</span>
                      {badgeLabel && (
                        <span className={`card-badge ${badgeClass}`}>{badgeLabel}</span>
                      )}
                      <span className="card-count">×{info.count}</span>
                    </div>
                    {info.effect && (
                      <div className="card-effect">{info.effect}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CardList;
