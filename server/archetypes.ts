import { ArchetypeDefinition } from "./types";

/**
 * 弈仙牌内置流派定义表
 * 基于实际 card_lib.json 中的卡牌数据
 * 核心牌 = 高阶(P4-P5)关键牌；推荐牌 = 中低阶常用牌
 */
export const ARCHETYPES: ArchetypeDefinition[] = [
  // ===== 门派流派 =====
  {
    id: "cloud-spirit",
    name: "云灵剑宗",
    description: "灵剑攻防兼备，灵气与剑术结合",
    category: "cloud-spirit",
    type: "sect",
    coreCards: [
      "云剑•游龙", "云剑•凌波", "飞灵闪影剑", "万法归灵剑",
      "剑意激荡", "御空剑阵", "连环剑阵", "狂剑•零式",
      "云剑•闪风", "云剑•月影", "聚灵心法", "百鸟灵剑诀",
    ],
    recommendCards: [
      "云剑•极意", "云剑•无锋", "云剑•柔心", "云剑•无妄",
      "化灵诀", "巨鲸灵剑", "巨虎灵剑", "引气剑",
      "云剑•探云", "云剑•飞刺", "云剑•厚土", "云剑•回守",
      "轻剑", "护身灵气", "灵气灌注",
    ],
  },
  {
    id: "heptastar",
    name: "七星阁",
    description: "星弈棋术，策略控场与爆发并重",
    category: "heptastar",
    type: "sect",
    coreCards: [
      "天元心法", "星弈•断", "乾卦", "五雷轰顶",
      "梅开二度", "气吞山河", "黄雀在后", "紫气东来",
      "星弈•飞", "星弈•虎", "六爻绝阵", "离卦",
    ],
    recommendCards: [
      "星轨推衍", "蜻蜓点水", "轰雷掣电", "反震心法",
      "金蝉脱壳", "杯弓蛇影", "众星拱月", "星弈•打",
      "星弈•拐", "坎卦", "艮卦",
    ],
  },
  {
    id: "five-element",
    name: "五行宗",
    description: "五行相生相克，灵活切换属性攻防",
    category: "five-element",
    type: "sect",
    coreCards: [
      "木灵•柳纷飞", "火灵•烈燎原", "土灵•合八荒",
      "金灵•巨鼎落", "水灵•纳百川", "混元无极阵", "五行天髓诀",
      "木灵•暗香", "火灵•瞬燃", "土灵•绝壁", "金灵•飞梭", "水灵•腾浪",
    ],
    recommendCards: [
      "木灵•玫刺", "火灵•灼心", "土灵•流沙", "金灵•铁骨",
      "水灵•潜遁", "混元碎击", "木灵阵", "火灵阵",
      "土灵阵", "金灵阵", "水灵阵",
    ],
  },
  {
    id: "duan-xuan",
    name: "段玄宗",
    description: "崩拳锻体，近战肉搏与体术爆发",
    category: "duan-xuan",
    type: "sect",
    coreCards: [
      "崩拳•闪击", "崩拳•惊触", "锻神开海", "百杀破境掌",
      "修罗吼", "玄心斩魄", "威震四方", "天地浩荡",
      "崩灭心法", "崩拳•寸劲", "崩拳•连崩", "锻髓",
    ],
    recommendCards: [
      "鹤步", "灵玄迷踪步", "冥影身法", "玄手夺魂",
      "冲霄破浪", "磅礴之势", "崩天步", "崩拳•截脉",
    ],
  },

  // ===== 副职流派 =====
  {
    id: "elixirist",
    name: "炼丹师",
    description: "炼制丹药，回复与增益效果",
    category: "elixirist",
    type: "side-jobs",
    coreCards: [
      "冰灵护体丹", "锻体玄丹", "悟道丹",
      "大还丹", "聚灵丹", "洗髓丹",
    ],
    recommendCards: [
      "还魂丹", "疗伤丹", "神力丹",
      "锻体丹", "飞云丹", "驱邪丹",
      "地灵丹", "培元丹", "小还丹",
    ],
  },
  {
    id: "fuluist",
    name: "符箓师",
    description: "符咒攻防，削弱敌人增强自身",
    category: "fuluist",
    type: "side-jobs",
    coreCards: [
      "镇魂封元符", "千里神行符", "万邪入体咒",
      "聚气咒", "扰心符", "弱体符",
    ],
    recommendCards: [
      "寒冰咒", "吸灵符", "瘴气符",
      "火云符", "清心咒", "水气符",
      "奔雷符", "护灵符", "锐金符",
    ],
  },
  {
    id: "musician",
    name: "乐师",
    description: "以乐曲施展各种增益减益效果",
    category: "musician",
    type: "side-jobs",
    coreCards: [
      "天音困仙曲", "幽绪乱心曲", "转弦合调",
      "回春曲", "九煞破灵曲", "同心曲",
    ],
    recommendCards: [
      "断肠曲", "狂舞曲", "轮指连音",
      "慈念曲", "幻音曲", "天灵曲",
      "破音", "土行曲", "逍遥曲",
    ],
  },
  {
    id: "painter",
    name: "画师",
    description: "妙笔生花，通过绘画施展灵术",
    category: "painter",
    type: "side-jobs",
    coreCards: [
      "运笔如飞", "画龙点睛", "妙笔生花",
      "触类旁通", "神来之笔", "纸落云烟",
    ],
    recommendCards: [
      "挥毫泼墨", "灵感迸发", "以画入道",
      "笔走龙蛇", "画饼充饥", "画蛇添足",
      "调色", "练笔", "研墨",
    ],
  },
  {
    id: "formation-master",
    name: "阵法师",
    description: "布阵控场，范围攻防效果",
    category: "formation-master",
    type: "side-jobs",
    coreCards: [
      "万花迷魂阵", "回响阵纹", "须弥阵纹",
      "天罡聚力阵", "八门金锁阵", "不动金刚阵",
    ],
    recommendCards: [
      "聚灵阵", "周天剑阵", "辟邪阵纹",
      "龟甲阵", "邪蛊阵", "疗愈阵纹",
      "引雷阵", "碎杀阵", "冲击阵纹",
    ],
  },
  {
    id: "plant-master",
    name: "植修",
    description: "灵植培育，道果与古藤攻防",
    category: "plant-master",
    type: "side-jobs",
    coreCards: [
      "玄韵道果", "魔韵道果", "空间灵田",
      "缚仙古藤", "噬仙古藤",
      "飞枭灵芝", "影枭灵芝",
    ],
    recommendCards: [
      "穿肠紫蕨", "清肠紫蕨", "冰封雪莲", "冰封血莲",
      "愈甘菊", "清甘菊", "灵植浇灌",
      "向灵葵", "邪灵葵", "神力草", "失力草",
    ],
  },
  {
    id: "fortune-teller",
    name: "卜师",
    description: "天机占卜，操纵命运吉凶",
    category: "fortune-teller",
    type: "side-jobs",
    coreCards: [
      "厄劫缠身", "命运轮回", "天机•顺应", "天机•逆施",
      "万事如意", "诸事不宜", "天星•牵引", "天星•御心",
    ],
    recommendCards: [
      "吉运初显", "血光之灾", "天命•飞逝", "天命•重现",
      "探灵", "凶相", "天运•避凶", "天运•趋吉",
      "卜命", "察体", "天谕•守", "天谕•攻",
    ],
  },
];

/**
 * 根据 category 快速查找流派
 */
export function findArchetypeByCategory(category: string): ArchetypeDefinition | undefined {
  return ARCHETYPES.find(a => a.category === category);
}

/**
 * 获取所有门派流派
 */
export function getSectArchetypes(): ArchetypeDefinition[] {
  return ARCHETYPES.filter(a => a.type === "sect");
}

/**
 * 获取所有副职流派
 */
export function getSideJobArchetypes(): ArchetypeDefinition[] {
  return ARCHETYPES.filter(a => a.type === "side-jobs");
}
