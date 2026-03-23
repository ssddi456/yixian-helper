"""
弈仙牌 Unity Asset Bundle 解包工具
解包所有 asset bundle 到临时目录，记录资源结构

用法: python scripts/extract_assets.py

输出目录: %TEMP%/yixian_extracted/
资源清单: %TEMP%/yixian_extracted/_manifest.json

资源结构 (截至 2026-03-21):
  - 207 个 asset bundle
  - 主要配置文件为 TextAsset 格式 (JSON/TSV)
  - 本地化文本在 MonoBehaviour (LanguageSourceAsset, 6.9MB)
  
关键 TextAsset:
  - RecommendDeckConfig: 推荐牌组配置（牌组ID、门派、卡牌列表、境界要求）
  - DivinationDeckConfig: 卜筮牌组配置
  - CardConfig: 所有卡牌配置
  - VersusCardConfig: 对战卡牌配置
  - KeYinCardConfig: 刻印卡牌配置
  
所有 TextAsset 在 bundle: c2054c8742301240a1708c45f642dbe6.bundle
本地化 MonoBehaviour 在: 另一个 bundle (LanguageSourceAsset)
"""
import json, os, sys
import UnityPy

UnityPy.config.FALLBACK_UNITY_VERSION = "2020.3.49f1"

GAME_DIR = r'G:\SteamLibrary\steamapps\common\弈仙牌'
BUNDLE_DIR = os.path.join(GAME_DIR, 'YiXianPai_Data', 'StreamingAssets', 'aa', 'StandaloneWindows64')
OUTPUT_DIR = os.path.join(os.environ['TEMP'], 'yixian_extracted')

os.makedirs(OUTPUT_DIR, exist_ok=True)

manifest = []

print(f"解包目录: {BUNDLE_DIR}")
print(f"输出目录: {OUTPUT_DIR}")

bundle_files = [f for f in os.listdir(BUNDLE_DIR) if os.path.isfile(os.path.join(BUNDLE_DIR, f))]
print(f"共 {len(bundle_files)} 个 bundle 文件\n")

for i, fname in enumerate(sorted(bundle_files)):
    fpath = os.path.join(BUNDLE_DIR, fname)
    try:
        env = UnityPy.load(fpath)
    except:
        continue

    for obj in env.objects:
        try:
            data = obj.read()
            name = getattr(data, 'm_Name', '') or getattr(data, 'name', '') or ''
            obj_type = obj.type.name
            size = obj.byte_size
            
            entry = {
                'bundle': fname,
                'type': obj_type,
                'name': name,
                'size': size,
                'path_id': obj.path_id,
            }

            if obj_type == 'TextAsset':
                text = data.text if hasattr(data, 'text') else (data.m_Script if hasattr(data, 'm_Script') else None)
                if text:
                    safe_name = name.replace('/', '_').replace('\\', '_') or str(obj.path_id)
                    out_path = os.path.join(OUTPUT_DIR, f"TextAsset_{safe_name}.txt")
                    content = text if isinstance(text, str) else text.decode('utf-8', errors='replace')
                    with open(out_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    entry['exported'] = out_path
                    entry['content_length'] = len(content)
                    print(f"  [TextAsset] {name} ({size} bytes) <- {fname}")

            elif obj_type == 'MonoBehaviour' and name:
                raw = obj.get_raw_data()
                safe_name = name.replace('/', '_').replace('\\', '_')
                out_path = os.path.join(OUTPUT_DIR, f"MonoBehaviour_{safe_name}.bin")
                with open(out_path, 'wb') as f:
                    f.write(raw)
                entry['exported'] = out_path
                if size > 10000:
                    print(f"  [MonoBehaviour] {name} ({size} bytes) <- {fname}")

            manifest.append(entry)
        except:
            pass

manifest_path = os.path.join(OUTPUT_DIR, '_manifest.json')
with open(manifest_path, 'w', encoding='utf-8') as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

print(f"\n解包完成！共 {len(manifest)} 个资源")
print(f"资源清单: {manifest_path}")

from collections import Counter
type_counts = Counter(e['type'] for e in manifest)
print("\n资源类型统计:")
for t, c in type_counts.most_common():
    print(f"  {t}: {c}")
