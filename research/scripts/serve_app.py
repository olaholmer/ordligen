from __future__ import annotations

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


APP_ROOT = Path(__file__).resolve().parents[2] / "app"


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve the local Ordlig helper app.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    handler = partial(SimpleHTTPRequestHandler, directory=str(APP_ROOT))
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Ordlig-hjälpen finns på http://{args.host}:{args.port}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStänger Ordlig-hjälpen.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
