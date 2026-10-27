---
name: elo-analytics
description: >
  Battle-Royale Elo rating system with logistic win probability and binary-search
  expected rank, 10 colour tiers from Newbie to Legendary Grandmaster, plus
  per-student topic strength/weakness graphs and teacher cohort heatmaps.
---

# Elo Analytics Skill

## Overview
Implements **REQ-15** (topic strength/weakness diagnostics) and **REQ-16**
(Battle-Royale Elo rating with 10 tiers).

## Part 1 — Battle-Royale Elo Rating (REQ-16)

### Algorithm
1. **Logistic win probability** between contestants *i* and *j*:

   $$P(i > j) = \frac{1}{1 + 10^{(R_j - R_i) / 400}}$$

2. **Expected rank** for contestant *i* among *N* participants:

   $$E_i = \sum_{j \neq i} P(j > i) + 1$$

   Optimise with **binary search** over the sorted rating list for O(N log N).

3. **Rating delta** (CF-style):

   $$\Delta R_i = K \cdot \left(\frac{N - \text{ActualRank}_i}{N - 1} - \frac{N - E_i}{N - 1}\right)$$

   where *K* = 40 for new users (< 6 rated contests) and *K* = 20 otherwise.

4. Apply after each rated contest ends; store the delta and new rating in
   `UserRatingHistory`.

### 10 Colour Tiers

| Tier | Rating Range | Hex Colour |
|------|-------------|------------|
| Newbie | < 1200 | `#808080` |
| Pupil | 1200–1399 | `#008000` |
| Specialist | 1400–1599 | `#03A89E` |
| Expert | 1600–1899 | `#0000FF` |
| Candidate Master | 1900–2099 | `#AA00AA` |
| Master | 2100–2299 | `#FF8C00` |
| International Master | 2300–2399 | `#FF8C00` |
| Grandmaster | 2400–2599 | `#FF0000` |
| International Grandmaster | 2600–2899 | `#FF0000` |
| Legendary Grandmaster | ≥ 2900 | `#FF0000` |

### Implementation Location
- `/server/src/services/elo.js` — pure functions: `calcWinProbability`,
  `calcExpectedRank`, `calcRatingDelta`, `getTier`.
- `/server/src/workers/ratingWorker.js` — BullMQ worker that runs after a contest
  finalises, computes deltas for all participants, and batch-updates the DB.

## Part 2 — Topic Strength / Weakness Graphs (REQ-15)

### Data Model
- Each `Submission` links to a `Problem` which carries `tags[]` (e.g.,
  `dp`, `graphs`, `greedy`).
- Aggregate per-student: `{ tag, attempted, solved, avgAttempts }`.

### Student View
- Personal radar/spider chart (ECharts `radar` series) showing solve-rate per topic.
- Weak topics (solve-rate < 40 %) highlighted in red with suggested practice links.

### Teacher View
- Cohort heatmap (`tag × student`) colour-coded by solve-rate.
- Exportable as CSV for academic reporting.

### API Endpoints
- `GET /api/analytics/student/:id/topics` — per-student topic breakdown.
- `GET /api/analytics/cohort/:contestId/heatmap` — teacher-only (RBAC-guarded).
