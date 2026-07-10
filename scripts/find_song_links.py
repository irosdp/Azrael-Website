#!/usr/bin/env python3
"""Find streaming-link candidates for requested songs.

The script is intentionally dependency-free so GitHub Actions can run it without
an install step. It writes candidates for human review and never changes the
published platform URLs in data/songs.json.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SONGS_PATH = ROOT / "data" / "songs.json"
SITE_PATH = ROOT / "data" / "site-config.json"
REQUESTS_PATH = ROOT / "data" / "link-requests.json"
CANDIDATES_PATH = ROOT / "data" / "link-candidates.json"
USER_AGENT = "Azrael-Website-Link-Finder/1.0 (+https://irosdp.github.io/Azrael-Website/)"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_json(path: Path, fallback: Any = None) -> Any:
    if not path.exists():
        if fallback is not None:
            return fallback
        raise FileNotFoundError(path)
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def http_json(url: str, headers: dict[str, str] | None = None, data: bytes | None = None) -> Any:
    request = urllib.request.Request(
        url,
        data=data,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json", **(headers or {})},
        method="POST" if data is not None else "GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")[:400]
        raise RuntimeError(f"HTTP {error.code}: {body}") from error


def normalize_text(value: str | None) -> str:
    normalized = unicodedata.normalize("NFKC", value or "").casefold()
    return "".join(character for character in normalized if character.isalnum())


def parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value[:10])
    except ValueError:
        return None


def candidate_score(song: dict[str, Any], candidate: dict[str, Any], artist_name: str) -> tuple[float, str]:
    song_title = normalize_text(song.get("title"))
    candidate_title = normalize_text(candidate.get("title"))
    expected_artist = normalize_text(artist_name)
    candidate_artist = normalize_text(candidate.get("artist"))
    score = 0.0
    notes: list[str] = []

    if song_title and candidate_title == song_title:
        score += 0.55
        notes.append("歌名完全相符")
    elif song_title and (song_title in candidate_title or candidate_title in song_title):
        score += 0.38
        notes.append("歌名高度相符")
    else:
        shared = len(set(song_title) & set(candidate_title)) / max(len(set(song_title)), 1)
        score += min(shared * 0.22, 0.22)
        notes.append("歌名需要人工確認")

    if expected_artist and expected_artist == candidate_artist:
        score += 0.28
        notes.append("藝人完全相符")
    elif expected_artist and (expected_artist in candidate_artist or candidate_artist in expected_artist):
        score += 0.2
        notes.append("藝人名稱相符")

    expected_date = parse_date(song.get("releaseDate"))
    actual_date = parse_date(candidate.get("releaseDate"))
    if expected_date and actual_date:
        days = abs((expected_date - actual_date).days)
        if days == 0:
            score += 0.12
            notes.append("發售日相符")
        elif days <= 7:
            score += 0.07
            notes.append("發售日在一週內")

    if song.get("albumName") and normalize_text(song["albumName"]) == normalize_text(candidate.get("album")):
        score += 0.05
        notes.append("專輯相符")

    return min(round(score, 3), 1.0), "、".join(notes)


def rank(song: dict[str, Any], candidates: list[dict[str, Any]], artist_name: str, limit: int = 5) -> list[dict[str, Any]]:
    ranked = []
    for candidate in candidates:
        confidence, notes = candidate_score(song, candidate, artist_name)
        candidate["confidence"] = confidence
        candidate["matchNotes"] = notes
        ranked.append(candidate)
    ranked.sort(key=lambda item: item["confidence"], reverse=True)
    return ranked[:limit]


def apple_candidates(song: dict[str, Any], artist_name: str) -> list[dict[str, Any]]:
    query = urllib.parse.urlencode(
        {
            "term": f'{artist_name} {song["title"]}',
            "media": "music",
            "entity": "song",
            "attribute": "songTerm",
            "country": os.getenv("APPLE_STOREFRONT", "US"),
            "limit": 20,
        }
    )
    payload = http_json(f"https://itunes.apple.com/search?{query}")
    candidates = []
    for item in payload.get("results", []):
        url = item.get("trackViewUrl")
        if not url:
            continue
        artwork = (item.get("artworkUrl100") or "").replace("100x100bb", "600x600bb")
        parsed = urllib.parse.urlparse(url)
        embed_url = urllib.parse.urlunparse(("https", "embed.music.apple.com", parsed.path, "", parsed.query, ""))
        candidates.append(
            {
                "id": str(item.get("trackId") or ""),
                "url": url,
                "embedUrl": embed_url,
                "previewUrl": item.get("previewUrl") or "",
                "title": item.get("trackName") or "",
                "artist": item.get("artistName") or "",
                "album": item.get("collectionName") or "",
                "releaseDate": item.get("releaseDate") or "",
                "artwork": artwork,
                "source": "Apple iTunes Search API",
            }
        )
    return rank(song, candidates, artist_name)


def youtube_candidates(song: dict[str, Any], artist_name: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    api_key = os.getenv("YOUTUBE_API_KEY", "")
    if not api_key:
        raise LookupError("尚未設定 YouTube Data API key")
    params = {
        "part": "snippet",
        "q": f'{artist_name} "{song["title"]}"',
        "type": "video",
        "maxResults": 15,
        "key": api_key,
    }
    payload = http_json(f"https://www.googleapis.com/youtube/v3/search?{urllib.parse.urlencode(params)}")
    youtube = []
    youtube_music = []
    for item in payload.get("items", []):
        video_id = item.get("id", {}).get("videoId")
        snippet = item.get("snippet") or {}
        if not video_id:
            continue
        thumbnails = snippet.get("thumbnails") or {}
        artwork = (thumbnails.get("high") or thumbnails.get("medium") or thumbnails.get("default") or {}).get("url", "")
        base = {
            "id": video_id,
            "embedUrl": f"https://www.youtube-nocookie.com/embed/{video_id}",
            "previewUrl": "",
            "title": snippet.get("title") or "",
            "artist": snippet.get("channelTitle") or "",
            "album": "",
            "releaseDate": snippet.get("publishedAt") or "",
            "artwork": artwork,
            "source": "YouTube Data API",
        }
        youtube.append({**base, "url": f"https://youtu.be/{video_id}"})
        youtube_music.append({**base, "url": f"https://music.youtube.com/watch?v={video_id}"})
    return rank(song, youtube, artist_name), rank(song, youtube_music, artist_name)


def safe_provider_call(name: str, call: Any, provider_status: dict[str, str]) -> list[dict[str, Any]]:
    try:
        result = call()
        provider_status[name] = "ok" if result else "找不到候選"
        return result
    except LookupError as error:
        provider_status[name] = str(error)
    except Exception as error:  # Keep other providers available when one API fails.
        provider_status[name] = f"查詢失敗：{str(error)[:180]}"
    return []


def process_request(
    song: dict[str, Any],
    request: dict[str, Any],
    artist_name: str,
) -> dict[str, Any]:
    provider_status: dict[str, str] = {}
    providers: dict[str, list[dict[str, Any]]] = {}

    providers["appleMusic"] = safe_provider_call(
        "appleMusic", lambda: apple_candidates(song, artist_name), provider_status
    )
    providers["spotify"] = []
    provider_status["spotify"] = "由管理者手動更新"

    try:
        youtube, youtube_music = youtube_candidates(song, artist_name)
        providers["youtube"] = youtube
        providers["youtubeMusic"] = youtube_music
        provider_status["youtube"] = "ok" if youtube else "找不到候選"
        provider_status["youtubeMusic"] = "ok" if youtube_music else "找不到候選"
    except LookupError as error:
        provider_status["youtube"] = str(error)
        provider_status["youtubeMusic"] = str(error)
        providers["youtube"] = []
        providers["youtubeMusic"] = []
    except Exception as error:
        message = f"查詢失敗：{str(error)[:180]}"
        provider_status["youtube"] = message
        provider_status["youtubeMusic"] = message
        providers["youtube"] = []
        providers["youtubeMusic"] = []

    provider_status["hyperfollow"] = "需由管理者手動提供"
    provider_status["amazonMusic"] = "目前保留人工確認"
    nonempty = sum(bool(items) for items in providers.values())
    status = "ready" if nonempty >= 3 else "partial" if nonempty else "error"
    return {
        "requestId": request.get("requestId") or request.get("requestedAt") or utc_now(),
        "status": status,
        "completedAt": utc_now(),
        "query": {
            "title": song.get("title", ""),
            "artist": artist_name,
            "releaseDate": song.get("releaseDate", ""),
            "isrc": song.get("isrc", ""),
        },
        "providerStatus": provider_status,
        "providers": providers,
    }


def run(slug: str | None = None) -> int:
    songs = load_json(SONGS_PATH)
    site = load_json(SITE_PATH)
    requests_data = load_json(REQUESTS_PATH, {"version": 1, "requests": {}})
    candidates_data = load_json(CANDIDATES_PATH, {"version": 1, "updatedAt": "", "songs": {}})
    requests = requests_data.setdefault("requests", {})
    candidates = candidates_data.setdefault("songs", {})
    songs_by_slug = {song.get("slug"): song for song in songs if song.get("slug")}
    artist_name = site.get("artistName") or "Azrael Morathane"

    selected = []
    for request_slug, request in requests.items():
        if slug and request_slug != slug:
            continue
        if not slug and request.get("status") != "requested":
            continue
        selected.append((request_slug, request))

    if slug and slug not in requests:
        requests[slug] = {
            "requestId": utc_now(),
            "slug": slug,
            "requestedAt": utc_now(),
            "requestedBy": "workflow_dispatch",
            "status": "requested",
        }
        selected = [(slug, requests[slug])]

    if not selected:
        print("No requested song-link searches found.")
        return 0

    failures = 0
    for request_slug, request in selected:
        song = songs_by_slug.get(request_slug)
        if not song:
            request["status"] = "error"
            request["completedAt"] = utc_now()
            request["error"] = "Song slug is not present in data/songs.json"
            failures += 1
            continue

        print(f"Searching platform links for {song.get('title')} ({request_slug})")
        request["status"] = "searching"
        try:
            result = process_request(song, request, artist_name)
            candidates[request_slug] = result
            request["status"] = result["status"]
            request["completedAt"] = result["completedAt"]
            request.pop("error", None)
            if result["status"] == "error":
                failures += 1
        except Exception as error:
            request["status"] = "error"
            request["completedAt"] = utc_now()
            request["error"] = str(error)[:300]
            candidates[request_slug] = {
                "requestId": request.get("requestId"),
                "status": "error",
                "completedAt": request["completedAt"],
                "query": {"title": song.get("title", ""), "artist": artist_name},
                "providerStatus": {"workflow": str(error)[:300]},
                "providers": {},
            }
            failures += 1

    candidates_data["updatedAt"] = utc_now()
    save_json(REQUESTS_PATH, requests_data)
    save_json(CANDIDATES_PATH, candidates_data)
    print(f"Processed {len(selected)} request(s); {failures} returned no usable candidates.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Find streaming-link candidates for Azrael songs.")
    parser.add_argument("--slug", help="Process one slug even if its request is not pending.")
    args = parser.parse_args()
    return run(args.slug)


if __name__ == "__main__":
    sys.exit(main())
