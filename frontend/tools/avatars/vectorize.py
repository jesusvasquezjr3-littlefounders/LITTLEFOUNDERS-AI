"""Step 2 of the avatar rebuild (docs/design/CHARACTER-AVATARS.md): turns a head's reference render into a clean,
light vector SVG, built the way an illustrator would build it.

  python tools/avatars/vectorize.py <Character> [--regions 14] [--tolerance 1.6]

Reads audit-out/avatars/<character>/ref-albedo.png and writes vector.svg next to it.

What it does:
  1. Splits the head into color regions (shading counts little, so a shaded skin is one region).
  2. Draws each region as a few smooth Bezier curves (Schneider's fitting, tolerance in pixels), so an outline is a
     handful of nodes and not hundreds of points. Sharp corners stay sharp.
  3. Replaces shapes that are really ellipses (eyes, pupils, nostrils, blush) with true ellipses, and rings that are
     really circles (the lenses of glasses) with a perfect ring.
  4. Fills a region with a flat color or a fitted gradient, and puts the soft shading of the big regions on top as a
     few blurred layers clipped to the region, so a glow is smooth and costs a few shapes.
  5. Paints the regions from the biggest to the smallest, each grown a little so no seams show.

Needs: pip install opencv-python-headless numpy
"""
import argparse
import os

import cv2
import numpy as np

from bezier import fit_closed, to_path

parser = argparse.ArgumentParser()
parser.add_argument("character")
parser.add_argument("--regions", type=int, default=14, help="how many color regions to split the head into")
parser.add_argument("--light", type=float, default=0.3, help="weight of lightness when splitting (0 ignores shading)")
parser.add_argument("--min-area", type=int, default=320, help="smallest piece kept, in pixels")
parser.add_argument("--merge", type=float, default=21.0, help="how different two neighboring colors must be to stay apart (mean shift)")
parser.add_argument("--blur", type=float, default=3.0, help="border smoothing, in pixels")
parser.add_argument("--grow", type=float, default=1.6, help="how far each region is grown to hide seams, in pixels")
parser.add_argument("--tolerance", type=float, default=2.4, help="how far a curve may stray from the outline, in pixels")
parser.add_argument("--ellipse-iou", type=float, default=0.955, help="how well a shape must match an ellipse to become one")
parser.add_argument("--shade", type=float, default=1.0, help="0 turns the blurred shading layers off")
parser.add_argument("--taper", type=float, default=0.0, help="shorten the middle of the bottom edge by this share of the height, leaving pointed tips")

# settings that suit each character best so far (found by looking at the results); flags still override them
PRESETS = {
    "zara": dict(regions=9, min_area=700, light=0.2, taper=0.11),
}
character = parser.parse_known_args()[0].character.lower()
parser.set_defaults(**PRESETS.get(character, {}))
args = parser.parse_args()

folder = os.path.join(os.path.dirname(__file__), "..", "..", "audit-out", "avatars", args.character.lower())
source = cv2.imread(os.path.join(folder, "ref-albedo.png"), cv2.IMREAD_UNCHANGED)
height, width = source.shape[:2]
inside = source[:, :, 3] > 127
bgr = source[:, :, :3].copy()

# a head that ends in a clean, pointed hem instead of a ragged cut
if args.taper > 0:
    columns = np.nonzero(inside[int(height * 0.7):].any(axis=0))[0]
    cx, half = (columns.min() + columns.max()) / 2.0, (columns.max() - columns.min()) / 2.0
    xs = np.arange(width)
    bottom = height - 3
    cut = bottom - args.taper * height * (1.0 - np.minimum(np.abs(xs - cx) / half, 1.0) ** 1.4)
    inside &= np.arange(height)[:, None] < cut[None, :]

sil_area = int(inside.sum())

# edge-preserving flattening: shading and grain melt into their region, edges stay
filled = bgr.copy()
filled[~inside] = bgr[inside].mean(axis=0).astype(np.uint8)
flattened = cv2.pyrMeanShiftFiltering(filled, sp=12, sr=args.merge, maxLevel=2)
smooth = cv2.bilateralFilter(bgr, d=9, sigmaColor=30, sigmaSpace=9)
lab = cv2.cvtColor(smooth, cv2.COLOR_BGR2LAB).astype(np.float32)
features = cv2.cvtColor(flattened, cv2.COLOR_BGR2LAB).astype(np.float32)
features[:, :, 0] *= args.light

