# Ordlig word-list experiments

This project builds and analyzes local Swedish lemma candidate lists for Ordlig's
five-letter weekday and six-letter weekend games, and includes a local browser app
for filtering candidate words and exploring letter recommendations.

## Data source

The lists are derived from **SALDO**, a descriptive electronic lexicon for modern
Swedish published and distributed by Språkbanken Text. The downloadable SALDO
file is identified as **CC BY 4.0** in the [SALDO resource page](https://spraakbanken.gu.se/en/resources/saldo).

Attribution: Lars Borin, Lennart Lönngren, and Markus Forsberg (2017), *SALDO*
(updated 2017-09-19), enriched and distributed by Språkbanken,
https://doi.org/10.23695/s80w-2517. Licensed under
[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).

The generated lists are filtered and deduplicated adaptations: written lemma
forms are lowercased, Unicode-normalized, restricted to Swedish letters
(`a-z`, `å`, `ä`, `ö`), and proper-noun parts of speech (`pm` family) are
excluded. The result is a research candidate list, not Ordlig's official answer
or accepted-guess list. SALDO is descriptive rather than normative, so further
curation may be needed.

## Project structure

- `app/` contains the complete static web app, including the word lists it loads.
  This folder can be published as a static website without the research files or
  a Python runtime.
- `research/data/` contains the SALDO source archive used to build the lists.
- `research/scripts/` contains the downloader, list builder, analysis tools, and
  local development server.
- `research/reports/` contains generated analysis results.
- `research/tests/` contains tests for word-list processing and feedback rules.

## Local research workflow

Requires Python 3.10 or later; there are no third-party dependencies.

```powershell
python -m research.scripts.download_saldo
python -m research.scripts.build_word_lists
python -m research.scripts.analyze_word_lists
python -m research.scripts.rank_max_coverage_combos
python -m unittest discover -s research/tests
```

The downloader saves its source to `research/data/raw/saldo.xml.gz`. The list
builder writes the app's runtime lists and their metadata to `app/data/`.
Analysis is written to `research/reports/analysis.json`, and combo rankings to
`research/reports/max-coverage-combos.csv`. Output paths can be overridden with
command-line options; run each script with `--help` for details.

## Run and publish the app

Start the app locally with the development server:

```powershell
python -m research.scripts.serve_app
```

Then open `http://127.0.0.1:8000/`. Press `Ctrl+C` in the terminal to stop the
server. The server serves the contents of `app/` only.

For static hosting, publish the contents of `app/` as the website root. No
backend is needed at runtime; the browser loads the local word-list files from
`app/data/` and performs filtering and recommendations locally.

The analysis reports raw character counts, per-position letter counts, and the
number of words containing each letter. These are counts from the candidate
list, not corpus-frequency estimates or game simulations. Five- and six-letter
results are kept separate.

`research/reports/max-coverage-combos.csv` lists all three-word combinations
that tie for maximum distinct-letter coverage, with two rankings: summed distinct green
positions over all candidate answers, and average candidate answers remaining
after duplicate-aware Wordle feedback for all three guesses. The latter assumes
each list word is both a possible answer and a valid guess, and that every
candidate answer is equally likely. The combo words are in canonical
alphabetical order; guess order does not affect either aggregate measure.

## Ordlig helper app

The app supports five-letter weekday and six-letter weekend lists, any number
of guess rows, and green/yellow/gray per-letter feedback. Letter tiles start
gray and cycle through yellow, green, and gray by clicking or pressing the up
arrow; the down arrow cycles in reverse. Left and right arrows move between
letters. Letters and suggested words display in uppercase. It offers:

- All matching candidate words, with a quick search.
- The most common untried letter among the remaining candidates.
- The most common untried letter at an unfixed position.
- Likely positions for letters marked yellow.
- Next-guess suggestions ranked by expected green and yellow tiles, with
  duplicate-letter feedback accounted for (ties prefer more greens).
- A separate suggestion mode that avoids every letter used in previous
  complete guesses and maximizes expected new green/yellow tiles.

Feedback uses duplicate-aware Wordle rules. A guess row only applies after all
its letters are entered. Clicking a suggested word fills the latest incomplete
row, or creates a new row when the latest row is already complete. Candidate
lists and filtering run locally in the browser; the app makes no external
requests. Guess recommendations use the SALDO candidate list as the available
guess list and treat each remaining candidate answer as equally likely.
