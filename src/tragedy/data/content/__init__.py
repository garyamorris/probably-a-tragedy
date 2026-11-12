"""Authored dataset content.

Build convention (see ``tragedy/data/build.py``): every module in this package that wants to publish a dataset exports

    DATASETS: dict[str, list | dict]      # dataset name -> data

For example ``cast.py`` exports ``{"performers": [...], "staff": [...]}``. The dataset names are the 15 in docs/DATA.md.
Modules that only hold helper data (``genre_farce.py`` feeding ``genres.py``) simply omit ``DATASETS``; modules whose name
starts with an underscore are never imported by the builder.

    uv run python -m tragedy.data build     # regenerate datasets/ (+ MANIFEST.json)
    uv run python -m tragedy.data check     # validate everything that exists against docs/DATA.md
"""