# 1. split by color, then smooth the borders (blur each region's mask, the strongest wins)
data = features.reshape(-1, 3)[inside.reshape(-1)]
_, labels, _ = cv2.kmeans(data, args.regions, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 60, 0.3), 5, cv2.KMEANS_PP_CENTERS)
label_image = np.full((height, width), -1, np.int32)
label_image[inside] = labels.flatten()
stack = np.zeros((args.regions + 1, height, width), np.float32)

for k in range(args.regions):
    stack[k] = cv2.GaussianBlur((label_image == k).astype(np.float32), (0, 0), args.blur)

stack[args.regions] = cv2.GaussianBlur((~inside).astype(np.float32), (0, 0), args.blur) * 0.9
winner = stack.argmax(axis=0)
del stack

kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))


def rgb_of(lab_color):
    pixel = np.clip(lab_color, 0, 255).astype(np.uint8).reshape(1, 1, 3)

    return cv2.cvtColor(pixel, cv2.COLOR_LAB2RGB).reshape(3)


def hexcolor(rgb):
    return "#%02x%02x%02x" % tuple(int(c) for c in rgb)


def contour_points(contour, spacing=2.5, sigma=3.0):
    """The outline smoothed along itself and resampled evenly, so curve fitting sees a clean line."""
    pts = contour.reshape(-1, 2).astype(np.float64)
    n = len(pts)
    if n < 12:
        return pts
    radius = int(sigma * 3)
    offsets = np.arange(-radius, radius + 1)
    weights = np.exp(-(offsets ** 2) / (2 * sigma ** 2))
    weights /= weights.sum()
    smoothed = sum(w * np.roll(pts, o, axis=0) for w, o in zip(weights, offsets))
    closed = np.vstack([smoothed, smoothed[:1]])
    length = np.r_[0, np.cumsum(np.linalg.norm(np.diff(closed, axis=0), axis=1))]
    count = max(8, int(length[-1] / spacing))
    t = np.linspace(0, length[-1], count, endpoint=False)

    return np.stack([np.interp(t, length, closed[:, 0]), np.interp(t, length, closed[:, 1])], axis=1)


def curve_path(contour):
    segments = fit_closed(contour_points(contour), args.tolerance, corner_degrees=60.0)

    return to_path(segments), len(segments)


def ellipse_of(contour, min_iou=None):
    """(cx, cy, rx, ry, degrees) when the outline is really an ellipse, else None."""
    if len(contour) < 20:
        return None
    (cx, cy), (w, h), angle = cv2.fitEllipse(contour)
    x, y, bw, bh = cv2.boundingRect(contour)
    pad = 4
    shape = (bh + 2 * pad, bw + 2 * pad)
    actual = np.zeros(shape, np.uint8)
    cv2.drawContours(actual, [contour - [x - pad, y - pad]], -1, 1, -1)
    drawn = np.zeros(shape, np.uint8)
    cv2.ellipse(drawn, ((cx - x + pad, cy - y + pad), (w, h), angle), 1, -1)
    union = np.logical_or(actual, drawn).sum()
    iou = np.logical_and(actual, drawn).sum() / union if union else 0

    return (cx, cy, w / 2, h / 2, angle) if iou >= (min_iou or args.ellipse_iou) else None


def fit_fill(xy, colors):
    """A linear gradient that follows the colors, or a flat color when flat is as good."""
    flat = colors.mean(axis=0)
    err_flat = np.mean((colors - flat) ** 2)

    if len(colors) < 600 or err_flat < 6.0:
        return ("flat", flat)

    x, y = xy[:, 0].astype(np.float64), xy[:, 1].astype(np.float64)
    cx, cy, scale = x.mean(), y.mean(), max(x.max() - x.min(), y.max() - y.min(), 1.0)
    u, v = (x - cx) / scale, (y - cy) / scale
    design = np.stack([np.ones(len(u)), u, v], axis=1)
    coef, *_ = np.linalg.lstsq(design, colors, rcond=None)
    err = np.mean((design @ coef - colors) ** 2)

    if err > err_flat * 0.6:
        return ("flat", flat)

    return ("linear", coef, (cx, cy, scale), (u.min(), u.max(), v.min(), v.max()))


# the pieces: connected areas of one color region
pieces = []

for k in range(args.regions):
    count, comp, stats, _ = cv2.connectedComponentsWithStats((winner == k).astype(np.uint8), connectivity=8)

    for c in range(1, count):
        if stats[c, cv2.CC_STAT_AREA] >= args.min_area:
            pieces.append((comp == c).astype(np.uint8))

