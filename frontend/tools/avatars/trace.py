"""Step 2 of the avatar rebuild (docs/design/CHARACTER-AVATARS.md): turns a head's reference render into a flat vector SVG.

  python tools/avatars/trace.py <character> [--colors 16] [--smooth 9]

Reads audit-out/avatars/<character>/ref-albedo.png and writes trace.svg and trace-flat.png next to it. The flat image
is the render reduced to a few colors (the "flatter character" look); the SVG is that image traced into layered
Bezier shapes with VTracer. Needs: pip install vtracer opencv-python-headless numpy
"""
import argparse
import os

import cv2
import numpy as np
import vtracer

parser = argparse.ArgumentParser()
parser.add_argument("character")
parser.add_argument("--colors", type=int, default=16, help="colors kept after flattening")
parser.add_argument("--smooth", type=int, default=9, help="edge-preserving smoothing strength before flattening")
parser.add_argument("--speckle", type=int, default=6, help="smallest shape kept, in pixels across")
parser.add_argument("--precision", type=int, default=6, help="VTracer color precision (bits)")
parser.add_argument("--layer", type=int, default=12, help="VTracer layer difference")
args = parser.parse_args()

folder = os.path.join(os.path.dirname(__file__), "..", "..", "audit-out", "avatars", args.character.lower())
source = cv2.imread(os.path.join(folder, "ref-albedo.png"), cv2.IMREAD_UNCHANGED)
alpha = source[:, :, 3]
mask = alpha > 127
bgr = source[:, :, :3].copy()

# flatten: edge-preserving smoothing, then k-means in Lab so the colors that remain are the ones the eye separates
smooth = cv2.bilateralFilter(bgr, d=args.smooth, sigmaColor=40, sigmaSpace=args.smooth)
lab = cv2.cvtColor(smooth, cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float32)
inside = mask.reshape(-1)
criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 40, 0.5)
_, labels, centers = cv2.kmeans(lab[inside], args.colors, None, criteria, 4, cv2.KMEANS_PP_CENTERS)
flat_lab = lab.copy()
flat_lab[inside] = centers[labels.flatten()]
flat = cv2.cvtColor(flat_lab.reshape(bgr.shape).astype(np.uint8), cv2.COLOR_LAB2BGR)

# remove tiny islands of a color (median on the label image keeps shapes clean)
flat = cv2.medianBlur(flat, 5)
flat[~mask] = (0, 0, 0)

out = np.dstack([flat, alpha])
flat_path = os.path.join(folder, "trace-flat.png")
cv2.imwrite(flat_path, out)

svg_path = os.path.join(folder, "trace.svg")
vtracer.convert_image_to_svg_py(
    flat_path,
    svg_path,
    colormode="color",
    hierarchical="stacked",
    mode="spline",
    filter_speckle=args.speckle,
    color_precision=args.precision,
    layer_difference=args.layer,
    corner_threshold=60,
    length_threshold=4.0,
    max_iterations=10,
    splice_threshold=45,
    path_precision=2,
)
size = os.path.getsize(svg_path)
text = open(svg_path, encoding="utf8").read()
print(f"{args.character}: {size / 1024:.0f} KB, {text.count('<path')} paths, {args.colors} colors")
