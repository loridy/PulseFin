# PulseFin — P0 / P1 implementation baseline

Status: **planning and source-probe only**. This branch does not claim to deliver the live product.

## Goal

- **P0 — Source proof of concept:** WallStreetCN global live feed and high-priority China/US official publications, with health checks, timestamps, recoverable cursors and provenance.
- **P1 — Live news:** use the existing AIHOT visual system and layout in PulseFin. Build a dedicated raw-news timeline rather than making AI selection a prerequisite for display.
- **Later:** dedicated Macro / China / AI supply-chain / Policy workspaces, entity tracking, source intelligence, event clustering, structured data and market linkage.

## What the fork already provides

The main branch is an AIHOT fork with React Router web, Fastify API, PostgreSQL, pg-boss workers and existing `rss`, `web_list`, `json_list`, `external` collectors. Keep those components; do **not** copy the Python curses UI.

The WallStreetCN CLI project is MIT-licensed, Python standard-library-only, and documents:

- Listing API: `https://api-one.wallstcn.com/apiv1/content/lives?channel=global-channel&client=pc&limit=50&first_page=true`
- Page backwards: `cursor={next_cursor}`
- Latest `id`, `display_time`, `title`, `content_text`, `score`, and cursors.
- It polls the latest page every 15 seconds in its terminal mode. It does not prove an official supported API, nor an authorized right to redistribute full articles.

Avoid accidentally confusing `next_cursor` (history), `polling_cursor` (returned metadata; semantics require testing), and our own last-seen item ID.

## Official-source registry (initial)

| ID | Region | Agency | Mechanism | Status |
|---|---|---|---|---|
| wscn-global | Global | WallStreetCN (media, not official) | JSON API | accessible, not licensed/contracted |
| fed-monetary | US | Federal Reserve FOMC/monetary policy | official RSS | access tested |
| bls-cpi | US | BLS CPI | official RSS | access tested |
| bls-employment | US | BLS Employment Situation | official RSS | access tested |
| bls-jolts | US | BLS JOLTS | official RSS | access tested |
| bea-news | US | BEA news releases | official RSS | access tested |
| nbs-releases | China | National Bureau of Statistics data releases | official RSS | official listing confirmed; request timed out in one test |
| nbs-analysis | China | NBS data interpretation | official RSS | official listing confirmed; request timed out in one test |
| pbc-news | China | People's Bank of China | official site | planned; connector not yet verified |
| ndrc-policy | China | NDRC notifications and policy | official list | planned; selectors not yet validated |
| state-council | China | State Council policy document database | official list | planned; selectors not yet validated |
| csrc | China | CSRC announcements | official list | planned; selectors not yet validated |
| safe | China | SAFE foreign-exchange policy/data | official list | planned; selectors not yet validated |
| sec-filings | US | SEC EDGAR | official API | planned; source/filing scope and rate limits to be set |

Add only verified and scoped sources to the production collector. A live feed must not silently drop official news because an RSS endpoint times out.

## Initial P0 probe

Run with Node.js 24 (no new dependencies):

```bash
node --test scripts/pulsefin-p0-probe.test.mjs
node scripts/pulsefin-p0-probe.mjs
node scripts/pulsefin-p0-probe.mjs --only=wscn-global,fed-monetary
```

It emits a machine-readable JSON health report with response time, item count, latest published time, source ID and error details. It is **one-shot** and does not save, republish, backfill or monitor anything. A failing source gives a nonzero exit code.

## P0 design after probe

- Source registry: stable source ID, agency/publisher, domain, country, priority, connector kind, poll target, licence policy, status and last success/error.
- Raw event contract: `source_id`, `external_id`, `url`, `title_original`, `summary_original`, `published_at`, `first_seen_at`, `ingested_at`, `updated_at`, `raw_metadata`, `hash`, `revision`.
- Unique identity: source ID + external ID, with URL fallback; corrections update a version/revision, not create an unrelated new story.
- Use persistent storage and scheduled jobs with retries, rate limits and checkpointing. On restart, catch up to watermark; measure missed messages against source listing.
- News delivery must be independent of LLM processing. A model outage must never suppress new raw messages.
- Keep source text and publication rights separate: public UI should default to headline/short excerpt/link, subject to source terms.
- Observe fetch success, p50/p95 discovery lag, clock validity, duplicate ratio, missing items and queue delay; don't infer market latency from page rendering speed.

## P1 live UI (AIHOT visual language)

Preserve AIHOT typography, cards, side navigation, responsive layout and dark/light themes. A new `Live` timeline should show unprocessed raw news and support source, region, importance, date and free-text filters.

Use server-side ingestion plus a fast HTTP delta endpoint. The browser can initially poll **our API** every 5–15 seconds; never cause each viewer to poll WallStreetCN directly. Show `N new updates` if the user is reading older messages, rather than force scrolling. All news must be visible independent of AI scores. RSS publications may update far less often; each source needs its own cadence and policies.

Proposed P0/P1 acceptance:
1. 72 hours of source availability/latency logging; reports explain all failures and time gaps.
2. No duplicate items by source/external ID, correct UTC/Asia-Singapore date display, restart recovery and backlog continuity.
3. Source updates in the live UI without manual reload; no AI gate or summary required.
4. Regression check: original AIHOT pages work; mobile and desktop preserve layouts; no third-party content/keys leaked.
5. Confirm content redistribution rights before any public-facing feed.

## References

- https://github.com/InphinitiZ/wallstreetcn-cli
- https://www.federalreserve.gov/feeds/feeds.htm
- https://www.bls.gov/feed/
- https://www.bea.gov/resources/for-developers
- https://www.stats.gov.cn/wzgl/rss/
- https://www.sec.gov/search-filings/edgar-application-programming-interfaces

This is a source-onboarding foundation; the collectors, persistence, and Live page are separate implementation tasks.
