"""One-shot crop of Blue-Hour European Destinations composite into four photos."""
from PIL import Image
from pathlib import Path

assets_dir = (
    Path.home()
    / ".cursor"
    / "projects"
    / "c-Users-Black-Scorpion-Downloads-pixel-perfect-render-85250-main"
    / "assets"
)
matches = sorted(assets_dir.glob("*Blue-Hour_European_Destinations*.jpg"))
if not matches:
    raise SystemExit(f"No Blue-Hour composite found in {assets_dir}")
src = matches[0]
print("src", src)

out_dir = Path(__file__).resolve().parents[1] / "src" / "assets"
ref_dir = Path(__file__).resolve().parents[1] / "public" / "images"

img = Image.open(src).convert("RGB")
w, h = img.size
print("size", w, h)

pad_x = int(w * 0.035)
pad_y = int(h * 0.04)
gap_x = int(w * 0.02)
gap_y = int(h * 0.025)

inner_w = w - 2 * pad_x - gap_x
inner_h = h - 2 * pad_y - gap_y
cw = inner_w // 2
ch = inner_h // 2

cells = {
    "ireland": (pad_x, pad_y),
    "austria": (pad_x + cw + gap_x, pad_y),
    "hungary": (pad_x, pad_y + ch + gap_y),
    "sweden": (pad_x + cw + gap_x, pad_y + ch + gap_y),
}

# Drop baked-in text band so React can render clean copy.
text_band = 0.38

for name, (x0, y0) in cells.items():
    x1, y1 = x0 + cw, y0 + ch
    inset = int(min(cw, ch) * 0.02)
    crop = img.crop((x0 + inset, y0 + inset, x1 - inset, y1 - inset))
    cw2, ch2 = crop.size
    photo = crop.crop((0, 0, cw2, int(ch2 * (1 - text_band))))
    photo.thumbnail((1280, 960), Image.Resampling.LANCZOS)
    dest = out_dir / f"dest-{name}.jpg"
    photo.save(dest, "JPEG", quality=82, optimize=True)
    print(name, photo.size, dest.stat().st_size)

ref_dir.mkdir(parents=True, exist_ok=True)
ref_path = ref_dir / "european-destinations-reference.jpg"
img.save(ref_path, "JPEG", quality=85, optimize=True)
print("reference", ref_path.stat().st_size)
