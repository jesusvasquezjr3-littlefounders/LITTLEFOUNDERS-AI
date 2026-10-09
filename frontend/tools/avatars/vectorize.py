"""Step 2 of the avatar rebuild (docs/design/CHARACTER-AVATARS.md): turns a head's reference render into a smooth vector SVG.

  python tools/avatars/vectorize.py <Character> [--regions 14] [--min-area 320] [--soft 12]

Reads audit-out/avatars/<character>/ref-albedo.png and writes vector.svg next to it.

How it works, so the result is flat but not pixelated and not banded:
  1. The render is split into regions by color, with lightness counting little, so a shaded skin is ONE region.
  2. Region borders are smoothed (each region mask is blurred, the strongest wins), then fitted with smooth Bezier
     curves; sharp corners stay sharp.
  3. Each region is filled with a gradient fitted to the original colors inside it (a plane, or a radial glow),
     or a flat color when it has no shading. So soft shading survives without a stack of bands.
  4. Regions are painted from the biggest to the smallest and each is grown a little, so no seams show between them.

Needs: pip install opencv-python-headless numpy
"""
import argparse
import os

import cv2
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument("character")
parser.add_argument("--regions", type=int, default=14, help="how many color regions to split the head into")
parser.add_argument("--light", type=float, default=0.3, help="weight of lightness when splitting (0 ignores shading)")
parser.add_argument("--min-area", type=int, default=320, help="smallest piece kept, in pixels")
parser.add_argument("--blur", type=float, default=3.0, help="border smoothing, in pixels")
parser.add_argument("--soft", type=float, default=12.0, help="pieces this close in color to what is around them get a soft edge (color distance)")
parser.add_argument("--soft-area", type=float, default=0.25, help="soft edges apply to pieces up to this share of the biggest piece")
parser.add_argument("--grow", type=float, default=1.6, help="how far each region is grown to hide seams, in pixels")
# settings that suit each character best so far (found by looking at the results); flags still override them
PRESETS = {
    "zara": dict(regions=9, min_area=900, soft=0.0, light=0.25),
    "dina": dict(soft=0.0),
}
character = parser.parse_known_args()[0].character.lower()
parser.set_defaults(**PRESETS.get(character, {}))
args = parser.parse_args()

folder = os.path.join(os.path.dirname(__file__), "..", "..", "audit-out", "avatars", args.character.lower())
source = cv2.imread(os.path.join(folder, "ref-albedo.png"), cv2.IMREAD_UNCHANGED)
height, width = source.shape[:2]
alpha = source[:, :, 3]
inside = alpha > 127
bgr = source[:, :, :3].copy()

# a lightly smoothed copy: the texture grain is not part of the character
# edge-preserving flattening (mean shift): shading and grain melt into their region, edges stay; the area outside
# the head is painted with the head's average color so it cannot bleed in
filled = bgr.copy()
filled[~inside] = bgr[inside].mean(axis=0).astype(np.uint8)
flattened = cv2.pyrMeanShiftFiltering(filled, sp=12, sr=21, maxLevel=2)
smooth = cv2.bilateralFilter(bgr, d=9, sigmaColor=30, sigmaSpace=9)
lab = cv2.cvtColor(smooth, cv2.COLOR_BGR2LAB).astype(np.float32)
features = cv2.cvtColor(flattened, cv2.COLOR_BGR2LAB).astype(np.float32)
features[:, :, 0] *= args.light

# 1. split by color
data = features.reshape(-1, 3)[inside.reshape(-1)]
criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 60, 0.3)
_, labels, _ = cv2.kmeans(data, args.regions, None, criteria, 5, cv2.KMEANS_PP_CENTERS)
label_image = np.full((height, width), -1, np.int32)
label_image[inside] = labels.flatten()

# 2. smooth the borders: blur each region's mask, the strongest wins
stack = np.zeros((args.regions + 1, height, width), np.float32)

for k in range(args.regions):
    stack[k] = cv2.GaussianBlur((label_image == k).astype(np.float32), (0, 0), args.blur)

stack[args.regions] = cv2.GaussianBlur((~inside).astype(np.float32), (0, 0), args.blur) * 0.9
winner = stack.argmax(axis=0)
winner[~inside] = args.regions
outside_alpha = cv2.GaussianBlur(inside.astype(np.float32), (0, 0), 1.0)
silhouette = (outside_alpha > 0.5)


