"""
解析 RecommendDeckConfig protobuf 数据，提取每个牌组每个境界的卡牌ID列表
然后通过 card_names 映射为中文卡牌名，保存为 JSON
"""
import json, os, struct

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
    """从字节中读取所有 varint"""
    result = []
    pos = 0
    while pos < len(data):
        val, pos = read_varint(data, pos)
        result.append(val)
    return result

def decode_protobuf_fields(data):
    """解码 protobuf 到 field list"""
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
                val = data[pos:pos+8]
                pos += 8
                fields.append((field_num, 'fixed64', val))
            elif wire_type == 2:
                length, pos = read_varint(data, pos)
                val = data[pos:pos+length]
                pos += length
                fields.append((field_num, 'bytes', val))
            elif wire_type == 5:
                val = data[pos:pos+4]
                pos += 4
                fields.append((field_num, 'fixed32', val))
            else:
                break
        except:
            break
    return fields


# 加载原始数据
raw_path = os.path.join(OUTPUT_DIR, 'raw_RecommendDeckConfig.bin')
with open(raw_path, 'rb') as f:
    raw = f.read()

# 找到 protobuf 开始位置 (跳过 TextAsset header)
# TextAsset header: 4 bytes object info, then name string, then script bytes
# 简单方式: 找到第一个有意义的 protobuf field
proto_start = 30  # 从之前的分析知道
data = raw[proto_start:]

# 解码顶层
top_fields = decode_protobuf_fields(data)

print(f"顶层字段数: {len(top_fields)}")

# field 2 是每条记录 (repeated message)
records = [(fn, ft, fv) for fn, ft, fv in top_fields if fn == 2 and ft == 'bytes']
print(f"记录数: {len(records)}")

# 解析每条记录
deck_data = {}  # key: "sectId_deckId", value: {phases: {phase: [cardIds]}}

for _, _, record_bytes in records:
    fields = decode_protobuf_fields(record_bytes)
    field_map = {}
    for fn, ft, fv in fields:
        field_map[fn] = (ft, fv)
    
    sect_id = field_map.get(1, ('varint', 0))[1]
    deck_id = field_map.get(3, ('varint', 0))[1]
    phase = field_map.get(4, ('varint', 0))[1]
    
    # field 8 包含卡牌ID列表 (packed varints in bytes)
    card_ids = []
    if 8 in field_map:
        ft, fv = field_map[8]
        if ft == 'bytes':
            card_ids = read_varints(fv)
    
    key = f"{sect_id}_{deck_id}"
    if key not in deck_data:
        deck_data[key] = {'sect_id': sect_id, 'deck_id': deck_id, 'phases': {}}
    
    deck_data[key]['phases'][phase] = card_ids
    print(f"  Deck {key} Phase {phase}: {len(card_ids)} cards -> {card_ids[:5]}{'...' if len(card_ids) > 5 else ''}")

# 加载 card_names 映射 (CardName_ID -> 中文名)
guides_path = os.path.join(PROJECT_DIR, 'src', 'data', 'deck_guides_full.json')
with open(guides_path, 'r', encoding='utf-8') as f:
    guides_data = json.load(f)

card_names = guides_data.get('card_names', {})

# 构建 ID -> 中文名 映射
# card_names keys 格式: CardName_XXXXXX, 其中 XXXXXX 可能是 base_id * 10000 + variant
# 卡牌ID可能对应多个 CardName (不同等级)
id_to_name = {}
for key, name in card_names.items():
    parts = key.replace('CardName_', '')
    try:
        card_id = int(parts)
        name = name.strip()
        if name and card_id not in id_to_name:
            id_to_name[card_id] = name
    except:
        pass

print(f"\nID->名称映射: {len(id_to_name)} 条")
# 检查哪些 deck card IDs 能映射到名称
total_found = 0
total_missing = 0
for key, info in deck_data.items():
    for phase, ids in info['phases'].items():
        for cid in ids:
            if cid in id_to_name:
                total_found += 1
            else:
                total_missing += 1
                # 尝试找附近的 ID
                for offset in [0, 10000, 20000]:
                    if cid + offset in id_to_name:
                        print(f"  ID {cid} not found, but {cid+offset} = {id_to_name[cid+offset]}")
                        break

print(f"直接映射: {total_found} 成功, {total_missing} 失败")

# 展示第一个 deck 的完整映射
first_key = list(deck_data.keys())[0]
info = deck_data[first_key]
print(f"\n=== Deck {first_key} ===")
for phase in sorted(info['phases'].keys()):
    ids = info['phases'][phase]
    names = [id_to_name.get(cid, f'?{cid}') for cid in ids]
    print(f"  Phase {phase}: {names}")
