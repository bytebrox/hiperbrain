---
"@hiperbrain/core": minor
---

Add `HiperbrainClient`, a typed, zero-dependency client for the hosted
credit-metered API. It wraps `ask`, `teach` and `balance` over `/api/v1`,
requires an API key, and throws a typed `HiperbrainApiError` (with
`outOfCredits` / `unauthorized`) on failure. The offline HDC engine is
unchanged; this is the opt-in path to reason over the live collective brain.