# rings of glasses: a dark piece with a round hole is a perfect ring, drawn as one stroke
rings = []

for i, mask in enumerate(pieces):
    ys, xs = np.nonzero(mask)
    color = lab[ys, xs].mean(axis=0)
    if color[0] > 90:  # only dark pieces (frames, outlines)
        continue
    contours, hierarchy = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)

    for ci, contour in enumerate(contours):
        if hierarchy[0][ci][3] < 0 or cv2.contourArea(contour) < 0.004 * sil_area:
            continue
        ell = ellipse_of(contour, 0.9)
        if not ell:
            continue
        cx, cy, rx, ry, angle = ell
        # walk outward from the hole's edge until the piece ends: that gives the thickness of the ring
        thick = []
        for a in np.linspace(0, 2 * np.pi, 96, endpoint=False):
            dx, dy = np.cos(a), np.sin(a)
            r0 = max(rx, ry) * 0.9
            r = r0
            ended = False
            while r < r0 + 0.8 * max(rx, ry):
                px, py = int(round(cx + dx * r)), int(round(cy + dy * r))
                if not (0 <= px < width and 0 <= py < height):
                    break
                if not mask[py, px] and r > min(rx, ry) * 0.9 and np.hypot(px - cx, py - cy) > np.hypot(rx * np.cos(a), ry * np.sin(a)) + 2:
                    ended = True
                    break
                r += 1
            if ended:
                thick.append(r - np.hypot(rx * np.cos(a), ry * np.sin(a)))
        if len(thick) < 60:
            continue
        t = float(np.median(thick))
        if t < 2 or t > 0.35 * max(rx, ry):
            continue
        rings.append(((cx, cy, rx + t / 2, ry + t / 2, angle), t, color))
        annulus = np.zeros_like(mask)
        cv2.ellipse(annulus, ((cx, cy), ((rx + t * 1.15) * 2, (ry + t * 1.15) * 2), angle), 1, -1)
        cv2.ellipse(annulus, ((cx, cy), ((rx - 1) * 2, (ry - 1) * 2), angle), 0, -1)
        pieces[i] = (pieces[i] & (1 - annulus)).astype(np.uint8)
        mask = pieces[i]

# what is left of a piece after its rings are taken out is cleaned and split again
cleaned = []

