"""Builds a character's avatar as a clean, named, layered SVG from an art spec (docs/design/CHARACTER-AVATARS.md).

  python tools/avatars/parts.py <Character>

Reads audit-out/avatars/<character>/ref-albedo.png (made by reference.mjs) and tools/avatars/art/<character>.json, and
writes audit-out/avatars/<character>/avatar.svg.

The reference is split into numbered pieces (segment.py shows the numbered map). The art spec names the parts of the
face and says which pieces make each one, in painting order from the back. Each part is then drawn as a few smooth
Bezier curves (or a true ellipse, ring or circle), flat or with a clean gradient, and parts that mirror each other are
drawn once and reflected, so the face is exactly symmetric. Every part is a named group, ready to be animated.

Layer kinds in the spec ("kind"):
  shape    the union of "pieces" (closed by "close" pixels, opened by "open"), as curves. "fill" is a color or "auto".
  ellipse  an ellipse fitted to the union of "pieces".
  circle   an explicit circle: cx, cy, r.
  ring     a ring stroke around the hole of one dark piece ("piece"), found automatically.
  path     a hand-drawn path ("d") in image pixels.
Any layer may have "mirror_of": "<name>", drawing that layer reflected about the spec's "axis".
A fill may be {"linear": [from, to, degrees]} or {"radial": [inner, outer, outerOpacity]}.
"""
import json
import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from bezier import corners_of, fit_closed, fit_open, to_path  # noqa: E402
from segment import folder_of, segment  # noqa: E402

character = sys.argv[1]
spec = json.load(open(os.path.join(os.path.dirname(__file__), "art", f"{character.lower()}.json"), encoding="utf8"))
bgr, inside, lab, pieces = segment(character, **spec.get("segment", {}))
height, width = inside.shape
by_id = {p["id"]: p for p in pieces}
axis = spec.get("axis", width / 2)
tolerance = spec.get("tolerance", 3.0)
kernel = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))  # noqa: E731


def hexrgb(rgb):
    return "#%02x%02x%02x" % tuple(int(c) for c in rgb)


def union(ids):
    mask = np.zeros((height, width), np.uint8)
    for i in ids:
        mask |= by_id[i]["mask"]

    return mask


def mean_color(ids):
    total = sum(by_id[i]["area"] for i in ids)

    return [sum(by_id[i]["rgb"][c] * by_id[i]["area"] for i in ids) / total for c in range(3)]


def contour_points(contour, spacing=3.0, sigma=4.0):
    pts = contour.reshape(-1, 2).astype(np.float64)
    if len(pts) < 12:
        return pts
    radius = int(sigma * 3)
    offsets = np.arange(-radius, radius + 1)
    weights = np.exp(-(offsets ** 2) / (2 * sigma ** 2))
    weights /= weights.sum()
    smoothed = sum(w * np.roll(pts, o, axis=0) for w, o in zip(weights, offsets))
    closed = np.vstack([smoothed, smoothed[:1]])
    length = np.r_[0, np.cumsum(np.linalg.norm(np.diff(closed, axis=0), axis=1))]
    t = np.linspace(0, length[-1], max(8, int(length[-1] / spacing)), endpoint=False)

    return np.stack([np.interp(t, length, closed[:, 0]), np.interp(t, length, closed[:, 1])], axis=1)


nodes = 0
defs = []
body = []
named = {}


