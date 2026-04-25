#!/usr/bin/env python3
import json
import os
import re
import tempfile
import threading
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


PROJECT_ROOT = Path(os.environ.get("GAME_PROJECT_ROOT", Path(__file__).resolve().parent)).resolve()
DIST_DIR = Path(os.environ.get("GAME_DIST_DIR", PROJECT_ROOT / "dist")).resolve()
DATA_FILE = Path(os.environ.get("GAME_DATA_FILE", PROJECT_ROOT / "rankings.json")).resolve()
HOST = os.environ.get("GAME_HOST", "0.0.0.0")
PORT = int(os.environ.get("GAME_PORT", "8000"))
MAX_PLAYERS = 1000
DATA_LOCK = threading.Lock()

BLOCKED_WORDS = [
    "fuck", "shit", "damn", "bitch", "asshole", "bastard", "crap", "piss", "dick", "cock",
    "pussy", "sex", "nigger", "nigga", "faggot", "slut", "whore", "douche", "turd", "bullshit",
    "isis", "terror", "kill", "rape",
]
BLOCKED_CHARS = set('@#$%^&*!~`<>/\\|"\':;\n\t')


def ensure_data_file():
    if DATA_FILE.exists():
        return
    atomic_write({"players": []})


def load_data():
    ensure_data_file()
    try:
        with DATA_FILE.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError):
        data = {"players": []}

    players = data.get("players")
    if not isinstance(players, list):
        return {"players": []}
    return {"players": players}


def atomic_write(data):
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=DATA_FILE.parent, delete=False) as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        temp_name = handle.name
    os.replace(temp_name, DATA_FILE)


def normalize_username(username):
    return re.sub(r"\s+", " ", username.strip())


def validate_username(username):
    if not isinstance(username, str):
        return False, "username must be a string"

    username = normalize_username(username)
    if not username:
        return False, "username is required"
    if len(username) < 2:
        return False, "username must be at least 2 chars"
    if len(username) > 16:
        return False, "username must be at most 16 chars"
    if any(char in username for char in BLOCKED_CHARS):
        return False, "username contains invalid characters"

    lowered = username.lower()
    if any(word in lowered for word in BLOCKED_WORDS):
        return False, "username contains blocked words"

    return True, username


def normalize_record(raw):
    valid, value = validate_username(raw.get("username"))
    if not valid:
        raise ValueError(value)

    try:
        kills = max(0, int(raw.get("kills", 0)))
        wave = max(1, int(raw.get("wave", 1)))
        headshots = max(0, int(raw.get("headshots", 0)))
        max_streak = max(0, int(raw.get("maxStreak", 0)))
    except (TypeError, ValueError) as exc:
        raise ValueError("score fields must be integers") from exc

    timestamp = int(datetime.now(tz=timezone.utc).timestamp() * 1000)
    return {
        "id": f"{timestamp}-{os.urandom(4).hex()}",
        "username": value,
        "kills": kills,
        "wave": wave,
        "headshots": headshots,
        "maxStreak": max_streak,
        "date": datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z"),
        "timestamp": timestamp,
    }


def sort_players(players):
    return sorted(
        players,
        key=lambda player: (
            -int(player.get("kills", 0)),
            -int(player.get("wave", 0)),
            -int(player.get("headshots", 0)),
            -int(player.get("maxStreak", 0)),
            int(player.get("timestamp", 0)),
        ),
    )


def is_better_record(new_record, old_record):
    return (
        int(new_record["kills"]),
        int(new_record["wave"]),
        int(new_record["headshots"]),
        int(new_record["maxStreak"]),
        -int(new_record["timestamp"]),
    ) > (
        int(old_record.get("kills", 0)),
        int(old_record.get("wave", 0)),
        int(old_record.get("headshots", 0)),
        int(old_record.get("maxStreak", 0)),
        -int(old_record.get("timestamp", 0)),
    )


def upsert_player_record(record):
    with DATA_LOCK:
        data = load_data()
        players = data["players"]
        existing = next((player for player in players if player.get("username") == record["username"]), None)

        if existing is None:
            players.append(record)
            saved_record = record
        elif is_better_record(record, existing):
            existing.update(record)
            saved_record = existing
        else:
            existing["lastPlayedAt"] = record["date"]
            saved_record = existing

        sorted_players = sort_players(players)[:MAX_PLAYERS]
        atomic_write({"players": sorted_players})
        return saved_record, sorted_players


class GameRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST_DIR), **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/healthz":
            return self.send_json(
                HTTPStatus.OK,
                {
                    "success": True,
                    "status": "ok",
                    "dist": str(DIST_DIR),
                    "data_file": str(DATA_FILE),
                },
            )

        if parsed.path == "/api/rankings":
            data = load_data()
            players = sort_players(data["players"])[:100]
            return self.send_json(HTTPStatus.OK, {"success": True, "players": players})

        if parsed.path == "/":
            self.path = "/index.html"

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api/rankings":
            return self.send_json(HTTPStatus.NOT_FOUND, {"success": False, "error": "not found"})

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            content_length = 0

        raw_body = self.rfile.read(content_length)
        try:
            payload = json.loads(raw_body.decode("utf-8") or "{}")
        except (UnicodeDecodeError, json.JSONDecodeError):
            return self.send_json(HTTPStatus.BAD_REQUEST, {"success": False, "error": "invalid json"})

        try:
            record = normalize_record(payload)
        except ValueError as exc:
            return self.send_json(HTTPStatus.BAD_REQUEST, {"success": False, "error": str(exc)})

        saved_record, players = upsert_player_record(record)
        rank = next((index + 1 for index, player in enumerate(players) if player.get("username") == saved_record["username"]), None)
        return self.send_json(
            HTTPStatus.OK,
            {
                "success": True,
                "record": saved_record,
                "rank": rank,
                "players": players[:100],
            },
        )

    def send_json(self, status, data):
        encoded = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, fmt, *args):
        print(f"[{self.log_date_time_string()}] {self.address_string()} {fmt % args}")


def main():
    if not DIST_DIR.exists():
        raise FileNotFoundError(f"dist directory not found: {DIST_DIR}")

    ensure_data_file()
    server = ThreadingHTTPServer((HOST, PORT), GameRequestHandler)
    print(f"Server running at http://{HOST}:{PORT}")
    print(f"Serving static files from: {DIST_DIR}")
    print(f"Ranking data file: {DATA_FILE}")
    server.serve_forever()


if __name__ == "__main__":
    main()