for mask in pieces:
    count, comp, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)

    for c in range(1, count):
        if stats[c, cv2.CC_STAT_AREA] >= max(60, args.min_area // 4):
            cleaned.append((comp == c).astype(np.uint8))

pieces = sorted(cleaned, key=lambda m: -int(m.sum()))
areas = [int(m.sum()) for m in pieces]
anchors = []

for m in pieces:
    ay, ax = np.nonzero(m)
    anchors.append((float(ax[len(ax) // 2]), float(ay[len(ay) // 2])))

defs, body = [], []
nodes = 0
grow_k = max(1, int(round(args.grow)))
big_threshold = 0.03 * sil_area

for index, mask in enumerate(pieces):
    area = areas[index]
    grown = cv2.dilate(mask, kernel, iterations=grow_k) if index > 0 else mask
    contours, hierarchy = cv2.findContours(grown, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    outer = [c for ci, c in enumerate(contours) if hierarchy[0][ci][3] < 0 and cv2.contourArea(c) >= args.min_area * 0.4]
    holes = []

    for ci, c in enumerate(contours):
        if hierarchy[0][ci][3] >= 0 and cv2.contourArea(c) >= args.min_area * 0.4:
            if any(j != index and cv2.pointPolygonTest(c, anchors[j], False) > 0 for j in range(len(pieces))):
                holes.append(c)

    if not outer:
        continue

    core = cv2.erode(mask, kernel, iterations=2).astype(bool)
    ys, xs = np.nonzero(core if core.sum() > 40 else mask.astype(bool))
    colors = lab[ys, xs]
    base_mean = colors.mean(axis=0)

    # shading layers for the big regions: where the region is lighter or darker than its own average
    overlays = []
    if args.shade > 0 and area >= big_threshold:
        residual = cv2.GaussianBlur(lab[:, :, 0], (0, 0), 5) - base_mean[0]
        inner = cv2.erode(mask, kernel, iterations=6).astype(bool)

        for level in (7, 16, -8, -18):
            region = (residual > level if level > 0 else residual < level) & inner
            region = cv2.morphologyEx(region.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
            count, comp, stats, _ = cv2.connectedComponentsWithStats(region, connectivity=8)

            for c in sorted(range(1, count), key=lambda c: -stats[c, cv2.CC_STAT_AREA])[:3]:
                if stats[c, cv2.CC_STAT_AREA] < max(400, 0.012 * area):
                    continue
                part = (comp == c).astype(np.uint8)
                cts, _ = cv2.findContours(part, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
                cts = [t for t in cts if cv2.contourArea(t) > 200]
                if not cts:
                    continue
                path, n = curve_path(max(cts, key=cv2.contourArea))
                py, px = np.nonzero(part)
                overlays.append((path, n, hexcolor(rgb_of(lab[py, px].mean(axis=0))), float(np.clip(0.08 * np.sqrt(area), 5, 60))))

    fill = ("flat", base_mean) if overlays else fit_fill(np.stack([xs, ys], axis=1), colors)

    if fill[0] == "flat":
        paint = hexcolor(rgb_of(fill[1]))
    else:
        _, coef, (cx0, cy0, scale), (u0, u1, v0, v1) = fill
        gid = f"g{index}"
        ax, ay = coef[1, 0], coef[2, 0]  # the lightness slope along u and v
        norm = np.hypot(ax, ay) or 1.0
        ax, ay = ax / norm, ay / norm
        t0, t1 = sorted((u0 * ax + v0 * ay, u1 * ax + v1 * ay))
        lo_c, hi_c = np.percentile(colors, 2, axis=0), np.percentile(colors, 98, axis=0)

        def at(t):
            return rgb_of(np.clip(coef.T @ np.array([1.0, ax * t, ay * t]), lo_c, hi_c))

        stops = "".join(f'<stop offset="{s:.2f}" stop-color="{hexcolor(at(t0 + (t1 - t0) * s))}"/>' for s in (0, 0.5, 1))
        defs.append(f'<linearGradient id="{gid}" gradientUnits="userSpaceOnUse" x1="{cx0 + ax * t0 * scale:.1f}" y1="{cy0 + ay * t0 * scale:.1f}" x2="{cx0 + ax * t1 * scale:.1f}" y2="{cy0 + ay * t1 * scale:.1f}">{stops}</linearGradient>')
        paint = f"url(#{gid})"

    # the shape itself: a true ellipse when it is one, else a few Bezier curves
    ell = ellipse_of(outer[0]) if len(outer) == 1 and not holes and not overlays else None

    if ell:
        ex, ey, erx, ery, eang = ell
        body.append(f'<ellipse cx="{ex:.1f}" cy="{ey:.1f}" rx="{erx:.1f}" ry="{ery:.1f}" transform="rotate({eang:.1f} {ex:.1f} {ey:.1f})" fill="{paint}"/>')
        nodes += 4
        continue

    d = ""
    for c in outer + holes:
        path, n = curve_path(c)
        d += path
        nodes += n

    if overlays:
        defs.append(f'<path id="p{index}" d="{d}" fill-rule="evenodd"/>')
        defs.append(f'<clipPath id="c{index}"><use href="#p{index}"/></clipPath>')
        group = f'<use href="#p{index}" fill="{paint}"/><g clip-path="url(#c{index})">'
        for path, n, color, sigma in overlays:
            fid = f"b{int(sigma)}"
            if not any(f'id="{fid}"' in item for item in defs):
                defs.append(f'<filter id="{fid}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="{int(sigma)}"/></filter>')
            group += f'<path d="{path}" fill="{color}" filter="url(#{fid})"/>'
            nodes += n
        body.append(group + "</g>")
    else:
        body.append(f'<path d="{d}" fill="{paint}" fill-rule="evenodd"/>')

# the rings are painted last: they sit on top of the face
ring_svg = ""

for (cx, cy, rx, ry, angle), t, color in rings:
    ring_svg += f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" transform="rotate({angle:.1f} {cx:.1f} {cy:.1f})" fill="none" stroke="{hexcolor(rgb_of(color))}" stroke-width="{t:.1f}"/>'
    nodes += 4

svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}"><defs>{"".join(defs)}</defs>{"".join(body)}{ring_svg}</svg>'
path = os.path.join(folder, "vector.svg")
open(path, "w", encoding="utf8").write(svg)
print(f"{args.character}: {os.path.getsize(path) / 1024:.0f} KB, {len(body)} shapes, {len(rings)} rings, about {nodes} nodes")
