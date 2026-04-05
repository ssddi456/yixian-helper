"""Extract DarkSun.HotUpdate DLL from bundle and search for developer.json keys."""
import UnityPy, os, re

UnityPy.config.FALLBACK_UNITY_VERSION = "2020.3.49f1"
bundle_path = r"G:\SteamLibrary\steamapps\common\弈仙牌\YiXianPai_Data\StreamingAssets\aa\StandaloneWindows64\017cdee75b4418cac3aa55b3af7b3ff1.bundle"
out_dir = os.path.join(os.environ["TEMP"], "yixian_hotupdate")
os.makedirs(out_dir, exist_ok=True)

env = UnityPy.load(bundle_path)
for obj in env.objects:
    data = obj.read()
    name = getattr(data, "m_Name", "")
    if name == "DarkSun.HotUpdate":
        script = data.m_Script
        if isinstance(script, (bytes, bytearray)):
            raw = bytes(script)
        elif isinstance(script, memoryview):
            raw = bytes(script)
        else:
            # Get raw bytes directly from the object
            raw = obj.get_raw_data()
        out_path = os.path.join(out_dir, "DarkSun.HotUpdate.dll")
        with open(out_path, "wb") as f:
            f.write(raw)
        print(f"Saved {len(raw)} bytes to {out_path}")
        print(f"First 4 bytes: {raw[:4].hex()}")

        # Now search for DeveloperConfigManager references and nearby key strings
        # In .NET IL, string literals are stored in the #US (user string) heap
        # Let's find all occurrences of DeveloperConfigManager and nearby strings
        
        # Search for key patterns near DeveloperConfigManager
        search_term = b"DeveloperConfigManager"
        idx = 0
        while True:
            idx = raw.find(search_term, idx)
            if idx == -1:
                break
            start = max(0, idx - 300)
            end = min(len(raw), idx + 500)
            context = raw[start:end]
            # Extract printable strings
            strings = re.findall(rb"[\x20-\x7e]{4,}", context)
            print(f"\n=== DeveloperConfigManager at offset 0x{idx:X} ===")
            for s in strings:
                print(f"  {s.decode('ascii', errors='replace')}")
            idx += len(search_term)

        # Also search specifically for "enableDebugMode" and similar key patterns
        print("\n=== Searching for known key patterns ===")
        for pattern in [b"enableDebugMode", b"enableLog", b"debugMode", b"enableBattle",
                        b"showFps", b"showDebug", b"logLevel", b"enableGM", b"gmMode",
                        b"enableConsole", b"showConsole"]:
            idx = raw.find(pattern)
            if idx >= 0:
                start = max(0, idx - 50)
                end = min(len(raw), idx + 100)
                ctx = raw[start:end]
                printable = "".join(chr(b) if 32 <= b < 127 else "." for b in ctx)
                print(f"  FOUND '{pattern.decode()}' at 0x{idx:X}: {printable}")

        # Extract ALL strings from the .NET user string heap
        # In .NET PE, the #US heap contains user strings prefixed with length
        # Let's extract all readable strings > 3 chars that could be keys
        print("\n=== All strings containing 'enable' or 'debug' or 'developer' (case-insensitive) ===")
        # Simple approach: find all UTF-16LE strings
        i = 0
        found_keys = set()
        while i < len(raw) - 4:
            # Check for UTF-16LE pattern (printable char followed by 0x00)
            if 0x20 <= raw[i] < 0x7f and raw[i+1] == 0:
                # Try to read a UTF-16LE string
                end = i
                while end < len(raw) - 1 and 0x20 <= raw[end] < 0x7f and raw[end+1] == 0:
                    end += 2
                s = raw[i:end].decode("utf-16-le", errors="replace")
                if len(s) >= 4:
                    sl = s.lower()
                    if any(kw in sl for kw in ["enable", "debug", "developer", "config", "log", "gm", "cheat", "console", "fps"]):
                        found_keys.add(s)
                i = end
            else:
                i += 1
        
        for k in sorted(found_keys):
            print(f"  {k}")

        break
