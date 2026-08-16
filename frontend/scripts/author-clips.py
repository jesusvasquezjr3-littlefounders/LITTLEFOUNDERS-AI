# Authors the Tutor's canonical animation clips on the shared biped skeleton.
#
# Run inside Blender — through the MCP extension's `execute` socket, or
#   blender --background --python frontend/scripts/author-clips.py
#
# WHY A SEPARATE CLIP LIBRARY AND NOT CLIPS PER CHARACTER: rho, zara and liruf
# share ONE 24-joint skeleton with identical bone names, and a three.js
# AnimationClip binds to nodes BY NAME. So one exported armature carrying every
# clip drives all three characters, and re-authoring a gesture is one edit
# rather than three exports. Dina is a quadruped on her own 27-joint rig and is
# not covered here.
#
# WHY HAND-POSED KEYS AND NOT GENERATED CURVES: the runtime already synthesises
# all 19 states from sinusoids (`src/tutor-scene/characterActions.ts`).
# Re-emitting those same curves as baked keyframes would be a lateral move —
# the same motion, less adjustable. What a clip can do that the procedural
# layer cannot is ANTICIPATION (move against the gesture before it starts),
# WEIGHT SHIFT (the hips answer the limbs) and FOLLOW-THROUGH (the body settles
# after the gesture stops). Every pose table below is built around those three.
#
# Rotations are degrees, applied in each pose bone's own space, which on this
# rig has +Y running along the bone: X pitches, Z swings, Y twists.
import json
import math
import bpy
from mathutils import Euler

FPS = 30
SOURCE_GLB = r"C:\Users\mel_f\OneDrive\Escritorio\LITTLEFOUNDERS-AI\glb\Zara.glb"

# Loop set must agree with LOOPING_ACTIONS in src/tutor-scene/characterActions.ts.
LOOPING = {"idle", "celebrate", "dance"}

