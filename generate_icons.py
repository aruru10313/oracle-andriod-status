import os
from PIL import Image

src_img = r"C:\Users\아루우\.gemini\antigravity-cli\brain\3d9e9fba-4287-4646-9c47-9361b96cfd90\oracle_monitor_icon_1786901463277.jpg"
assets_dir = r"C:\Users\아루우\Desktop\오라클 pc status\android-app\assets"

os.makedirs(assets_dir, exist_ok=True)

try:
    with Image.open(src_img) as img:
        img = img.convert("RGBA")
        
        # icon (1024x1024)
        img.resize((1024, 1024)).save(os.path.join(assets_dir, "icon.png"), "PNG")
        
        # adaptive icon (1024x1024)
        img.resize((1024, 1024)).save(os.path.join(assets_dir, "adaptive-icon.png"), "PNG")
        
        # splash (1242x2436 or similar, we'll just make it square and let expo scale it)
        img.resize((1024, 1024)).save(os.path.join(assets_dir, "splash.png"), "PNG")
        
        # favicon (48x48)
        img.resize((48, 48)).save(os.path.join(assets_dir, "favicon.png"), "PNG")
        
    print("Icons successfully generated and saved to assets.")
except Exception as e:
    print(f"Error: {e}")
