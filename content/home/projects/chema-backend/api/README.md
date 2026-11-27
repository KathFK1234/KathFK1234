# API: endpoints, sign-in and access control

REST endpoints in FastAPI and Django REST Framework, backed by PostgreSQL through SQLAlchemy.

- Token authentication, role-based access control and rate limiting.
- Sign-in moved from Parse to Supabase after the founder reviewed it.
- Business logic kept out of the route handlers, so endpoints stay thin.
- Responses shaped for the people using them: an answer someone can act on, not a dump of the table behind it.
