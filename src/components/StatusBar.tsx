import React from "react";
import type { GameStatus } from "../types";

const SECT_NAMES: Record<string, string> = {
  "cloud-spirit": "云灵剑宗",
  "heptastar": "七星阁",
  "five-element": "五行宗",
  "duan-xuan": "段玄宗",
};

const SIDE_JOB_NAMES: Record<string, string> = {
  "body-forging": "锻体",
  elixirist: "丹修",
  musician: "琴师",
  painter: "画师",
  "array-master": "阵法",
  fortune: "卜筮",
  "beast-tamer": "驭兽",
};

const PHASE_NAMES: Record<number, string> = {
  1: "炼气期",
  2: "筑基期",
  3: "金丹期",
  4: "元婴期",
  5: "化神期",
};

interface Props {
  connected: boolean;
  gameStatus: GameStatus;
}

const StatusBar: React.FC<Props> = ({ connected, gameStatus }) => {
  const player = gameStatus.player;

  if (!connected) {
    return (
      <div className="status-bar">
        <div className="status-left">
          <div className="status-indicator" style={{ backgroundColor: "#f44336" }} />
          <span className="status-text">未连接服务器</span>
        </div>
        <span className="status-connection">○ 断开</span>
      </div>
    );
  }

  if (!player || gameStatus.status !== "in_game") {
    return (
      <div className="status-bar">
        <div className="status-left">
          <div className="status-indicator" style={{ backgroundColor: "#ff9800" }} />
          <span className="status-text">等待对局...</span>
        </div>
        <span className="status-connection">● 已连接</span>
      </div>
    );
  }

  const sideJobNames = (player.sideJobs || [])
    .map((sj) => SIDE_JOB_NAMES[sj] || sj)
    .filter(Boolean);

  return (
    <div className="status-bar">
      <div className="status-left">
        <div className="status-indicator" style={{ backgroundColor: "#4caf50" }} />
        <span className="player-name">{player.characterName}</span>
        <span className="info-divider">·</span>
        <span className="player-sect">{SECT_NAMES[player.sect] || player.sect}</span>
        {sideJobNames.length > 0 && (
          <>
            <span className="info-divider">·</span>
            <span className="player-sidejobs">{sideJobNames.join(" / ")}</span>
          </>
        )}
        <span className="info-divider">·</span>
        <span className="player-phase">{PHASE_NAMES[player.phase] || `第${player.phase}境界`}</span>
      </div>
      <span className="status-connection">● 已连接</span>
    </div>
  );
};

export default StatusBar;