def paint(fill, ids, bbox, name):
    """Turns a fill spec into an SVG paint value, adding a gradient to the defs when needed."""
    if fill in (None, "auto"):
        return hexrgb(mean_color(ids)) if ids else "#000000"
    if isinstance(fill, str):
        return fill
    x0, y0, x1, y1 = bbox
    gid = f"gr-{name}"
    if "gradient" in fill:
        g = fill["gradient"]
        stops = "".join(f'<stop offset="{o}" stop-color="{c}"' + (f' stop-opacity="{op[0]}"' if (op := rest) else "") + "/>" for o, c, *rest in g["stops"])
        if g["type"] == "radial":
            defs.append(f'<radialGradient id="{gid}" gradientUnits="userSpaceOnUse" cx="{g["cx"]}" cy="{g["cy"]}" r="{g["r"]}">{stops}</radialGradient>')
        else:
            defs.append(f'<linearGradient id="{gid}" gradientUnits="userSpaceOnUse" x1="{g["x1"]}" y1="{g["y1"]}" x2="{g["x2"]}" y2="{g["y2"]}">{stops}</linearGradient>')

        return f"url(#{gid})"
    if "linear" in fill:
        a, b, deg = fill["linear"]
        rad = np.radians(deg)
        cx, cy, half = (x0 + x1) / 2, (y0 + y1) / 2, max(x1 - x0, y1 - y0) / 2
        dx, dy = np.cos(rad) * half, np.sin(rad) * half
        defs.append(f'<linearGradient id="{gid}" gradientUnits="userSpaceOnUse" x1="{cx - dx:.1f}" y1="{cy - dy:.1f}" x2="{cx + dx:.1f}" y2="{cy + dy:.1f}"><stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/></linearGradient>')
    else:
        inner, outer, opacity = fill["radial"]
        cx, cy, r = (x0 + x1) / 2, (y0 + y1) / 2, max(x1 - x0, y1 - y0) / 2
        defs.append(f'<radialGradient id="{gid}" gradientUnits="userSpaceOnUse" cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}"><stop offset="0" stop-color="{inner}"/><stop offset="1" stop-color="{outer}" stop-opacity="{opacity}"/></radialGradient>')

    return f"url(#{gid})"


def _resample(points, spacing):
    closed = np.vstack([points, points[:1]])
    length = np.r_[0, np.cumsum(np.linalg.norm(np.diff(closed, axis=0), axis=1))]
    t = np.linspace(0, length[-1], max(8, int(length[-1] / spacing)), endpoint=False)

    return np.stack([np.interp(t, length, closed[:, 0]), np.interp(t, length, closed[:, 1])], axis=1)


def _kernel(sigma_samples):
    radius = max(1, int(3 * sigma_samples))
    offsets = np.arange(-radius, radius + 1)
    weights = np.exp(-(offsets ** 2) / (2 * sigma_samples ** 2))

    return offsets, weights / weights.sum()


def _smooth_closed(points, sigma_samples):
    offsets, weights = _kernel(sigma_samples)

    return sum(w * np.roll(points, o, axis=0) for w, o in zip(weights, offsets))


def _smooth_open(run, sigma_samples):
    """Smooths a run of points with both ends held fixed (the ends are mirrored through themselves)."""
    n = len(run)
    radius = min(int(3 * sigma_samples), n - 1)
    if n < 5 or radius < 1:
        return run
    left = 2 * run[0] - run[1 : radius + 1][::-1]
    right = 2 * run[-1] - run[-radius - 1 : -1][::-1]
    padded = np.vstack([left, run, right])
    offsets = np.arange(-radius, radius + 1)
    weights = np.exp(-(offsets ** 2) / (2 * sigma_samples ** 2))
    weights /= weights.sum()
    out = np.zeros_like(run)
    for w, o in zip(weights, offsets):
        out += w * padded[radius + o : radius + o + n]

    return out


def organic_segments(contour, tol, sigma, corner_degrees):
    """Bezier segments for one outline: corners are found first, then each stretch between corners is smoothed
    hard, so curves are long and calm and corners stay crisp."""
    spacing = 2.0
    base = _smooth_closed(_resample(contour.reshape(-1, 2).astype(np.float64), spacing), 1.2)
    corners = corners_of(base, window=7, degrees=corner_degrees)
    sig = max(1.0, sigma / spacing)

    if not corners:
        return fit_closed(_smooth_closed(base, sig), tol, corner_degrees=999.0)

    segments = []
    n = len(base)
    for i, start in enumerate(corners):
        end = corners[(i + 1) % len(corners)]
        run = base[start : end + 1] if end > start else np.vstack([base[start:], base[: end + 1]])
        if len(run) >= 3:
            segments += fit_open(_smooth_open(run, sig), tol)

    return segments


