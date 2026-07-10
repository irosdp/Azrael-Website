import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch


MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "find_song_links.py"
SPEC = importlib.util.spec_from_file_location("find_song_links", MODULE_PATH)
finder = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(finder)


class LinkFinderTests(unittest.TestCase):
    def setUp(self):
        self.song = {
            "title": "月影に溺れて",
            "slug": "tsukikage-ni-oborete",
            "releaseDate": "2026-07-01",
            "albumName": "月影に溺れて",
            "isrc": "QZTEST000001",
        }

    def candidate(self, provider):
        return {
            "id": provider,
            "url": f"https://example.com/{provider}",
            "embedUrl": "",
            "previewUrl": "",
            "title": "月影に溺れて",
            "artist": "Azrael Morathane",
            "album": "月影に溺れて",
            "releaseDate": "2026-07-01",
            "artwork": "",
            "source": provider,
        }

    def test_normalize_text_handles_japanese_and_spacing(self):
        self.assertEqual(finder.normalize_text(" 月影 に 溺れて！"), "月影に溺れて")

    def test_exact_metadata_scores_highly(self):
        score, notes = finder.candidate_score(
            self.song, self.candidate("apple"), "Azrael Morathane"
        )
        self.assertGreaterEqual(score, 0.95)
        self.assertIn("歌名完全相符", notes)
        self.assertIn("藝人完全相符", notes)

    @patch.object(finder, "apple_candidates")
    @patch.object(finder, "youtube_candidates")
    def test_process_request_keeps_candidates_for_review(
        self, youtube_candidates, apple_candidates
    ):
        apple_candidates.return_value = [self.candidate("apple")]
        youtube_candidates.return_value = (
            [self.candidate("youtube")],
            [self.candidate("youtubeMusic")],
        )

        result = finder.process_request(
            self.song,
            {"requestId": "request-1", "requestedAt": "2026-07-10T00:00:00Z"},
            "Azrael Morathane",
        )

        self.assertEqual(result["status"], "ready")
        self.assertEqual(result["requestId"], "request-1")
        self.assertEqual(len(result["providers"]["spotify"]), 0)
        self.assertEqual(len(result["providers"]["appleMusic"]), 1)
        self.assertEqual(len(result["providers"]["youtube"]), 1)
        self.assertEqual(len(result["providers"]["youtubeMusic"]), 1)
        self.assertEqual(result["providerStatus"]["spotify"], "由管理者手動更新")
        self.assertEqual(result["providerStatus"]["hyperfollow"], "需由管理者手動提供")


if __name__ == "__main__":
    unittest.main()
