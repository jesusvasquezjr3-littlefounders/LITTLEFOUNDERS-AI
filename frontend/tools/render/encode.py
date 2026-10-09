"""Encodes a folder of frame-NNNN.jpg files to an H.264 MP4 with Blender's bundled FFmpeg (the only encoder these tools need).

Run by render-signin.mjs:
  blender -b --factory-startup -P encode.py -- <frames dir> <output base> <fps> <width> <height> <frame count> <crf>

The frames are already display-referred sRGB, so the sequencer must not tone-map them: Standard view transform, no look,
strips in sRGB. Chroma is 4:2:0 and the container is plain, so every browser's hardware decoder takes the file.
"""
import os
import sys

import bpy

frames_dir, out_base, fps, width, height, count, crf = sys.argv[sys.argv.index("--") + 1:]
fps, width, height, count = int(fps), int(width), int(height), int(count)

names = sorted(f for f in os.listdir(frames_dir) if f.startswith("frame-") and f.endswith(".jpg"))
assert len(names) >= count, f"expected {count} frames, found {len(names)}"
names = names[:count]

scene = bpy.context.scene
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = width, height, 100
scene.render.fps, scene.render.fps_base = fps, 1
scene.frame_start, scene.frame_end = 1, count
scene.render.use_sequencer = True
scene.render.film_transparent = False
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.view_settings.exposure = 0.0
scene.view_settings.gamma = 1.0
scene.display_settings.display_device = "sRGB"
scene.sequencer_colorspace_settings.name = "sRGB"

if scene.sequence_editor is None:
    scene.sequence_editor_create()
strips = scene.sequence_editor.strips
strip = strips.new_image(name="scene", filepath=os.path.join(frames_dir, names[0]), channel=1, frame_start=1)
for name in names[1:]:
    strip.elements.append(name)
strip.colorspace_settings.name = "sRGB"

scene.render.image_settings.media_type = "VIDEO"
scene.render.image_settings.file_format = "FFMPEG"
ff = scene.render.ffmpeg
ff.format = "MPEG4"
ff.codec = "H264"
ff.constant_rate_factor = "CUSTOM"
ff.custom_constant_rate_factor = int(crf)
ff.ffmpeg_preset = "BEST"
ff.gopsize = fps * 5
ff.use_max_b_frames = True
ff.max_b_frames = 2
ff.audio_codec = "NONE"
scene.render.filepath = out_base + ".mp4"
bpy.ops.render.render(animation=True)

# Blender may append the frame range to the name; normalise it.
for candidate in os.listdir(os.path.dirname(out_base)):
    if candidate.startswith(os.path.basename(out_base)) and candidate.endswith(".mp4") and candidate != os.path.basename(out_base) + ".mp4":
        os.replace(os.path.join(os.path.dirname(out_base), candidate), out_base + ".mp4")
print("video encoded:", out_base)
