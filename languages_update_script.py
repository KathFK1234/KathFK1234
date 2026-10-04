#!/usr/bin/env python3
"""
Detect the languages, frameworks and tools used across all public GitHub
repositories, then update the README and the website's data file.

Languages come from GitHub's own language statistics. Frameworks and tools
are detected by reading each repository's dependency files (requirements.txt,
pyproject.toml, package.json, ...) and looking for files such as a Dockerfile.
Only names listed in KNOWN_PACKAGES / KNOWN_FILES below are reported, so add a
line there when you start using something that should show up.

The README is updated between these marker pairs:

    <!-- stack:start -->      icons and a table of detected tools
    <!-- stack:end -->
    <!-- languages:start -->  language list and pie chart
    <!-- languages:end -->

The website reads src/data/stack.json (the `skills` and `stack` commands).

Usage:
    python3 languages_update_script.py --dry-run
    python3 languages_update_script.py --username <your_github_username>

For higher rate limits, put a token in the GITHUB_TOKEN environment variable
(preferred, since it stays out of your shell history) or pass --token.
The scheduled GitHub Actions workflow runs this once a day.

Private repositories are included with --include-private, which needs a token
that can read them. Only totals leave the script: private repository names are
never printed or written anywhere.
"""

import argparse
import json
import os
import re
import sys
from collections import Counter
from datetime import date
from pathlib import Path
from urllib.parse import quote

import requests
from requests import RequestException

START_MARKER = "<!-- languages:start -->"
END_MARKER = "<!-- languages:end -->"
STACK_START_MARKER = "<!-- stack:start -->"
STACK_END_MARKER = "<!-- stack:end -->"
# Build and template file types that GitHub counts but that are not languages
NOT_LANGUAGES = ["Dockerfile", "Makefile", "Mako", "Procfile", "Batchfile"]
EXCLUDED = ["Shell"] + NOT_LANGUAGES  # Exclude non-programming

CATEGORIES = [
    "Backend",
    "Frontend",
    "Data & databases",
    "AI",
    "Testing",
    "Infrastructure",
]

# package name (lowercase) -> (display name, category, skillicons.dev icon or None)
KNOWN_PACKAGES = {
    # Backend
    "fastapi": ("FastAPI", "Backend", "fastapi"),
    "django": ("Django", "Backend", "django"),
    "djangorestframework": ("Django REST Framework", "Backend", None),
    "flask": ("Flask", "Backend", "flask"),
    "express": ("Express", "Backend", "express"),
    "@nestjs/core": ("NestJS", "Backend", "nestjs"),
    "sqlalchemy": ("SQLAlchemy", "Backend", None),
    "sqlmodel": ("SQLModel", "Backend", None),
    "pydantic": ("Pydantic", "Backend", None),
    "celery": ("Celery", "Backend", None),
    "rails": ("Ruby on Rails", "Backend", "rails"),
    # Frontend
    "react": ("React", "Frontend", "react"),
    "next": ("Next.js", "Frontend", "nextjs"),
    "vue": ("Vue", "Frontend", "vue"),
    "svelte": ("Svelte", "Frontend", "svelte"),
    "vite": ("Vite", "Frontend", "vite"),
    "tailwindcss": ("Tailwind CSS", "Frontend", "tailwind"),
    "bootstrap": ("Bootstrap", "Frontend", "bootstrap"),
    # Data & databases
    "psycopg2": ("PostgreSQL", "Data & databases", "postgres"),
    "psycopg2-binary": ("PostgreSQL", "Data & databases", "postgres"),
    "psycopg": ("PostgreSQL", "Data & databases", "postgres"),
    "asyncpg": ("PostgreSQL", "Data & databases", "postgres"),
    "pg": ("PostgreSQL", "Data & databases", "postgres"),
    "pymongo": ("MongoDB", "Data & databases", "mongodb"),
    "mongoose": ("MongoDB", "Data & databases", "mongodb"),
    "redis": ("Redis", "Data & databases", "redis"),
    "supabase": ("Supabase", "Data & databases", "supabase"),
    "@supabase/supabase-js": ("Supabase", "Data & databases", "supabase"),
    "pandas": ("pandas", "Data & databases", None),
    "numpy": ("NumPy", "Data & databases", None),
    "scikit-learn": ("scikit-learn", "Data & databases", "sklearn"),
    "statsmodels": ("statsmodels", "Data & databases", None),
    "matplotlib": ("Matplotlib", "Data & databases", None),
    # AI
    "openai": ("OpenAI API", "AI", None),
    "anthropic": ("Claude API", "AI", None),
    "groq": ("Groq", "AI", None),
    "langchain": ("LangChain", "AI", None),
    "transformers": ("Hugging Face Transformers", "AI", None),
    "torch": ("PyTorch", "AI", "pytorch"),
    "tensorflow": ("TensorFlow", "AI", "tensorflow"),
    # Testing
    "pytest": ("pytest", "Testing", None),
    "vitest": ("Vitest", "Testing", "vitest"),
    "jest": ("Jest", "Testing", "jest"),
    "playwright": ("Playwright", "Testing", None),
    "@playwright/test": ("Playwright", "Testing", None),
    "rspec": ("RSpec", "Testing", None),
}