def fit_fill(pixels_xy, colors):
    """A gradient (linear or radial) that follows the colors, or None when flat is as good."""
    n = len(colors)
    flat = colors.mean(axis=0)
    err_flat = np.mean((colors - flat) ** 2)
    if n < 600 or err_flat < 6.0:
        return ("flat", flat)

    x = pixels_xy[:, 0].astype(np.float64)
    y = pixels_xy[:, 1].astype(np.float64)
    cx, cy = x.mean(), y.mean()
    scale = max(x.max() - x.min(), y.max() - y.min(), 1.0)
    u = (x - cx) / scale
    v = (y - cy) / scale
    # plane: c = a + b u + c v      radial: c = a + b u + c v + d (u^2 + v^2)
    plane = np.stack([np.ones(n), u, v], axis=1)
    radial = np.stack([np.ones(n), u, v, u * u + v * v], axis=1)
    best = None

    for name, design in (("linear", plane), ("radial", radial)):
        coef, *_ = np.linalg.lstsq(design, colors, rcond=None)
        err = np.mean((design @ coef - colors) ** 2)
        if best is None or err < best[0] * 0.8:
            best = (err, name, coef)

    err, name, coef = best

    if err > err_flat * 0.7:
        return ("flat", flat)

    return (name, coef, (cx, cy, scale), (u.min(), u.max(), v.min(), v.max()))


LIMITS = {"low": None, "high": None}


def to_rgb(lab_color):
    lo, hi = LIMITS["low"], LIMITS["high"]
    pixel = np.clip(lab_color, lo if lo is not None else 0, hi if hi is not None else 255).astype(np.uint8).reshape(1, 1, 3)

    return cv2.cvtColor(pixel, cv2.COLOR_LAB2RGB).reshape(3)


def hexcolor(rgb):
    return "#%02x%02x%02x" % tuple(int(c) for c in rgb)


def smooth_path(points, closed=True, corner_degrees=70.0):
    """Closed Bezier path through the points (Catmull-Rom), with sharp corners kept sharp."""
    n = len(points)
    if n < 3:
        return ""
    pts = points.astype(np.float64)
    corners = np.zeros(n, bool)

    for i in range(n):
        a, b, c = pts[i - 1], pts[i], pts[(i + 1) % n]
        v1, v2 = b - a, c - b
        l1, l2 = np.linalg.norm(v1), np.linalg.norm(v2)
        if l1 > 0 and l2 > 0:
            turn = np.degrees(np.arccos(np.clip(np.dot(v1, v2) / (l1 * l2), -1, 1)))
            corners[i] = turn > corner_degrees

    d = f"M{pts[0][0]:.1f} {pts[0][1]:.1f}"

    for i in range(n):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        c1 = p1 if corners[i] else p1 + (p2 - p0) / 6.0
        c2 = p2 if corners[(i + 1) % n] else p2 - (p3 - p1) / 6.0
        d += f"C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}"

    return d + "Z"


def smooth_contour(contour, sigma=3.0):
    """Moves each point toward its neighbors along the closed outline, so pixel stair-steps disappear."""
    pts = contour.reshape(-1, 2).astype(np.float64)
    n = len(pts)
    if n < 12:
        return pts
    radius = int(sigma * 3)
    offsets = np.arange(-radius, radius + 1)
    weights = np.exp(-(offsets ** 2) / (2 * sigma ** 2))
    weights /= weights.sum()
    out = np.zeros_like(pts)

    for w, o in zip(weights, offsets):
        out += w * np.roll(pts, o, axis=0)

    return out


# 3 and 4. one shape per connected piece, painted big to small
pieces = []
kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))

for k in range(args.regions):
    region = (winner == k).astype(np.uint8)
    count, comp, stats, _ = cv2.connectedComponentsWithStats(region, connectivity=8)

    for c in range(1, count):
        area = stats[c, cv2.CC_STAT_AREA]
        if area < args.min_area:
            continue
        mask = (comp == c).astype(np.uint8)
        pieces.append((area, mask))

pieces = [p for p in pieces if p[0] >= args.min_area]
pieces.sort(key=lambda p: -p[0])
anchors = []

