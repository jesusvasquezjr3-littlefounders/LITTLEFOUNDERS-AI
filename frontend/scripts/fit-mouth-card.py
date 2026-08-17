# Fits a character's mouth card to their face, and writes the baked grid that
# `src/tutor-scene/mouthCards.generated.json` is built from.
#
# Run inside Blender — either through the MCP extension's `execute` socket or
#   blender --background --python frontend/scripts/fit-mouth-card.py
# with CHARACTER/MOUTH_RECT set in the surrounding scope (see MOUTHS below).
#
# WHY A FITTED GRID AND NOT A QUAD: the face bulges about 1.6 cm forward across
# the mouth's 8.6 cm width. A flat card tangent at the centre stands that far
# off the cheek at its corners — invisible head-on, obvious the moment the
# camera orbits, and the scene's camera orbits continuously.
#
# THREE THINGS HERE COST REAL TIME. Do not undo them:
#
#   1. `bpy.ops.wm.read_homefile()` INVALIDATES the context the MCP timer runs
#      in, after which `bpy.context.object` raises AttributeError rather than
#      returning None — and Blender 5.2's glTF importer reads that attribute
#      while building the armature display, so the import dies before creating
#      a single node. Clear the scene by removing objects instead.
#   2. The importer also needs SOME active object to exist, so an anchor empty
#      is created before importing and removed after.
#   3. A long ray fired at the face does not necessarily hit the FACE. Near the
#      card's corners it sails past the cheek and strikes the back of the skull,
#      reporting hit=True 30 cm behind the mouth. That is not a miss, so a
#      hit/miss check never sees it; the card still looked plausible in a front
#      render while its UVs sheared across the depth gradient and skewed the
#      whole mouth. The search is bounded to a slab around the mouth so the
#      wrong surface cannot be found at all.
import json
import math
import bpy
from mathutils import Vector

# Mouth rectangles, measured off a gridded front render of each character
# (Workbench, flat shading, known ortho scale) and converted with that render's
# own metres-per-pixel. Never estimated by eye.
#
#   centre  — mouth centre in Blender world space (x, z); depth is raycast.
#   size    — card width and height in metres. WIDER and TALLER than the painted
#             mouth it covers, by the margin the feathered alpha fades over.
#   depth   — half-thickness of the slab rays may hit in, in metres. Scales with
#             the card: Liruf's snout curves far more across his 58 cm card than
#             Zara's cheek does across her 13.5 cm one, and Zara's tolerance
#             applied to him rejects most of his grin.
#   projection — "planar" fires every ray straight back along -Y. That works on
#             a shallow, forward-facing face like Zara's. It FAILS on a snout:
#             Liruf's grin wraps around the sides of a long muzzle, a front
#             projection compresses those sides to nothing, and the fitted card
#             left the painted grin's corners showing while the card itself
#             folded over in three-quarter view. "cylindrical" fans the rays out
#             from an axis inside the head instead, so the card wraps with the
#             mouth.
MOUTHS = {
    "Zara": {
        "centre": (-0.00254, 1.30408),
        "size": (0.135, 0.0675),
        "depth": 0.05,
        "projection": "planar",
    },
    # Rho's card ADDS a mouth rather than covering one: nothing is painted
    # under his moustache. It is deliberately small and sits inside the clean
    # skin patch between the moustache's centre and his chin, because a card
    # edge straying onto that near-black moustache would be obvious.
    "Rho": {
        "centre": (0.006, 0.925),
        "size": (0.078, 0.039),
        "depth": 0.04,
        "projection": "planar",
    },
    # Liruf's grin is an ARC, and that defeated both simpler projections. A
    # planar fit compressed the sides of his muzzle to nothing and left the
    # painted corners showing; a cylindrical fit swept a band of FIXED HEIGHT
    # around the snout, which a mouth whose height varies with the angle does
    # not follow either. So his card is a RIBBON: the mouth line is traced as a
    # curve through three measured points and the card is built along it, which
    # means the curve lives in the GEOMETRY and his atlas frames can be drawn
    # straight like everyone else's.
    # Dina's mouth is a thin painted CURVE, not an open shape — much less to
    # cover than Liruf's grin, which is why the ribbon that fell short on him is
    # the right tool here. Her numbers look wrong until you remember she was
    # exported in Unreal scale: everything is ~25x smaller than the others and
    # is blown back up at runtime.
    # The curve sits 0.0008 HIGHER than first measured, and that one number is
    # the difference between a card and a crumpled blob. Her mouth is a thin
    # line just above a chin that falls away steeply: with the band centred on
    # the first estimate, its bottom row cleared the chin entirely and landed on
    # her throat 1.9 cm behind — five times the band's own height — so the patch
    # folded back on itself and vanished inside her head.
    #
    # Measured by firing the ribbon's own rays and reporting the spread of first
    # -surface depths. Raising the curve takes that spread from 0.01899 to
    # 0.00594. Every ray hits, and none hits a back face, so this was never a
    # cavity problem — the band was simply below the mouth.
    "Dina": {
        "projection": "ribbon",
        "curve": ((-0.0038, 0.0150), (0.0, 0.01297), (0.0038, 0.0150)),
        "band": 0.0038,
        "depth": 0.0025,
        "gap": 0.00014,
    },
    "Liruf": {
        "projection": "ribbon",
        # Left corner, centre, right corner of the mouth LINE, in Blender world
        # (x, z). Measured off a gridded front render at a known ortho scale.
        #
        # WIDENED from (-0.1489 .. 0.2085) after the first fit shipped nothing:
        # the painted grin leaked past BOTH ends of the card, which is not a
        # depth or projection problem and no amount of tuning those fixed it.
        # Re-measured against a front render at ortho 0.62 centred on (0.03,
        # 0.90): the grin actually runs -0.191 to 0.237, so the card was ~4 cm
        # short on each side. The ends are NOT symmetric because his model is
        # not — the same asymmetry that leaves his rig without a mirror (§4.2).
        "curve": ((-0.205, 0.9180), (0.0309, 0.8450), (0.2500, 0.9180)),
        # Band height across the mouth line, in metres. The painted grin is
        # 0.084 m at its centre; the rest is the margin the feather fades over.
        "band": 0.155,
        "depth": 0.075,
    },
}