def outline_path(mask, holes=False, tol=None, sigma=None, corner=None):
    global nodes
    mode = cv2.RETR_CCOMP if holes else cv2.RETR_EXTERNAL
    contours, hierarchy = cv2.findContours(mask, mode, cv2.CHAIN_APPROX_NONE)
    d = ""
    for i, c in enumerate(contours):
        if cv2.contourArea(c) < 40:
            continue
        s_ = sigma if sigma is not None else float(np.clip(len(c) / 140.0, 4.0, 16.0))
        segments = organic_segments(c, tol or tolerance, s_, corner if corner is not None else spec.get("corner", 70.0))
        nodes += len(segments)
        d += to_path(segments)

    return d


def fit_ellipse_of(mask):
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    contour = max(contours, key=cv2.contourArea)
    (cx, cy), (w, h), angle = cv2.fitEllipse(contour)

    return cx, cy, w / 2, h / 2, angle


def ring_of(piece_id):
    """The round holes of a dark piece, each with the thickness of the ring around it."""
    mask = by_id[piece_id]["mask"]
    contours, hierarchy = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    out = []
    for ci, c in enumerate(contours):
        if hierarchy[0][ci][3] < 0 or cv2.contourArea(c) < 3000:
            continue
        (cx, cy), (w, h), angle = cv2.fitEllipse(c)
        rx, ry = w / 2, h / 2
        thick = []
        for a in np.linspace(0, 2 * np.pi, 96, endpoint=False):
            dx, dy = np.cos(a), np.sin(a)
            r0 = np.hypot(rx * np.cos(a), ry * np.sin(a))
            r = r0 + 1
            while r < r0 + 0.5 * max(rx, ry):
                px, py = int(round(cx + dx * r)), int(round(cy + dy * r))
                if not (0 <= px < width and 0 <= py < height) or not mask[py, px]:
                    thick.append(r - r0)
                    break
                r += 1
        if len(thick) > 60:
            out.append((cx, cy, rx, ry, angle, float(np.median(thick))))

    return out


CLIPS = {}
BLUR = {}
CLIP_ELLIPSES = {}
MIRRORED = {l["mirror_of"] for l in spec["layers"] if "mirror_of" in l}


def add(name, markup, bbox=None):
    named[name] = markup
    if BLUR.get(name):
        markup = f'<g filter="url(#{blur_filter(BLUR[name])})">{markup}</g>'
    if name in MIRRORED:
        # a mirrored part is drawn once; the mirror references the art, not the group, so the rig can move each side alone
        group = f'<g id="{name}"><g id="{name}-art">{markup}</g></g>'
    else:
        group = f'<g id="{name}">{markup}</g>'
    ellipse = CLIP_ELLIPSES.get(name)
    if ellipse:
        cid = f"clip-{name}"
        defs.append(f'<clipPath id="{cid}"><ellipse cx="{ellipse[0]}" cy="{ellipse[1]}" rx="{ellipse[2]}" ry="{ellipse[3]}"/></clipPath>')
        group = f'<g clip-path="url(#{cid})">{group}</g>'
    clip = CLIPS.get(name)
    if clip:
        # the clip sits OUTSIDE the group the rig moves, so a blush that slides with a turn can never leave the face
        cid = f"clip-{name}"
        defs.append(f'<clipPath id="{cid}"><use href="#p-{clip}"/></clipPath>')
        group = f'<g clip-path="url(#{cid})">{group}</g>'
    body.append(group)


def blur_filter(sigma):
    fid = f"blur{int(round(sigma))}"
    if not any(f'id="{fid}"' in item for item in defs):
        defs.append(f'<filter id="{fid}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="{sigma}"/></filter>')

    return fid


