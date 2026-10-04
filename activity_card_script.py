#!/usr/bin/env python3
"""
Draw the "On GitHub" card in the README from live GitHub data.

It asks GitHub for the last year of contributions and writes
assets/activity.svg: four headline numbers and a contribution calendar,
styled like the terminal header. The scheduled workflow runs this once a
day, so the card follows the account without any manual editing.

Usage:
    GITHUB_TOKEN=<token> python3 activity_card_script.py
    GITHUB_TOKEN=<token> python3 activity_card_script.py --dry-run

A token is required (GitHub's GraphQL API has no anonymous access). With a
token that belongs to the account, private contributions are counted too,
as totals only.
"""

import argparse
import os
import sys
from datetime import date
from pathlib import Path

import requests
from requests import RequestException

QUERY = """
query($login: String!) {
  user(login: $login) {
    pullRequests { totalCount }
    repositories(ownerAffiliations: OWNER, isFork: false) { totalCount }
    contributionsCollection {
      totalCommitContributions
      restrictedContributionsCount
      contributionCalendar {
        totalContributions
        weeks { contributionDays { contributionCount date } }
      }
    }
  }
}
"""

WIDTH = 840
HEIGHT = 300
CELL = 10
STEP = 13  # cell plus gap
GRID_TOP = 172
# Contributions in a day -> colour, from "none" up to "a lot"
LEVELS = [(0, "#131c1c"), (1, "#134e48"), (3, "#1f8f82"), (6, "#3cc9b5"), (10, "#5eead4")]
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def fetch_activity(username, token):
    response = requests.post(
        "https://api.github.com/graphql",
        json={"query": QUERY, "variables": {"login": username}},
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    if payload.get("errors") or not payload.get("data", {}).get("user"):
        raise SystemExit(f"GitHub could not answer: {payload.get('errors', 'user not found')}")
    return payload["data"]["user"]


def colour_for(count):
    colour = LEVELS[0][1]
    for threshold, value in LEVELS:
        if count >= threshold:
            colour = value
    return colour


def render(user):
    """Return the SVG text for the card."""
    contributions = user["contributionsCollection"]
    calendar = contributions["contributionCalendar"]
    weeks = calendar["weeks"]
    # Commits to private repositories are reported separately from the public count
    commits = contributions["totalCommitContributions"] + contributions["restrictedContributionsCount"]

    tiles = [
        (calendar["totalContributions"], "contributions (past year)"),
        (commits, "commits (past year)"),
        (user["pullRequests"]["totalCount"], "pull requests (all time)"),
        (user["repositories"]["totalCount"], "repositories"),
    ]

    grid_left = (WIDTH - len(weeks) * STEP + (STEP - CELL)) // 2
    cells = []
    labels = []
    last_month = None
    for column, week in enumerate(weeks):
        x = grid_left + column * STEP
        first_day = date.fromisoformat(week["contributionDays"][0]["date"])
        # Label a column when a new month starts in it (skipping a cramped first column)
        if first_day.month != last_month:
            if last_month is not None and column < len(weeks) - 2:
                labels.append(f'<text x="{x}" y="{GRID_TOP - 8}" class="dim small">{MONTHS[first_day.month - 1]}</text>')
            last_month = first_day.month
        for day in week["contributionDays"]:
            # GitHub weeks start on Sunday, which is row 0
            row = (date.fromisoformat(day["date"]).weekday() + 1) % 7
            count = day["contributionCount"]
            noun = "contribution" if count == 1 else "contributions"
            cells.append(
                f'<rect x="{x}" y="{GRID_TOP + row * STEP}" width="{CELL}" height="{CELL}" rx="2" '
                f'fill="{colour_for(count)}"><title>{day["date"]}: {count} {noun}</title></rect>'
            )

    tile_width = (WIDTH - 56) // len(tiles)
    tile_svg = []
    for index, (number, label) in enumerate(tiles):
        x = 28 + index * tile_width
        tile_svg.append(f'<text x="{x}" y="108" class="number">{number:,}</text>')
        tile_svg.append(f'<text x="{x}" y="130" class="dim small">{label}</text>')

    legend_x = grid_left + len(weeks) * STEP - 5 * STEP - 74
    legend_y = GRID_TOP + 7 * STEP + 10
    legend = [f'<text x="{legend_x}" y="{legend_y + 9}" class="dim small">less</text>']
    legend += [
        f'<rect x="{legend_x + 38 + i * STEP}" y="{legend_y}" width="{CELL}" height="{CELL}" rx="2" fill="{colour}"/>'
        for i, (_, colour) in enumerate(LEVELS)
    ]
    legend.append(f'<text x="{legend_x + 44 + len(LEVELS) * STEP}" y="{legend_y + 9}" class="dim small">more</text>')

    description = "; ".join(f"{number:,} {label}" for number, label in tiles)
    newline = "\n  "
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" width="{WIDTH}" height="{HEIGHT}" role="img" aria-label="GitHub activity: {description}">
  <style>
    text {{ font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace; font-size: 15px; fill: #d8e3e0; }}
    .dim {{ fill: #6f8280; }}
    .accent {{ fill: #5eead4; }}
    .accent2 {{ fill: #8ca9ff; }}
    .small {{ font-size: 12px; }}
    .number {{ font-size: 30px; font-weight: 700; fill: #5eead4; }}
  </style>
  <rect x="1" y="1" width="{WIDTH - 2}" height="{HEIGHT - 2}" rx="12" fill="#0a0e0e" stroke="#1c2626" stroke-width="2"/>
  <text x="28" y="44"><tspan class="accent">visitor@katheu</tspan><tspan class="dim">:</tspan><tspan class="accent2">~</tspan><tspan class="dim">$</tspan> git activity --since "1 year ago"</text>
  {newline.join(tile_svg)}
  {newline.join(labels)}
  {newline.join(cells)}
  {newline.join(legend)}
</svg>
"""


def main():
    parser = argparse.ArgumentParser(description="Draw the README activity card from GitHub data")
    parser.add_argument("--username", default="KathFK1234", help="GitHub username (default: KathFK1234)")
    parser.add_argument(
        "--token",
        default=os.environ.get("GITHUB_TOKEN"),
        help="GitHub token (defaults to $GITHUB_TOKEN)",
    )
    parser.add_argument("--output", default="assets/activity.svg", help="Where to write the card")
    parser.add_argument("--dry-run", action="store_true", help="Fetch and report, but write nothing")
    args = parser.parse_args()

    if not args.token:
        print("Error: a token is required (set GITHUB_TOKEN)")
        return 1

    try:
        user = fetch_activity(args.username, args.token)
    except RequestException as error:
        status = getattr(error.response, "status_code", "no response")
        print(f"Error fetching activity: HTTP {status}")
        return 1

    svg = render(user)
    total = user["contributionsCollection"]["contributionCalendar"]["totalContributions"]
    print(f"✓ {total:,} contributions in the past year")

    if args.dry_run:
        print("(Dry run: no files modified)")
        return 0

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists() and output.read_text(encoding="utf-8") == svg:
        print(f"✓ {args.output} is already up to date")
        return 0
    output.write_text(svg, encoding="utf-8")
    print(f"✓ Wrote {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