COLS, ROWS = 11, 7
# Gap between card and skin, along the surface normal. Grid density matters as
# much as the gap: the card is a bilinear patch BETWEEN samples and the face
# bulges between them, so at 7x5 the real surface rose through the card and the
# face punched a hole in the mouth.
#
# This is in the MODEL'S OWN UNITS, which are not the same units for everyone.
# Dina was exported in Unreal scale and is blown up ~25x at runtime, so the
# 3.5 mm that is right for Zara would stand 9 cm off Dina's face. Per-character
# `gap` overrides exist for exactly that.
GAP = 0.0035


def purge_orphans():
    for _ in range(4):
        removed = 0
        for collection in (
            bpy.data.meshes, bpy.data.armatures, bpy.data.actions,
            bpy.data.materials, bpy.data.images, bpy.data.node_groups,
        ):
            for block in list(collection):
                if block.users == 0:
                    collection.remove(block)
                    removed += 1
        if not removed:
            break


def import_glb(path):
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    purge_orphans()
    # A stray mesh left in the scene is not cosmetic: `scene.ray_cast` tests
    # EVERYTHING, so one forgotten primitive in front of a face silently becomes
    # the surface the whole card is fitted to. An 80-poly Icosphere survived a
    # clear during this work and went unnoticed precisely because it happened
    # not to sit on the ray that was being watched.
    if bpy.data.objects:
        raise RuntimeError(
            "fit-mouth-card: scene not empty after clear — {} would be raycast "
            "against. Close whatever is re-creating it and retry.".format(
                [o.name for o in bpy.data.objects]
            )
        )
    anchor = bpy.data.objects.new("mcp_import_anchor", None)
    bpy.context.scene.collection.objects.link(anchor)
    bpy.context.view_layer.objects.active = anchor
    bpy.ops.import_scene.gltf(filepath=path)
    if anchor.name in bpy.data.objects:
        bpy.data.objects.remove(anchor, do_unlink=True)
    return [o for o in bpy.data.objects if o.type == 'MESH']


