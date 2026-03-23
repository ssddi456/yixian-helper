"""合并 card_lib.json 的分类信息和 card_data.json 的效果信息，输出最终 card_data.json"""
import json, os

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

old_lib_path = os.path.join(PROJECT_DIR, 'src', 'data', 'card_lib.json')
new_data_path = os.path.join(PROJECT_DIR, 'src', 'data', 'card_data.json')

with open(old_lib_path, 'r', encoding='utf-8') as f:
    old_lib = json.load(f)

with open(new_data_path, 'r', encoding='utf-8') as f:
    new_data = json.load(f)

# 标准化分类名（old lib 用了不同的命名）
CATEGORY_NORMALIZE = {
    "formation-master": "array-master",
    "fuluist": "fortune",
    "plant-master": "beast-tamer",
    "fortune-teller": "fortune",
    "talisman": "fortune",
    "spiritual-pet": "beast-tamer",
}

# 角色专属牌分类
CHARACTER_NAMES = [
    "MuYifeng", "YanXue", "LongYao", "LinXiaoyue", "LuJianxin",
    "LiChengyun", "TanShuyan", "YanChen", "YaoLing", "JiangXiming",
    "WuCe", "WuXingzhi", "DuLingyuan", "HuaQinrui", "MuHu",
    "XiaoBu", "TuKui", "YeMingming", "JiFangsheng", "LiMan",
    "QiWangyou", "FengXu",
]

SECT_CATEGORIES = {"cloud-spirit", "heptastar", "five-element", "duan-xuan"}
SIDE_JOB_CATEGORIES = {
    "elixirist", "musician", "painter", "array-master",
    "fortune", "beast-tamer", "body-forging",
}

# 合并：以 new_data 为基础，补充 old_lib 的分类信息
result = {}

# 1. 处理 new_data 中的所有卡牌
for name, card in new_data.items():
    entry = dict(card)
    
    # 如果 old_lib 有更好的分类信息，使用 old_lib 的
    if name in old_lib:
        old_card = old_lib[name]
        old_cat = old_card.get('category', '')
        
        # 标准化旧分类名
        normalized_cat = CATEGORY_NORMALIZE.get(old_cat, old_cat)
        
        # 角色专属牌
        if old_cat in CHARACTER_NAMES:
            entry['category'] = old_cat
            entry['type'] = 'character'
        # 如果新数据没有分类或者旧数据有更具体的分类
        elif not entry.get('category') and normalized_cat:
            entry['category'] = normalized_cat
            if normalized_cat in SECT_CATEGORIES:
                entry['type'] = 'sect'
            elif normalized_cat in SIDE_JOB_CATEGORIES:
                entry['type'] = 'side-job'
        
        # 保留 old_lib 的 phase 如果新数据没有
        if not entry.get('phase') and old_card.get('phase'):
            entry['phase'] = old_card['phase']
    
    result[name] = entry

# 2. 补充 old_lib 中存在但 new_data 没有的卡牌（可能是版本差异）
for name, old_card in old_lib.items():
    if name not in result:
        old_cat = old_card.get('category', '')
        normalized_cat = CATEGORY_NORMALIZE.get(old_cat, old_cat)
        
        entry = {
            'name': name,
            'phase': old_card.get('phase', 0),
            'category': normalized_cat if old_cat not in CHARACTER_NAMES else old_cat,
            'type': 'character' if old_cat in CHARACTER_NAMES else (
                'sect' if normalized_cat in SECT_CATEGORIES else (
                    'side-job' if normalized_cat in SIDE_JOB_CATEGORIES else ''
                )
            ),
            'effect': '',
            'effectRaw': '',
        }
        result[name] = entry

# 清理：移除多余的 sectName/sideJobName（前端不需要）
for name, card in result.items():
    card.pop('sectName', None)
    card.pop('sideJobName', None)
    card.pop('sideJob', None)
    card.pop('sect', None)

# 保存
out_path = os.path.join(PROJECT_DIR, 'src', 'data', 'card_data.json')
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

# 统计
from collections import Counter
type_counts = Counter()
cat_counts = Counter()
phase_counts = Counter()
has_effect = 0

for card in result.values():
    type_counts[card.get('type', '')] += 1
    cat_counts[card.get('category', '') or '(none)'] += 1
    phase_counts[card.get('phase', 0)] += 1
    if card.get('effect'):
        has_effect += 1

print(f"已保存 {len(result)} 张卡牌到 {out_path}")
print(f"文件大小: {os.path.getsize(out_path)} bytes")
print(f"\n类型分布: {dict(type_counts.most_common())}")
print(f"分类分布: {dict(cat_counts.most_common())}")
print(f"境界分布: {dict(sorted(phase_counts.items()))}")
print(f"有效果描述: {has_effect}/{len(result)}")

# 样例
print("\n=== 样例 ===")
for name in ["云剑•探云", "火灵印", "崩拳•戳", "驱邪丹", "普通攻击", "纸落云烟", "罗刹扑"]:
    if name in result:
        c = result[name]
        eff = c.get('effect', '')[:50]
        print(f"  {name}: phase={c['phase']} cat={c['category']} type={c['type']} effect={eff}")
