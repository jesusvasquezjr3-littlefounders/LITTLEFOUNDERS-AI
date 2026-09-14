"""Repairs a Meshy-exported character whose arm is welded to the torso.

    blender --background --python scripts/repair-skin.py

WHY THIS EXISTS. Rho and Liruf ship from Meshy with the inner surface of each
arm fused to the torso and thigh, because they were generated in a pose with the
arms hanging against the body and the surface reconstruction merged whatever it
found touching. Rho's closest hand vertex sat 1.2 cm from his leg and 91
triangles had corners in both a hand and a hip. The auto-rigger then painted
weights across that contact, so 259 arm vertices carried torso and leg weight.

The visible result is that raising his arms dragged the LEGS 0.333 and the torso
0.275 — against Zara's 0.000 and 0.063 — shortening his trousers, narrowing his
waistcoat, and fanning sheets of geometry from each shoulder to the hip.

TWO THINGS MUST HAPPEN TOGETHER AND THE ORDER OF DISCOVERY MATTERS. Cleaning the
weights alone is worse than doing nothing: it lets the hand and the thigh move
independently and pulls the still-welded sheet taut, taking the worst triangle
from x8.9 to x92.4 and doubling the count of severely stretched ones. Cutting
alone leaves the hip following the hand exactly as before. Measured:

    as shipped          6.53% of triangles over 2x area, legs drift 0.333
    weights only        2.99%, worst x92.4, legs drift 0.000
    cut only            5.10%, legs drift 0.333
    both                0.10%, worst x2.9, legs drift 0.000

THE CUT IS ANATOMICAL, NOT GEOMETRIC. An earlier version severed every face
joining the arm region to the body region and produced an arm that hung off the
shoulder in ribbons, because the SHOULDER is how an arm attaches to a torso and
the upper arm meeting the torso is the ARMPIT. Both are real anatomy. Only the
impossible pairs are cut — a hand or forearm touching a hip, a thigh or the
spine; an upper arm touching a leg. `spurious()` is that rule and it is mirrored
in `verify-skin.mjs`, which is what proves the repair worked.

IDEMPOTENT BY CONSTRUCTION. The first run copies each export to
`glb/originals/` and every run — including the first — repairs FROM that copy.
Re-running can therefore never cut a second time or compound a reweight, which
is the failure mode TUTOR_3D.md 4.0a records for the rig at runtime.
"""
import os
import shutil
import sys

import bmesh
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.realpath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
SOURCE_DIR = os.path.join(REPO, "glb")
ORIGINALS_DIR = os.path.join(SOURCE_DIR, "originals")

# Dina is a quadruped on her own 27-joint rig and shares none of this vocabulary.
CHARACTERS = ("Rho", "Liruf", "Zara")

HAND = ("LeftHand", "RightHand")
FORE = ("LeftForeArm", "RightForeArm")
UPPER = ("LeftArm", "RightArm")
SHOULDER = ("LeftShoulder", "RightShoulder")
LEG = ("LeftUpLeg", "RightUpLeg", "LeftLeg", "RightLeg",
       "LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase")
PELVIS = ("Hips",)
SPINE = ("Spine", "Spine01", "Spine02")

ARM_SIDE = {"hand", "fore", "upper"}
BODY_SIDE = {"leg", "pelvis", "spine"}


def class_of(name):
    if name in HAND: return "hand"
    if name in FORE: return "fore"
    if name in UPPER: return "upper"
    if name in SHOULDER: return "shoulder"
    if name in LEG: return "leg"
    if name in PELVIS: return "pelvis"
    if name in SPINE: return "spine"
    return "other"


def spurious(a, b):
    """True when a face or a weight linking bones `a` and `b` cannot be anatomy.

    Kept identical to `spurious()` in verify-skin.mjs. If one of the two ever
    changes, the repair and the gate that judges it stop agreeing about what a
    defect is, and the gate is the only thing standing between this and a
    character that looks wrong on a paying family's screen.
    """
    x, y = class_of(a), class_of(b)
    if x == "other" or y == "other" or x == y:
        return False
    if x in ARM_SIDE and y in ARM_SIDE:
        return False
    if x in BODY_SIDE and y in BODY_SIDE:
        return False
    if x == "shoulder" or y == "shoulder":
        return False
    arm_side = x if x in ARM_SIDE else y
    body_side = y if x in ARM_SIDE else x
    # The armpit reaches the spine, never the pelvis. Liruf's rig hands 365 of
    # his 468 torso vertices, at his WAIST, up to 0.60 of upper-arm weight, and
    # a wider reading of this exemption waved every one of them through.
    if arm_side == "upper" and body_side == "spine":
        return False
    return True


def load(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    # The imported walk cycle is re-evaluated at render and export time and
    # silently overwrites any pose set by hand. Clear it before touching bones.
    for obj in bpy.data.objects:
        if obj.animation_data:
            obj.animation_data_clear()
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"{path}: no mesh")
    mesh = max(meshes, key=lambda o: len(o.data.vertices))
    for other in meshes:
        # Meshy leaves an unskinned 42-vertex Icosphere in these exports.
        if other is not mesh and not other.vertex_groups:
            print(f"    dropped orphan object {other.name} ({len(other.data.vertices)} verts)")
            bpy.data.objects.remove(other, do_unlink=True)
    return mesh


