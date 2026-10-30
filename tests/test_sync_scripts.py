"""Tests for the sync scripts, on the standard library: python3 -m unittest discover tests"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import languages_update_script as languages
import mood_sync_script as mood
import projects_sync_script as projects

READ = {
    "private": True,
    "url": "https://github.com/KathFK1234/secret",
    "started": "2026-01-01",
    "updated": "2026-10-30",
    "commits": 12,
    "recent": [{"date": "2026-10-30", "subject": "Add a secret thing"}],
}


class PrivateProjects(unittest.TestCase):
    def test_a_private_project_keeps_its_link_and_commits_to_itself(self):
        entry = projects.public_entry({"name": "Secret", "folder": "secret"}, READ)
        self.assertIsNone(entry["url"])
        self.assertEqual(entry["recent"], [])

    def test_a_private_project_shares_commits_only_when_told_to(self):
        entry = projects.public_entry({"name": "Secret", "folder": "secret", "share": True}, READ)
        self.assertEqual(entry["recent"], READ["recent"])
        self.assertIsNone(entry["url"])

    def test_an_unshared_project_shows_only_its_commit_count(self):
        entry = projects.public_entry({"name": "Secret", "folder": "secret"}, READ)
        table = projects.format_lately([entry])
        self.assertIn("private work · 12 commits so far", table)
        self.assertNotIn("Add a secret thing", table)

    def test_a_team_project_stays_out_of_the_table(self):
        entry = projects.public_entry({"name": "Team", "folder": "team", "team": True}, {**READ, "private": False})
        self.assertNotIn("Team", projects.format_lately([entry]))


class CommitSubjects(unittest.TestCase):
    def test_html_cannot_get_through_a_table_cell(self):
        self.assertEqual(projects.cell("a <b> & c"), "a &lt;b&gt; &amp; c")

    def test_a_pipe_cannot_end_the_cell(self):
        self.assertEqual(projects.cell("a | b"), "a \\| b")

    def test_code_keeps_its_characters(self):
        self.assertEqual(projects.cell("use `a<b>` here"), "use `a<b>` here")

    def test_the_subject_is_the_first_line(self):
        self.assertEqual(projects.subject("  Title\n\nBody"), "Title")
        self.assertEqual(projects.subject("  "), "")

    def test_a_date_is_read_in_utc(self):
        self.assertEqual(projects.day("2026-10-30T23:30:00-03:00"), "2026-10-31")


class Markers(unittest.TestCase):
    def test_projects_replaces_between_markers_only(self):
        self.assertEqual(projects.replace_between("a[s]old[e]b", "[s]", "[e]", "new", inline=True), "a[s]new[e]b")

    def test_projects_leaves_content_alone_without_both_markers(self):
        self.assertEqual(projects.replace_between("a[s]old", "[s]", "[e]", "new"), "a[s]old")

    def test_languages_says_when_markers_are_missing(self):
        self.assertIsNone(languages.replace_between("no markers", "[s]", "[e]", "new"))

    def test_languages_takes_a_replacement_as_plain_text(self):
        self.assertEqual(languages.replace_between("[s]\nold\n[e]", "[s]", "[e]", r"C# \1"), "[s]\nC# \\1\n[e]")


class Manifests(unittest.TestCase):
    def test_package_json_lists_both_kinds_of_dependency(self):
        text = '{"dependencies": {"React": "1"}, "devDependencies": {"vite": "1"}}'
        self.assertEqual(languages.parse_manifest("a/package.json", text), {"react", "vite"})

    def test_a_broken_package_json_lists_nothing(self):
        self.assertEqual(languages.parse_manifest("package.json", "{broken"), set())

    def test_requirements_lose_their_versions_and_comments(self):
        text = "FastAPI==1.0\n# a comment\n--hash=sha256:abc\nrequests>=2\n"
        self.assertEqual(languages.parse_manifest("requirements.txt", text), {"fastapi", "requests"})


class MoodSync(unittest.TestCase):
    def test_only_get_endpoints_under_api_are_listed(self):
        document = {"paths": {
            "/api/mood/{location}": {"get": {"description": "Mood\nmore", "parameters": [
                {"name": "days", "in": "query", "required": True}, {"name": "location", "in": "path"}]}},
            "/api/subscribe": {"post": {}},
            "/health": {"get": {}},
        }}
        self.assertEqual(mood.read_endpoints(document), [{
            "name": "mood", "place": True, "about": "Mood", "params": [{"name": "days", "required": True}],
        }])

    def test_a_service_module_is_read_and_never_run(self):
        source = 'import nothing_of_the_kind\nraise SystemExit(1)\nCOLD_PLACES = ("Oslo",)\n'
        source += 'ACTIVITIES = (Activity("Walk", "outdoor", ("hike",)), Activity(name_from_code(), "x", ()))\n'
        places, activities = mood.read_vocabulary({"a.py": source})
        self.assertEqual(places, {"cold": ["Oslo"]})
        self.assertEqual(activities, [{"name": "Walk", "category": "outdoor", "aliases": ["hike"]}])

    def test_a_module_that_cannot_be_parsed_is_skipped(self):
        self.assertEqual(mood.read_vocabulary({"a.py": "def ("}), ({}, []))


if __name__ == "__main__":
    unittest.main()
