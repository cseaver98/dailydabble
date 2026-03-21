# Yelple - Project Brief

Last updated: 2026-03-14 (America/New_York)

## Product Idea
A daily Wordle-like guessing game for local businesses:
- Show hint 1: a review excerpt
- Show hint 2/3: additional excerpts or metadata
- Player guesses the place's overall star rating (out of 5)

## Core Decisions So Far
1. Google Places review data is likely too restrictive for long-term storage/caching for this game style.
2. Yelp Places API is a better candidate for low-cost daily-ingest architecture.
3. Google Maps + Street View may still be used for visual clues, with proper attribution and policy compliance.

## Policy Constraints to Respect
### Yelp
- Yelp Places content caching is generally limited to 24 hours.
- Business IDs can be stored indefinitely.
- Archive gameplay metadata is fine; long-term storage of Yelp content is likely not.
- Yelp docs mention that "analysis" is not permitted for Places integrations; this game mechanic may need explicit written approval.

### Google Maps / Street View
- Can be used for map and Street View presentation with proper Google attribution.
- Do not store restricted Google content long-term unless specifically allowed.

## Cost Direction
- Daily challenge architecture can keep provider API calls very low (roughly one ingestion cycle/day, plus occasional refreshes), instead of one API call per play.

## Recommended Next Step
Send Yelp a written approval request describing exact use case:
- daily rating-guess game
- review excerpts as hints
- ad-supported monetization
- caching/deletion behavior (24h TTL)
- archive behavior (game stats retained, provider content refreshed or removed)

## MVP Architecture (Compliance-First)
1. `daily_cron` selects a place and fetches allowed fields.
2. Store challenge payload with strict TTL for provider content.
3. Serve gameplay from DB/cache for active challenge window.
4. Purge provider content at TTL expiry.
5. Keep permanent internal analytics only (guesses, scores, retention).

## Open Questions
1. Yelp written approval for this exact gameplay mechanic.
2. Exact attribution placement in UI for Yelp + Google assets.
3. Archive replay behavior (live refetch vs limited archive depth).
