"""Async HTTP client for the Open-Meteo weather API (https://open-meteo.com)."""
# excerpt from backend/app/services/weather.py

# Current-conditions variables requested from Open-Meteo
CURRENT_VARIABLES = "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m"
FORECAST_DAYS = 7


class WeatherClient:
    """Async client for Open-Meteo with caching and error handling."""

    def __init__(self, base_url: str):
        self.base_url = base_url
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create async HTTP client. Open-Meteo needs no API key."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=10.0
            )
        return self._client
