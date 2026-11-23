"""Merge Tripo retarget outputs into one game-ready GLB (run with Blender).

    blender -b --python tools/merge_clips.py -- animA.glb animB.glb src/assets/m0p1.glb

Keeps the mesh and armature of the first file, takes every animation from both,
writes each as its own clip, and shrinks the 4K textures to 1024 WebP.
"""
import bpy, sys

a, b, out = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a)
keep = set(bpy.context.scene.objects)
arm = next(o for o in keep if o.type == 'ARMATURE')
bpy.ops.import_scene.gltf(filepath=b)
for o in list(bpy.context.scene.objects):
    if o not in keep or o.name.startswith('Icosphere'):
        bpy.data.objects.remove(o, do_unlink=True)
mesh = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
mesh.name = 'M0P1'; arm.name = 'M0P1_rig'
for img in bpy.data.images:
    if img.size[0] > 1024: img.scale(1024, 1024)
# every action goes on its own NLA track so the exporter writes them all as separate clips
ad = arm.animation_data or arm.animation_data_create()
ad.action = None
for act in bpy.data.actions:
    tr = ad.nla_tracks.new(); tr.name = act.name
    st = tr.strips.new(act.name, int(act.frame_range[0]), act)
    if hasattr(st, 'action_slot') and act.slots: st.action_slot = act.slots[0]
print('ACTIONS', [a.name for a in bpy.data.actions])
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animation_mode='NLA_TRACKS', export_image_format='WEBP',
                          export_yup=True, export_apply=False, export_force_sampling=True, export_optimize_animation_size=True)
