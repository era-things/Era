# Project design principles

Era is a personal app that a person uses every day. Optimize the design for ease
of day-to-day use, rather than for a first-time user's introduction to the app.

Elements that exist only to present or explain the app add friction on every use
after the first. Avoid decorative presentation, promotional copy, and repeated
explanations that do not help with the user's recurring tasks.

Assume that:

1. The user is intelligent and familiar with common interface patterns.
2. The user returns regularly. It is acceptable for them to learn and remember
   how interactions work and what visual elements represent.

Prioritize how quickly an experienced user's eyes can find the information they
need once they understand the app. Evaluate layout, hierarchy, density, labels,
and interactions by how well they support that repeated use, rather than by how
thoroughly they explain themselves on a first visit.

## Compatibility and obsolete code

This is a personal project used by one person. Never add code for backwards
compatibility. Remove code that is no longer functional ruthlessly.

## Extensibility

Keep widget metadata and behavior with their definitions. Prefer typed registries
and named resource handlers over growing chains of ID, kind, or method checks.
Adding a widget that uses an existing kind should reuse storage, rendering, and
API handling. Keep ordinary validation and algorithmic conditions explicit; do
not replace them with abstractions that make the code harder to follow.

## Verification

Use `node scripts/verify.mjs` from the checkout. Run the full unit suite with
`node scripts/verify.mjs unit` whenever unit verification is useful.

For browser verification, run the smallest set of tests that covers the change
and the existing behavior it can affect. Name the browser specs explicitly and
use Playwright's `-g` filter when only specific tests in a spec apply. Run the
full browser suite, including via `node scripts/verify.mjs full`, only when
explicitly requested.

| Change                               | Related checks |
| ------------------------------------ | -------------- |
| Existing widget kind or domain rules | Run the unit suite. |
| Visual or interaction change         | Run `node scripts/verify.mjs browser <spec>` for the affected view. Use a named scenario when it covers the changed layout. |
| Navigation or timeline               | Run the relevant tests in `routes.spec.ts` or `timeline-position.spec.ts`. |
| API, storage, or synchronization     | Run the unit suite. Include the relevant browser tests in `api.spec.ts` or `sync.spec.ts` when a change crosses the browser/server boundary. |

For repeated browser checks, keep `node scripts/verify.mjs serve` running in a
separate session and pass `--warm` immediately after `browser` or `scenario`.
Run browser checks one at a time with the focused runner's single worker. Each
warm run resets the server's disposable data before starting. Browser tracing
is off by default. Add `--trace on` when a failure needs a trace.
Failed browser runs print assertion details and artifact paths under `test-results/`.