def shade_markup(name, mask, cfg):
    """Soft tonal shapes (shadows and lights) found where the reference is darker or lighter than the part's own
    average, drawn inside the part so they never leave its outline."""
    cfg = cfg if isinstance(cfg, dict) else {}
    light = cv2.GaussianBlur(lab[:, :, 0], (0, 0), cfg.get("sigma", 7))
    inner = cv2.erode(mask, kernel(cfg.get("inset", 10))).astype(bool)
    if inner.sum() < 400:
        return ""
    base = np.median(light[inner])
    residual = light - base
    area = int(mask.sum())
    shapes = ""
    global nodes
    for level in cfg.get("levels", [-9, 9]):
        region = ((residual < level) if level < 0 else (residual > level)) & inner
        region = cv2.morphologyEx(region.astype(np.uint8), cv2.MORPH_OPEN, kernel(cfg.get("open", 4)))
        region = cv2.morphologyEx(region, cv2.MORPH_CLOSE, kernel(cfg.get("open", 4) + 3))
        count, comp, stats, _ = cv2.connectedComponentsWithStats(region, connectivity=8)
        for c in sorted(range(1, count), key=lambda c: -stats[c, cv2.CC_STAT_AREA])[: cfg.get("max", 2)]:
            if stats[c, cv2.CC_STAT_AREA] < cfg.get("min", 0.015) * area:
                continue
            part = (comp == c).astype(np.uint8)
            ys, xs = np.nonzero(part)
            rgb = cv2.cvtColor(bgr[ys, xs].reshape(-1, 1, 3), cv2.COLOR_BGR2RGB).reshape(-1, 3).mean(axis=0)
            d = outline_path(part, sigma=cfg.get("smooth", 12.0), tol=cfg.get("tolerance", 3.5), corner=999.0)
            if d:
                shapes += f'<path d="{d}" fill="{hexrgb(rgb)}"/>'
    if not shapes:
        return ""
    fid = blur_filter(cfg.get("blur", 5))
    cid = f"cp-{name}"
    defs.append(f'<clipPath id="{cid}"><use href="#p-{name}"/></clipPath>')

    return f'<g clip-path="url(#{cid})"><g filter="url(#{fid})">{shapes}</g></g>'


