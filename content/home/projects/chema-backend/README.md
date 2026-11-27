# Chema: a RAG backend for food-system intelligence

Built during my internship as a Back End Developer at Chakula, now Nawiri (Feb 2026 to Apr 2026).

Ask Chema a question about food and farming, and a Llama model served through Groq answers from retrieval over agricultural datasets, so the answer stays grounded in real data rather than in whatever the model half-remembers.

The bug I remember best: the model kept adding confidence scores nobody asked for. Telling it not to, in the prompt, wasn't enough. So the rule moved out of the prompt and onto the model's output, where it could be enforced instead of requested.

  stack: Python · FastAPI · Django REST Framework · PostgreSQL · SQLAlchemy · Supabase · Groq · Docker · Railway

  api/           endpoints, sign-in and access control
  analytics/     forecasting and reporting
  integration/   the model, retrieval, data pipelines and deployment

It was built before it had any real users, so there is no adoption to report, only what it does and how it is built. The source belongs to the company and is not public, so these folders hold notes, not code.
