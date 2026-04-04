"""
弈仙牌逆向资源提取 -> ./crack
提取 IL2CPP 代码元数据 + Unity 图片/配置资源

用法: python scripts/extract_to_crack.py
"""
import json, os, shutil, sys

GAME_DIR = r'G:\SteamLibrary\steamapps\common\弈仙牌'
CRACKED_DIR = os.path.join(GAME_DIR, 'cracked')
BUNDLE_DIR = os.path.join(GAME_DIR, 'YiXianPai_Data', 'StreamingAssets', 'aa', 'StandaloneWindows64')
PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(PROJECT_DIR, 'crack')

CODE_DIR = os.path.join(OUTPUT_DIR, 'code')
IMAGES_DIR = os.path.join(OUTPUT_DIR, 'images')
CONFIG_DIR = os.path.join(OUTPUT_DIR, 'configs')

for d in [CODE_DIR, IMAGES_DIR, CONFIG_DIR]:
    os.makedirs(d, exist_ok=True)

# === 1. 复制 IL2CPP 代码元数据 ===
print("=" * 60)
print("1. 复制 IL2CPP 代码元数据...")
print("=" * 60)

code_files = ['il2cpp.h', 'script.json', 'stringliteral.json', 'config.json']
for fname in code_files:
    src = os.path.join(CRACKED_DIR, fname)
    dst = os.path.join(CODE_DIR, fname)
    if os.path.exists(src):
        if not os.path.exists(dst) or os.path.getmtime(src) > os.path.getmtime(dst):
            print(f"  复制 {fname} ({os.path.getsize(src) / 1024 / 1024:.1f} MB)")
            shutil.copy2(src, dst)
        else:
            print(f"  跳过 {fname} (已是最新)")
    else:
        print(f"  未找到 {fname}")

# 复制 DummyDll 目录
dummy_src = os.path.join(CRACKED_DIR, 'DummyDll')
dummy_dst = os.path.join(CODE_DIR, 'DummyDll')
if os.path.isdir(dummy_src):
    if not os.path.isdir(dummy_dst):
        print(f"  复制 DummyDll/ ...")
        shutil.copytree(dummy_src, dummy_dst)
    else:
        print(f"  跳过 DummyDll/ (已存在)")

# === 2. 提取 Unity 资源 (图片 + 配置) ===
print(f"\n{'=' * 60}")
print("2. 提取 Unity 资源 (图片 + 配置)...")
print("=" * 60)

try:
    import UnityPy
    UnityPy.config.FALLBACK_UNITY_VERSION = "2020.3.49f1"
except ImportError:
    print("  ❌ 需要安装 UnityPy: pip install UnityPy")
    print("  代码元数据已复制完成，图片提取跳过")
    sys.exit(0)

from PIL import Image

bundle_files = sorted(f for f in os.listdir(BUNDLE_DIR) if os.path.isfile(os.path.join(BUNDLE_DIR, f)))
print(f"  共 {len(bundle_files)} 个 bundle\n")

manifest = []
img_count = 0
config_count = 0

for i, fname in enumerate(bundle_files):
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

            if obj_type in ('Texture2D', 'Sprite'):
                if not name:
                    continue
                img = data.image
                if img.width < 4 or img.height < 4:
                    continue
                safe_name = name.replace('/', '_').replace('\\', '_')
                out_path = os.path.join(IMAGES_DIR, f"{safe_name}.png")
                if not os.path.exists(out_path):
                    img.save(out_path)
                    img_count += 1
                    if img_count % 50 == 0:
                        print(f"  已提取 {img_count} 张图片...")
                manifest.append({
                    'bundle': fname, 'type': obj_type, 'name': name,
                    'size': f"{img.width}x{img.height}", 'path': out_path
                })

            elif obj_type == 'TextAsset':
                text = data.text if hasattr(data, 'text') else (data.m_Script if hasattr(data, 'm_Script') else None)
                if text and name:
                    safe_name = name.replace('/', '_').replace('\\', '_')
                    out_path = os.path.join(CONFIG_DIR, f"{safe_name}.txt")
                    content = text if isinstance(text, str) else text.decode('utf-8', errors='replace')
                    with open(out_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    config_count += 1
                    manifest.append({
                        'bundle': fname, 'type': obj_type, 'name': name,
                        'size': len(content), 'path': out_path
                    })
                    print(f"  [Config] {name}")

            elif obj_type == 'MonoBehaviour' and name:
                raw = obj.get_raw_data()
                safe_name = name.replace('/', '_').replace('\\', '_')
                out_path = os.path.join(CONFIG_DIR, f"MonoBehaviour_{safe_name}.bin")
                with open(out_path, 'wb') as f:
                    f.write(raw)
                manifest.append({
                    'bundle': fname, 'type': obj_type, 'name': name,
                    'size': obj.byte_size, 'path': out_path
                })
                if obj.byte_size > 10000:
                    print(f"  [MonoBehaviour] {name} ({obj.byte_size} bytes)")

        except Exception as e:
            pass

    if (i + 1) % 20 == 0:
        print(f"  进度: {i + 1}/{len(bundle_files)} bundles")

# === 3. 保存清单 ===
manifest_path = os.path.join(OUTPUT_DIR, '_manifest.json')
with open(manifest_path, 'w', encoding='utf-8') as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

print(f"\n{'=' * 60}")
print(f"提取完成！")
print(f"  代码元数据: {CODE_DIR}")
print(f"  图片: {img_count} 张 -> {IMAGES_DIR}")
print(f"  配置: {config_count} 个 -> {CONFIG_DIR}")
print(f"  清单: {manifest_path}")
print(f"{'=' * 60}")
