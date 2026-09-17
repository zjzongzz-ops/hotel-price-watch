# -*- coding: utf-8 -*-
import os
import zipfile

PROJECT_DIR = r"C:\Users\1\.gemini\antigravity\scratch\hotel-radar"
DESKTOP_DIR = os.path.join(os.environ["USERPROFILE"], "Desktop")

EXCLUDE_DIRS = {"node_modules", "__pycache__", ".git"}
EXCLUDE_FILES = {"cloudflared.exe"}
EXCLUDE_EXTS = {".zip", ".pyc"}

target_zips = [
    os.path.join(DESKTOP_DIR, "酒店比价雷达_V2.0_实测交付包.zip"),
    os.path.join(PROJECT_DIR, "Hotel_Radar_v2.0_Delivery.zip")
]

file_count = 0
for target_zip in target_zips:
    file_count = 0
    with zipfile.ZipFile(target_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(PROJECT_DIR):
            # 排除特定目录
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith(".gemini")]
            
            for file in files:
                if file in EXCLUDE_FILES:
                    continue
                ext = os.path.splitext(file)[1].lower()
                if ext in EXCLUDE_EXTS:
                    continue
                
                full_path = os.path.join(root, file)
                # 排除自身
                if os.path.abspath(full_path) == os.path.abspath(target_zip):
                    continue
                rel_path = os.path.relpath(full_path, PROJECT_DIR)
                zf.write(full_path, arcname=rel_path)
                file_count += 1
                
    print(f"[OK] Generated: {target_zip} (Files: {file_count}, Size: {os.path.getsize(target_zip):,} bytes)")

