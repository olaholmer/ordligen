from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from pathlib import Path

from .build_word_lists import DEFAULT_OUTPUT, ROOT, SWEDISH_ORDER


DEFAULT_REPORT = ROOT / "research" / "reports" / "max-coverage-combos.csv"
WORD_LENGTH = 5
GUESS_COUNT = 3


def load_words(input_dir: Path) -> list[str]:
    path = input_dir / f"words-{WORD_LENGTH}.txt"
    with path.open(encoding="utf-8") as source:
        return [line.strip() for line in source if line.strip()]


def load_analysis() -> dict[str, object]:
    path = ROOT / "research" / "reports" / "analysis.json"
    with path.open(encoding="utf-8") as source:
        analysis = json.load(source)
    return analysis[str(WORD_LENGTH)]


def select_top_letters(
    word_coverage: list[dict[str, int | str]],
) -> tuple[list[str], int]:
    ranked = sorted(
        word_coverage,
        key=lambda item: (-int(item["count"]), SWEDISH_ORDER[str(item["letter"])]),
    )
    letters = [str(item["letter"]) for item in ranked[: WORD_LENGTH * GUESS_COUNT]]
    score = sum(int(item["count"]) for item in ranked[: WORD_LENGTH * GUESS_COUNT])
    return letters, score


def find_combinations(words: list[str], letters: list[str]) -> list[tuple[str, ...]]:
    letter_index = {letter: index for index, letter in enumerate(letters)}
    full_mask = (1 << len(letters)) - 1
    words_by_mask: dict[int, list[str]] = {}

    for word in words:
        if len(word) != WORD_LENGTH or len(set(word)) != WORD_LENGTH:
            continue
        if any(letter not in letter_index for letter in word):
            continue
        mask = sum(1 << letter_index[letter] for letter in word)
        words_by_mask.setdefault(mask, []).append(word)

    masks = list(words_by_mask)
    combinations: set[tuple[str, ...]] = set()
    for first_index, first_mask in enumerate(masks):
        for second_mask in masks[first_index + 1 :]:
            if first_mask & second_mask:
                continue
            third_mask = full_mask ^ (first_mask | second_mask)
            if third_mask not in words_by_mask:
                continue
            for first in words_by_mask[first_mask]:
                for second in words_by_mask[second_mask]:
                    for third in words_by_mask[third_mask]:
                        combinations.add(tuple(sorted((first, second, third))))

    return sorted(combinations)


def feedback_pattern(guess: str, answer: str) -> int:
    marks = [0] * WORD_LENGTH
    remaining = Counter()

    for position, (guess_letter, answer_letter) in enumerate(zip(guess, answer)):
        if guess_letter == answer_letter:
            marks[position] = 2
        else:
            remaining[answer_letter] += 1

    for position, guess_letter in enumerate(guess):
        if marks[position] == 0 and remaining[guess_letter] > 0:
            marks[position] = 1
            remaining[guess_letter] -= 1

    return sum(mark * 3**position for position, mark in enumerate(marks))


def rank_combinations(
    combinations: list[tuple[str, ...]],
    words: list[str],
    word_coverage: list[dict[str, int | str]],
    position_frequency: list[dict[str, object]],
) -> list[dict[str, object]]:
    letter_counts = {
        str(item["letter"]): int(item["count"]) for item in word_coverage
    }
    position_counts = [
        {
            str(item["letter"]): int(item["count"])
            for item in position["letters"]
        }
        for position in position_frequency
    ]

    all_guesses = sorted({word for combo in combinations for word in combo})
    feedback = {
        guess: [feedback_pattern(guess, answer) for answer in words]
        for guess in all_guesses
    }

    results: list[dict[str, object]] = []
    for combo in combinations:
        distinct_letters = set("".join(combo))
        if len(distinct_letters) != WORD_LENGTH * GUESS_COUNT:
            raise ValueError(f"{combo} does not contain 15 distinct letters")

        green_total = sum(
            position_counts[position].get(letter, 0)
            for position in range(WORD_LENGTH)
            for letter in {word[position] for word in combo}
        )

        feedback_groups = Counter(
            tuple(feedback[guess][answer_index] for guess in combo)
            for answer_index in range(len(words))
        )
        remaining_sum = sum(group_size**2 for group_size in feedback_groups.values())

        results.append(
            {
                "combo": combo,
                "letter_score": sum(letter_counts[letter] for letter in distinct_letters),
                "green_total": green_total,
                "green_average": green_total / len(words),
                "remaining_sum": remaining_sum,
                "remaining_average": remaining_sum / len(words),
                "largest_remaining_group": max(feedback_groups.values()),
                "feedback_patterns": len(feedback_groups),
            }
        )

    green_order = sorted(
        results,
        key=lambda result: (
            -int(result["green_total"]),
            float(result["remaining_average"]),
            result["combo"],
        ),
    )
    remaining_order = sorted(
        results,
        key=lambda result: (
            int(result["remaining_sum"]),
            -int(result["green_total"]),
            result["combo"],
        ),
    )

    for field, ordering, score_key in (
        ("green_rank", green_order, "green_total"),
        ("remaining_rank", remaining_order, "remaining_sum"),
    ):
        rank = 0
        previous_score: int | None = None
        for index, result in enumerate(ordering, start=1):
            score = int(result[score_key])
            if score != previous_score:
                rank = index
                previous_score = score
            result[field] = rank

    return green_order


