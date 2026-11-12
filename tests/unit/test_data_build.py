"""The dataset builder: deterministic, convention-driven, honest about drift."""

from __future__ import annotations

import hashlib
import json
import sys

import pytest

from tragedy.data import build, content
from tragedy.data.__main__ import main


@pytest.fixture(scope="module")
def collected():
    data, problems = build.collect()
    assert not problems, problems
    return data


def test_collect_finds_the_cast_tables(collected):
    for name in ("performers", "staff", "flaws", "mishaps", "whispers", "cues", "props"):
        assert name in collected, f"content/ should publish {name}"
    assert list(collected) == [n for n in build.ORDER if n in collected], "datasets come back in canonical order"


def test_render_is_deterministic(collected):
    first, second = build.render(collected), build.render(build.collect()[0])
    assert first == second
    for fname, text in first.items():
        assert text.endswith("\n") and not text.endswith("\n\n"), fname


def test_two_builds_are_byte_identical(tmp_path):
    a, b = tmp_path / "a", tmp_path / "b"
    for out in (a, b):
        messages, problems = build.build(out, skip_gold=True)
        assert not problems and messages
    assert sorted(p.name for p in a.iterdir()) == sorted(p.name for p in b.iterdir())
    for p in a.iterdir():
        assert p.read_bytes() == (b / p.name).read_bytes(), p.name


def test_manifest_matches_files(tmp_path):
    build.build(tmp_path, only={"props", "cues", "whispers"}, skip_gold=True)
    manifest = json.loads((tmp_path / "MANIFEST.json").read_text(encoding="utf-8"))
    assert list(manifest) == ["whispers", "cues", "props"]  # canonical order, only what exists
    for name, entry in manifest.items():
        assert set(entry) == {"file", "rows", "sha256", "description"}
        text = (tmp_path / entry["file"]).read_text(encoding="utf-8")
        assert entry["sha256"] == hashlib.sha256(text.encode("utf-8")).hexdigest()
        assert entry["rows"] == len(json.loads(text))
        assert entry["description"] == build.DESCRIPTIONS[name]


def test_file_format(tmp_path):
    build.build(tmp_path, only={"props", "almanac_seeds"}, skip_gold=True)
    props = (tmp_path / "props.json").read_text(encoding="utf-8")
    assert props.startswith('[\n {\n  "id"'), "indent=1"
    seeds = tmp_path / "almanac_seeds.jsonl"
    if seeds.exists():
        lines = seeds.read_text(encoding="utf-8").splitlines()
        assert lines and all(json.loads(line)["id"].startswith("legend_") for line in lines)


def test_unicode_is_not_escaped(tmp_path):
    build.build(tmp_path, only={"cues"}, skip_gold=True)
    text = (tmp_path / "cues.json").read_text(encoding="utf-8")
    assert "\\u" not in text and "⛈" in text


def test_drift_detection(tmp_path):
    build.build(tmp_path, only={"props", "cues"}, skip_gold=True)
    diffs, problems = build.drift(tmp_path, only={"props", "cues"}, skip_gold=True)
    assert not diffs and not problems
    path = tmp_path / "cues.json"
    path.write_text(path.read_text(encoding="utf-8").replace("Thunder sheet", "Thunder sheets"), encoding="utf-8")
    diffs, _ = build.drift(tmp_path, only={"props", "cues"}, skip_gold=True)
    assert any("cues.json" in d for d in diffs)
    (tmp_path / "props.json").unlink()
    diffs, _ = build.drift(tmp_path, only={"props", "cues"}, skip_gold=True)
    assert any("props.json" in d and "missing" in d for d in diffs)


def test_cli_build_and_check(tmp_path, capsys):
    out = str(tmp_path)
    assert main(["build", "--out", out, "--only", "props", "--skip-gold"]) == 0
    assert main(["build", "--check", "--out", out, "--only", "props", "--skip-gold"]) == 0
    (tmp_path / "props.json").write_text("[]\n", encoding="utf-8")
    assert main(["build", "--check", "--out", out, "--only", "props", "--skip-gold"]) == 1
    assert "out of date" in capsys.readouterr().err


@pytest.fixture
def extra_content(tmp_path, monkeypatch):
    """A scratch directory spliced into the content package, to play the part of other workers' modules."""
    monkeypatch.setattr(content, "__path__", [*content.__path__, str(tmp_path)])
    before = set(sys.modules)
    yield tmp_path
    for name in set(sys.modules) - before:
        if name.startswith("tragedy.data.content.zz_"):
            del sys.modules[name]


def test_collect_tolerates_helpers_and_reports_broken_modules(extra_content):
    (extra_content / "zz_helper.py").write_text("X = 1\n", encoding="utf-8")  # no DATASETS: a helper
    (extra_content / "zz_broken.py").write_text("DATASETS = {\n", encoding="utf-8")  # syntax error
    (extra_content / "zz_dupe.py").write_text("DATASETS = {'props': []}\n", encoding="utf-8")
    (extra_content / "zz_unknown.py").write_text("DATASETS = {'hats': []}\n", encoding="utf-8")
    (extra_content / "zz_badtype.py").write_text("DATASETS = [1, 2]\n", encoding="utf-8")
    (extra_content / "_private.py").write_text("raise RuntimeError('never imported')\n", encoding="utf-8")
    data, problems = build.collect()
    text = "\n".join(problems)
    assert "zz_broken.py failed to import" in text
    assert "both content/props.py and content/zz_dupe.py" in text
    assert "unknown dataset 'hats'" in text
    assert "zz_badtype.py: DATASETS must be a dict" in text
    assert "_private" not in text and "zz_helper" not in text
    assert len(data["props"]) == 30, "the first publisher wins; the duplicate is reported, not merged"


def test_build_refuses_on_problems_unless_skipping_broken(extra_content, tmp_path):
    (extra_content / "zz_broken.py").write_text("import nonexistent_module_xyz\n", encoding="utf-8")
    out = tmp_path / "out"
    messages, problems = build.build(out, skip_gold=True)
    assert problems and not out.exists(), "a broken module blocks the build and writes nothing"
    messages, problems = build.build(out, skip_gold=True, skip_broken=True)
    assert problems and (out / "props.json").exists(), "--skip-broken builds the rest but still reports"
    assert messages


def test_a_dataset_nobody_wrote_yet_is_just_absent(tmp_path):
    data, _ = build.collect()
    data.pop("props")
    assert "props.json" not in build.render(data)


def test_repo_datasets_match_the_generator():
    """The committed datasets/ are exactly what the content modules generate (`make data` if this fails)."""
    diffs, problems = build.drift(skip_gold=True)
    assert not problems, problems
    assert not diffs, "\n".join(diffs)


def test_every_dataset_has_a_one_line_description():
    assert set(build.DESCRIPTIONS) == set(build.ORDER)
    for name, desc in build.DESCRIPTIONS.items():
        assert desc.endswith(".") and "\n" not in desc and len(desc) <= 160, name