MAX_PASSES = 6

# A face this much smaller than the median, sitting on the cut, is debris.
CRUMB_SHARE = 0.30


def repair(mesh):
    """Purge the weight bleed, then sever the spurious welds and cap what opens.

    The weights go FIRST because every later decision reads a vertex's dominant
    bone, and purging is the thing that makes that reading trustworthy.

    The cut then runs to a FIXED POINT rather than once. Capping an opening
    fans it from a hub vertex whose weights are the average of the rim, and a
    rim borders both sides of the cut, so a single-pass repair hands the hub
    mixed weights and quietly re-bridges the seam it just severed — the same
    mistake `fill_holes` makes, one level subtler. It left 3 welds on Liruf and
    nothing said so except the gate.
    """
    group_name = {g.index: g.name for g in mesh.vertex_groups}

    bm = bmesh.new()
    bm.from_mesh(mesh.data)
    bm.verts.ensure_lookup_table()
    bm.edges.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    uv_layer = bm.loops.layers.uv.active
    deform = bm.verts.layers.deform.active
    if deform is None:
        raise RuntimeError("mesh carries no vertex weights")

    def dominant(vert):
        weights = vert[deform]
        if not weights:
            return None
        return group_name[max(weights.items(), key=lambda kv: kv[1])[0]]

    def purge(verts):
        """Drop every weight that reaches across a spurious pair, and renormalise."""
        changed = 0
        for vert in verts:
            weights = vert[deform]
            top = dominant(vert)
            if top is None:
                continue
            drop = [g for g in weights.keys() if spurious(top, group_name[g])]
            if not drop or len(drop) == len(weights):
                continue
            for group in drop:
                del weights[group]
            total = sum(weights.values())
            if total <= 0:
                continue
            for group in list(weights.keys()):
                weights[group] /= total
            changed += 1
        return changed

    reweighted = purge(bm.verts)

    # Which edges were ALREADY open. These meshes are not watertight — Rho has
    # 278 open boundaries in the hat, glasses and moustache — and an earlier
    # version capped all of them, which re-welded the very seam it had just cut.
    was_open = {e for e in bm.edges if len(e.link_faces) <= 1}
    uv_of = {}
    for face in bm.faces:
        for loop in face.loops:
            uv_of.setdefault(loop.vert.index, loop[uv_layer].uv.copy())

    cut = capped = rim_count = stripped = 0
    for attempt in range(MAX_PASSES):
        dom = {v: dominant(v) for v in bm.verts}
        doomed = [
            face for face in bm.faces
            if any(a and b and spurious(a, b)
                   for i, a in enumerate([dom[v] for v in face.verts])
                   for b in [dom[v] for v in face.verts][i + 1:])
        ]
        if not doomed:
            break
        if attempt == MAX_PASSES - 1:
            # Out of passes: remove what is left and do NOT cap it. A weld that
            # survives is a visible tear; an uncapped hole this deep in an armpit
            # is not, and leaving the weld would defeat the whole repair.
            bmesh.ops.delete(bm, geom=doomed, context="FACES_ONLY")
            cut += len(doomed)
            break

        cut += len(doomed)
        bmesh.ops.delete(bm, geom=doomed, context="FACES_ONLY")
        bm.edges.ensure_lookup_table()
        wire = [e for e in bm.edges if len(e.link_faces) == 0 and e not in was_open]
        if wire:
            bmesh.ops.delete(bm, geom=wire, context="EDGES")
        bm.edges.ensure_lookup_table()
        bm.verts.ensure_lookup_table()

        # Strip the flaps the cut leaves behind. The weld is a ragged sheet, so
        # removing the faces that STRADDLE it leaves slivers whose corners all
        # landed on one side — invisible to the anatomical rule, and visible on
        # screen as thin tongues of cloth standing off Rho's hip once his arm is
        # up. A face hanging by a single edge is such a sliver. Only edges the
        # cut opened count, so the hat brim and the other 278 pre-existing open
        # boundaries are left exactly as they were.
        areas = sorted(f.calc_area() for f in bm.faces)
        crumb = areas[len(areas) // 2] * CRUMB_SHARE if areas else 0.0
        for _ in range(MAX_PASSES):
            opened_now = {e for e in bm.edges if len(e.link_faces) == 1 and e not in was_open}
            if not opened_now:
                break
            flaps = [
                f for f in bm.faces
                # hanging by a single edge, or a crumb of the severed sheet left
                # clinging to the wrong side. The crumbs are hand geometry that
                # stayed with the hip, so they read as SKIN-coloured specks on
                # Rho's trousers the moment his arm goes up — small, but on the
                # one surface a learner is looking at.
                if sum(1 for e in f.edges if e in opened_now) >= 2
                or (any(e in opened_now for e in f.edges) and f.calc_area() < crumb)
            ]
            if not flaps:
                break
            bmesh.ops.delete(bm, geom=flaps, context="FACES_ONLY")
            stripped += len(flaps)
            bm.edges.ensure_lookup_table()
            dangling = [e for e in bm.edges if len(e.link_faces) == 0 and e not in was_open]
            if dangling:
                bmesh.ops.delete(bm, geom=dangling, context="EDGES")
            bm.edges.ensure_lookup_table()
            bm.verts.ensure_lookup_table()

        opened = {e for e in bm.edges if len(e.link_faces) == 1 and e not in was_open}
        rims, seen = [], set()
        for start in opened:
            if start in seen:
                continue
            rim, stack = [], [start]
            seen.add(start)
            while stack:
                edge = stack.pop()
                rim.append(edge)
                for vert in edge.verts:
                    for other in vert.link_edges:
                        if other in opened and other not in seen:
                            seen.add(other)
                            stack.append(other)
            rims.append(rim)

        made = []
        for rim in rims:
            verts = list({v for e in rim for v in e.verts})
            if len(verts) < 3:
                continue
            # A fan from the rim's own centroid closes both closed loops and the
            # open chains left where a weld ran into a pre-existing hole.
            hub = bm.verts.new(sum((v.co for v in verts), Vector()) / len(verts))
            totals = {}
            for vert in verts:
                for group, weight in vert[deform].items():
                    totals[group] = totals.get(group, 0.0) + weight
            scale = sum(totals.values()) or 1.0
            hub_weights = hub[deform]
            for group, weight in totals.items():
                hub_weights[group] = weight / scale
            fallback = sum((uv_of.get(v.index, Vector((0.0, 0.0))) for v in verts),
                           Vector((0.0, 0.0))) / len(verts)
            for edge in rim:
                try:
                    face = bm.faces.new((edge.verts[0], edge.verts[1], hub))
                except ValueError:
                    continue  # the face already exists
                capped += 1
                # The hub's UV is taken per FACE, from the two rim vertices that
                # face actually spans, rather than once from the whole rim. One
                # averaged UV for the entire fan lands wherever the mean of the
                # rim happens to fall in the atlas — which put patches of SKIN on
                # Rho's trousers, visible at both hips the moment he raised his
                # arms. Per-face keeps each cap triangle continuous with the
                # surface it closes.
                near = [uv_of.get(v.index) for v in (edge.verts[0], edge.verts[1])]
                known = [uv for uv in near if uv is not None]
                local = (sum(known, Vector((0.0, 0.0))) / len(known)) if known else fallback
                for loop in face.loops:
                    loop[uv_layer].uv = (local if loop.vert is hub
                                         else uv_of.get(loop.vert.index, local))
            made.append(hub)
        rim_count += len(rims)
        bm.verts.ensure_lookup_table()
        # The hub inherits a rim that straddles the cut, so it can be a weld in
        # its own right. Purge it before the next pass judges the faces it made.
        if made:
            purge(made)

    loose = [v for v in bm.verts if not v.link_faces]
    if loose:
        bmesh.ops.delete(bm, geom=loose, context="VERTS")
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh.data)
    bm.free()
    mesh.data.update()

    return cut, rim_count, capped, stripped, len(loose), reweighted