# frame -> {bone: (x, y, z) degrees}. Frame 0 is the rest pose unless stated.
CLIPS = {
    # A LOOPING clip's first and last key must be identical or the cycle jumps
    # once per repetition — the one defect in a loop that no still frame shows.
    "idle": {
        "frames": 120,
        "keys": [
            (0, {"Spine01": (-1.0, 0, 0), "Hips": (0, 0, 1.2), "Head": (0, 1.5, 0)}),
            # Weight rolls onto one leg and the shoulders answer the hips in the
            # OPPOSITE direction. That counter-rotation is what stops an idle
            # reading as a mannequin swaying in one piece.
            (30, {"Spine01": (1.2, 0, 0), "Spine02": (0, 0, -1.4), "Hips": (0, 0, -1.2),
                  "Head": (0, -1.2, 0.6), "neck": (-0.8, 0, 0)}),
            (60, {"Spine01": (-1.0, 0, 0), "Hips": (0, 0, 1.2), "Head": (0, 1.5, 0)}),
            (90, {"Spine01": (1.4, 0, 0), "Spine02": (0, 0, 1.2), "Hips": (0, 0, -1.0),
                  "Head": (0, 1.0, -0.8), "neck": (-0.6, 0, 0)}),
            (120, {"Spine01": (-1.0, 0, 0), "Hips": (0, 0, 1.2), "Head": (0, 1.5, 0)}),
        ],
    },

    "nod": {
        "frames": 30,
        "keys": [
            (0, {}),
            # The chin lifts BEFORE it drops. Skipping this is what makes a
            # procedural nod read as a hinge rather than agreement.
            (4, {"Head": (-7, 0, 0), "neck": (-3, 0, 0)}),
            (10, {"Head": (16, 0, 0), "neck": (7, 0, 0), "Spine02": (2, 0, 0)}),
            (16, {"Head": (-3, 0, 0), "neck": (-1, 0, 0)}),
            (22, {"Head": (11, 0, 0), "neck": (5, 0, 0), "Spine02": (1, 0, 0)}),
            (30, {}),
        ],
    },

    "bow": {
        "frames": 54,
        "keys": [
            (0, {}),
            # Anticipation: the chest opens and the head lifts before folding.
            (7, {"Spine01": (-6, 0, 0), "Spine02": (-4, 0, 0), "Head": (-6, 0, 0),
                 "LeftArm": (0, 0, -6), "RightArm": (0, 0, 6)}),
            # The fold comes from the HIPS and spine together; arms hang and lag
            # behind the torso rather than travelling with it.
            #
            # These angles ACCUMULATE down the chain, and the first pass ignored
            # that: 24 + 10 + 12 + 10 + 6 + 10 summed to 72 degrees at the head
            # and folded her face to the floor. A greeting bow is about 40 at
            # the head, so the per-joint numbers have to be read as a total.
            #
            # The legs are deliberately NOT rotated. Turning the thigh takes the
            # foot with it, which put her on tiptoe and read as tipping over —
            # a real bow moves the hips BACK, which is root translation, not a
            # thigh rotation.
            (20, {"Hips": (10, 0, 0), "Spine": (6, 0, 0), "Spine01": (7, 0, 0),
                  "Spine02": (6, 0, 0), "neck": (3, 0, 0), "Head": (5, 0, 0),
                  "LeftArm": (0, 0, -12), "RightArm": (0, 0, 12)}),
            # Head arrives LAST and settles deepest — follow-through.
            (27, {"Hips": (11, 0, 0), "Spine": (6, 0, 0), "Spine01": (8, 0, 0),
                  "Spine02": (6, 0, 0), "neck": (5, 0, 0), "Head": (9, 0, 0),
                  "LeftArm": (0, 0, -15), "RightArm": (0, 0, 15)}),
            (40, {"Hips": (3, 0, 0), "Spine01": (2, 0, 0), "Head": (1, 0, 0),
                  "LeftArm": (0, 0, -4), "RightArm": (0, 0, 4)}),
            # Overshoot slightly past upright, then settle.
            (47, {"Spine01": (-3, 0, 0), "Head": (-4, 0, 0)}),
            (54, {}),
        ],
    },

    "celebrate": {
        "frames": 54,
        "keys": [
            # Both arms overhead, bouncing. Loops, so first and last key match.
            #
            # SIGNS ARE MIRRORED, and getting them backwards does not look like
            # a mistake — it looks like a pose. At LeftArm +128 / RightArm -128
            # she folded both arms ACROSS her chest, a perfectly plausible
            # gesture that simply was not celebration. `wave` had already
            # established that RightArm +Z swings OUTWARD, so the left arm must
            # be negative. And 128 is nowhere near vertical: +92 is roughly
            # horizontal, so overhead needs ~160.
            (0, {"LeftArm": (0, 0, -138), "RightArm": (0, 0, 138),
                 "LeftForeArm": (0, 0, -4), "RightForeArm": (0, 0, 4),
                 "LeftShoulder": (0, 0, -7), "RightShoulder": (0, 0, 7),
                 "Spine02": (-6, 0, 0), "Head": (-8, 0, 0)}),
            (14, {"LeftArm": (0, 0, -150), "RightArm": (0, 0, 150),
                  "LeftForeArm": (0, 0, 2), "RightForeArm": (0, 0, -2),
                  "LeftShoulder": (0, 0, -9), "RightShoulder": (0, 0, 9),
                  "Spine02": (-11, 0, 0), "Spine01": (-4, 0, 0), "Head": (-13, 0, 0),
                  "Hips": (-3, 0, 0)}),
            (27, {"LeftArm": (0, 0, -138), "RightArm": (0, 0, 138),
                  "LeftForeArm": (0, 0, -4), "RightForeArm": (0, 0, 4),
                  "LeftShoulder": (0, 0, -7), "RightShoulder": (0, 0, 7),
                  "Spine02": (-6, 0, 0), "Head": (-8, 0, 0)}),
            (41, {"LeftArm": (0, 0, -153), "RightArm": (0, 0, 153),
                  "LeftForeArm": (0, 0, 3), "RightForeArm": (0, 0, -3),
                  "LeftShoulder": (0, 0, -10), "RightShoulder": (0, 0, 10),
                  "Spine02": (-12, 0, 0), "Spine01": (-5, 0, 0), "Head": (-14, 0, 0),
                  "Hips": (-3, 0, 0)}),
            (54, {"LeftArm": (0, 0, -138), "RightArm": (0, 0, 138),
                  "LeftForeArm": (0, 0, -4), "RightForeArm": (0, 0, 4),
                  "LeftShoulder": (0, 0, -7), "RightShoulder": (0, 0, 7),
                  "Spine02": (-6, 0, 0), "Head": (-8, 0, 0)}),
        ],
    },

    "wave": {
        "frames": 48,
        "keys": [
            # Anticipation: the arm drops and the chest turns AWAY before the
            # wave, which is what stops it reading as a mechanical lift.
            (0, {}),
            (5, {"RightArm": (0, 0, -14), "Spine02": (0, -4, -3), "Head": (0, -5, 0)}),
            # Arm up, chest opens toward the viewer, weight goes onto the left leg.
            (13, {"RightArm": (0, 0, 92), "RightForeArm": (0, 0, 22), "RightShoulder": (0, 0, 12),
                  "Spine02": (0, 6, 4), "Spine01": (0, 3, 2), "Head": (0, 6, -3),
                  "Hips": (0, 0, -2)}),
            # Two waves from the forearm only. A whole-arm wave from the
            # shoulder reads as marshalling an aircraft.
            (21, {"RightArm": (0, 0, 92), "RightForeArm": (0, 0, -14), "RightShoulder": (0, 0, 12),
                  "Spine02": (0, 6, 4), "Head": (0, 6, -3), "Hips": (0, 0, -2)}),
            (28, {"RightArm": (0, 0, 95), "RightForeArm": (0, 0, 24), "RightShoulder": (0, 0, 12),
                  "Spine02": (0, 6, 4), "Head": (0, 6, -3), "Hips": (0, 0, -2)}),
            (35, {"RightArm": (0, 0, 92), "RightForeArm": (0, 0, -10), "RightShoulder": (0, 0, 10),
                  "Spine02": (0, 5, 3), "Head": (0, 5, -2), "Hips": (0, 0, -2)}),
            # Follow-through: the arm passes THROUGH rest and settles back up to
            # it, so the limb has weight instead of snapping to a stop.
            (43, {"RightArm": (0, 0, -8), "RightForeArm": (0, 0, 4), "Spine02": (0, 1, -1)}),
            (48, {}),
        ],
    },
}


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