def write_report(
    report_path: Path,
    results: list[dict[str, object]],
    word_count: int,
    maximum_letter_score: int,
) -> None:
    report_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "green_rank",
        "remaining_rank",
        "guess_1",
        "guess_2",
        "guess_3",
        "letter_score",
        "green_total",
        "green_average_per_answer",
        "remaining_candidates_average",
        "largest_remaining_group",
        "distinct_feedback_patterns",
    ]

    with report_path.open("w", encoding="utf-8-sig", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for result in results:
            combo = result["combo"]
            writer.writerow(
                {
                    "green_rank": result["green_rank"],
                    "remaining_rank": result["remaining_rank"],
                    "guess_1": combo[0],
                    "guess_2": combo[1],
                    "guess_3": combo[2],
                    "letter_score": result["letter_score"],
                    "green_total": result["green_total"],
                    "green_average_per_answer": f"{result['green_average']:.6f}",
                    "remaining_candidates_average": (
                        f"{result['remaining_average']:.6f}"
                    ),
                    "largest_remaining_group": result["largest_remaining_group"],
                    "distinct_feedback_patterns": result["feedback_patterns"],
                }
            )

    print(f"Candidate answers: {word_count}")
    print(f"Maximum distinct-letter score: {maximum_letter_score}")
    print(f"Combos with that score: {len(results)}")
    print(f"Wrote both rankings to {report_path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Rank all maximum-letter-coverage three-guess combinations by "
            "green matches and remaining candidates."
        )
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Directory containing words-5.txt (default: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_REPORT,
        help=f"CSV output path (default: {DEFAULT_REPORT})",
    )
    args = parser.parse_args()

    words = load_words(args.input_dir)
    analysis = load_analysis()
    word_coverage = analysis["word_coverage"]
    position_frequency = analysis["position_frequency"]
    if not isinstance(word_coverage, list) or not isinstance(position_frequency, list):
        raise ValueError("Analysis report is missing letter-frequency data")

    letters, maximum_letter_score = select_top_letters(word_coverage)
    combinations = find_combinations(words, letters)
    results = rank_combinations(
        combinations, words, word_coverage, position_frequency
    )
    if any(int(result["letter_score"]) != maximum_letter_score for result in results):
        raise ValueError("A generated combination does not have the maximum letter score")

    write_report(args.output, results, len(words), maximum_letter_score)
    print("Top by distinct green positions:")
    for result in results[:10]:
        print(
            f"{result['green_rank']}: {' · '.join(result['combo'])} "
            f"({result['green_total']} greens)"
        )
    print("Top by fewest remaining candidates:")
    for result in sorted(
        results,
        key=lambda item: (
            int(item["remaining_rank"]),
            float(item["remaining_average"]),
            -int(item["green_total"]),
            item["combo"],
        ),
    )[:10]:
        print(
            f"{result['remaining_rank']}: {' · '.join(result['combo'])} "
            f"({result['remaining_average']:.3f} remaining on average; "
            f"{result['largest_remaining_group']} worst case)"
        )


if __name__ == "__main__":
    main()