for _, m in pieces:
    ay, ax = np.nonzero(m)
    anchors.append((float(ax[len(ax) // 2]), float(ay[len(ay) // 2])))

defs, shapes = [], []
grow_k = max(1, int(round(args.grow)))

for index, (area, mask) in enumerate(pieces):
    grown = cv2.dilate(mask, kernel, iterations=grow_k) if index > 0 else mask
    contours, hierarchy = cv2.findContours(grown, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    d = ""

    for ci, contour in enumerate(contours):
        if cv2.contourArea(contour) < args.min_area * 0.5:
            continue
        if hierarchy[0][ci][3] >= 0:  # a hole: keep it only when another piece sits inside it
            holds = any(j != index and cv2.pointPolygonTest(contour, anchors[j], False) > 0 for j in range(len(pieces)))
            if not holds:
                continue
        eps = 0.9 if len(contour) > 200 else 0.6
        line = smooth_contour(contour)
        poly = cv2.approxPolyDP(line.astype(np.float32).reshape(-1, 1, 2), eps, True).reshape(-1, 2)
        d += smooth_path(poly, corner_degrees=80.0)

    if not d:
        continue

    core = cv2.erode(mask, kernel, iterations=2).astype(bool)
    ys, xs = np.nonzero(core if core.sum() > 40 else mask.astype(bool))
    colors = lab[ys, xs]
    LIMITS["low"], LIMITS["high"] = np.percentile(colors, 2, axis=0), np.percentile(colors, 98, axis=0)
    fill = fit_fill(np.stack([xs, ys], axis=1), colors)

    if fill[0] == "flat":
        paint = hexcolor(to_rgb(fill[1]))
    else:
        name, coef, (cx, cy, scale), (u0, u1, v0, v1) = fill
        gid = f"g{index}"

        if name == "linear":
            direction = np.array([np.linalg.norm(coef[1]), np.linalg.norm(coef[2])]) * 0  # placeholder, replaced below
            gu, gv = coef[1], coef[2]  # per channel slopes
            lum = np.array([1.0, 0.0, 0.0])  # follow the lightness channel's direction
            ax, ay = gu @ lum, gv @ lum
            norm = np.hypot(ax, ay) or 1.0
            ax, ay = ax / norm, ay / norm
            t0 = u0 * ax + v0 * ay
            t1 = u1 * ax + v1 * ay
            lo, hi = min(t0, t1), max(t0, t1)

            def at(t):
                point = np.array([1.0, ax * t, ay * t])
                return to_rgb(coef.T @ point)

            x1, y1 = cx + ax * lo * scale, cy + ay * lo * scale
            x2, y2 = cx + ax * hi * scale, cy + ay * hi * scale
            stops = "".join(f'<stop offset="{s:.2f}" stop-color="{hexcolor(at(lo + (hi - lo) * s))}"/>' for s in (0, 0.5, 1))
            defs.append(f'<linearGradient id="{gid}" gradientUnits="userSpaceOnUse" x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}">{stops}</linearGradient>')
        else:
            a, bu, bv, dq = coef[0], coef[1], coef[2], coef[3]
            # the radial surface c = a + b.u + c.v + d (u^2+v^2) has its center where the gradient vanishes
            dq_l = dq[0] if abs(dq[0]) > 1e-6 else 1e-6
            ucen = -bu[0] / (2 * dq_l)
            vcen = -bv[0] / (2 * dq_l)
            corners = [(u0, v0), (u0, v1), (u1, v0), (u1, v1)]
            radius = max(np.hypot(cu - ucen, cv - vcen) for cu, cv in corners)
            radius = max(radius, 1e-3)

            def at(r):
                du = ucen + r * radius
                point = np.array([1.0, du, vcen, du * du + vcen * vcen])
                return to_rgb(coef.T @ point)

            stops = "".join(f'<stop offset="{s:.2f}" stop-color="{hexcolor(at(s))}"/>' for s in (0, 0.25, 0.5, 0.75, 1))
            defs.append(f'<radialGradient id="{gid}" gradientUnits="userSpaceOnUse" cx="{cx + ucen * scale:.1f}" cy="{cy + vcen * scale:.1f}" r="{radius * scale:.1f}">{stops}</radialGradient>')

        paint = f"url(#{gid})"

    # a piece that is close in color to what lies around it (a blush, a shadow) gets a soft edge
    ring = cv2.dilate(mask, kernel, iterations=7).astype(bool) & ~mask.astype(bool) & inside
    soft = ""

    if index > 0 and ring.sum() > 30 and area < args.soft_area * pieces[0][0]:
        distance = np.linalg.norm(lab[ys, xs].mean(axis=0) - lab[ring].mean(axis=0))
        if distance < args.soft:
            sigma = int(np.clip(np.sqrt(area) * 0.1, 3, 40))
            fid = f"soft{sigma}"
            if not any(f'id="{fid}"' in d for d in defs):
                defs.append(f'<filter id="{fid}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="{sigma}"/></filter>')
            soft = f' filter="url(#{fid})"'

    shapes.append(f'<path d="{d}" fill="{paint}" fill-rule="evenodd"{soft}/>')

svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}"><defs>{"".join(defs)}</defs>{"".join(shapes)}</svg>'
path = os.path.join(folder, "vector.svg")
open(path, "w", encoding="utf8").write(svg)
print(f"{args.character}: {os.path.getsize(path) / 1024:.0f} KB, {len(shapes)} shapes, {len(defs)} gradients")
