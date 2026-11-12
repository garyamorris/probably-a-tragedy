#!/usr/bin/env python3
"""Build V/raw/footage.json from a rec run: make_footage_json.py raw/game.mp4 [idle_min_seconds]
Reads <mp4>.markers.json + <mp4>.meta.json, looks up the tour's threads on the game server, and finds idle (static) stretches
with rec/vtool timeline so the editor can speed-ramp them."""
import json, subprocess, sys, os, urllib.request

V = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
mp4 = sys.argv[1]
idle_min = float(sys.argv[2]) if len(sys.argv) > 2 else 4.0
mk = json.load(open(mp4 + '.markers.json'))
meta = json.load(open(mp4 + '.meta.json'))
dur = meta['duration']

def post(path, body):
    r = urllib.request.Request('http://127.0.0.1:2027' + path, data=json.dumps(body).encode(), headers={'content-type': 'application/json'}, method='POST')
    return json.load(urllib.request.urlopen(r, timeout=30))

end = next((m for m in mk if m['name'] == 'end'), None)
tour_id = (end or {}).get('data', {}).get('tour_id') if end else None
threads = {}
if tour_id:
    for t in post('/threads/search', {'metadata': {'tour_id': tour_id}, 'limit': 100, 'sort_by': 'updated_at', 'sort_order': 'desc'}):
        g = (t.get('metadata') or {}).get('graph_id') or (t.get('metadata') or {}).get('graph')
        threads.setdefault(g, []).append({'thread_id': t['thread_id'], 'updated_at': t['updated_at'], 'status': t['status']})
thread_ids = {g: v[0]['thread_id'] for g, v in threads.items()}
all_threads = {g: [x['thread_id'] for x in v] for g, v in threads.items()}

names = [m['name'] for m in mk]
# segments between consecutive scene markers
order = [m for m in mk if m['name'] != 'end']
segments = []
for i, m in enumerate(order):
    out = order[i + 1]['t'] if i + 1 < len(order) else dur
    segments.append({'id': m['name'], 'name': m['name'], 'in': m['t'], 'out': round(out, 3)})
if end:
    segments.append({'id': 'end', 'name': 'end', 'in': end['t'], 'out': dur})

# idle ranges: use vtool timeline at 1 s steps; idle = change_vs_prev < 0.35 for >= idle_min seconds
out = subprocess.run([os.path.join(V, 'rec/vtool'), 'timeline', mp4, '1'], capture_output=True, text=True).stdout
pts = []
for line in out.splitlines():
    try:
        t = float(line.split('t=')[1].split()[0]); ch = float(line.split('change_vs_prev=')[1])
        pts.append((t, ch))
    except Exception:
        pass
idle = []
start = None
for t, ch in pts:
    if ch < 0.35 and t > 0:
        if start is None: start = t - 1
    else:
        if start is not None and t - start >= idle_min: idle.append([round(start, 1), round(t - 1, 1)])
        start = None
if start is not None and pts and pts[-1][0] - start >= idle_min: idle.append([round(start, 1), round(pts[-1][0], 1)])

def ranges(th, minlen):
    res = []; st = None
    for t, ch in pts:
        if ch < th and t > 0:
            if st is None: st = t - 1
        else:
            if st is not None and t - st >= minlen: res.append([round(st, 1), round(t - 1, 1)])
            st = None
    if st is not None and pts and pts[-1][0] - st >= minlen: res.append([round(st, 1), round(pts[-1][0], 1)])
    return res
slow = ranges(4.0, 10.0)
# show captions sampled from the director heartbeat log (every 10 s)
caps = []
logp = os.path.join(V, 'raw/logs/game.log')
if os.path.exists(logp):
    import re
    for l in open(logp, errors='replace'):
        m = re.match(r'\[log\s+([\d.]+)\] hb (\S+) \| (.*?) \| cap: (.*)', l)
        if m and m[2] == '#/show' and m[4].strip(): caps.append({'t': float(m[1]), 'caption': m[4].strip()})
data = {
    'file': os.path.abspath(mp4), 'duration': dur, 'fps': meta['fps'], 'width': meta['width'], 'height': meta['height'],
    'tour_id': tour_id, 'thread_ids': thread_ids, 'all_thread_ids': all_threads,
    'markers': [{'name': m['name'], 't': m['t'], **({'data': m['data']} if m.get('data') else {})} for m in mk],
    'segments': segments, 'idle_ranges': idle, 'slow_ranges': slow, 'slow_note': 'low-motion stretches >= 10s (mean abs change < 4/255 per second): the show itself (about 1x real time, ~3 min) is mostly this; speed-ramp 2x-4x or cut between caption beats',
    'show_captions_sampled_every_10s': caps, 'idle_note': 'static (visually unchanging) stretches >= %.0fs measured at 1 s steps; safe to speed-ramp / cut' % idle_min,
    'recorder': {k: meta[k] for k in ('frames', 'repeated', 'avg_grab_ms', 'console_errors') if k in meta},
}
json.dump(data, open(os.path.join(V, 'raw/footage.json'), 'w'), indent=2)
print(json.dumps({'duration': dur, 'tour_id': tour_id, 'threads': thread_ids, 'idle': idle, 'markers': [(m['name'], m['t']) for m in mk]}, indent=1))
