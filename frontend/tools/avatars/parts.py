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
from bezier import fit_closed, to_path  # noqa: E402
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


def outline_path(mask, holes=False, tol=None):
    global nodes
    mode = cv2.RETR_CCOMP if holes else cv2.RETR_EXTERNAL
    contours, hierarchy = cv2.findContours(mask, mode, cv2.CHAIN_APPROX_NONE)
    d = ""
    for i, c in enumerate(contours):
        if cv2.contourArea(c) < 40:
            continue
        segments = fit_closed(contour_points(c), tol or tolerance, corner_degrees=spec.get("corner", 65.0))
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


def add(name, markup, bbox=None):
    named[name] = markup
    body.append(f'<g id="{name}">{markup}</g>')


for layer in spec["layers"]:
    name = layer["name"]
    kind = layer.get("kind", "shape")

    if "mirror_of" in layer:
        add(name, f'<use href="#{layer["mirror_of"]}" transform="translate({2 * axis:.1f} 0) scale(-1 1)"/>')
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
        if layer.get("clip"):
            clip = np.zeros_like(mask)
            cv2.fillPoly(clip, [np.array(layer["clip"], np.int32)], 1)
            mask = mask & clip
        ys, xs = np.nonzero(mask)
        bbox = (xs.min(), ys.min(), xs.max(), ys.max())
        d = outline_path(mask, holes=layer.get("holes", False), tol=layer.get("tolerance"))
        extra = f' opacity="{layer["opacity"]}"' if "opacity" in layer else ""
        if layer.get("outline"):
            extra += f' stroke="{layer["outline"]}" stroke-width="{layer.get("outline_width", 8)}" stroke-linejoin="round"'
        add(name, f'<path d="{d}" fill="{paint(layer.get("fill"), ids, bbox, name)}" fill-rule="evenodd"{extra}/>')
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
    elif kind == "path":
        if layer.get("round"):
            extra = f' fill="{layer["fill"]}" stroke="{layer["fill"]}" stroke-width="{layer["round"]}" stroke-linejoin="round"'
        elif "stroke" in layer:
            extra = f' stroke="{layer["stroke"]}" stroke-width="{layer.get("width", 4)}" stroke-linecap="round" fill="none"'
        else:
            px, py = [float(v) for v in __import__("re").findall(r"-?\d+\.?\d*", layer["d"])][0::2], [float(v) for v in __import__("re").findall(r"-?\d+\.?\d*", layer["d"])][1::2]
            extra = f' fill="{paint(layer.get("fill", "#000"), [], (min(px), min(py), max(px), max(py)), name)}"'
        add(name, f'<path d="{layer["d"]}"{extra}/>')
        nodes += layer["d"].count("C") + layer["d"].count("Q") + layer["d"].count("L")

crop = spec.get("crop", [0, 0, width, height])
x0, y0, x1, y1 = crop
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0} {y0} {x1 - x0} {y1 - y0}"><defs>{"".join(defs)}</defs>{"".join(body)}</svg>'
out = os.path.join(folder_of(character), "avatar.svg")
open(out, "w", encoding="utf8").write(svg)
# the tracked copy of the art, small enough to keep in the repository
os.makedirs(os.path.join(os.path.dirname(__file__), "out"), exist_ok=True)
open(os.path.join(os.path.dirname(__file__), "out", f"{character.lower()}.svg"), "w", encoding="utf8").write(svg)
# the same art with the whole reference frame, to lay over the reference when judging it
full = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}"><defs>{"".join(defs)}</defs>{"".join(body)}</svg>'
open(os.path.join(folder_of(character), "avatar-full.svg"), "w", encoding="utf8").write(full)
print(f"{character}: {os.path.getsize(out) / 1024:.0f} KB, {len(body)} layers, about {nodes} nodes -> {out}")