def circle_through(p0, p1, p2):
    """Centre of the circle through three points in the XY plane.

    Used to find the muzzle's axis from the mouth's own surface rather than
    guessing where the middle of a snout is. Returns None when the points are
    collinear, which is the honest answer for a flat face.
    """
    ax, ay = p0
    bx, by = p1
    cx, cy = p2
    d = 2.0 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
    if abs(d) < 1e-9:
        return None
    a2 = ax * ax + ay * ay
    b2 = bx * bx + by * by
    c2 = cx * cx + cy * cy
    ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d
    uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d
    return (ux, uy)


def bezier(p0, p1, p2, t):
    """Quadratic Bezier whose curve PASSES THROUGH p1 at t=0.5.

    The control point is solved for rather than used directly: p1 is a MEASURED
    point on the mouth, so a curve that merely leans toward it would not sit on
    the grin.
    """
    control = (
        2.0 * p1[0] - 0.5 * (p0[0] + p2[0]),
        2.0 * p1[1] - 0.5 * (p0[1] + p2[1]),
    )
    u = 1.0 - t
    return (
        u * u * p0[0] + 2 * u * t * control[0] + t * t * p2[0],
        u * u * p0[1] + 2 * u * t * control[1] + t * t * p2[1],
    )


def fit_ribbon(character, spec, dg):
    """Build a card that FOLLOWS the mouth line instead of spanning a box.

    For a grin that arcs around a muzzle, a rectangle is the wrong primitive at
    every orientation: swept flat it loses the sides, swept cylindrically it
    keeps a constant height the mouth does not have. Tracing the line and
    building a band across it puts the curve in the geometry, which also means
    the atlas frames stay straight and the ellipse shape family still applies.
    """
    left, centre, right = spec["curve"]
    band = spec["band"]
    tolerance = spec["depth"]
    gap = spec.get("gap", GAP)

    # An axis inside the muzzle, so rays fan outward and reach the sides of the
    # grin instead of grazing them.
    samples = []
    for point in (left, centre, right):
        ok, loc, _n, _a, _b, _c = bpy.context.scene.ray_cast(
            dg, Vector((point[0], -3.0, point[1])), Vector((0.0, 1.0, 0.0))
        )
        if not ok:
            raise RuntimeError("{:s}: curve point {} misses the head".format(character, point))
        samples.append((loc.x, loc.y))
    # A ribbon FOLLOWS the mouth line; how its rays are FIRED is a separate
    # question, and answering both with one mechanism is what collapsed Dina's
    # card. Fitting a circle through her three surface points gives a huge
    # radius, because a flat face makes them nearly collinear — and then
    # `abs(distance - radius) <= tolerance` is a knife edge that rejects almost
    # every vertex, leaving a crumpled scrap of a card.
    #
    # So the curvature is MEASURED and the ray mode follows from it: a real
    # muzzle gets radial rays, a flat face gets parallel ones.
    axis = circle_through(*samples)
    half_width = abs(right[0] - left[0]) / 2.0
    radius = math.dist(samples[1], axis) if axis is not None else float("inf")
    radial = axis is not None and radius < half_width * 8.0
    if not radial:
        # Flat enough to treat as a plane. Fire straight back, from in front.
        axis = (samples[1][0], samples[1][1] - max(half_width, tolerance) * 2.0)
        radius = abs(samples[1][1] - axis[1])

    # Same split the planar fit uses: each grid point owns a RAY, and the only
    # unknown is how far along it the surface sits. Gaps are filled in DISTANCE
    # so a patched vertex stays on its own ray and the UV grid survives.
    ray_origin = [[None] * COLS for _ in range(ROWS)]
    ray_dir = [[None] * COLS for _ in range(ROWS)]
    distance = [[None] * COLS for _ in range(ROWS)]
    normal = [[None] * COLS for _ in range(ROWS)]

    for j in range(ROWS):
        for i in range(COLS):
            t = i / (COLS - 1)
            x, z_on_curve = bezier(left, centre, right, t)
            z = z_on_curve + (j / (ROWS - 1) - 0.5) * band

            # Fire outward from the axis THROUGH the curve point, so the ray
            # meets the surface square-on wherever it sits around the snout.
            # The traced point supplies the angle; the axis supplies the origin.
            if radial:
                outward = Vector((x - axis[0], samples[1][1] - axis[1], 0.0))
                if outward.length < 1e-6:
                    outward = Vector((0.0, -1.0, 0.0))
                outward.normalize()
                origin = Vector((axis[0], axis[1], z))
            else:
                outward = Vector((0.0, 1.0, 0.0))
                origin = Vector((x, axis[1], z))
            ray_origin[j][i] = origin
            ray_dir[j][i] = outward
            ok, loc, nrm, _a, _b, _c = bpy.context.scene.ray_cast(
                dg, origin, outward, distance=radius + tolerance
            )
            if ok and abs((loc - origin).length - radius) <= tolerance:
                distance[j][i] = (loc - origin).length
                normal[j][i] = nrm.copy()

    # Grow the unknown distances outward from their neighbours. The earlier
    # version parked a missing vertex at the CENTRE's depth instead, which threw
    # it off its own ray and scattered stray card triangles across Liruf's chest
    # in three-quarter view — visible as loose white teeth floating beside his
    # arm.
    for _ in range(COLS + ROWS):
        if not any(distance[j][i] is None for j in range(ROWS) for i in range(COLS)):
            break
        for j in range(ROWS):
            for i in range(COLS):
                if distance[j][i] is not None:
                    continue
                around = [
                    distance[nj][ni]
                    for nj, ni in ((j - 1, i), (j + 1, i), (j, i - 1), (j, i + 1))
                    if 0 <= nj < ROWS and 0 <= ni < COLS and distance[nj][ni] is not None
                ]
                if around:
                    distance[j][i] = sum(around) / len(around)
                    normal[j][i] = ray_dir[j][i].copy()

    if any(distance[j][i] is None for j in range(ROWS) for i in range(COLS)):
        raise RuntimeError("{:s}: no ray met the muzzle anywhere".format(character))

    positions = []
    for j in range(ROWS):
        for i in range(COLS):
            v = ray_origin[j][i] + ray_dir[j][i] * distance[j][i]
            v = v + (normal[j][i] or ray_dir[j][i]) * gap
            positions.append([round(v.x, 8), round(v.z, 8), round(-v.y, 8)])
    return positions


