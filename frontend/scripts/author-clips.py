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
#
# A bone value may also be SIX numbers — (rx, ry, rz, lx, ly, lz) — where the
# last three are a translation in the bone's own units. Only `jump` and `hop`
# use it, on Hips, because leaving the ground is root motion and cannot be
# expressed as a rotation. Those units are NOT metres: this armature carries a
# 0.01 scale, so a 12 cm hop is 12 here, not 0.12.
import json
import math
import bpy
from mathutils import Euler

FPS = 30
SOURCE_GLB = r"C:\Users\mel_f\OneDrive\Escritorio\LITTLEFOUNDERS-AI\glb\Zara.glb"

# Loop set must agree with LOOPING_ACTIONS in src/tutor-scene/characterActions.ts.
# Matched against the BASE name, so `celebrate@rho` loops because `celebrate`
# does — an override must never disagree with the clip it overrides.
LOOPING = {"idle", "celebrate", "dance"}

# A clip named `<action>@<characterId>` overrides `<action>` for that character
# and is ignored by everyone else (`clipFor` in src/tutor-scene/clipLibrary.ts).
CHARACTER_SUFFIX = "@"

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

    "jump": {
        "frames": 22,
        "keys": [
            (0, {}),
            # Crouch first. A jump that starts by going UP has no weight; the
            # anticipation is what sells the push.
            (5, {"Hips": (0, 0, 0, 0, 0, -9), "LeftUpLeg": (16, 0, 0), "RightUpLeg": (16, 0, 0),
                 "LeftLeg": (-30, 0, 0), "RightLeg": (-30, 0, 0), "Spine01": (9, 0, 0),
                 "LeftArm": (0, 0, -18), "RightArm": (0, 0, 18)}),
            # Extension: legs straighten, arms throw upward, body stretches.
            (10, {"Hips": (0, 0, 0, 0, 0, 26), "LeftUpLeg": (-6, 0, 0), "RightUpLeg": (-6, 0, 0),
                  "Spine01": (-5, 0, 0), "LeftArm": (0, 0, -70), "RightArm": (0, 0, 70),
                  "Head": (-7, 0, 0)}),
            # Apex — tuck slightly, the way a body does at the top.
            (13, {"Hips": (0, 0, 0, 0, 0, 32), "LeftUpLeg": (14, 0, 0), "RightUpLeg": (14, 0, 0),
                  "LeftLeg": (-20, 0, 0), "RightLeg": (-20, 0, 0),
                  "LeftArm": (0, 0, -58), "RightArm": (0, 0, 58)}),
            # Land into a compression, then rise out of it. Landing flat on the
            # rest pose is what makes a jump read as a lift-and-drop.
            (18, {"Hips": (0, 0, 0, 0, 0, -11), "LeftUpLeg": (19, 0, 0), "RightUpLeg": (19, 0, 0),
                  "LeftLeg": (-34, 0, 0), "RightLeg": (-34, 0, 0), "Spine01": (11, 0, 0),
                  "LeftArm": (0, 0, -12), "RightArm": (0, 0, 12)}),
            (22, {"Hips": (0, 0, 0, 0, 0, 0)}),
        ],
    },

    "hop": {
        "frames": 17,
        "keys": [
            (0, {}),
            (4, {"Hips": (0, 0, 0, 0, 0, -6), "LeftLeg": (-20, 0, 0), "RightLeg": (-20, 0, 0),
                 "LeftUpLeg": (11, 0, 0), "RightUpLeg": (11, 0, 0), "Spine01": (6, 0, 0)}),
            (9, {"Hips": (0, 0, 0, 0, 0, 15), "LeftUpLeg": (-4, 0, 0), "RightUpLeg": (-4, 0, 0),
                 "Spine01": (-3, 0, 0), "Head": (-4, 0, 0)}),
            (14, {"Hips": (0, 0, 0, 0, 0, -7), "LeftLeg": (-22, 0, 0), "RightLeg": (-22, 0, 0),
                  "LeftUpLeg": (12, 0, 0), "RightUpLeg": (12, 0, 0), "Spine01": (7, 0, 0)}),
            (17, {"Hips": (0, 0, 0, 0, 0, 0)}),
        ],
    },

    "point": {
        "frames": 42,
        "keys": [
            (0, {}),
            # Pull back before reaching out — the same anticipation `wave` uses.
            (6, {"RightArm": (0, 0, -12), "Spine02": (0, -5, 0), "Head": (0, -6, 0)}),
            # Reach. The chest and head lead so the gesture points WITH the
            # whole body rather than only with an arm.
            (15, {"RightArm": (-62, 0, 26), "RightForeArm": (-14, 0, 6),
                  "RightShoulder": (0, 0, 8), "Spine02": (0, 10, 0), "Spine01": (0, 5, 0),
                  "Head": (0, 12, 0), "Hips": (0, 3, 0)}),
            # Hold, with a small settle so the arm is not frozen.
            (26, {"RightArm": (-59, 0, 24), "RightForeArm": (-11, 0, 5),
                  "RightShoulder": (0, 0, 8), "Spine02": (0, 10, 0), "Spine01": (0, 5, 0),
                  "Head": (0, 12, 0), "Hips": (0, 3, 0)}),
            (36, {"RightArm": (0, 0, -6), "Spine02": (0, 2, 0), "Head": (0, 3, 0)}),
            (42, {}),
        ],
    },

    "shake": {
        "frames": 27,
        "keys": [
            (0, {}),
            # Turn INTO the shake before the first real swing.
            (4, {"Head": (0, 9, 0), "neck": (0, 4, 0)}),
            (10, {"Head": (0, -22, 0), "neck": (0, -9, 0), "Spine02": (0, -4, 0)}),
            (17, {"Head": (0, 20, 0), "neck": (0, 8, 0), "Spine02": (0, 4, 0)}),
            (23, {"Head": (0, -9, 0), "neck": (0, -4, 0)}),
            (27, {}),
        ],
    },

    "think": {
        "frames": 66,
        "keys": [
            # Loops. Hand toward the chin, head tilted, weight on one hip.
            (0, {"RightArm": (-34, 0, 44), "RightForeArm": (-72, 0, 30),
                 "RightShoulder": (0, 0, 10), "Head": (6, -13, 9), "neck": (3, -5, 3),
                 "Spine01": (0, -4, 0), "Hips": (0, 0, 2)}),
            (22, {"RightArm": (-36, 0, 46), "RightForeArm": (-76, 0, 32),
                  "RightShoulder": (0, 0, 11), "Head": (9, -15, 11), "neck": (4, -6, 4),
                  "Spine01": (0, -5, 0), "Hips": (0, 0, 2)}),
            (44, {"RightArm": (-32, 0, 42), "RightForeArm": (-70, 0, 28),
                  "RightShoulder": (0, 0, 9), "Head": (4, -11, 8), "neck": (2, -4, 2),
                  "Spine01": (0, -3, 0), "Hips": (0, 0, 2)}),
            (66, {"RightArm": (-34, 0, 44), "RightForeArm": (-72, 0, 30),
                  "RightShoulder": (0, 0, 10), "Head": (6, -13, 9), "neck": (3, -5, 3),
                  "Spine01": (0, -4, 0), "Hips": (0, 0, 2)}),
        ],
    },

    "dance": {
        "frames": 72,
        "keys": [
            # Loops. Weight rocks hip to hip and the shoulders answer in the
            # OPPOSITE direction — moving in one piece reads as a swaying prop.
            (0, {"Hips": (0, 0, 7), "Spine01": (0, 0, -5), "Spine02": (0, 0, -4),
                 "Head": (0, 6, -4), "LeftArm": (0, 0, -44), "RightArm": (0, 0, 22),
                 "LeftForeArm": (0, 0, -30), "RightForeArm": (0, 0, 14)}),
            (18, {"Hips": (0, 0, 0), "Spine01": (-4, 0, 0), "Head": (-4, 0, 0),
                  "LeftArm": (0, 0, -34), "RightArm": (0, 0, 34),
                  "LeftForeArm": (0, 0, -22), "RightForeArm": (0, 0, 22)}),
            (36, {"Hips": (0, 0, -7), "Spine01": (0, 0, 5), "Spine02": (0, 0, 4),
                  "Head": (0, -6, 4), "LeftArm": (0, 0, -22), "RightArm": (0, 0, 44),
                  "LeftForeArm": (0, 0, -14), "RightForeArm": (0, 0, 30)}),
            (54, {"Hips": (0, 0, 0), "Spine01": (-4, 0, 0), "Head": (-4, 0, 0),
                  "LeftArm": (0, 0, -34), "RightArm": (0, 0, 34),
                  "LeftForeArm": (0, 0, -22), "RightForeArm": (0, 0, 22)}),
            (72, {"Hips": (0, 0, 7), "Spine01": (0, 0, -5), "Spine02": (0, 0, -4),
                  "Head": (0, 6, -4), "LeftArm": (0, 0, -44), "RightArm": (0, 0, 22),
                  "LeftForeArm": (0, 0, -30), "RightForeArm": (0, 0, 14)}),
        ],
    },

    "peek": {
        "frames": 45,
        "keys": [
            (0, {}),
            # Lean AWAY first, so the look around the corner has somewhere to
            # come from.
            (7, {"Spine01": (0, 0, 4), "Head": (0, -6, 3)}),
            (20, {"Spine01": (0, 0, -13), "Spine02": (0, 0, -9), "Hips": (0, 0, -4),
                  "neck": (0, 8, -6), "Head": (-4, 17, -11)}),
            (30, {"Spine01": (0, 0, -14), "Spine02": (0, 0, -10), "Hips": (0, 0, -4),
                  "neck": (0, 9, -6), "Head": (-5, 19, -12)}),
            (39, {"Spine01": (0, 0, 3), "Head": (0, -4, 2)}),
            (45, {}),
        ],
    },

    # `peek` leans the torso 13 degrees sideways and rotates the hips with it,
    # and it never touches the arms — on Zara and Liruf that is fine. Rho stands
    # with his hands 1.2 cm from his thighs (TUTOR_3D.md §4.2a), so the lean
    # brings the thigh up THROUGH his hand: at t=0.80 more than half of it was
    # inside his trousers with only the fingers still showing. The fix is the
    # smallest one that works — hold both arms a few degrees out for the length
    # of the lean, which is what a person does to look around a corner anyway.
    # Found by `verify:clearance`; invisible to every other gate, because a hand
    # inside a leg deforms nothing at all.
    "peek@rho": {
        "frames": 45,
        "keys": [
            (0, {}),
            (7, {"Spine01": (0, 0, 4), "Head": (0, -6, 3),
                 "LeftArm": (0, 0, -6), "RightArm": (0, 0, 6)}),
            (20, {"Spine01": (0, 0, -13), "Spine02": (0, 0, -9), "Hips": (0, 0, -4),
                  "neck": (0, 8, -6), "Head": (-4, 17, -11),
                  "LeftArm": (0, 0, -14), "RightArm": (0, 0, 14)}),
            (30, {"Spine01": (0, 0, -14), "Spine02": (0, 0, -10), "Hips": (0, 0, -4),
                  "neck": (0, 9, -6), "Head": (-5, 19, -12),
                  "LeftArm": (0, 0, -15), "RightArm": (0, 0, 15)}),
            (39, {"Spine01": (0, 0, 3), "Head": (0, -4, 2),
                  "LeftArm": (0, 0, -5), "RightArm": (0, 0, 5)}),
            (45, {}),
        ],
    },

    # ---- EMOTION LAYER -------------------------------------------------
    #
    # These are composed ADDITIVELY over whichever action is playing, so they
    # touch head, neck and upper torso only — an emotion that moved the legs
    # would fight a jump for the same joints.
    #
    # `emotion.rest` is not an emotion. It is the REFERENCE POSE the others are
    # made additive against, and it has to be exported rather than synthesised:
    # a bone's rest orientation is its own bind rotation, not identity, so there
    # is no way to write "no emotion" in clip space without shipping it.
    "emotion.rest": {
        "frames": 2,
        "keys": [
            (0, {"Head": (0, 0, 0), "neck": (0, 0, 0), "Spine02": (0, 0, 0),
                 "Spine01": (0, 0, 0)}),
            (2, {"Head": (0, 0, 0), "neck": (0, 0, 0), "Spine02": (0, 0, 0),
                 "Spine01": (0, 0, 0)}),
        ],
    },

    "emotion.neutral": {
        "frames": 90,
        "keys": [
            (0, {"Head": (0, 1.2, 0), "neck": (0, 0.5, 0)}),
            (45, {"Head": (-0.8, -1.2, 0.5), "neck": (-0.4, -0.5, 0)}),
            (90, {"Head": (0, 1.2, 0), "neck": (0, 0.5, 0)}),
        ],
    },

    "emotion.happy": {
        "frames": 72,
        "keys": [
            (0, {"Head": (-5, 0, 0), "neck": (-2, 0, 0), "Spine02": (-3, 0, 0)}),
            (36, {"Head": (-7.5, 2, 1.5), "neck": (-3, 1, 0), "Spine02": (-4.5, 0, 0)}),
            (72, {"Head": (-5, 0, 0), "neck": (-2, 0, 0), "Spine02": (-3, 0, 0)}),
        ],
    },

    "emotion.excited": {
        "frames": 30,
        "keys": [
            # Quick, small and repeating — excitement is FREQUENCY, not
            # amplitude. A big slow version of this reads as seasick.
            (0, {"Head": (-7, 0, 0), "neck": (-3, 0, 0), "Spine02": (-5, 0, 0)}),
            (8, {"Head": (-11, 2.5, 2), "neck": (-4.5, 1, 0), "Spine02": (-7, 0, 0)}),
            (16, {"Head": (-7, 0, 0), "neck": (-3, 0, 0), "Spine02": (-5, 0, 0)}),
            (24, {"Head": (-11, -2.5, -2), "neck": (-4.5, -1, 0), "Spine02": (-7, 0, 0)}),
            (30, {"Head": (-7, 0, 0), "neck": (-3, 0, 0), "Spine02": (-5, 0, 0)}),
        ],
    },

    "emotion.thinking": {
        "frames": 96,
        "keys": [
            (0, {"Head": (5, 8, 7), "neck": (2, 3, 3), "Spine01": (0, -2, 0)}),
            (48, {"Head": (7, 10.5, 9), "neck": (3, 4, 4), "Spine01": (0, -3, 0)}),
            (96, {"Head": (5, 8, 7), "neck": (2, 3, 3), "Spine01": (0, -2, 0)}),
        ],
    },

    "emotion.surprised": {
        "frames": 54,
        "keys": [
            # Held recoil with a tremor. Surprise that keeps re-arriving reads
            # as a tic; surprise that is perfectly still reads as a statue.
            (0, {"Head": (-13, 0, 0), "neck": (-5, 0, 0), "Spine02": (5, 0, 0)}),
            (14, {"Head": (-14.5, 1, 0), "neck": (-5.5, 0, 0), "Spine02": (5.5, 0, 0)}),
            (32, {"Head": (-13, -1, 0), "neck": (-5, 0, 0), "Spine02": (5, 0, 0)}),
            (54, {"Head": (-13, 0, 0), "neck": (-5, 0, 0), "Spine02": (5, 0, 0)}),
        ],
    },

    "emotion.encouraging": {
        "frames": 78,
        "keys": [
            # Leaning IN. The chest comes forward and the chin drops slightly,
            # which is what attention looks like from the outside.
            (0, {"Spine02": (6, 0, 0), "Spine01": (3, 0, 0), "Head": (-3, 0, 0)}),
            (39, {"Spine02": (8, 0, 0), "Spine01": (4, 0, 0), "Head": (-4.5, 1.5, 0),
                  "neck": (-1.5, 0, 0)}),
            (78, {"Spine02": (6, 0, 0), "Spine01": (3, 0, 0), "Head": (-3, 0, 0)}),
        ],
    },

    "emotion.proud": {
        "frames": 84,
        "keys": [
            (0, {"Spine02": (-7, 0, 0), "Spine01": (-3, 0, 0), "Head": (-6.5, 0, 0),
                 "neck": (-2.5, 0, 0)}),
            (42, {"Spine02": (-8.5, 0, 0), "Spine01": (-4, 0, 0), "Head": (-8, -1.5, 0),
                  "neck": (-3, 0, 0)}),
            (84, {"Spine02": (-7, 0, 0), "Spine01": (-3, 0, 0), "Head": (-6.5, 0, 0),
                  "neck": (-2.5, 0, 0)}),
        ],
    },

    # ---- PER-CHARACTER OVERRIDES ---------------------------------------
    #
    # Additive playback fixes PROPORTIONS — every character keeps its own
    # stance — but it cannot fix AMPLITUDE. A bone-local delta of 150 degrees
    # means something different on a bone whose rest orientation is 73 degrees
    # away, so a gesture authored on Zara arrives muted or misaimed on the
    # others. These four clips are the ones that failed to read at all.
    #
    # Every number below was MEASURED before it was chosen, then rendered:
    # the arm solver reported reach, forward distance along the character's own
    # measured facing, and hand height against the crown.
    #
    # THE FINDING THAT SHAPED THEM: Rho cannot raise his arms overhead. Reach
    # 15.99 from a shoulder at ~3.2 tops out at 19.2; his crown is at 25.94.
    # Liruf's arms are shorter still. So their celebrate is NOT a weaker copy
    # of Zara's overhead pose — it is arms UP AND OUT with the torso carrying
    # the gesture, which is what a short-armed character actually does.

    "celebrate@rho": {
        "frames": 54,
        "keys": [
            # Arms out and up beside the head, elbows open. At Zara's 150 his
            # hands landed ON his head, which reads as dismay, not delight.
            (0, {"LeftArm": (0, 0, -108), "RightArm": (0, 0, 108),
                 "LeftForeArm": (0, 0, -20), "RightForeArm": (0, 0, 20),
                 "LeftShoulder": (0, 0, -10), "RightShoulder": (0, 0, 10),
                 "Spine02": (-9, 0, 0), "Head": (-11, 0, 0)}),
            (14, {"LeftArm": (0, 0, -120), "RightArm": (0, 0, 120),
                  "LeftForeArm": (0, 0, -28), "RightForeArm": (0, 0, 28),
                  "LeftShoulder": (0, 0, -13), "RightShoulder": (0, 0, 13),
                  "Spine02": (-14, 0, 0), "Spine01": (-5, 0, 0),
                  "Head": (-17, 0, 0), "Hips": (-4, 0, 0)}),
            (27, {"LeftArm": (0, 0, -108), "RightArm": (0, 0, 108),
                  "LeftForeArm": (0, 0, -20), "RightForeArm": (0, 0, 20),
                  "LeftShoulder": (0, 0, -10), "RightShoulder": (0, 0, 10),
                  "Spine02": (-9, 0, 0), "Head": (-11, 0, 0)}),
            (41, {"LeftArm": (0, 0, -122), "RightArm": (0, 0, 122),
                  "LeftForeArm": (0, 0, -29), "RightForeArm": (0, 0, 29),
                  "LeftShoulder": (0, 0, -14), "RightShoulder": (0, 0, 14),
                  "Spine02": (-15, 0, 0), "Spine01": (-6, 0, 0),
                  "Head": (-18, 0, 0), "Hips": (-4, 0, 0)}),
            (54, {"LeftArm": (0, 0, -108), "RightArm": (0, 0, 108),
                  "LeftForeArm": (0, 0, -20), "RightForeArm": (0, 0, 20),
                  "LeftShoulder": (0, 0, -10), "RightShoulder": (0, 0, 10),
                  "Spine02": (-9, 0, 0), "Head": (-11, 0, 0)}),
        ],
    },

    # LIRUF'S RIG HAS NO MIRROR. Reflecting his right hand across his own
    # sagittal plane misses the left by 23.4 units under EVERY euler negation
    # (rho's best is 1.4), so his two arms are stated independently here rather
    # than derived. That asymmetry is why his celebrate looked one-armed.
    #
    # Past a Z of about 110 the two sides diverge visibly — one arm keeps
    # rising while the other drops — so the amplitude is capped there.
    "celebrate@liruf": {
        "frames": 54,
        "keys": [
            (0, {"LeftArm": (-22, 0, -100), "RightArm": (-22, 0, 100),
                 "LeftForeArm": (0, 0, -18), "RightForeArm": (0, 0, 18),
                 "LeftShoulder": (0, 0, -10), "RightShoulder": (0, 0, 10),
                 "Spine02": (-9, 0, 0), "Head": (-11, 0, 0)}),
            (14, {"LeftArm": (-26, 0, -112), "RightArm": (-26, 0, 112),
                  "LeftForeArm": (0, 0, -20), "RightForeArm": (0, 0, 20),
                  "LeftShoulder": (0, 0, -11), "RightShoulder": (0, 0, 11),
                  "Spine02": (-14, 0, 0), "Spine01": (-5, 0, 0),
                  "Head": (-17, 0, 0), "Hips": (-4, 0, 0)}),
            (27, {"LeftArm": (-22, 0, -100), "RightArm": (-22, 0, 100),
                  "LeftForeArm": (0, 0, -18), "RightForeArm": (0, 0, 18),
                  "LeftShoulder": (0, 0, -10), "RightShoulder": (0, 0, 10),
                  "Spine02": (-9, 0, 0), "Head": (-11, 0, 0)}),
            (41, {"LeftArm": (-27, 0, -114), "RightArm": (-27, 0, 114),
                  "LeftForeArm": (0, 0, -21), "RightForeArm": (0, 0, 21),
                  "LeftShoulder": (0, 0, -12), "RightShoulder": (0, 0, 12),
                  "Spine02": (-15, 0, 0), "Spine01": (-6, 0, 0),
                  "Head": (-18, 0, 0), "Hips": (-4, 0, 0)}),
            (54, {"LeftArm": (-22, 0, -100), "RightArm": (-22, 0, 100),
                  "LeftForeArm": (0, 0, -18), "RightForeArm": (0, 0, 18),
                  "LeftShoulder": (0, 0, -10), "RightShoulder": (0, 0, 10),
                  "Spine02": (-9, 0, 0), "Head": (-11, 0, 0)}),
        ],
    },

    # Liruf's shipped `point` aimed BEHIND him: measured against his own facing
    # (read from the `headfront` bone rather than assumed to be -Y), the hand
    # ended up -0.94 forward. This reaches +18.4.
    "point@liruf": {
        "frames": 42,
        "keys": [
            (0, {}),
            # The anticipation pulls the arm OUT, not back. This override was
            # written to fix the REACH and kept the shared clip's own -12 on Z,
            # which on Zara's rig pulls the arm behind her and on Liruf — whose
            # rest orientation differs by 73 degrees (TUTOR_3D.md §3) — drove his
            # forearm INSIDE his belly. At t=0.23 only his claws were still
            # visible. `verify:clearance` found it; nothing else could, because
            # interpenetration deforms no triangle.
            (6, {"RightArm": (0, 0, 10), "Spine02": (0, -5, 0), "Head": (0, -6, 0)}),
            (15, {"RightArm": (-75, -20, -30), "RightForeArm": (-10, 0, 6),
                  "RightShoulder": (0, 0, 8), "Spine02": (0, 10, 0), "Spine01": (0, 5, 0),
                  "Head": (0, 12, 0), "Hips": (0, 3, 0)}),
            (26, {"RightArm": (-72, -19, -28), "RightForeArm": (-8, 0, 5),
                  "RightShoulder": (0, 0, 8), "Spine02": (0, 10, 0), "Spine01": (0, 5, 0),
                  "Head": (0, 12, 0), "Hips": (0, 3, 0)}),
            # The settle out, like the anticipation above, goes OUT rather than in.
            (36, {"RightArm": (0, 0, 5), "Spine02": (0, 2, 0), "Head": (0, 3, 0)}),
            (42, {}),
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
        for bone_name, values in pose.items():
            bone = armature.pose.bones.get(bone_name)
            if bone is None:
                missing.add(bone_name)
                continue
            euler = Euler([math.radians(d) for d in values[:3]], 'XYZ')
            bone.rotation_quaternion = euler.to_quaternion()
            if len(values) == 6:
                bone.location = tuple(values[3:])
        # Key EVERY bone that the clip touches anywhere, on every key — a bone
        # keyed only where it moves holds its last value across the frames it is
        # absent from, which silently turns a two-beat wave into a drift.
        for bone_name in spec["_bones"]:
            bone = armature.pose.bones.get(bone_name)
            if bone is None:
                continue
            bone.keyframe_insert(data_path="rotation_quaternion", frame=frame)
            if bone_name in spec["_moved"]:
                bone.keyframe_insert(data_path="location", frame=frame)
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
        # Bones that TRANSLATE anywhere in the clip must be keyed for location
        # on every key, not only where they move — an unkeyed frame holds the
        # last value, which turns a landing into a character stuck in mid-air.
        spec["_moved"] = {
            b for _f, pose in spec["keys"] for b, v in pose.items() if len(v) == 6
        }
        action, missing = author(armature, name, spec)
        # Stash into its own NLA track: the glTF exporter emits one animation
        # per track, which is how several clips reach a single file.
        track = armature.animation_data.nla_tracks.new()
        track.name = name
        track.strips.new(name, 0, action)
        armature.animation_data.action = None
        base = name.split(CHARACTER_SUFFIX)[0]
        report[name] = {
            "frames": spec["frames"],
            "bones": spec["_bones"],
            "missing_bones": sorted(missing),
            # Looping is a property of the ACTION, not of the override, so an
            # override cannot silently disagree with the clip it replaces.
            "loop": base in LOOPING,
            "overrides": base if base != name else None,
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
