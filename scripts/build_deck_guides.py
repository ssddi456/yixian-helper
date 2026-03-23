"""
从 RecommendDeckConfig protobuf 构建完整的牌组指南数据
输出: src/data/deck_guides.json
"""
import json, os

OUTPUT_DIR = os.path.join(os.environ['TEMP'], 'yixian_extracted')
PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def read_varint(data, pos):
    result = 0
    shift = 0
    while pos < len(data):
        b = data[pos]
        result |= (b & 0x7F) << shift
        pos += 1
        if (b & 0x80) == 0:
            break
        shift += 7
    return result, pos

def read_varints(data):
    result = []
    pos = 0
    while pos < len(data):
        val, pos = read_varint(data, pos)
        result.append(val)
    return result

def decode_protobuf_fields(data):
    pos = 0
    fields = []
    while pos < len(data):
        try:
            tag, pos = read_varint(data, pos)
            field_num = tag >> 3
            wire_type = tag & 0x07
            if wire_type == 0:
                val, pos = read_varint(data, pos)
                fields.append((field_num, 'varint', val))
            elif wire_type == 1:
                pos += 8
                fields.append((field_num, 'fixed64', None))
            elif wire_type == 2:
                length, pos = read_varint(data, pos)
                val = data[pos:pos+length]
                pos += length
                fields.append((field_num, 'bytes', val))
            elif wire_type == 5:
                pos += 4
                fields.append((field_num, 'fixed32', None))
            else:
                break
        except:
            break
    return fields

SECT_MAP = {1: "cloud-spirit", 2: "heptastar", 3: "five-element", 4: "duan-xuan"}

# 加载 card_names 映射
guides_full_path = os.path.join(PROJECT_DIR, 'src', 'data', 'deck_guides_full.json')
with open(guides_full_path, 'r', encoding='utf-8') as f:
    guides_full = json.load(f)

# ID -> 中文名
id_to_name = {}
for key, name in guides_full['card_names'].items():
    card_id = int(key.replace('CardName_', ''))
    name = name.strip()
    if name:
        id_to_name[card_id] = name

# 加载 protobuf
raw_path = os.path.join(OUTPUT_DIR, 'raw_RecommendDeckConfig.bin')
with open(raw_path, 'rb') as f:
    raw = f.read()

data = raw[30:]  # skip header
top_fields = decode_protobuf_fields(data)
records = [(fn, ft, fv) for fn, ft, fv in top_fields if fn == 2 and ft == 'bytes']

# 解析记录 - 注意同一个 deck+phase 可能有多条记录（变体）
deck_phases = {}  # key: "sectId_deckId", value: {phase: [[card_names variant1], [variant2]...]}

for _, _, record_bytes in records:
    fields = decode_protobuf_fields(record_bytes)
    field_map = {}
    for fn, ft, fv in fields:
        field_map[fn] = (ft, fv)
    
    sect_id = field_map.get(1, ('varint', 0))[1]
    deck_id = field_map.get(3, ('varint', 0))[1]
    phase = field_map.get(4, ('varint', 0))[1]
    
    if sect_id == 0 or deck_id == 0:
        continue
    
    card_ids = []
    if 8 in field_map:
        ft, fv = field_map[8]
        if ft == 'bytes':
            card_ids = read_varints(fv)
    
    # Map IDs to names
    card_names = []
    for cid in card_ids:
        name = id_to_name.get(cid, None)
        if name:
            card_names.append(name)
    
    key = f"{sect_id}_{deck_id}"
    if key not in deck_phases:
        deck_phases[key] = {'sect_id': sect_id, 'deck_id': deck_id, 'phases': {}}
    
    if phase not in deck_phases[key]['phases']:
        deck_phases[key]['phases'][phase] = []
    deck_phases[key]['phases'][phase].append(card_names)

# 构建最终输出
result = {
    "decks": {}
}

for key, info in deck_phases.items():
    sect_id = info['sect_id']
    deck_id = info['deck_id']
    
    # 获取标题和描述
    title_key = f"RecommendDeckTitle_{sect_id}_{deck_id}"
    title = guides_full['recommend_titles'].get(title_key, f"牌组{key}")
    
    desc_key = f"RecommendDeckDesc_{sect_id}_{deck_id}"
    desc = guides_full['recommend_descs'].get(desc_key, "")
    
    # 获取境界描述
    phase_descs = {}
    for p in range(1, 6):
        descs = []
        # 基础牌组: RecommendDeckDesc_X_Y_Z
        basic_key = f"RecommendDeckDesc_{sect_id}_{deck_id}_{p}"
        if basic_key in guides_full['recommend_descs']:
            descs.append(guides_full['recommend_descs'][basic_key])
        # 高手精选: RecommendDeckDesc_X_Y_Z_W
        for w in range(1, 10):
            pro_key = f"RecommendDeckDesc_{sect_id}_{deck_id}_{p}_{w}"
            if pro_key in guides_full['recommend_descs']:
                descs.append(guides_full['recommend_descs'][pro_key])
        if descs:
            phase_descs[str(p)] = descs
    
    # 构建 phases: {phase: {cards: [[variant1], [variant2]], descs: [...]}}
    phases = {}
    for p, variants in info['phases'].items():
        phases[str(p)] = {
            "cards": variants,
            "descs": phase_descs.get(str(p), [])
        }
    
    result['decks'][key] = {
        "id": key,
        "sect_id": sect_id,
        "deck_id": deck_id,
        "sect": SECT_MAP.get(sect_id, "unknown"),
        "title": title,
        "description": desc,
        "is_pro_picked": deck_id >= 6,
        "phases": phases
    }

# 保存
out_path = os.path.join(PROJECT_DIR, 'src', 'data', 'deck_guides.json')
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f"已保存 {len(result['decks'])} 个牌组到 {out_path}")
print(f"文件大小: {os.path.getsize(out_path)} bytes")

# 显示摘要
for key in sorted(result['decks'].keys(), key=lambda x: (int(x.split('_')[0]), int(x.split('_')[1]))):
    deck = result['decks'][key]
    phases = deck['phases']
    total_cards = sum(len(v['cards'][0]) for v in phases.values() if v['cards'])
    phase_list = sorted(int(p) for p in phases.keys())
    print(f"  {key} {deck['title']}: phases={phase_list}, ~{total_cards} cards")
