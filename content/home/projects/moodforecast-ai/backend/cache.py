"""In-memory TTL cache implementation."""
# excerpt from backend/app/services/cache.py

# Enough for thousands of places and searches; beyond it the oldest entries make room
MAX_ENTRIES = 5000


class TTLCache:
    """Simple in-memory cache with TTL support, holding at most `max_entries` values."""

    def __init__(self, ttl_seconds: int = 600, max_entries: int = MAX_ENTRIES):
        self.ttl_seconds = ttl_seconds
        self.max_entries = max_entries
        self._cache: dict[str, tuple[Any, float]] = {}

    def get(self, key: str) -> Optional[Any]:
        """Get cached value if not expired."""
        return self.get_stale(key, self.ttl_seconds)

    def get_stale(self, key: str, max_age_seconds: float) -> Optional[Any]:
        """Get a value up to max_age_seconds old: the last known value when a fresh one can't be fetched."""
        if key not in self._cache:
            return None

        value, timestamp = self._cache[key]
        if time.time() - timestamp > max_age_seconds:
            return None

        return value

    def set(self, key: str, value: Any) -> None:
        """Set a cached value with current timestamp, making room if the cache is full."""
        # Re-inserting moves the key to the end, keeping the oldest entries first
        self._cache.pop(key, None)
        self._cache[key] = (value, time.time())
        while len(self._cache) > self.max_entries:
            del self._cache[next(iter(self._cache))]
