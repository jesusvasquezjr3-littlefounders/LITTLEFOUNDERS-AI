"""Builds the loading window's runner sprite sheets from the frames render-loading.mjs wrote.

  python tools/render/loading-sheets.py

Reads audit-out/loading-render/<light|dark>/<character>/f-00.png to f-11.png (960 x 576, transparent), crops every character to one
box shared by its two modes, reduces the frames by 0.4 (a 2x screen shows them at 0.2), puts the 12 frames side by side and writes
public/loading/<character>-<light|dark>.avif (quality 50). The dark sheets also get a faint halo behind the figure, so dark clothes and
hair stay readable on the dark window. It prints the size one frame is shown at in CSS pixels: those numbers are FRAME in
src/components/LoadingWindow.tsx and must match.

Needs Pillow with AVIF support (pip install pillow, version 11.3 or later).
"""
import json
import os

from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
FRONTEND = os.path.abspath(os.path.join(HERE, '..', '..'))
SOURCE = os.path.join(FRONTEND, 'audit-out', 'loading-render')
OUT = os.path.join(FRONTEND, 'public', 'loading')
SCALE = 0.4
FRAMES = 12
MARGIN = 14
QUALITY = 50

os.makedirs(OUT, exist_ok=True)

shown = {}

for name in ['rho', 'zara', 'liruf', 'dina']:
    frames = {mode: [Image.open(os.path.join(SOURCE, mode, name, f'f-{i:02d}.png')).convert('RGBA') for i in range(FRAMES)] for mode in ('light', 'dark')}
    boxes = [f.getchannel('A').point(lambda a: 255 if a > 10 else 0).getbbox() for mode in frames for f in frames[mode]]
    x0 = min(b[0] for b in boxes) - MARGIN
    y0 = min(b[1] for b in boxes) - MARGIN
    x1 = max(b[2] for b in boxes) + MARGIN
    y1 = max(b[3] for b in boxes) + MARGIN
    width = int(round((x1 - x0) * SCALE / 2)) * 2
    height = int(round((y1 - y0) * SCALE / 2)) * 2

    for mode, images in frames.items():
        sheet = Image.new('RGBA', (width * FRAMES, height), (0, 0, 0, 0))

        for i, image in enumerate(images):
            frame = image.crop((x0, y0, x1, y1)).resize((width, height), Image.LANCZOS)

            if mode == 'dark':
                halo = frame.getchannel('A').filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(2.6)).point(lambda v: int(v * 0.26))
                glow = Image.new('RGBA', frame.size, (196, 190, 255, 0))
                glow.putalpha(halo)
                glow.alpha_composite(frame)
                frame = glow

            sheet.paste(frame, (i * width, 0))

        path = os.path.join(OUT, f'{name}-{mode}.avif')

        sheet.save(path, 'AVIF', quality=QUALITY, speed=4)
        print(f'{name}-{mode}.avif  {width}x{height} per frame  {os.path.getsize(path) / 1024:.1f} KB')

    shown[name] = [width // 2, height // 2]

print('FRAME (CSS px) =', json.dumps(shown))
