"""FastAPI application factory."""
# excerpt from backend/app/main.py

def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    app = FastAPI(
        title="MoodForecast AI",
        description="Where environmental intelligence meets psychological wellbeing",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.include_router(forecast.router)
    app.include_router(wellbeing.router)
    app.include_router(subscribe.router)

    @app.get("/health")
    async def health() -> HealthResponse:
        """Health check endpoint for Railway deploy probe."""
        return HealthResponse(status="ok")

    # Static files (frontend)
    static_path = Path(__file__).parent / "static"
    if static_path.exists():
        app.mount("/", StaticFiles(directory=str(static_path), html=True), name="static")

    return app


app = create_app()