def main():
    os.makedirs(ORIGINALS_DIR, exist_ok=True)
    touched = 0
    for name in CHARACTERS:
        live = os.path.join(SOURCE_DIR, f"{name}.glb")
        pristine = os.path.join(ORIGINALS_DIR, f"{name}.glb")
        if not os.path.exists(live) and not os.path.exists(pristine):
            print(f"{name}: SKIPPED — no export in /glb/")
            continue
        # Always repair from the pristine copy, so a second run is a no-op rather
        # than a second cut.
        if not os.path.exists(pristine):
            shutil.copy2(live, pristine)
            print(f"{name}: kept the Meshy original at glb/originals/{name}.glb")

        mesh = load(pristine)
        before_v, before_p = len(mesh.data.vertices), len(mesh.data.polygons)
        cut, rims, capped, stripped, loose, reweighted = repair(mesh)
        after_v, after_p = len(mesh.data.vertices), len(mesh.data.polygons)

        if cut == 0 and reweighted == 0:
            print(f"{name}: clean — nothing welded, nothing bled. Left untouched.")
            continue

        bpy.ops.export_scene.gltf(filepath=live, export_format="GLB", use_selection=False)
        touched += 1
        print(f"{name}: cut {cut} welded face(s), stripped {stripped} sliver(s), "
              f"capped {rims} opening(s) with {capped} face(s), "
              f"dropped {loose} loose vert(s), reweighted {reweighted} vert(s)")
        print(f"{name}: {before_v} verts / {before_p} polys  ->  {after_v} / {after_p}")
        print(f"{name}: wrote {live}")

    print(f"\nrepair-skin: {touched} character(s) rewritten. "
          f"Now run `npm run verify:skin` — it is what proves this worked.")


if __name__ == "__main__":
    main()
