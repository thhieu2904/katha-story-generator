# Phase 4 manual verification matrix

Status: **not executed in a browser or against live OpenAI/R2 as of 2026-07-21**. This matrix is the acceptance record for the remaining manual and controlled-live checks; a checked row must include its operator, environment, timestamp, and a short result before Phase 4 is called end-to-end verified.

| ID | Scenario | Action | Expected result | Automated evidence | Manual/live state |
| --- | --- | --- | --- | --- | --- |
| M1 | First start | Open a plan-ready `text_confirmed` story, save mapping, confirm Start. | `202`; page moves to `generating_images`; mapping is locked; no cover is requested. | Backend service/API tests; frontend `useStoryImages` specs. | Pending |
| M2 | Polling lifecycle | Keep the workspace open while a controlled job changes pending -> generating -> completed. | UI refreshes about every 3 seconds, preserves last state, and stops polling after final status. | `useStoryImages` polling spec. | Pending |
| M3 | Poll `409` reconciliation | While polling, force a stale response/version conflict then return a canonical state. | UI rereads story/image state; no stale error remains if reread succeeds. | `useStoryImages` 409 spec. | Pending |
| M4 | Retry only failed pages | Produce one failed page and one completed page, then choose Retry. | Completed URL remains unchanged; only pending/failed page is claimed. | PostgreSQL claim/stale tests plus frontend retry spec. | Pending |
| M5 | Stale resume | Stop an in-process runner after claim creation, wait past stale threshold in a non-production test environment, then click Resume. | New UUID claim is used; stale `generating` pages become retryable; completed pages remain. | Unit + PostgreSQL stale-reclaim tests; frontend resume spec. | Pending |
| M6 | All-complete stale finalization | Create a stale job whose pages are already completed, then click the finalization CTA. | CTA says completion/finalization; it does not create a new image and moves story to `pending_review`. | Runner finalizer tests; frontend resume spec. | Pending |
| M7 | Missing/untrusted character reference | Select a character with no valid R2 public reference and start. | Request fails before claim with a clear `422`; no runner is scheduled. | Service/API tests. | Pending |
| M8 | Provider/R2 failure | Use controlled failing OpenAI/R2 credentials or a test bucket policy. | Error is sanitized; page becomes retryable with the right code; already-completed assets stay. | Adapter/runner unit tests. | Pending |
| M9 | Real image contract | Run one controlled image/edit request using production-equivalent model, custom size, and 0/1/multiple references. | Returned file is WebP at configured dimensions, within cap, uploaded to R2 with immutable cache headers. | Offline adapter/validation tests only. | Pending — required live smoke |
| M10 | Authorization/navigation | Open the route as non-admin, and open it for draft/text-draft/archived stories. | API is admin-only; UI redirects to the appropriate workflow with no unsafe action. | API and frontend route tests/type checks. | Pending |

## Evidence to attach when executing

For each completed manual row, record the story ID (or disposable fixture), request/job UUID, environment, timestamp, screenshot or response excerpt, and whether OpenAI/R2 cost was incurred. Do not use production stories for M5/M8 without an approved recovery plan.

## Deliberate verification boundary

Offline tests prove deterministic contracts, claims, fences, and UI state handling. They do **not** prove Docker/Testcontainers availability, PostgreSQL migration execution, OpenAI image-model compatibility, R2 credentials/network behavior, or browser rendering. Those remain distinct gates.