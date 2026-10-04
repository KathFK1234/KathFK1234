# API — core endpoints and orchestration services

REST endpoints in FastAPI for agricultural decision support, backed by PostgreSQL through SQLAlchemy.

- Token-based authentication with role-aware access.
- Business logic kept out of the route handlers, so endpoints stay thin.
- Responses shaped for the people using them: an answer someone can act on, not a dump of the table behind it.
