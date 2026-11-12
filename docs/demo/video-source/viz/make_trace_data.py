"""Pull one real night from LangSmith (read-only) and write trace_data.json for trace.html.
Run:  from the repo root: uv run --env-file .env python docs/demo/video-source/viz/make_trace_data.py
Reads the thread id from V/raw/footage.json (thread_ids.performance) and falls back to the first night we recorded.
Secrets: only run names, timings, token counts and the game's own prompt/reply text are written. No keys, no URLs with credentials."""
import json, os, sys, datetime as dt, warnings
warnings.filterwarnings("ignore")
from langsmith import Client

V = os.environ.get("VIDEO_DIR") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # the video-source folder
FALLBACK = "d4460ca8-bf11-5270-adb6-aecda10a91b8"
try:
    thread = json.load(open(f"{V}/raw/footage.json"))["thread_ids"]["performance"]
except Exception:
    thread = FALLBACK
if len(sys.argv) > 1:
    thread = sys.argv[1]
proj = os.environ.get("LANGSMITH_PROJECT", "probably-a-tragedy")
c = Client()

def trim(s, n):
    s = " ".join(str(s).split())
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"

def ms(r):
    return round((r.end_time - r.start_time).total_seconds() * 1000) if r.end_time and r.start_time else 0

flt = f'and(eq(is_root, true), eq(metadata_key, "thread_id"), eq(metadata_value, "{thread}"))'
roots = sorted(c.list_runs(project_name=proj, filter=flt, limit=10), key=lambda r: r.start_time)
if len(roots) < 2 and thread != FALLBACK:  # prefer a night with two traces
    thread = FALLBACK
    flt = f'and(eq(is_root, true), eq(metadata_key, "thread_id"), eq(metadata_value, "{thread}"))'
    roots = sorted(c.list_runs(project_name=proj, filter=flt, limit=10), key=lambda r: r.start_time)

def msg_text(m):
    k = (m.get("kwargs") or {})
    role = (m.get("id") or ["", "", "", ""])[-1].replace("Message", "").lower()
    return role, k.get("content", "")

out = {"project": proj, "thread_id": thread, "fetched_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "traces": [], "llm": [], "nodes": {}}
for ti, root in enumerate(roots):
    runs = list(c.list_runs(project_name=proj, trace_id=root.id, limit=100))
    byid = {r.id: r for r in runs}
    t0 = root.start_time
    rows = []
    for r in runs:
        err = (r.error or "")
        rows.append({
            "id": str(r.id), "short": str(r.id)[:8], "parent": str(r.parent_run_id) if r.parent_run_id else None,
            "name": r.name, "type": r.run_type, "off": round((r.start_time - t0).total_seconds() * 1000), "ms": ms(r),
            "tokens": r.total_tokens or 0, "ptok": r.prompt_tokens or 0, "ctok": r.completion_tokens or 0,
            "status": r.status, "interrupted": ("Interrupt" in err) or ("GraphInterrupt" in err),
            "parent_name": byid[r.parent_run_id].name if r.parent_run_id in byid else None,
        })
    rows.sort(key=lambda x: (x["off"], x["type"] != "chain"))
    meta = (root.extra or {}).get("metadata") or {}
    out["traces"].append({
        "id": str(root.id), "short": str(root.id)[:8], "start": root.start_time.isoformat(), "ms": ms(root), "status": root.status,
        "tokens": root.total_tokens or 0, "ptok": root.prompt_tokens or 0, "ctok": root.completion_tokens or 0, "n_runs": len(runs),
        "graph": meta.get("graph"), "attempt": meta.get("run_attempt"), "rows": rows,
    })
    # node details: output keys, and the interrupt payload for prompters_box
    for r in runs:
        if r.run_type == "chain" and r.name != "performance" and r.name not in out["nodes"]:
            full = c.read_run(r.id)
            o = full.outputs or {}
            o = o.get("output", o) if isinstance(o, dict) else {}
            ks = list(o.keys())[:6] if isinstance(o, dict) else []
            out["nodes"][r.name] = {"out_keys": ks, "in_keys": len((full.inputs or {}).keys())}
    for r in runs:
        if r.run_type == "llm":
            full = c.read_run(r.id)
            msgs = ((full.inputs or {}).get("messages") or [[]])[0]
            parts = [msg_text(m) for m in msgs if isinstance(m, dict)]
            gen = (((full.outputs or {}).get("generations") or [[{}]])[0] or [{}])[0]
            gi = gen.get("generation_info") or {}
            out["llm"].append({
                "trace": str(root.id)[:8], "ti": ti, "run": str(r.id)[:8], "id": str(r.id), "parent": byid[r.parent_run_id].name if r.parent_run_id in byid else None,
                "off": round((r.start_time - t0).total_seconds() * 1000), "ms": ms(r),
                "model": gi.get("model_name") or (full.extra or {}).get("metadata", {}).get("ls_model_name"),
                "ptok": r.prompt_tokens or 0, "ctok": r.completion_tokens or 0, "tokens": r.total_tokens or 0,
                "system": trim(next((t for role, t in parts if role == "system"), ""), 300),
                "human": trim(next((t for role, t in parts if role == "human"), ""), 280),
                "reply": trim(gen.get("text", ""), 240),
            })
json.dump(out, open(f"{V}/viz/trace_data.json", "w"), indent=1)
print("thread", thread, "traces", [(t["short"], t["n_runs"], t["ms"]) for t in out["traces"]], "llm", len(out["llm"]))
