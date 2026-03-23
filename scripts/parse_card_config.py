"""解析 CardConfig protobuf，提取卡牌完整信息并输出 card_data.json"""
import os, json, struct
from collections import Counter

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
                val = data[pos:pos+4]
                pos += 4
                fields.append((field_num, 'fixed32', val))
            else:
                break
        except:
            break
    return fields

def decode_signed(val):
    if val > 2**63:
        return val - 2**64
    return val

# Sect mapping: field 4 values
SECT_MAP = {
    1: "cloud-spirit",
    2: "heptastar",
    3: "five-element",
    4: "duan-xuan",
}
SECT_NAMES = {
    1: "云灵",
    2: "七星",
    3: "五行",
    4: "断玄",
}

# Side-job mapping: field 5 values
SIDE_JOB_MAP = {
    1: "elixirist",
    2: "fortune",
    3: "musician",
    4: "painter",
    5: "array-master",
    6: "body-forging",
    7: "beast-tamer",
}
SIDE_JOB_NAMES = {
    1: "丹修",
    2: "占卜",
    3: "琴修",
    4: "画修",
    5: "阵修",
    6: "锻体",
    7: "驭兽",
}

# Load raw CardConfig
raw_path = os.path.join(OUTPUT_DIR, 'raw_CardConfig.bin')
with open(raw_path, 'rb') as f:
    raw = f.read()

data = raw[30:]
top_fields = decode_protobuf_fields(data)
records = [(fn, ft, fv) for fn, ft, fv in top_fields if fn == 2 and ft == 'bytes']

# Parse all records
all_cards = []
for _, _, rec_bytes in records:
    fields = decode_protobuf_fields(rec_bytes)
    card = {}
    for fn, ft, fv in fields:
        if ft == 'varint':
            v = decode_signed(fv)
            if fn == 1: card['id'] = v
            elif fn == 4: card['sect_id'] = v
            elif fn == 5: card['side_job_id'] = v
            elif fn == 6: card['phase'] = v
            elif fn == 7: card['modifier'] = v
            elif fn == 8: card['action_type'] = v
            elif fn == 18: card['card_type'] = v  # 1=attack, 2=consumable, 3=skill
            elif fn == 19: card['level'] = v
            elif fn == 105: card['upgrade_from'] = v
        elif ft == 'bytes':
            try:
                s = fv.decode('utf-8')
                if fn == 2: card['name'] = s
                elif fn == 3: card['effect_raw'] = s
                elif fn == 100: card['tags'] = s
            except:
                pass
    all_cards.append(card)

print(f"Total raw records: {len(all_cards)}")

# Filter: skip test cards (id < 0), skip records without id/name
valid_cards = [c for c in all_cards if c.get('id') is not None and c.get('name') and c['id'] >= 0]
print(f"Valid cards (id >= 0): {len(valid_cards)}")

# Group by name — multiple IDs = level variants of same card
# We want unique cards by name, merging level variants
name_map = {}
for card in valid_cards:
    name = card['name']
    if name not in name_map:
        name_map[name] = card
    else:
        # Keep the one with more info, prefer base level (id < 10000)
        existing = name_map[name]
        if card['id'] < existing.get('id', 999999):
            # Merge: keep new card but inherit any missing fields from existing
            for k, v in existing.items():
                if k not in card:
                    card[k] = v
            name_map[name] = card

print(f"Unique card names: {len(name_map)}")

# Clean up effect text: convert template syntax to readable
def clean_effect(raw_effect):
    if not raw_effect:
        return ""
    text = raw_effect
    # Replace template variables with placeholders
    text = text.replace('{attack}', '').replace('{def}', '')
    text = text.replace('{anima}', '')
    text = text.replace('{attackCount}', 'N')
    # Remove otherParams references  
    import re
    text = re.sub(r'\{otherParams\[\d+\]\}', 'N', text)
    text = re.sub(r'\{[^}]+\}', '', text)
    # Clean up brackets to be more readable
    text = text.replace('[', '').replace(']', '')
    text = text.strip()
    return text

# Build output
result = {}
sect_counts = Counter()
sidejob_counts = Counter()

for name, card in sorted(name_map.items()):
    entry = {
        "name": name,
        "phase": card.get('phase', 0),
    }
    
    # Sect
    sect_id = card.get('sect_id')
    if sect_id and sect_id in SECT_MAP:
        entry["sect"] = SECT_MAP[sect_id]
        entry["sectName"] = SECT_NAMES[sect_id]
        sect_counts[SECT_MAP[sect_id]] += 1
    
    # Side job
    side_job_id = card.get('side_job_id')
    if side_job_id and side_job_id in SIDE_JOB_MAP:
        entry["sideJob"] = SIDE_JOB_MAP[side_job_id]
        entry["sideJobName"] = SIDE_JOB_NAMES[side_job_id]
        sidejob_counts[SIDE_JOB_MAP[side_job_id]] += 1
    
    # Category: sect or side-job or general
    if 'sect' in entry:
        entry["category"] = entry["sect"]
        entry["type"] = "sect"
    elif 'sideJob' in entry:
        entry["category"] = entry["sideJob"]
        entry["type"] = "side-job"
    else:
        entry["category"] = ""
        entry["type"] = ""
    
    # Effect
    raw_eff = card.get('effect_raw', '')
    entry["effectRaw"] = raw_eff
    entry["effect"] = clean_effect(raw_eff)
    
    result[name] = entry

# Save
out_path = os.path.join(PROJECT_DIR, 'src', 'data', 'card_data.json')
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f"\n已保存 {len(result)} 张卡牌到 {out_path}")
print(f"文件大小: {os.path.getsize(out_path)} bytes")
print(f"\n门派分布: {dict(sect_counts)}")
print(f"副职分布: {dict(sidejob_counts)}")
print(f"无门派/副职: {len(result) - sum(sect_counts.values()) - sum(sidejob_counts.values())}")

# Show some samples
print("\n=== 样例 ===")
for name in ["云剑•探云", "火灵印", "崩拳•戳", "灵卦术", "驱邪丹", "玄冥雪莲", "普通攻击"]:
    if name in result:
        c = result[name]
        print(f"  {name}: phase={c['phase']} cat={c['category']} type={c['type']} effect={c['effect'][:60]}")

# Phase distribution
phase_dist = Counter()
for c in result.values():
    phase_dist[c['phase']] += 1
print(f"\n境界分布: {dict(sorted(phase_dist.items()))}")


