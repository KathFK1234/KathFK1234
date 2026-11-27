"""One HTTP session with bounded retries, shared by the sync scripts.

A scheduled run reads GitHub (and MoodForecast AI) a hundred or more times. Without
retries, one dropped connection or 502 stops the whole run, and the site keeps stale
data until the next one. The retries are few and spaced out, honour Retry-After, and
cover only failures a second try can fix: connection errors and 429/500/502/503/504.
Anything else (a 404, a 401) still fails at once, as before.

The one POST the scripts make is GitHub's GraphQL contributions query, which only
reads, so it is safe to repeat.
"""

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

RETRY = Retry(
    total=3,
    backoff_factor=2,
    backoff_max=30,
    status_forcelist=(429, 500, 502, 503, 504),
    allowed_methods=frozenset({"GET", "POST"}),
    respect_retry_after_header=True,
    # After the last try, hand back the response so each script's own status handling runs
    raise_on_status=False,
)


def new_session() -> requests.Session:
    session = requests.Session()
    session.mount("https://", HTTPAdapter(max_retries=RETRY))
    return session


http = new_session()
