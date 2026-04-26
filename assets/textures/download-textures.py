#!/usr/bin/env python3
"""
Download PBR Texturen von PolyHaven (stabile CDN-Links)
Alle CC0 - kostenlos für kommerzielle Nutzung
"""

import urllib.request
import ssl
from pathlib import Path

TEXTURE_DIR = Path(__file__).parent
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

# PolyHaven CDN - stabile Links
textures = {
    'wood': 'https://cdn.polyhaven.com/texture_img/primary/wood_planks_05/1k/',
    'brick': 'https://cdn.polyhaven.com/texture_img/primary/red_brick_wall/1k/',
    'concrete': 'https://cdn.polyhaven.com/texture_img/primary/concrete_painted_02/1k/',
    'grass': 'https://cdn.polyhaven.com/texture_img/primary/grass_02/1k/',
    'dirt': 'https://cdn.polyhaven.com/texture_img/primary/dry_leaves/1k/',
}

maps = ['color', 'normal_gl', 'roughness']

def download(url, dest):
    if dest.exists():
        print(f"  ✓ {dest.name}")
        return
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=ssl_context, timeout=30) as r:
            data = r.read()
        with open(dest, 'wb') as f:
            f.write(data)
        print(f"  ✓ {dest.name} ({len(data)/1024:.0f}KB)")
    except Exception as e:
        print(f"  ✗ {dest.name}: {e}")

print("🎨 PolyHaven PBR Texturen\n")

for name, base in textures.items():
    print(f"[{name}]")
    d = TEXTURE_DIR / name
    d.mkdir(exist_ok=True)
    for m in maps:
        fname = f"{m}.jpg"
        download(base + fname, d / fname)

print("\n✅ Done!")
