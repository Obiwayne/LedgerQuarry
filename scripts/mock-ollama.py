"""Stand-in for Ollama, for tests and screenshots without a GPU or a model download.

python scripts/mock-ollama.py [port]   (default 11500)

Answers /api/tags with the default model and /api/chat with a fixed receipt
after a short delay, the way a real model takes a few seconds.
"""
import datetime
import json
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 11500


class Handler(BaseHTTPRequestHandler):
    def _json(self, obj):
        body = json.dumps(obj).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith("/api/tags"):
            return self._json({"models": [{"name": "qwen2.5vl:7b"}]})
        self.send_error(404)

    def do_POST(self):
        length = int(self.headers.get("content-length", 0))
        self.rfile.read(length)
        if self.path.startswith("/api/chat"):
            time.sleep(2.5)
            receipt = {
                "merchant": "Gail's Bakery",
                "date": datetime.date.today().isoformat(),
                "total": 14.85,
                "tax": 2.48,
                "currency": "",
                "category": "eating-out",
                "payment": "card",
                "items": [
                    {"name": "Flat white", "amount": 3.6},
                    {"name": "Cinnamon bun", "amount": 3.95},
                    {"name": "Sourdough loaf", "amount": 5.5},
                    {"name": "Oat milk", "amount": 1.8},
                ],
            }
            return self._json({"message": {"role": "assistant", "content": json.dumps(receipt)}})
        self.send_error(404)

    def log_message(self, *args):
        pass


ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
