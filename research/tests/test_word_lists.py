from __future__ import annotations

import gzip
import tempfile
import unittest
from pathlib import Path

from research.scripts.analyze_word_lists import analyze_words
from research.scripts.build_word_lists import build_word_lists, write_word_lists
from research.scripts.rank_max_coverage_combos import feedback_pattern


SAMPLE_XML = """\
<LexicalResource>
  <Lexicon>
    <LexicalEntry><Lemma><FormRepresentation>
      <feat att="writtenForm" val="Äpple" />
      <feat att="partOfSpeech" val="nn" />
    </FormRepresentation></Lemma></LexicalEntry>
    <LexicalEntry><Lemma><FormRepresentation>
      <feat att="writtenForm" val="a&#x30A;rsta" />
      <feat att="partOfSpeech" val="nn" />
    </FormRepresentation></Lemma></LexicalEntry>
    <LexicalEntry><Lemma><FormRepresentation>
      <feat att="writtenForm" val="äpple" />
      <feat att="partOfSpeech" val="nn" />
    </FormRepresentation></Lemma></LexicalEntry>
    <LexicalEntry><Lemma><FormRepresentation>
      <feat att="writtenForm" val="Stockholm" />
      <feat att="partOfSpeech" val="pm" />
    </FormRepresentation></Lemma></LexicalEntry>
    <LexicalEntry><Lemma><FormRepresentation>
      <feat att="writtenForm" val="röd-x" />
      <feat att="partOfSpeech" val="av" />
    </FormRepresentation></Lemma></LexicalEntry>
    <LexicalEntry><Lemma><FormRepresentation>
      <feat att="writtenForm" val="skolor" />
      <feat att="partOfSpeech" val="nn" />
    </FormRepresentation></Lemma></LexicalEntry>
    <LexicalEntry><Lemma><FormRepresentation>
      <feat att="writtenForm" val="skörda" />
      <feat att="partOfSpeech" val="vb" />
    </FormRepresentation></Lemma></LexicalEntry>
  </Lexicon>
</LexicalResource>
"""


class WordListTests(unittest.TestCase):
    def test_build_lists_normalizes_filters_and_separates_lengths(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            source = Path(temporary_directory) / "saldo.xml.gz"
            with gzip.open(source, "wt", encoding="utf-8") as output:
                output.write(SAMPLE_XML)

            word_lists = build_word_lists(source)

        self.assertEqual(word_lists[5], ["årsta", "äpple"])
        self.assertEqual(word_lists[6], ["skolor", "skörda"])

    def test_write_word_lists_includes_counts_and_checksums(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            output_dir = Path(temporary_directory)
            write_word_lists({5: ["äpple"], 6: ["skolor"]}, output_dir)

            self.assertEqual(
                (output_dir / "words-5.txt").read_text(encoding="utf-8"), "äpple\n"
            )
            metadata = (output_dir / "metadata.json").read_text(encoding="utf-8")

        self.assertIn('"word_count": 1', metadata)
        self.assertIn('"source_license": "CC BY 4.0"', metadata)

    def test_analysis_reports_letter_frequency_and_coverage(self) -> None:
        analysis = analyze_words(["ababa", "aabbb"], 5)

        self.assertEqual(analysis["word_count"], 2)
        self.assertEqual(analysis["total_letters"], 10)
        self.assertEqual(
            analysis["letter_frequency"][:2],
            [{"letter": "a", "count": 5}, {"letter": "b", "count": 5}],
        )
        self.assertEqual(
            analysis["word_coverage"][:2],
            [{"letter": "a", "count": 2}, {"letter": "b", "count": 2}],
        )

    def test_analysis_rejects_mixed_lengths(self) -> None:
        with self.assertRaises(ValueError):
            analyze_words(["ababa", "word"], 5)

    def test_feedback_pattern_handles_duplicate_letters(self) -> None:
        self.assertEqual(feedback_pattern("allee", "apple"), 167)


if __name__ == "__main__":
    unittest.main()