for layer in spec["layers"]:
    name = layer["name"]
    kind = layer.get("kind", "shape")
    if layer.get("blur") and kind != "shape":
        BLUR[name] = layer["blur"]
    if layer.get("clip_to"):
        CLIPS[name] = layer["clip_to"]
    if layer.get("clip_ellipse"):
        CLIP_ELLIPSES[name] = layer["clip_ellipse"]

    if "mirror_of" in layer:
        add(name, f'<use href="#{layer["mirror_of"]}-art" transform="translate({2 * axis:.1f} 0) scale(-1 1)"/>')
        continue

    ids = list(layer.get("pieces", []))
    pick = layer.get("select")
    if pick:
        target = np.array([int(pick["near"][i:i + 2], 16) for i in (1, 3, 5)])
        x0, y0, x1, y1 = pick.get("bbox", [0, 0, width, height])
        for p in pieces:
            cx, cy = p["centroid"]
            if x0 <= cx <= x1 and y0 <= cy <= y1 and np.linalg.norm(np.array(p["rgb"]) - target) <= pick.get("dist", 40) and p["id"] not in ids:
                ids.append(p["id"])
    if layer.get("all"):
        ids = [p["id"] for p in pieces]
    mask = union(ids) if ids else None

    if kind == "shape":
        if layer.get("close"):
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel(layer["close"]))
        if layer.get("open"):
            mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel(layer["open"]))
        if layer.get("grow"):
            mask = cv2.dilate(mask, kernel(layer["grow"]))
        if layer.get("symmetrize"):
            flipped = cv2.warpAffine(mask, np.float32([[-1, 0, 2 * axis], [0, 1, 0]]), (width, height), flags=cv2.INTER_NEAREST)
            half = np.zeros_like(mask)
            side = layer["symmetrize"]
            if side == "union":
                mask = mask | flipped
            else:
                cut = int(axis)
                half[:, : cut + 2] = mask[:, : cut + 2] if side == "left" else flipped[:, : cut + 2]
                half_flipped = cv2.warpAffine(half, np.float32([[-1, 0, 2 * axis], [0, 1, 0]]), (width, height), flags=cv2.INTER_NEAREST)
                mask = half | half_flipped
        if layer.get("fill_holes", True):
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
            filled = np.zeros_like(mask)
            cv2.drawContours(filled, contours, -1, 1, -1)
            mask = filled if not layer.get("holes") else mask
        if layer.get("arch"):
            a = layer["arch"]
            xs_ = np.arange(width)
            cut_ = a["bottom"] - a["rise"] * (1.0 - np.minimum(np.abs(xs_ - a.get("axis", axis)) / a["half"], 1.0) ** a.get("power", 1.4))
            mask = mask & (np.arange(height)[:, None] < cut_[None, :]).astype(np.uint8)
        if layer.get("arc"):
            a = layer["arc"]
            xs_ = np.arange(width)
            cut_ = a["y"] + a["sag"] * (1.0 - np.minimum(np.abs(xs_ - a.get("axis", axis)) / a["half"], 1.0) ** a.get("power", 2.0))
            mask = mask & (np.arange(height)[:, None] < cut_[None, :]).astype(np.uint8)
        if layer.get("clip"):
            clip = np.zeros_like(mask)
            cv2.fillPoly(clip, [np.array(layer["clip"], np.int32)], 1)
            mask = mask & clip
        ys, xs = np.nonzero(mask)
        bbox = (xs.min(), ys.min(), xs.max(), ys.max())
        d = outline_path(mask, holes=layer.get("holes", False), tol=layer.get("tolerance"), sigma=layer.get("sigma"), corner=layer.get("corner"))
        extra = f' opacity="{layer["opacity"]}"' if "opacity" in layer else ""
        if layer.get("outline"):
            extra += f' stroke="{layer["outline"]}" stroke-width="{layer.get("outline_width", 8)}" stroke-linejoin="round"'
        markup = f'<path id="p-{name}" d="{d}" fill="{paint(layer.get("fill"), ids, bbox, name)}" fill-rule="evenodd"{extra}/>'
        if layer.get("shade"):
            markup += shade_markup(name, mask, layer["shade"])
        add(name, markup)
    elif kind == "ellipse":
        if "cx" in layer:
            cx, cy, rx, ry, angle = layer["cx"], layer["cy"], layer["rx"], layer["ry"], layer.get("angle", 0)
        else:
            cx, cy, rx, ry, angle = fit_ellipse_of(mask)
        bbox = (cx - rx, cy - ry, cx + rx, cy + ry)
        extra = f' opacity="{layer["opacity"]}"' if "opacity" in layer else ""
        if layer.get("outline"):
            extra += f' stroke="{layer["outline"]}" stroke-width="{layer.get("outline_width", 8)}"'
        add(name, f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" transform="rotate({angle:.1f} {cx:.1f} {cy:.1f})" fill="{paint(layer.get("fill"), ids, bbox, name)}"{extra}/>')
        nodes += 4
    elif kind == "circle":
        cx, cy, r = layer["cx"], layer["cy"], layer["r"]
        extra = f' opacity="{layer["opacity"]}"' if "opacity" in layer else ""
        add(name, f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{paint(layer.get("fill"), ids, (cx - r, cy - r, cx + r, cy + r), name)}"{extra}/>')
        nodes += 4
    elif kind == "ring":
        color = layer.get("fill") or hexrgb(by_id[layer["piece"]]["rgb"])
        markup = ""
        for cx, cy, rx, ry, angle, t in ring_of(layer["piece"]):
            t *= layer.get("thickness", 1.0)
            markup += f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx + t / 2:.1f}" ry="{ry + t / 2:.1f}" transform="rotate({angle:.1f} {cx:.1f} {cy:.1f})" fill="none" stroke="{color}" stroke-width="{t:.1f}"/>'
            nodes += 4
        add(name, markup)
    elif kind == "smooth":
        # a closed smooth shape through measured points; "half" lists the left half from top to bottom on the axis
        pts = [np.array(q, dtype=np.float64) for q in layer["points"]]
        if layer.get("mirror", True):
            right = [np.array([2 * axis - q[0], q[1]]) for q in pts[1:-1]][::-1]
            pts = pts + right
        n_ = len(pts)
        tension = layer.get("tension", 1.0) / 6.0
        d = f"M{pts[0][0]:.1f} {pts[0][1]:.1f}"
        for i in range(n_):
            p0, p1, p2, p3 = pts[i - 1], pts[i], pts[(i + 1) % n_], pts[(i + 2) % n_]
            c1, c2 = p1 + (p2 - p0) * tension, p2 - (p3 - p1) * tension
            d += f"C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}"
        d += "Z"
        nodes += n_
        xs_ = [q[0] for q in pts]
        ys_ = [q[1] for q in pts]
        extra = f' opacity="{layer["opacity"]}"' if "opacity" in layer else ""
        add(name, f'<path id="p-{name}" d="{d}" fill="{paint(layer.get("fill"), [], (min(xs_), min(ys_), max(xs_), max(ys_)), name)}"{extra}/>')
    elif kind == "path":
        if layer.get("round"):
            extra = f' fill="{layer["fill"]}" stroke="{layer["fill"]}" stroke-width="{layer["round"]}" stroke-linejoin="round"'
        elif "stroke" in layer:
            extra = f' stroke="{layer["stroke"]}" stroke-width="{layer.get("width", 4)}" stroke-linecap="round" fill="none"'
        else:
            px, py = [float(v) for v in __import__("re").findall(r"-?\d+\.?\d*", layer["d"])][0::2], [float(v) for v in __import__("re").findall(r"-?\d+\.?\d*", layer["d"])][1::2]
            extra = f' fill="{paint(layer.get("fill", "#000"), [], (min(px), min(py), max(px), max(py)), name)}"'
        if "opacity" in layer:
            extra += f' opacity="{layer["opacity"]}"'
        add(name, f'<path d="{layer["d"]}"{extra}/>')
        nodes += layer["d"].count("C") + layer["d"].count("Q") + layer["d"].count("L")

crop = spec.get("crop", [0, 0, width, height])
x0, y0, x1, y1 = crop
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0} {y0} {x1 - x0} {y1 - y0}"><defs>{"".join(defs)}</defs>{"".join(body)}</svg>'
out = os.path.join(folder_of(character), "avatar.svg")
open(out, "w", encoding="utf8").write(svg)
# the same art with the whole reference frame, to lay over the reference when judging it
full = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}"><defs>{"".join(defs)}</defs>{"".join(body)}</svg>'
open(os.path.join(folder_of(character), "avatar-full.svg"), "w", encoding="utf8").write(full)

