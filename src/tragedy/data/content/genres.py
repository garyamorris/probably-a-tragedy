"""Assembles the five genres (docs/DATA.md section 7) into the ``genres`` dataset, in GENRES order."""

from __future__ import annotations

from tragedy.data.content.genre_farce import GENRE as FARCE
from tragedy.data.content.genre_gothic_romance import GENRE as GOTHIC_ROMANCE
from tragedy.data.content.genre_melodrama import GENRE as MELODRAMA
from tragedy.data.content.genre_pantomime import GENRE as PANTOMIME
from tragedy.data.content.genre_whodunit import GENRE as WHODUNIT

DATASETS = {"genres": [MELODRAMA, FARCE, WHODUNIT, GOTHIC_ROMANCE, PANTOMIME]}