def import_rig(path):
    """Import the source export and return its armature.

    `read_homefile` is NOT used to clear the scene: it invalidates the context
    the MCP timer runs in, and Blender 5.2's glTF importer then dies reading
    `bpy.context.object`. Remove objects instead, and leave an active anchor
    because the importer requires one.
    """
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    purge_orphans()
    anchor = bpy.data.objects.new("anchor", None)
    bpy.context.scene.collection.objects.link(anchor)
    bpy.context.view_layer.objects.active = anchor
    bpy.ops.import_scene.gltf(filepath=path)
    if anchor.name in bpy.data.objects:
        bpy.data.objects.remove(anchor, do_unlink=True)
    armatures = [o for o in bpy.data.objects if o.type == 'ARMATURE']
    if not armatures:
        raise RuntimeError("no armature in {:s}".format(path))
    return armatures[0]


def clear_pose(armature):
    for bone in armature.pose.bones:
        bone.rotation_mode = 'QUATERNION'
        bone.rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
        bone.location = (0.0, 0.0, 0.0)


def author(armature, name, spec):
    """Build one Action from its pose table."""
    action = bpy.data.actions.new(name)
    # Blender 4.4+ requires a slot before an action can hold channels for an id.
    armature.animation_data_create()
    armature.animation_data.action = action
    if hasattr(action, "slots"):
        slot = action.slots.new(id_type='OBJECT', name=name)
        armature.animation_data.action_slot = slot

    missing = set()
    for frame, pose in spec["keys"]:
        clear_pose(armature)
        for bone_name, degrees in pose.items():
            bone = armature.pose.bones.get(bone_name)
            if bone is None:
                missing.add(bone_name)
                continue
            euler = Euler([math.radians(d) for d in degrees], 'XYZ')
            bone.rotation_quaternion = euler.to_quaternion()
        # Key EVERY bone that the clip touches anywhere, on every key — a bone
        # keyed only where it moves holds its last value across the frames it is
        # absent from, which silently turns a two-beat wave into a drift.
        for bone_name in spec["_bones"]:
            bone = armature.pose.bones.get(bone_name)
            if bone is not None:
                bone.keyframe_insert(data_path="rotation_quaternion", frame=frame)
    return action, missing


def build():
    armature = import_rig(SOURCE_GLB)
    bpy.context.scene.render.fps = FPS
    # The clip that shipped with the export is a locomotion cycle — looping a
    # walk on a character standing still and talking reads as a treadmill — so
    # it must not travel with the library.
    #
    # Removing the ACTIONS is not enough. The importer also leaves NLA TRACKS
    # behind, and the glTF exporter emits one animation per track, so the walk
    # cycle came straight back out of a file whose actions had all been deleted.
    if armature.animation_data:
        for track in list(armature.animation_data.nla_tracks):
            armature.animation_data.nla_tracks.remove(track)
        armature.animation_data.action = None
    for existing in list(bpy.data.actions):
        bpy.data.actions.remove(existing)

    report = {}
    for name, spec in CLIPS.items():
        spec["_bones"] = sorted({b for _f, pose in spec["keys"] for b in pose})
        action, missing = author(armature, name, spec)
        # Stash into its own NLA track: the glTF exporter emits one animation
        # per track, which is how several clips reach a single file.
        track = armature.animation_data.nla_tracks.new()
        track.name = name
        track.strips.new(name, 0, action)
        armature.animation_data.action = None
        report[name] = {
            "frames": spec["frames"],
            "bones": spec["_bones"],
            "missing_bones": sorted(missing),
            "loop": name in LOOPING,
        }
    clear_pose(armature)
    return armature, report


if __name__ == "__main__":
    armature, report = build()
    out = globals().get(
        "OUT_GLB",
        r"C:\Users\mel_f\OneDrive\Escritorio\LITTLEFOUNDERS-AI\frontend\public\scenes\clips-biped.glb",
    )
    for obj in bpy.data.objects:
        obj.select_set(obj.type == 'ARMATURE')
    bpy.context.view_layer.objects.active = armature
    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format='GLB',
        use_selection=True,
        export_animations=True,
        export_animation_mode='NLA_TRACKS',
        export_force_sampling=True,
        export_frame_range=False,
        export_skins=True,
        export_yup=True,
    )
    print("author-clips: wrote {:s}".format(out))
    print(json.dumps(report, indent=1))
