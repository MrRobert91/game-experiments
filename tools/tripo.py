#!/usr/bin/env python3
"""Tiny Tripo3D v3 API client used to build the M0P-1 model.

    TRIPO_API_KEY=... python3 tools/tripo.py model "prompt"           -> task id
    TRIPO_API_KEY=... python3 tools/tripo.py rig <model_task>
    TRIPO_API_KEY=... python3 tools/tripo.py retarget <rig_task> preset:idle preset:walk ...
    TRIPO_API_KEY=... python3 tools/tripo.py wait <task> [out.glb]    -> waits and downloads

How src/assets/m0p1.glb was made:
    model    "A small cute chibi cleaning robot mascot, glossy bright orange plastic body with white and dark grey
             accents, big round helmet head with a wide black glass screen visor for a face, small round orange ear
             discs, one short antenna with a glowing orange tip, stubby arms with round mitten hands, short sturdy
             legs with round orange boots, standing in T-pose, toy-like stylized game character, clean hard-surface design"
    rig      <model task>
    retarget <rig task> preset:idle preset:walk preset:run preset:jump preset:fall      -> animA.glb
    retarget <rig task> preset:dive preset:hurt preset:slash preset:turn preset:climb   -> animB.glb
    blender -b --python tools/merge_clips.py -- animA.glb animB.glb src/assets/m0p1.glb
"""
import json, os, sys, time, urllib.request

API = 'https://openapi.tripo3d.ai/v3'
KEY = os.environ['TRIPO_API_KEY']


def call(method, path, body=None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body else None,
                                 headers={'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            res = json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f'{e.code}: {e.read().decode()}')
    if res.get('code') != 0:
        sys.exit(json.dumps(res))
    return res['data']


def wait(task, out=None):
    while True:
        d = call('GET', f'/tasks/{task}')
        print(d['status'], d.get('progress'), file=sys.stderr)
        if d['status'] == 'success':
            break
        if d['status'] in ('failed', 'cancelled', 'banned', 'expired'):
            sys.exit(json.dumps(d))
        time.sleep(5)
    print(json.dumps(d['output'], indent=1))
    if out:
        urllib.request.urlretrieve(d['output']['model_url'], out)
        img = d['output'].get('rendered_image_url')
        if img:
            urllib.request.urlretrieve(img, os.path.splitext(out)[0] + '.preview' + os.path.splitext(img.split('?')[0])[1])
    return d


if __name__ == '__main__':
    cmd, *a = sys.argv[1:]
    if cmd == 'model':
        print(call('POST', '/generation/text-to-model', {
            'prompt': a[0], 'negative_prompt': a[1] if len(a) > 1 else 'realistic, human skin, weapon, text',
            'model': 'v3.1-20260211', 'texture': True, 'pbr': True, 'texture_quality': 'detailed',
            'face_limit': 20000})['task_id'])
    elif cmd == 'rig':
        print(call('POST', '/animations/rig', {'input': a[0], 'model': 'v3.0-20260909', 'rig_type': 'biped',
                                               'spec': 'tripo', 'out_format': 'glb'})['task_id'])
    elif cmd == 'retarget':
        print(call('POST', '/animations/retarget', {'input': a[0], 'animations': a[1:], 'out_format': 'glb',
                                                    'export_with_geometry': True, 'animate_in_place': True})['task_id'])
    elif cmd == 'check':
        print(call('POST', '/animations/rig-check', {'input': a[0]})['task_id'])
    elif cmd == 'wait':
        wait(a[0], a[1] if len(a) > 1 else None)