# file name pattern -> (display name, category, skillicons.dev icon or None)
KNOWN_FILES = {
    r"(^|/)Dockerfile$": ("Docker", "Infrastructure", "docker"),
    r"(^|/)(docker-)?compose\.ya?ml$": ("Docker Compose", "Infrastructure", None),
    r"(^|/)railway\.(toml|json)$": ("Railway", "Infrastructure", None),
    r"^\.github/workflows/[^/]+\.ya?ml$": ("GitHub Actions", "Infrastructure", "githubactions"),
    r"(^|/)vercel\.json$": ("Vercel", "Infrastructure", "vercel"),
}

# GitHub language name -> skillicons.dev icon
LANGUAGE_ICONS = {
    "Python": "python",
    "JavaScript": "js",
    "TypeScript": "ts",
    "HTML": "html",
    "CSS": "css",
    "C": "c",
    "C++": "cpp",
    "Shell": "bash",
    "Go": "go",
    "Rust": "rust",
    "Java": "java",
    "Ruby": "ruby",
    "PHP": "php",
    "Kotlin": "kotlin",
    "Dart": "dart",
}

# Tools that never appear in a dependency file but belong in the icon row
BASE_ICONS = {
    "aws": "AWS",
    "linux": "Linux",
    "git": "Git",
    "github": "GitHub",
    "figma": "Figma",
    "postman": "Postman",
}

MANIFEST_PATTERN = re.compile(
    r"(^|/)(requirements[^/]*\.txt|pyproject\.toml|Pipfile|package\.json|Gemfile)$"
)
IGNORED_DIRS = re.compile(r"(^|/)(node_modules|venv|\.venv|env|vendor|dist|build)/")
MAX_MANIFESTS_PER_REPO = 8


def parse_manifest(path, text):
    """Return the lowercase package names declared in one dependency file."""
    name = path.rsplit("/", 1)[-1]

    if name == "package.json":
        try:
            data = json.loads(text)
        except ValueError:
            return set()
        packages = set()
        for section in ("dependencies", "devDependencies"):
            if isinstance(data.get(section), dict):
                packages.update(data[section])
        return {package.lower() for package in packages}

    if name == "Gemfile":
        return {match.lower() for match in re.findall(r"^\s*gem\s+['\"]([^'\"]+)", text, re.M)}

    if name.endswith(".txt"):
        lines = (line.strip() for line in text.splitlines())
        matches = (re.match(r"[A-Za-z0-9][A-Za-z0-9._-]*", line) for line in lines)
        return {match.group(0).lower() for match in matches if match}

    # pyproject.toml and Pipfile: take every quoted or bare package-like name
    names = re.findall(r"^\s*['\"]?([A-Za-z0-9][A-Za-z0-9._-]*)", text, re.M)
    names += re.findall(r"['\"]([A-Za-z0-9][A-Za-z0-9._-]*)\s*(?:\[[^\]]*\])?\s*[<>=~!^;'\"]", text)
    return {found.lower() for found in names}


def detect_tools(paths, manifests):
    """Return {display name: (category, icon)} for one repository."""
    found = {}
    for pattern, (display, category, icon) in KNOWN_FILES.items():
        if any(re.search(pattern, path) for path in paths):
            found[display] = (category, icon)
    for path, text in manifests.items():
        for package in parse_manifest(path, text):
            if package in KNOWN_PACKAGES:
                display, category, icon = KNOWN_PACKAGES[package]
                found[display] = (category, icon)
    return found


