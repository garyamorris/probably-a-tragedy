"""Probably a Tragedy: datasets.

* ``tragedy.data.tags``     the closed vocabularies (tags, skills, roles, calamities, ...)
* ``tragedy.data.content``  the authored tables (one module per theme, each exporting ``DATASETS``)
* ``tragedy.data.build``    deterministic generator: ``python -m tragedy.data build [--check]``
* ``tragedy.data.check``    validator for everything above: ``python -m tragedy.data check``
* ``tragedy.data.loader``   runtime access to ``datasets/``: ``load("performers")``
"""
