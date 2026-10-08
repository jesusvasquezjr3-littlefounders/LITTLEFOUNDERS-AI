"""Encodes a folder of frame-NNNN.jpg files to MP4 (H.264), and WebM (VP9) when a WebM crf above 0 is given, with Blender's bundled FFmpeg.

Run by scripts/render-hero-video.mjs:
  blender -b --factory-startup -P hero-video-encode.py -- <frames dir> <output base> <fps> <width> <height> <frame count> <mp4 crf> <webm crf>

The frames are already display-referred sRGB, so the sequencer must not tone-map them: Standard view transform, no look,
strips in sRGB. Chroma is 4:2:0 and the container is plain, so every browser's hardware decoder takes the file.
"""
import os
import sys

import bpy

frames_dir, out_base, fps, width, height, count, crf_mp4, crf_webm = sys.argv[sys.argv.index("--") + 1:]
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
strip = strips.new_image(name="hero", filepath=os.path.join(frames_dir, names[0]), channel=1, frame_start=1)
for name in names[1:]:
    strip.elements.append(name)
strip.colorspace_settings.name = "sRGB"


def encode(extension, container, codec, crf, extra=None):
    scene.render.image_settings.media_type = "VIDEO"
    scene.render.image_settings.file_format = "FFMPEG"
    ff = scene.render.ffmpeg
    ff.format = container
    ff.codec = codec
    ff.constant_rate_factor = "CUSTOM"
    ff.custom_constant_rate_factor = int(crf)
    ff.ffmpeg_preset = "BEST"
    ff.gopsize = fps * 5
    ff.use_max_b_frames = True
    ff.max_b_frames = 2
    ff.audio_codec = "NONE"
    for key, value in (extra or {}).items():
        setattr(ff, key, value)
    scene.render.filepath = out_base + "." + extension
    bpy.ops.render.render(animation=True)
    # Blender appends the frame range to an animation's file name when the path has no extension handling; normalise.
    for candidate in os.listdir(os.path.dirname(out_base)):
        if candidate.startswith(os.path.basename(out_base)) and candidate.endswith("." + extension) and candidate != os.path.basename(out_base) + "." + extension:
            os.replace(os.path.join(os.path.dirname(out_base), candidate), out_base + "." + extension)


encode("mp4", "MPEG4", "H264", crf_mp4)
if int(crf_webm) > 0:
    encode("webm", "WEBM", "WEBM", crf_webm)
print("hero video encoded:", out_base)
