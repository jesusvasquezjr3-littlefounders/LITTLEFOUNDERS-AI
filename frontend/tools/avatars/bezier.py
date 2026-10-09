"""Fits smooth cubic Bezier curves to a run of points with as few segments as the tolerance allows
(Schneider's algorithm, "An Algorithm for Automatically Fitting Digitized Curves", Graphics Gems, 1990).

Used by vectorize.py so a head outline becomes a few well-placed curve segments instead of hundreds of points.
"""
import numpy as np


def _unit(v):
    n = np.linalg.norm(v)

    return v / n if n > 1e-12 else v


def _chord_params(points):
    d = np.r_[0.0, np.cumsum(np.linalg.norm(np.diff(points, axis=0), axis=1))]

    return d / d[-1] if d[-1] > 0 else d


def _bezier_at(c, t):
    t = np.asarray(t)[:, None]
    mt = 1 - t

    return mt ** 3 * c[0] + 3 * mt ** 2 * t * c[1] + 3 * mt * t ** 2 * c[2] + t ** 3 * c[3]


def _generate(points, u, tl, tr):
    p0, p3 = points[0], points[-1]
    b1 = 3 * (1 - u) ** 2 * u
    b2 = 3 * (1 - u) * u ** 2
    a1 = tl[None, :] * b1[:, None]
    a2 = tr[None, :] * b2[:, None]
    c00 = np.sum(a1 * a1)
    c01 = np.sum(a1 * a2)
    c11 = np.sum(a2 * a2)
    base = _bezier_at(np.array([p0, p0, p3, p3]), u)
    rest = points - base
    x0 = np.sum(a1 * rest)
    x1 = np.sum(a2 * rest)
    det = c00 * c11 - c01 * c01
    seg = np.linalg.norm(p3 - p0)
    eps = 1e-6 * seg

    if abs(det) > 1e-12:
        alpha1 = (x0 * c11 - x1 * c01) / det
        alpha2 = (c00 * x1 - c01 * x0) / det
    else:
        alpha1 = alpha2 = 0.0

    if alpha1 < eps or alpha2 < eps:
        alpha1 = alpha2 = seg / 3.0

    return np.array([p0, p0 + tl * alpha1, p3 + tr * alpha2, p3])


def _newton(c, point, t):
    c1 = 3 * (c[1:] - c[:-1])
    c2 = 2 * (c1[1:] - c1[:-1])
    mt = 1 - t
    d = mt ** 3 * c[0] + 3 * mt ** 2 * t * c[1] + 3 * mt * t ** 2 * c[2] + t ** 3 * c[3] - point
    d1 = mt ** 2 * c1[0] + 2 * mt * t * c1[1] + t ** 2 * c1[2]
    d2 = mt * c2[0] + t * c2[1]
    den = np.dot(d1, d1) + np.dot(d, d2)

    return t if abs(den) < 1e-12 else t - np.dot(d, d1) / den


def _max_error(points, c, u):
    d = np.sum((_bezier_at(c, u) - points) ** 2, axis=1)
    i = int(np.argmax(d))

    return d[i], i


def _fit(points, tl, tr, error):
    n = len(points)

    if n == 2:
        dist = np.linalg.norm(points[0] - points[1]) / 3.0

        return [np.array([points[0], points[0] + tl * dist, points[1] + tr * dist, points[1]])]

    u = _chord_params(points)
    c = _generate(points, u, tl, tr)
    err, split = _max_error(points, c, u)

    if err < error:
        return [c]

    if err < error * 16:
        for _ in range(12):
            u = np.array([_newton(c, p, t) for p, t in zip(points, u)])
            c = _generate(points, u, tl, tr)
            err, split = _max_error(points, c, u)
            if err < error:
                return [c]

    split = min(max(split, 1), n - 2)
    center = _unit(points[split - 1] - points[split + 1])

    return _fit(points[: split + 1], tl, center, error) + _fit(points[split:], -center, tr, error)


def fit_open(points, tolerance):
    """Bezier segments (each a 4x2 array) through an open run of points, within `tolerance` pixels."""
    points = np.asarray(points, dtype=np.float64)

    if len(points) < 2:
        return []

    tl = _unit(points[1] - points[0])
    tr = _unit(points[-2] - points[-1])

    return _fit(points, tl, tr, tolerance ** 2)


def corners_of(points, window=8, degrees=55.0):
    """Indices of sharp corners on a closed outline (turn over `window` points on each side above `degrees`)."""
    n = len(points)
    if n < 2 * window + 3:
        return []
    prev = points - np.roll(points, window, axis=0)
    nxt = np.roll(points, -window, axis=0) - points
    cos = np.sum(prev * nxt, axis=1) / (np.linalg.norm(prev, axis=1) * np.linalg.norm(nxt, axis=1) + 1e-12)
    turn = np.degrees(np.arccos(np.clip(cos, -1, 1)))
    out = []

    for i in range(n):
        if turn[i] > degrees and turn[i] >= turn[(np.arange(i - window, i + window + 1)) % n].max() - 1e-9:
            out.append(i)

    # keep corners at least `window` points apart
    kept = []
    for i in out:
        if not kept or i - kept[-1] >= window:
            kept.append(i)

    return kept


def fit_closed(points, tolerance, corner_degrees=55.0):
    """Closed outline to Bezier segments, split at sharp corners; returns (segments, node_count)."""
    points = np.asarray(points, dtype=np.float64)
    n = len(points)
    cuts = corners_of(points, degrees=corner_degrees)
    segments = []

    if not cuts:
        a, b = 0, n // 2
        run1 = points[a : b + 1]
        run2 = np.vstack([points[b:], points[:1]])
        t = _unit(points[(a + 1) % n] - points[a - 1])
        t2 = _unit(points[(b + 1) % n] - points[b - 1])
        segments += _fit(run1, t, -t2, tolerance ** 2)
        segments += _fit(run2, t2, -t, tolerance ** 2)

        return segments

    for i, start in enumerate(cuts):
        end = cuts[(i + 1) % len(cuts)]
        run = points[start : end + 1] if end > start else np.vstack([points[start:], points[: end + 1]])
        if len(run) >= 2:
            segments += fit_open(run, tolerance)

    return segments


def to_path(segments):
    if not segments:
        return ""
    d = f"M{segments[0][0][0]:.1f} {segments[0][0][1]:.1f}"
    for c in segments:
        d += f"C{c[1][0]:.1f} {c[1][1]:.1f} {c[2][0]:.1f} {c[2][1]:.1f} {c[3][0]:.1f} {c[3][1]:.1f}"

    return d + "Z"
