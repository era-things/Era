# Era: original project overview

Recorded on October 30, 2026, before the fresh rebuild. This describes the old
project, not the architecture of the new application.

## The idea

Era appears to be a personal timeline and planning app: a grid where every square
represents one day, letting you see time passing and attach meaning to individual
dates. The older code suggests an intended combination of this overview, a day
editor, and an agenda.

The checkout at the time of this review was an unfinished rewrite of a more
developed earlier version. The removed functionality remains in Git history.

## What the 2024 prototype did

The home page had two columns: a day grid on the left and an empty gray panel on
the right. The grid covered February 1, 2020 through January 31, 2030, with roughly
3,650 squares.

- Each year received a color based on its last digit.
- Past days appeared faded.
- Today received a larger square with a border.
- Hovering over past or future days shrank the square.
- Squares accepted a text label and a click callback, but their parent supplied
  empty labels and callbacks that did nothing.

It was primarily a visual prototype of the timeline.

## Original code structure

The project used SvelteKit, TypeScript, Vite, and Tailwind CSS.

| Original file                    | Responsibility                                               |
| -------------------------------- | ------------------------------------------------------------ |
| `src/routes/+page.svelte`        | Two-column home page                                         |
| `src/components/BitTable.svelte` | Date range generation and past/present/future classification |
| `src/components/Bit.svelte`      | One day's color, hover behavior, label, and click handling   |
| `src/components/types.ts`        | Day and display states                                       |

The grid waited for browser mount, then animated into view. Each square used an
intersection observer to render its inner content near the viewport. This
reduced inner rendering, but all outer components still existed.

The About page, Sverdle word game, navigation, logos, and much of the styling were
SvelteKit starter leftovers. There was no Era-specific backend, database,
authentication, or persistence in this version.

## History and the more complete version

1. August 2023: started as a SvelteKit app with day selection and editable labels.
2. August–September 2023: became a Chrome extension replacing the new-tab page.
3. September 3, 2024: commit `8008bd241d1395d434f09591158f17000896d04a`,
   titled `update from scratch`, replaced the extension with the prototype above.

The last commit before that rewrite, `ae25bfc`, contained:

- A scrollable day grid.
- A selected-day panel showing the full date.
- An input for editing that day's label.
- Browser-local label storage using `store2`.
- A shared Svelte store for selection and events for label changes.
- An agenda panel, dark mode, and controls for showing or hiding panels.

The agenda was a mockup: two hardcoded tasks and placeholder tabs for recurring
items, tags, and settings. Labels and selection had actual implementations.

Historical source can be inspected without restoring it, for example:

```sh
git show ae25bfc:src/components/MainPage.svelte
git show ae25bfc:src/components/DayInfo.svelte
git show ae25bfc:src/lib/dayStore.ts
```

## Where the prototype was unfinished

- Selection and editing had been disconnected during the rewrite.
- Scroll-to-today searched for an element named `today`, but squares had numeric IDs.
- Dates were hardcoded. Day classification mixed local dates with UTC day numbers,
  leaving timezone edge cases.
- Configuration included duplicate keys, a `layout.ts` missing SvelteKit's `+`
  prefix, and overlapping Tailwind setup.
- Dependencies included prerelease Svelte 5 and alpha Tailwind 4 versions.

This assessment came from source and Git history. The old application was not
installed or build-tested during the review.

## Direction for the rebuild

Retain the general idea: a broad view of time represented by day squares. Use
modern Svelte 5 and SvelteKit as a regular fullstack application. Begin with the
grid and basic interaction. Historical implementation choices are references,
not constraints; richer planning features can be reconsidered later.
