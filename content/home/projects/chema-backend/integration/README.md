# Integration: the model, retrieval, pipelines and deployment

- A Llama model served through Groq, answering from retrieval over agricultural datasets so it stays grounded in the data.
- When prompt instructions alone didn't stop the model adding confidence scores, the rule was enforced on its output instead. A prompt is a request; a check on the output is a guarantee.
- Supabase for managed Postgres and sign-in.
- Multi-stage Docker builds, deployed on Railway.
- Credentials kept in environment configuration, never in the repo.
