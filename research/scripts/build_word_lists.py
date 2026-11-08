from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = ROOT / "research" / "data" / "raw" / "saldo.xml.gz"
DEFAULT_OUTPUT = ROOT / "app" / "data"
SOURCE_URL = "https://svn.spraakbanken.gu.se/sb-arkiv/pub/lmf/saldo/saldo.xml"
ALPHABET = "abcdefghijklmnopqrstuvwxyzåäö"
SWEDISH_ORDER = {letter: index for index, letter in enumerate(ALPHABET)}
LENGTHS = (5, 6)


def build_word_lists(source_path: Path) -> dict[int, list[str]]:
    words = {length: set() for length in LENGTHS}
    opener = gzip.open if source_path.suffix == ".gz" else open

    with opener(source_path, "rb") as source:
        for _, entry in ET.iterparse(source, events=("end",)):
            if entry.tag != "LexicalEntry":
                continue

            lemma = entry.find("Lemma")
            if lemma is not None:
                for representation in lemma.findall("FormRepresentation"):
                    features = {
                        feature.attrib.get("att"): feature.attrib.get("val")
                        for feature in representation.findall("feat")
                    }
                    written_form = features.get("writtenForm")
                    part_of_speech = features.get("partOfSpeech", "")
                    if not written_form or part_of_speech.startswith("pm"):
                        continue

                    word = unicodedata.normalize("NFC", written_form).casefold()
                    if (
                        len(word) in words
                        and all(letter in SWEDISH_ORDER for letter in word)
                    ):
                        words[len(word)].add(word)

            entry.clear()

    return {
        length: sorted(
            words[length],
            key=lambda word: tuple(SWEDISH_ORDER[letter] for letter in word),
        )
        for length in LENGTHS
    }


def write_word_lists(word_lists: dict[int, list[str]], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    metadata: dict[str, object] = {
        "source": "SALDO",
        "source_url": SOURCE_URL,
        "source_doi": "https://doi.org/10.23695/s80w-2517",
        "source_attribution": (
            "Lars Borin, Lennart Lönngren, and Markus Forsberg (2017), "
            "enriched and distributed by Språkbanken"
        ),
        "source_license": "CC BY 4.0",
        "source_license_url": "https://creativecommons.org/licenses/by/4.0/",
        "normalization": "Unicode NFC, casefold, unique lemmas, Swedish alphabet only",
        "excluded_parts_of_speech": "pm family (proper nouns)",
        "lists": {},
    }
    list_metadata = metadata["lists"]
    assert isinstance(list_metadata, dict)

    for length, words in word_lists.items():
        file_name = f"words-{length}.txt"
        output_path = output_dir / file_name
        with output_path.open("w", encoding="utf-8", newline="\n") as output:
            output.writelines(f"{word}\n" for word in words)
        list_metadata[str(length)] = {
            "file": file_name,
            "word_count": len(words),
            "sha256": hashlib.sha256(output_path.read_bytes()).hexdigest(),
        }

    with (output_dir / "metadata.json").open(
        "w", encoding="utf-8", newline="\n"
    ) as output:
        json.dump(metadata, output, ensure_ascii=False, indent=2)
        output.write("\n")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build five- and six-letter Swedish lemma candidate lists."
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help=f"SALDO XML or .xml.gz input (default: {DEFAULT_SOURCE})",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Directory for word lists and metadata (default: {DEFAULT_OUTPUT})",
    )
    args = parser.parse_args()

    if not args.source.is_file():
        parser.error(
            f"SALDO source not found at {args.source}; run scripts\\download_saldo.py first"
        )

    word_lists = build_word_lists(args.source)
    write_word_lists(word_lists, args.output_dir)
    for length, words in word_lists.items():
        print(f"{length}-letter words: {len(words)}")
    print(f"Wrote lists and metadata to {args.output_dir}")


if __name__ == "__main__":
    main()