def fit(character, source_glb):
    spec = MOUTHS[character]
    projection = spec.get("projection", "planar")
    import_glb(source_glb)
    dg = bpy.context.evaluated_depsgraph_get()

    if projection == "ribbon":
        return fit_ribbon(character, spec, dg)

    centre_x, centre_z = spec["centre"]
    card_w, card_h = spec["size"]
    depth_tolerance = spec["depth"]
    ray_start_offset = depth_tolerance * 1.6
    gap = spec.get("gap", GAP)

    # The face points -Y in Blender (= +Z in the glTF the runtime loads),
    # confirmed by the `headfront` bone direction AND a four-way render.
    hit, c_loc, c_nrm, _i, _o, _m = bpy.context.scene.ray_cast(
        dg, Vector((centre_x, -1.0, centre_z)), Vector((0.0, 1.0, 0.0))
    )
    if not hit:
        raise RuntimeError("{:s}: mouth centre does not hit the face".format(character))

    axis = None
    radius = 0.0
    if projection == "cylindrical":
        # Find the muzzle's axis from the mouth's own surface: sample the left,
        # centre and right of the mouth line and fit a circle through them.
        samples = []
        for frac in (-0.42, 0.0, 0.42):
            x = centre_x + frac * card_w
            ok, loc, _n, _a, _b, _c = bpy.context.scene.ray_cast(
                dg, Vector((x, -3.0, centre_z)), Vector((0.0, 1.0, 0.0))
            )
            if ok:
                samples.append((loc.x, loc.y))
        if len(samples) == 3:
            axis = circle_through(*samples)
        if axis is None:
            raise RuntimeError("{:s}: could not fit a muzzle axis".format(character))
        radius = ((samples[1][0] - axis[0]) ** 2 + (samples[1][1] - axis[1]) ** 2) ** 0.5

    # Each grid point owns a RAY whose direction is fixed by the projection; the
    # only unknown is how far along it the surface sits. Keeping that split is
    # what preserves the card's UV grid — an earlier version filled gaps by
    # averaging whole 3D points, which dragged their x and z off the grid and
    # silently moved Zara's card 4.7 cm.
    ray_origin = [[None] * COLS for _ in range(ROWS)]
    ray_direction = [[None] * COLS for _ in range(ROWS)]
    distance = [[None] * COLS for _ in range(ROWS)]
    normal = [[None] * COLS for _ in range(ROWS)]
    sweep = math.radians(spec.get("sweep", 0.0))

    for j in range(ROWS):
        for i in range(COLS):
            fx = i / (COLS - 1) - 0.5
            z = centre_z + (j / (ROWS - 1) - 0.5) * card_h
            if projection == "cylindrical":
                # Fire OUTWARD from inside the muzzle, so the first thing hit is
                # the surface the card must sit on.
                theta = fx * 2.0 * sweep
                direction = Vector((math.sin(theta), -math.cos(theta), 0.0))
                origin = Vector((axis[0], axis[1], z))
                ok, loc, nrm, _a, _b, _c = bpy.context.scene.ray_cast(
                    dg, origin, direction, distance=radius + depth_tolerance
                )
                accept = ok and abs((loc - origin).length - radius) <= depth_tolerance
            else:
                x = centre_x + fx * card_w
                origin = Vector((x, c_loc.y - ray_start_offset, z))
                direction = Vector((0.0, 1.0, 0.0))
                ok, loc, nrm, _a, _b, _c = bpy.context.scene.ray_cast(
                    dg, origin, direction,
                    distance=ray_start_offset + depth_tolerance,
                )
                accept = ok and abs(loc.y - c_loc.y) <= depth_tolerance
            ray_origin[j][i] = origin
            ray_direction[j][i] = direction
            if accept:
                distance[j][i] = (loc - origin).length
                normal[j][i] = nrm.copy()

    # Corners with no surface under them have run off onto the jaw. Snapping
    # them to the tangent plane made the card's SILHOUETTE jump — a skin-coloured
    # tab past the cheek, invisible under flat shading and certain to catch the
    # scene's real lighting. Growing depth outward from valid neighbours instead
    # keeps the patch continuous.
    # Fill on the FULL 3D point, not on depth alone. Under a cylindrical
    # projection a vertex's x moves with its angle, so patching only y would
    # leave a hole's x sitting wherever the planar formula happened to put it.
    for _ in range(COLS + ROWS):
        if not any(distance[j][i] is None for j in range(ROWS) for i in range(COLS)):
            break
        for j in range(ROWS):
            for i in range(COLS):
                if distance[j][i] is not None:
                    continue
                around = [
                    distance[nj][ni]
                    for nj, ni in ((j - 1, i), (j + 1, i), (j, i - 1), (j, i + 1))
                    if 0 <= nj < ROWS and 0 <= ni < COLS and distance[nj][ni] is not None
                ]
                if around:
                    distance[j][i] = sum(around) / len(around)
                    normal[j][i] = c_nrm.copy()

    if any(distance[j][i] is None for j in range(ROWS) for i in range(COLS)):
        raise RuntimeError(
            "{:s}: no ray hit the surface anywhere — the mouth rect is wrong".format(character)
        )

    positions = []
    for j in range(ROWS):
        for i in range(COLS):
            v = ray_origin[j][i] + ray_direction[j][i] * distance[j][i]
            v = v + (normal[j][i] or c_nrm) * gap
            # Blender is Z-up, the runtime's glTF is Y-up.
            positions.append([round(v.x, 6), round(v.z, 6), round(-v.y, 6)])
    return positions


if __name__ == "__main__":
    character = globals().get("CHARACTER", "Zara")
    source = globals().get(
        "SOURCE_GLB",
        r"C:\Users\mel_f\OneDrive\Escritorio\LITTLEFOUNDERS-AI\glb\{:s}.glb".format(character),
    )
    out = globals().get("OUT_JSON", "mouth-card-{:s}.json".format(character.lower()))
    with open(out, "w", encoding="utf-8") as fh:
        json.dump({"cols": COLS, "rows": ROWS, "positions": fit(character, source)}, fh)
    print("fit-mouth-card: wrote {:s}".format(out))
