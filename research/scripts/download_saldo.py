from __future__ import annotations

import argparse
import gzip
import hashlib
import tempfile
import urllib.request
from pathlib import Path


SOURCE_URL = "https://svn.spraakbanken.gu.se/sb-arkiv/pub/lmf/saldo/saldo.xml"
ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = ROOT / "research" / "data" / "raw" / "saldo.xml.gz"


def download(output_path: Path) -> tuple[int, str]:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    digest = hashlib.sha256()
    byte_count = 0

    try:
        with tempfile.NamedTemporaryFile(
            dir=output_path.parent, suffix=".part", delete=False
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
            with urllib.request.urlopen(SOURCE_URL, timeout=60) as response:
                with gzip.GzipFile(fileobj=temporary_file, mode="wb", mtime=0) as zipped:
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        zipped.write(chunk)
                        digest.update(chunk)
                        byte_count += len(chunk)
        temporary_path.replace(output_path)
    finally:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink()

    return byte_count, digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description="Download the SALDO Swedish lexicon.")
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Compressed output path (default: {DEFAULT_OUTPUT})",
    )
    args = parser.parse_args()

    byte_count, checksum = download(args.output)
    print(f"Downloaded {byte_count} bytes from {SOURCE_URL}")
    print(f"Saved compressed source to {args.output}")
    print(f"SHA-256 of source XML: {checksum}")


if __name__ == "__main__":
    main()
