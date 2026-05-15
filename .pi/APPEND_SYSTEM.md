## Implementation style

- Work incrementally: implement one logical piece, then run a verification command (build, lint, test, or health check) before moving on
- Do not mentally plan the entire solution before starting — begin writing after a brief analysis (3–5 bullet points max)
- After each significant file group, pause and run the relevant check (e.g. `docker compose build api`, `pnpm tsc --noEmit`, `pytest`, `ruff check .`)
- If a check fails, fix it immediately before writing the next piece
- Prefer many small focused tool calls over one large batch of writes
- When implementing a feature that spans frontend and backend, wire up and verify one end before starting the other
