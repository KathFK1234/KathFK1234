"""Async HTTP client for Weather-AI API integration."""
# excerpt from backend/app/services/weatherai.py

class WeatherAIClient:
    """Async client for weather-ai.co with caching and error handling."""

    BASE_URL = "https://api.weather-ai.co/v1"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create async HTTP client with bearer token auth."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.BASE_URL,
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=10.0,
            )
        return self._client
