import React, { useState } from "react";
import type { GameStatus, ClientWSMessage } from "../types";

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

const CHARACTER_LIST: { id: string; name: string; sect: string }[] = [
  { id: "MuYifeng", name: "慕一峰", sect: "cloud-spirit" },
  { id: "YanXue", name: "燕雪", sect: "cloud-spirit" },
  { id: "LongYao", name: "龙瑶", sect: "cloud-spirit" },
  { id: "LinXiaoyue", name: "林小月", sect: "cloud-spirit" },
  { id: "LuJianxin", name: "陆剑心", sect: "cloud-spirit" },
  { id: "LiChengyun", name: "李承云", sect: "cloud-spirit" },
  { id: "TanShuyan", name: "谭书言", sect: "cloud-spirit" },
  { id: "YanChen", name: "严尘", sect: "heptastar" },
  { id: "YaoLing", name: "妖灵", sect: "heptastar" },
  { id: "JiangXiming", name: "姜熙明", sect: "heptastar" },
  { id: "WuCe", name: "无策", sect: "heptastar" },
  { id: "WuXingzhi", name: "吴行之", sect: "five-element" },
  { id: "DuLingyuan", name: "杜灵鸢", sect: "five-element" },
  { id: "HuaQinrui", name: "花沁蕊", sect: "five-element" },
  { id: "MuHu", name: "穆虎", sect: "five-element" },
  { id: "XiaoBu", name: "小布", sect: "duan-xuan" },
  { id: "TuKui", name: "屠魁", sect: "duan-xuan" },
  { id: "YeMingming", name: "夜冥冥", sect: "duan-xuan" },
  { id: "JiFangsheng", name: "纪方生", sect: "duan-xuan" },
  { id: "LiMan", name: "黎曼", sect: "duan-xuan" },
  { id: "QiWangyou", name: "齐忘忧", sect: "duan-xuan" },
  { id: "FengXu", name: "风虚", sect: "duan-xuan" },
];

const SIDE_JOB_LIST = Object.entries(SIDE_JOB_NAMES);

interface Props {
  connected: boolean;
  gameStatus: GameStatus;
  onSendMessage: (msg: ClientWSMessage) => void;
}

const StatusBar: React.FC<Props> = ({ connected, gameStatus, onSendMessage }) => {
  const [editing, setEditing] = useState(false);
  const player = gameStatus.player;

  // Edit form state, initialized from current player
  const [editChar, setEditChar] = useState("");
  const [editPhase, setEditPhase] = useState(1);
  const [editSideJobs, setEditSideJobs] = useState<string[]>([]);

  const startEditing = () => {
    if (player) {
      setEditChar(player.character);
      setEditPhase(player.phase);
      setEditSideJobs([...player.sideJobs]);
    }
    setEditing(true);
  };

  const handleSave = () => {
    onSendMessage({
      type: "set_player_override",
      data: {
        character: editChar || undefined,
        phase: editPhase,
        sideJobs: editSideJobs,
      },
    });
    setEditing(false);
  };

  const handleClear = () => {
    onSendMessage({ type: "clear_player_override" });
    setEditing(false);
  };

  const toggleSideJob = (job: string) => {
    setEditSideJobs((prev) =>
      prev.includes(job) ? prev.filter((j) => j !== job) : [...prev, job]
    );
  };

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

  if (editing) {
    const selectedChar = CHARACTER_LIST.find((c) => c.id === editChar);
    return (
      <div className="status-bar status-bar-editing">
        <div className="status-edit-form">
          <div className="edit-row">
            <label>角色</label>
            <select value={editChar} onChange={(e) => setEditChar(e.target.value)}>
              <option value="">-- 选择角色 --</option>
              {Object.entries(SECT_NAMES).map(([sectId, sectName]) => (
                <optgroup key={sectId} label={sectName}>
                  {CHARACTER_LIST.filter((c) => c.sect === sectId).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {selectedChar && (
              <span className="edit-sect-hint">{SECT_NAMES[selectedChar.sect]}</span>
            )}
          </div>
          <div className="edit-row">
            <label>境界</label>
            <div className="edit-phase-btns">
              {[1, 2, 3, 4, 5].map((p) => (
                <button
                  key={p}
                  className={`edit-phase-btn ${editPhase === p ? "active" : ""}`}
                  onClick={() => setEditPhase(p)}
                >
                  {PHASE_NAMES[p]}
                </button>
              ))}
            </div>
          </div>
          <div className="edit-row">
            <label>副职</label>
            <div className="edit-sidejob-btns">
              {SIDE_JOB_LIST.map(([id, name]) => (
                <button
                  key={id}
                  className={`edit-sidejob-btn ${editSideJobs.includes(id) ? "active" : ""}`}
                  onClick={() => toggleSideJob(id)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
          <div className="edit-actions">
            <button className="edit-save-btn" onClick={handleSave}>确认</button>
            <button className="edit-clear-btn" onClick={handleClear}>恢复自动</button>
            <button className="edit-cancel-btn" onClick={() => setEditing(false)}>取消</button>
          </div>
        </div>
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
        <button className="edit-trigger-btn" onClick={startEditing} title="修正角色信息">✎</button>
      </div>
      <span className="status-connection">● 已连接</span>
    </div>
  );
};

export default StatusBar;
