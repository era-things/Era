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

Use `node scripts/verify.mjs` from the checkout. Start with the smallest check
that exercises the change, then run the full pass once the change is ready.

| Change                               | First check                                                                                                                                                |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing widget kind or domain rules | `node scripts/verify.mjs unit tests/widget-registry.test.ts tests/widgets.test.ts` or the affected domain test                                             |
| Visual or interaction change         | Run `node scripts/verify.mjs browser <spec>`. For layout changes, use `scenario time-widgets` or `scenario counters` to capture the affected viewport.     |
| Navigation or timeline               | Run the affected `routes.spec.ts` or `timeline-position.spec.ts` with `verify.mjs browser`.                                                                |
| API, storage, or synchronization     | Run the affected API, database, or sync unit tests. Use `verify.mjs browser api.spec.ts` or `sync.spec.ts` for changes across the browser/server boundary. |

For repeated browser checks, keep `node scripts/verify.mjs serve` running in a
separate session and pass `--warm` immediately after `browser` or `scenario`.
Run one warm invocation at a time. Each resets the server's disposable data before
starting. Use `node scripts/verify.mjs full` for final type, unit, build, and
production-browser verification. Failed browser runs print assertion details and
artifact paths under `test-results/`.
