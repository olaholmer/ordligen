from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

from .build_word_lists import ALPHABET, DEFAULT_OUTPUT, ROOT, SWEDISH_ORDER


DEFAULT_REPORT = ROOT / "research" / "reports" / "analysis.json"
LENGTHS = (5, 6)


def analyze_words(words: list[str], length: int) -> dict[str, object]:
    if any(len(word) != length for word in words):
        raise ValueError(f"Expected only {length}-letter words")

    letter_counts = Counter(letter for word in words for letter in word)
    word_counts = Counter(letter for word in words for letter in set(word))
    positional_counts = [
        Counter(word[position] for word in words) for position in range(length)
    ]

    def ranked_counts(counts: Counter[str]) -> list[dict[str, int | str]]:
        return [
            {"letter": letter, "count": counts[letter]}
            for letter in sorted(
                ALPHABET, key=lambda candidate: (-counts[candidate], SWEDISH_ORDER[candidate])
            )
            if counts[letter]
        ]

    return {
        "word_count": len(words),
        "unique_word_count": len(set(words)),
        "total_letters": sum(letter_counts.values()),
        "letter_frequency": ranked_counts(letter_counts),
        "word_coverage": ranked_counts(word_counts),
        "position_frequency": [
            {"position": index + 1, "letters": ranked_counts(counts)}
            for index, counts in enumerate(positional_counts)
        ],
    }


def read_word_list(path: Path, expected_length: int) -> list[str]:
    with path.open(encoding="utf-8") as source:
        words = [line.strip() for line in source if line.strip()]
    if any(len(word) != expected_length for word in words):
        raise ValueError(f"{path} contains a word that is not {expected_length} letters")
    return words


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Analyze letter frequencies in the generated candidate lists."
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Directory containing words-5.txt and words-6.txt (default: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_REPORT,
        help=f"JSON report path (default: {DEFAULT_REPORT})",
    )
    args = parser.parse_args()

    report: dict[str, object] = {}
    for length in LENGTHS:
        words = read_word_list(args.input_dir / f"words-{length}.txt", length)
        report[str(length)] = analyze_words(words, length)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8", newline="\n") as output:
        json.dump(report, output, ensure_ascii=False, indent=2)
        output.write("\n")

    for length in LENGTHS:
        summary = report[str(length)]
        assert isinstance(summary, dict)
        print(f"{length}-letter words: {summary['word_count']}")
        print(
            f"Most frequent letters: "
            f"{', '.join(item['letter'] for item in summary['letter_frequency'][:5])}"
        )
    print(f"Wrote analysis report to {args.output}")


if __name__ == "__main__":
    main()