class GitHubLanguageFetcher:
    def __init__(self, username, token=None, include_private=False):
        self.username = username
        self.token = token
        self.include_private = include_private
        self.private_count = 0
        self.headers = {}
        self.language_bytes = Counter()
        self.language_repos = Counter()
        self.tool_repos = Counter()
        self.tool_info = {}
        self.repo_count = 0
        if token:
            self.headers["Authorization"] = f"Bearer {token}"

    def _get(self, url, **params):
        response = requests.get(url, headers=self.headers, params=params, timeout=20)
        response.raise_for_status()
        return response

    def fetch_repositories(self):
        """Return every non-fork repository the user owns."""
        if self.include_private:
            # Lists the token owner's repositories, private ones included
            url = "https://api.github.com/user/repos"
            query = {"affiliation": "owner", "visibility": "all"}
        else:
            url = f"https://api.github.com/users/{self.username}/repos"
            query = {"type": "owner"}

        repos = []
        page = 1
        while True:
            try:
                batch = self._get(
                    url, per_page=100, page=page, sort="updated", **query
                ).json()
            except RequestException as error:
                # A partial list would silently shrink the README, so stop here.
                status = getattr(error.response, "status_code", "no response")
                raise SystemExit(f"Error fetching repositories: HTTP {status}")
            repos.extend(
                repo
                for repo in batch
                if not repo["fork"]
                and repo["owner"]["login"].lower() == self.username.lower()
            )
            if len(batch) < 100:
                break
            page += 1
        self.private_count = sum(1 for repo in repos if repo["private"])
        return repos

    def fetch_file(self, repo, path):
        """Return one file's text, or None if it cannot be read."""
        if repo["private"]:
            response = requests.get(
                f"{repo['url']}/contents/{path}",
                headers={**self.headers, "Accept": "application/vnd.github.raw+json"},
                params={"ref": repo["default_branch"]},
                timeout=20,
            )
        else:
            # raw.githubusercontent.com does not count against the API rate limit
            response = requests.get(
                f"https://raw.githubusercontent.com/{repo['full_name']}/{repo['default_branch']}/{path}",
                timeout=20,
            )
        return response.text if response.ok else None

    def scan_repository(self, repo):
        """Record the languages and known tools used in one repository."""
        langs = self._get(repo["languages_url"]).json()
        self.language_bytes.update(langs)
        self.language_repos.update(langs.keys())

        tree = self._get(
            f"{repo['url']}/git/trees/{repo['default_branch']}", recursive=1
        ).json()
        paths = [
            item["path"]
            for item in tree.get("tree", [])
            if item["type"] == "blob" and not IGNORED_DIRS.search(item["path"])
        ]

        manifests = {}
        for path in [p for p in paths if MANIFEST_PATTERN.search(p)][:MAX_MANIFESTS_PER_REPO]:
            text = self.fetch_file(repo, path)
            if text is not None:
                manifests[path] = text

        tools = detect_tools(paths, manifests)
        for display, info in tools.items():
            self.tool_repos[display] += 1
            self.tool_info[display] = info
        return langs, tools

    def fetch_all_languages(self):
        """Scan every repository. Returns the language names found (with repeats)."""
        print(f"Fetching repositories for {self.username}...")
        repos = self.fetch_repositories()
        self.repo_count = len(repos)

        for repo in repos:
            # This output lands in public workflow logs, so private names stay out of it
            name = "(private repository)" if repo["private"] else repo["name"]
            try:
                langs, tools = self.scan_repository(repo)
            except RequestException as error:
                status = getattr(error.response, "status_code", None)
                if status in (404, 409):  # empty repository
                    print(f"  - {name}: empty")
                    continue
                # Losing one repository would drop its tools from the README.
                # The error text contains the URL, so only the status is shown.
                raise SystemExit(f"Error reading {name}: HTTP {status}")
            summary = ", ".join(list(langs) + sorted(tools))
            print(f"  ✓ {name}: {summary}")

        return list(self.language_repos.elements())

    def get_curated_languages(self, languages, top_n=12):
        """
        Get the most frequently used languages, with some curation.
        Returns both raw count and a curated list for the README.
        """
        if not languages:
            return []

        counter = Counter(languages)
        most_common = counter.most_common(top_n * 2)  # Get extra to curate

        # Prioritize languages and filter
        curated = []
        for lang, count in most_common:
            if lang not in EXCLUDED:
                curated.append(lang)
                if len(curated) >= top_n:
                    break

        return curated

    def format_languages_for_readme(self, languages):
        """Format languages as a markdown string."""
        if not languages:
            return "No languages detected"
        return " · ".join(languages)

    def format_chart_for_readme(self, languages):
        """Format a Mermaid pie chart of code volume for the curated languages."""
        sizes = sorted(
            ((lang, self.language_bytes[lang]) for lang in languages),
            key=lambda item: item[1],
            reverse=True,
        )
        total = sum(size for _, size in sizes) or 1
        lines = [
            "```mermaid",
            # Percentages go in the legend; this hides the ones drawn on the slices
            '%%{init: {"themeVariables": {"pieSectionTextSize": "0px"}}}%%',
            "pie title Share of code across my repositories",
        ]
        lines += [
            f'    "{lang} · {size / total:.1%}" : {size / 1024:.1f}'
            for lang, size in sizes
            if size
        ]
        lines.append("```")
        return "\n".join(lines)

    def tools_by_category(self):
        """Return [(category, [tool names])], most used tool first."""
        grouped = []
        for category in CATEGORIES:
            names = [name for name, (cat, _) in self.tool_info.items() if cat == category]
            names.sort(key=lambda name: (-self.tool_repos[name], name.lower()))
            if names:
                grouped.append((category, names))
        return grouped

    def icon_entries(self, languages):
        """(icon, name, link) for the README: languages, detected tools, then the fixed ones."""
        entries = []
        shown = list(languages) + (["Shell"] if "Shell" in self.language_repos else [])
        for lang in shown:
            if lang in LANGUAGE_ICONS:
                # Language icons open my repositories written in that language
                link = f"https://github.com/{self.username}?tab=repositories&language={quote(lang.lower())}"
                entries.append((LANGUAGE_ICONS[lang], lang, link))
        for _, names in self.tools_by_category():
            entries += [
                (self.tool_info[name][1], name, "#toolbox")
                for name in names
                if self.tool_info[name][1]
            ]
        entries += [(icon, name, "#toolbox") for icon, name in BASE_ICONS.items()]

        unique = {}
        for icon, name, link in entries:
            unique.setdefault(icon, (icon, name, link))  # keep order, drop repeats
        return list(unique.values())

    def format_stack_for_readme(self, languages, updated):
        """Format the icon rows and the table of detected tools."""
        entries = self.icon_entries(languages)
        # Even rows of at most 10, so the last row is never a lone icon
        rows = -(-len(entries) // 10)
        per_line = -(-len(entries) // rows)

        # One image per tool, each carrying its name, so hovering shows what it is
        lines = ['<p align="center">']
        for index, (icon, name, link) in enumerate(entries):
            lines.append(
                f'  <a href="{link}" title="{name}">'
                f'<img src="https://skillicons.dev/icons?i={icon}" width="48" height="48" alt="{name}" title="{name}">'
                "</a>"
            )
            if (index + 1) % per_line == 0 and index + 1 < len(entries):
                lines.append("  <br>")
        lines += [
            "</p>",
            "",
            "<br>",
            "",
            "| Found in my repositories | |",
            "| --- | --- |",
            f"| **Languages** | {' · '.join(languages)} |",
        ]
        for category, names in self.tools_by_category():
            lines.append(f"| **{category}** | {' · '.join(names)} |")
        scope = "repositories (public and private)" if self.private_count else "public repositories"
        lines += [
            "",
            f"<sub>Detected automatically from {self.repo_count} {scope} · last changed {updated}</sub>",
        ]
        return "\n".join(lines)

    def build_data(self):
        """The website's view of the same information."""
        languages = [
            {"name": name, "bytes": size, "repos": self.language_repos[name]}
            for name, size in self.language_bytes.most_common()
            if name not in NOT_LANGUAGES
        ]
        tools = [
            {"name": name, "category": category, "repos": self.tool_repos[name]}
            for category, names in self.tools_by_category()
            for name in names
        ]
        return {
            "repos": self.repo_count,
            "includesPrivate": self.private_count > 0,
            "languages": languages,
            "tools": tools,
        }


def replace_between(content, start, end, replacement):
    """Replace whatever sits between two markers. Returns None if they are missing."""
    pattern = re.compile(rf"({re.escape(start)}\n).*?(\n{re.escape(end)})", re.DOTALL)
    if not pattern.search(content):
        return None
    # A function replacement keeps names like "C#" or "\\" from being read as regex syntax
    return pattern.sub(lambda match: f"{match.group(1)}{replacement}{match.group(2)}", content)


def update_readme(readme_path, sections):
    """Update the README file. `sections` is a list of (start, end, text)."""
    readme_file = Path(readme_path)

    if not readme_file.exists():
        print(f"Error: {readme_path} not found")
        return False

    with open(readme_file, "r", encoding="utf-8") as f:
        content = f.read()

    updated_content = content
    for start, end, text in sections:
        result = replace_between(updated_content, start, end, text)
        if result is None:
            print("Warning: Could not find these markers in README:")
            print(start)
            print(end)
            return False
        updated_content = result

    if updated_content == content:
        print(f"✓ {readme_path} is already up to date")
        return True

    with open(readme_file, "w", encoding="utf-8") as f:
        f.write(updated_content)

    print(f"✓ Updated {readme_path}")
    return True


def load_previous_data(data_path):
    try:
        with open(data_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def main():
    parser = argparse.ArgumentParser(
        description="Detect languages and tools on GitHub and update the README and website"
    )
    parser.add_argument(
        "--username", default="KathFK1234", help="GitHub username (default: KathFK1234)"
    )
    parser.add_argument(
        "--token",
        default=os.environ.get("GITHUB_TOKEN"),
        help="GitHub Personal Access Token (optional; defaults to $GITHUB_TOKEN)",
    )
    parser.add_argument(
        "--readme", default="README.md", help="Path to README file (default: README.md)"
    )
    parser.add_argument(
        "--data",
        default="src/data/stack.json",
        help="Path to the website data file (default: src/data/stack.json)",
    )
    parser.add_argument(
        "--top-n",
        type=int,
        default=12,
        help="Number of top languages to include (default: 12)",
    )
    parser.add_argument(
        "--include-private",
        action="store_true",
        help="Also scan private repositories (needs a token that can read them)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be updated without modifying files",
    )

    args = parser.parse_args()

    if args.include_private and not args.token:
        print("Error: --include-private needs a token (set GITHUB_TOKEN)")
        return 1

    fetcher = GitHubLanguageFetcher(args.username, args.token, args.include_private)

    print("\n🔍 Fetching your repositories...\n")
    languages = fetcher.fetch_all_languages()

    if not languages:
        print("No languages found. Check your username and try again.")
        return 1

    print(f"\n✓ Found {len(languages)} language instances across your repositories\n")

    curated = fetcher.get_curated_languages(languages, args.top_n)
    formatted = fetcher.format_languages_for_readme(curated)
    formatted += "\n\n" + fetcher.format_chart_for_readme(curated)

    # Keep the old date unless something actually changed, so a daily run
    # with nothing new produces no diff at all.
    data = fetcher.build_data()
    previous = load_previous_data(args.data)
    unchanged = {key: previous.get(key) for key in data} == data
    data["updated"] = (
        previous["updated"] if unchanged and previous.get("updated") else date.today().isoformat()
    )

    stack = fetcher.format_stack_for_readme(curated, data["updated"])

    print("📝 Languages and tools for your README:\n")
    print(f"{stack}\n\n{formatted}\n")

    if args.dry_run:
        print("(Dry run: no files modified)")
        return 0

    sections = [
        (STACK_START_MARKER, STACK_END_MARKER, stack),
        (START_MARKER, END_MARKER, formatted),
    ]
    if not update_readme(args.readme, sections):
        return 1

    data_file = Path(args.data)
    data_file.parent.mkdir(parents=True, exist_ok=True)
    data_file.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"✓ Wrote {args.data}")
    print("✨ Your README and website data are ready!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
