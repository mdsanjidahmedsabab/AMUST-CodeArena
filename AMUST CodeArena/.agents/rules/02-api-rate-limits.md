---
trigger: always_on
description: External Online Judge rate limits and event-sourced leaderboard rules
---
# External OJ & Leaderboard Rules

1. **Codeforces API Rate Limit (REQ-04, REQ-07):** Enforce a strict maximum of 5 requests per second across all BullMQ workers querying Codeforces endpoints, with exponential backoff on HTTP 429/503 responses.
2. **24-Hour Problem Cache (REQ-11):** Cache fetched problem statements and sample test cases in PostgreSQL for at least 24 hours so student page loads never trigger live scraping.
3. **Immutable Contest Log & Redis ZSET Standings (REQ-08, REQ-09):** Store all contest submissions as immutable records in PostgreSQL. Materialize live standings in Redis Sorted Sets (`ZSET`). When a teacher mutates a running contest, replay the submission log in memory, atomically update the Redis `ZSET`, and broadcast the delta via Server-Sent Events (SSE).