# the shipped copy: every id gets the character's prefix, so several avatars can share one page, and the rig file
# says which named parts move and how (read by src/features/avatars)
import re  # noqa: E402
prefix = spec.get("prefix", character.lower() + "-")
shipped = re.sub(r'\bid="([^"]+)"', lambda m: f'id="{prefix}{m.group(1)}"', svg)
shipped = re.sub(r'url\(#([^)]+)\)', lambda m: f'url(#{prefix}{m.group(1)})', shipped)
shipped = re.sub(r'href="#([^"]+)"', lambda m: f'href="#{prefix}{m.group(1)}"', shipped)
assets = os.path.join(os.path.dirname(__file__), "..", "..", "src", "features", "avatars", "assets")
os.makedirs(assets, exist_ok=True)
open(os.path.join(assets, f"{character.lower()}.svg"), "w", encoding="utf8").write(shipped)
rig = {"prefix": prefix, "viewBox": [x0, y0, x1 - x0, y1 - y0], **spec.get("rig", {})}
used = {n for e in rig.get("eyes", []) for n in e["parts"]} | {b["part"] for b in rig.get("brows", [])} | {n for f in rig.get("face", []) for n in f["parts"]} | set(rig.get("mouth", {}).get("parts", [])) | set(rig.get("cheeks", [])) | set(rig.get("body", [])) | set(rig.get("head", {}).get("parts", []))
missing = sorted(n for n in used if n not in named)
if missing:
    print("WARNING: rig names not in the art:", missing)
json.dump(rig, open(os.path.join(assets, f"{character.lower()}.rig.json"), "w", encoding="utf8"), indent=1)
print(f"{character}: {os.path.getsize(out) / 1024:.0f} KB, {len(body)} layers, about {nodes} nodes -> {out}")
