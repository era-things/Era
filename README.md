# Era

A broad view of time, one square per day. Rebuilt from scratch with Svelte 5,
SvelteKit 3, TypeScript, and a standalone Node server.

## Development

Requires Node.js 22.18 or newer (a currently supported Node LTS is recommended).

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite.

## Checks

```sh
npm run check
npm test
npm run format:check
npm run build
```

## Production

```sh
npm run build
npm start
```

The Node adapter writes to `build/` and serves HTTP on port 3000 by default.
Set `HOST` and `PORT` in your deployment environment as needed. See the
[official Node adapter documentation](https://svelte.dev/docs/kit/adapter-node)
for reverse-proxy and deployment configuration.

## Initial scope

- Ten-year overview centered around the current year (five before, four after).
- Two view tabs: Weekdays is a continuous horizontal timeline with Monday-first
  week columns; Grid is a vertical rectangle of consecutive dates that wraps to
  the available width, without weekday alignment or blank calendar cells.
- Squares default to 24px, with toolbar zoom controls from 50% to 200% in both
  views. Click the percentage to reset to 100%. Zoom is remembered on return.
- Year colors, faded past days, and a distinct marker for today.
- Click to select a day and see its date in a compact readout.
- Browse the previous or next ten years; return to today.
- Keyboard navigation follows each view's layout: arrows move to adjacent rows
  or columns, Home/End reach the beginning/end of that year. Arrow keys also switch
  between focused view tabs.
- Open near today on a fresh visit; remember the range, selected day, and scroll
  position and view mode on return using browser-local storage.
- Switching view modes retains the selected date and brings it into view.
- Grid view reserves a narrower right-hand panel for the selected date, with
  previous/next-day controls. The grid scrolls independently of the panel.
- An emoji button at the top of the day panel opens the full picker with search,
  categories, skin tones, its built-in history, and Clear. The button shows the
  day's assigned emoji, or a picker icon when empty. Assignments start empty,
  appear in both views, scale with zoom, and are saved in this browser.
- The full picker uses [emoji-picker-element](https://github.com/nolanlawson/emoji-picker-element),
  initialized in the background when the day panel mounts and kept mounted for
  fast reopening. The closed dialog stays laid out with `visibility: hidden` so
  opening it does not trigger the initial emoji grid layout. Its emoji data is
  bundled and served by this app.
  Its bottom Favorites row is ordered by usage count, not recency, and refreshed
  after each selection; history remains in the library's browser database.
- Keyboard movement scrolls only when needed. Range changes preserve the viewport
  and the selected month/day (February 29 becomes February 28 in a non-leap year).
- Fixed toolbar and date readout; the grid scrolls on both axes on narrow screens.

This is a regular fullstack SvelteKit application. `+page.server.ts` provides the
initial date and the overview is server-rendered; Svelte 5 runes handle browser
interaction. The Node adapter builds a runnable server, rather than a static
export or browser extension. No database is needed for this first slice.

Calendar arithmetic uses date-only keys and UTC to avoid daylight saving errors.
The server initially seeds today in UTC. After hydration the browser uses its
local calendar date, refreshing every minute and on window focus.

## Project map

- `src/routes/+page.server.ts`: initial server data.
- `src/routes/+page.svelte`: overview state, range controls, selection.
- `src/lib/calendar.ts`: date-only calendar operations.
- `src/lib/components/TimelineGrid.svelte`: continuous horizontal and vertical layouts.
- `src/lib/components/DaySquare.svelte`: day appearance, selection, and keyboard input.
- `src/lib/components/DayDetail.svelte`: compact selected-day readout.
- `src/lib/components/DayPanel.svelte`: selected-day sidebar in Grid view.
- `src/lib/components/EmojiSelector.svelte`: reusable emoji button and full picker dialog.
- `src/lib/view-state.ts`: validation of saved browser view state.
- `src/lib/day-emojis.ts`: emoji validation and browser-local day assignments.
- `src/app.css`: shared visual styles.
- `tests/calendar.test.ts`: leap-year, date-boundary, and timezone-safe arithmetic checks.

The [original project overview](docs/original-project.md) records the previous
implementation and useful historical commits. The old application remains in
Git history. Tags, tasks, an agenda, accounts, and server-side data persistence
are outside this first rebuild.
