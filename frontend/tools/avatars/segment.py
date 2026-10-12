"""Splits a head's reference render into numbered color pieces, so each can be named and rebuilt by hand
(docs/design/CHARACTER-AVATARS.md). Imported by parts.py; run on its own it writes the numbered map to look at:

  python tools/avatars/segment.py <Character> [--regions 14] [--merge 21] [--min-area 150]

Writes audit-out/avatars/<character>/pieces.png (the pieces, numbered) and pieces.json.
"""
import argparse
import json
import os

import cv2
import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "audit-out", "avatars")

# per-character settings for the split; the art specs in tools/avatars/art/ may override them
DEFAULTS = {"regions": 14, "light": 0.3, "merge": 21.0, "blur": 3.0, "min_area": 150}


def folder_of(character):
    return os.path.join(ROOT, character.lower())


def load(character):
    source = cv2.imread(os.path.join(folder_of(character), "ref-albedo.png"), cv2.IMREAD_UNCHANGED)
    return source[:, :, :3].copy(), source[:, :, 3] > 127


def segment(character, **options):
    """Returns (bgr, inside, lab, pieces); pieces are dicts with a mask, sorted from the biggest to the smallest."""
    opts = {**DEFAULTS, **options}
    bgr, inside = load(character)
    height, width = inside.shape
    filled = bgr.copy()
    filled[~inside] = bgr[inside].mean(axis=0).astype(np.uint8)
    flattened = cv2.pyrMeanShiftFiltering(filled, sp=12, sr=opts["merge"], maxLevel=2)
    smooth = cv2.bilateralFilter(bgr, d=9, sigmaColor=30, sigmaSpace=9)
    lab = cv2.cvtColor(smooth, cv2.COLOR_BGR2LAB).astype(np.float32)
    features = cv2.cvtColor(flattened, cv2.COLOR_BGR2LAB).astype(np.float32)
    features[:, :, 0] *= opts["light"]
    data = features.reshape(-1, 3)[inside.reshape(-1)]
    k = opts["regions"]
    cv2.setRNGSeed(7)
    _, labels, _ = cv2.kmeans(data, k, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 60, 0.3), 5, cv2.KMEANS_PP_CENTERS)
    label_image = np.full((height, width), -1, np.int32)
    label_image[inside] = labels.flatten()
    best = np.zeros((height, width), np.float32)
    winner = np.full((height, width), k, np.int32)

    for r in range(k):
        blurred = cv2.GaussianBlur((label_image == r).astype(np.float32), (0, 0), opts["blur"])
        better = blurred > best
        winner[better] = r
        best[better] = blurred[better]

    outside = cv2.GaussianBlur((~inside).astype(np.float32), (0, 0), opts["blur"]) * 0.9
    winner[outside > best] = k
    pieces = []

    for r in range(k):
        count, comp, stats, _ = cv2.connectedComponentsWithStats((winner == r).astype(np.uint8), connectivity=8)

        for c in range(1, count):
            if stats[c, cv2.CC_STAT_AREA] >= opts["min_area"]:
                mask = (comp == c).astype(np.uint8)
                ys, xs = np.nonzero(mask)
                rgb = cv2.cvtColor(bgr[ys, xs].reshape(-1, 1, 3), cv2.COLOR_BGR2RGB).reshape(-1, 3).mean(axis=0)
                pieces.append({"mask": mask, "area": int(stats[c, cv2.CC_STAT_AREA]), "centroid": (float(xs.mean()), float(ys.mean())),
                               "bbox": [int(stats[c, 0]), int(stats[c, 1]), int(stats[c, 2]), int(stats[c, 3])], "rgb": [int(v) for v in rgb]})

    pieces.sort(key=lambda p: -p["area"])

    for i, p in enumerate(pieces):
        p["id"] = i

    return bgr, inside, lab, pieces


def hexrgb(rgb):
    return "#%02x%02x%02x" % tuple(rgb)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("character")
    parser.add_argument("--regions", type=int)
    parser.add_argument("--merge", type=float)
    parser.add_argument("--min-area", type=int, dest="min_area")
    parser.add_argument("--light", type=float)
    args = parser.parse_args()
    options = {k: v for k, v in vars(args).items() if k != "character" and v is not None}
    bgr, inside, lab, pieces = segment(args.character, **options)
    height, width = inside.shape
    scale = 1100.0 / height
    base = cv2.resize(bgr, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    canvas = (base * 0.35 + 255 * 0.65).astype(np.uint8)
    rng = np.random.default_rng(3)

    for p in pieces:
        small = cv2.resize(p["mask"], (canvas.shape[1], canvas.shape[0]), interpolation=cv2.INTER_NEAREST)
        color = tuple(int(v) for v in rng.integers(40, 220, 3))
        contours, _ = cv2.findContours(small, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(canvas, contours, -1, color, 2)

    for p in pieces:
        cx, cy = int(p["centroid"][0] * scale), int(p["centroid"][1] * scale)
        size = 0.5 if p["area"] > 8000 else 0.38
        cv2.putText(canvas, str(p["id"]), (cx - 8, cy + 5), cv2.FONT_HERSHEY_SIMPLEX, size, (0, 0, 0), 3, cv2.LINE_AA)
        cv2.putText(canvas, str(p["id"]), (cx - 8, cy + 5), cv2.FONT_HERSHEY_SIMPLEX, size, (255, 255, 255), 1, cv2.LINE_AA)

    folder = folder_of(args.character)
    cv2.imwrite(os.path.join(folder, "pieces.png"), canvas)
    info = [{"id": p["id"], "area": p["area"], "bbox": p["bbox"], "rgb": hexrgb(p["rgb"])} for p in pieces]
    json.dump(info, open(os.path.join(folder, "pieces.json"), "w"), indent=1)
    print(f"{args.character}: {len(pieces)} pieces -> {os.path.join(folder, 'pieces.png')}")
