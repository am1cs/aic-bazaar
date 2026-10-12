"""Create synthetic, fictional-brand fixtures. They are not customer work."""
from pathlib import Path
import json
import subprocess
import hashlib

out = Path(__file__).resolve().parent / "demo-assets"
out.mkdir(exist_ok=True)
font = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
if not Path(font).is_file():
    raise SystemExit("Set a supported bold font path in this generator before running on another OS.")

panels = []
for index, (headline, caption) in enumerate([
    ("MEET GLOW", "Opening: introduce the fictional brand"),
    ("MAKE IT BRIGHT", "Middle: retain the approved visual style"),
    ("CREATE YOUR MOMENT", "Closing: show the agreed call to action"),
]):
    x = 32 + index * 352
    panels.append(f'''<g transform="translate({x},90)">
      <rect width="328" height="584" rx="20" fill="#18372e"/>
      <circle cx="260" cy="130" r="75" fill="#285a43"/>
      <text x="24" y="64" fill="#ecffbd" font-family="Arial,sans-serif" font-size="20" font-weight="bold">{headline}</text>
      <rect x="96" y="158" width="136" height="284" rx="24" fill="#cef780"/>
      <rect x="110" y="144" width="108" height="24" rx="8" fill="#a2c95e"/>
      <text x="164" y="300" text-anchor="middle" fill="#18372e" font-family="Arial,sans-serif" font-size="30" font-weight="bold">GLOW</text>
      <text x="24" y="532" fill="#ecffbd" font-family="Arial,sans-serif" font-size="17">SCENE {index + 1} · 5 SECONDS</text>
    </g>''')
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="760" viewBox="0 0 1080 760">
<rect width="1080" height="760" fill="#10231f"/>
<text x="32" y="52" fill="#f0f7ef" font-family="Arial,sans-serif" font-size="28" font-weight="bold">GLOW · THREE-FRAME STORYBOARD</text>
{''.join(panels)}
<text x="32" y="726" fill="#b1c5b9" font-family="Arial,sans-serif" font-size="18">Synthetic content sample for AIC Bazaar escrow demonstration. Fictional brand.</text>
</svg>'''
(out / "concept.svg").write_text(svg)

base = [
    "drawbox=x=340:y=620:w=400:h=820:color=0xCEF780:t=fill",
    "drawbox=x=370:y=580:w=340:h=70:color=0xA2C95E:t=fill",
    f"drawtext=fontfile='{font}':text='GLOW':fontsize=108:fontcolor=0x18372E:x=(w-text_w)/2:y=980",
    f"drawtext=fontfile='{font}':text='MEET GLOW':fontsize=92:fontcolor=0xECFFBD:x=(w-text_w)/2:y=280:enable='lt(t,5)'",
    f"drawtext=fontfile='{font}':text='MAKE IT BRIGHT':fontsize=82:fontcolor=0xECFFBD:x=(w-text_w)/2:y=280:enable='between(t,5,9.999)'",
    f"drawtext=fontfile='{font}':text='CREATE YOUR':fontsize=90:fontcolor=0xECFFBD:x=(w-text_w)/2:y=250:enable='gte(t,10)'",
    f"drawtext=fontfile='{font}':text='MOMENT':fontsize=110:fontcolor=0xECFFBD:x=(w-text_w)/2:y=365:enable='gte(t,10)'",
]
for name in ["draft", "final"]:
    filters = list(base)
    if name == "draft":
        filters.append(f"drawtext=fontfile='{font}':text='DRAFT':fontsize=64:fontcolor=white@0.65:x=(w-text_w)/2:y=1660")
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
        "color=c=0x18372E:s=1080x1920:r=24:d=15", "-vf", ",".join(filters),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "25", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", str(out / f"{name}.mp4"),
    ], check=True)

manifest = {p.name: {"sha256": hashlib.sha256(p.read_bytes()).hexdigest(), "bytes": p.stat().st_size}
            for p in [out / "concept.svg", out / "draft.mp4", out / "final.mp4"]}
(out / "hashes.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps(manifest, indent=2))
