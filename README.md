# Era

A personal calendar with a SvelteKit UI and a Bun server. Notes, emojis, measures, nutrition and reminders are saved in SQLite. Each browser remembers its own view and scroll position.

UI conventions and widget patterns are documented in [DESIGN.md](DESIGN.md).
Widget registries and API extension points are described in [ARCHITECTURE.md](docs/ARCHITECTURE.md).

Tabs have their own URLs: Grid `/`, Weekdays `/weekdays`, Today `/today`,
Layout `/layout`, Reminders `/reminders`, and Settings `/settings`. Refresh keeps
the selected view; Back and Forward restore views and their calendar positions.

The [HTTP API](docs/API.md) supports widget discovery and settings, daily values,
custom measures, emojis, and reminders. The app uses these same resource endpoints.

Sleep, phone screen time, gym, reading, movies, and Steam game time appear together
as 26px rows. Add them per day through + or pin them in Layout. Activity durations
are stored as whole minutes (up to 24 hours); clearing a value keeps its widget
attached. Phone, Gym, Reading, Movie, and Steam show only an icon and duration.

In Layout, click a widget's visibility button to cycle between Pinned,
Available, and With data. Hide moves it to the collapsed Hidden widgets section.
Hidden widgets keep their entries and skin and continue to receive API updates.
Restore returns a hidden widget to Available.

## Development

Use Bun 1.4.4. Run `bun install --frozen-lockfile`, then `bun run dev`.

Run verification with Node.js 20 or later. The script checks the Bun version in
`package.json` and uses the local Bun executable when available.

```sh
node scripts/verify.mjs unit tests/widget-registry.test.ts
node scripts/verify.mjs browser time.spec.ts
node scripts/verify.mjs scenario time-widgets
node scripts/verify.mjs scenario counters
node scripts/verify.mjs full
```

`unit` without filenames runs all Bun tests. `browser` runs the selected spec
against Vite, and `scenario` seeds and captures a named UI state. Both use isolated
test data and print artifact paths. `full` runs the unit and type checks, builds
once, and runs the browser suite against that build. The production browser suite
uses two workers, each with its own Bun server and in-memory SQLite database.
The calendar resets before each test.

For repeated checks, keep `node scripts/verify.mjs serve` running in a separate
terminal and add `--warm` after `browser` or `scenario`. The next run starts with
empty test data. Run warm checks one at a time and stop the server with Ctrl+C
when finished.

## Data and deployment

Run `bun run build` and `bun run start` on the home server. Set `ERA_DB` to an absolute path on persistent local storage (default `data/era.sqlite` in the working directory). Keep the service on a private, access-controlled network. Anyone who can access Era can read and edit its data.

Set `ORIGIN` to the URL used to access the production server (for example,
`http://127.0.0.1:3000` for local HTTP). The Bun adapter otherwise assumes HTTPS.
The API allows HTTP clients without an Origin header and rejects browser writes
from a different origin.

Wearable and phone sync clients on the LAN can send JSON to
`PUT /api/days/:date/widgets/:id/automated`. See [HTTP API](docs/API.md).

Use **Export data** in Settings to download the current server data, including
manual and automated widget values. **Import data** previews how many dates
are in the file and how many have values that will be overwritten. Confirm to
merge the file into your data. Imports overwrite matching entries and preserve
entries absent from the file, including other widgets on the same date.
`bun run import "path/to/export.json"` with the same `ERA_DB` performs the same
merge. For a live database backup use SQLite's online backup facility or
`VACUUM INTO` and keep a copy off the server.

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
- The Layout tab manages widget pinning, appearance, and custom measure definitions with a name, unsigned-integer or
  boolean type, and one of six faint-to-bright color palettes. Names and palettes
  can be edited; types stay fixed after creation. Deleting a definition also
  removes its day values, after an inline confirmation.
- Use the day panel's widget (+) button to attach definitions. Each appears in
  a pale-colored card with a number input or boolean checkbox. Newly added values
  default to 0 for numbers and false for booleans. Numbers may be
  blank or non-negative safe integers; zero, false, and absence stay distinct.
  Values save to the server and are independent per day.
- The Reminders tab creates, edits, and deletes reminders with text, a starting
  date, and a one-time, weekly, monthly, or yearly period. The day panel
  lists reminders due on its selected date in a separate section. Dates before
  the start are excluded; monthly and yearly repeats use the last day of shorter
  months when needed, while preserving the original starting day for later repeats.
  One-off and Periodic columns each have a New button that opens an inline form.
  One-off forms have no period selector; periodic forms offer weekly, monthly,
  and yearly repeats. Each saved reminder has
  its own compact drawer, collapsed by default, with independent editable settings.
  Columns are capped at 480px wide and stack with One-off first on narrow screens.
  Reminders are saved on the server.
- The selected day's Reminders section has a + button for quickly adding a
  one-off reminder by name. Enter adds it and closes the field;
  Escape closes the field. These items use the same Done/Undo controls and storage.
- Each day has a compact Silkdown Markdown editor among its widgets, above the
  add button. Notes save while typing and are independent per day. Markdown
  headings, emphasis, links, lists, tasks and code blocks render inline; tables
  remain Markdown source. The active line reveals its Markdown markers.
  Ctrl+B / Ctrl+I toggle bold / italic, and Markdown can be pasted directly.
  Notes are stored and exported as the original Markdown text. The unpublished
  Silkdown core is pinned in `vendor/silkdown`; see its README for provenance.
- Settings exports and restores day emojis, measure definitions and daily values, nutrition
  entries, notes, and reminders with completion history to a dated JSON file, including
  dates outside the visible calendar range.
- Today shows yesterday, today, and tomorrow side by side, with independent day
  editors for emojis, measures, and reminders. The columns scroll horizontally
  on narrow screens.
- Layout previews built-in widgets and their skins before custom measures.
  Pinned widgets appear every day, Available widgets can be added through +,
  and With data widgets appear on days with nonempty entries.
  Nutrition shows daily kcal, protein, fat, and carb totals with an expandable food log in
  each day editor. Food entries accept decimal values and can be added, edited,
  or removed. Each item has quantity controls starting at ×1; its nutrient values
  are displayed per item, and the day totals include the quantity.
  Double-click the quantity or press F2 on it to enter up to two decimal places.
  Edit names and nutrient values directly in their rows; Enter or leaving a field
  saves it, and Escape cancels the change.
  The + button adds a blank row and focuses its name. Click the quantity to reveal
  decrease/increase controls. At ×1, the decrease control becomes delete.
  Unpinning keeps entries on their days and hides the widget on untouched days.
- The reminder date picker distinguishes past and future dates and marks today.
  Past dates remain selectable. Dates can also be typed as YYYY-MM-DD; arrow keys
  move between days, Page Up/Down changes months, and Escape closes the picker.
- Reminders can temporarily override their occurrence's day emoji with ❗.
  Set a non-negative number of days before it is due (0 starts on the due date),
  or Always to show every occurrence in advance. Overdue occurrences keep their
  override until completed. The original day emoji remains saved underneath.
  Done in the day panel completes only that date's occurrence, with Undo to
  reopen it; future repeats remain active. The original emoji returns when no
  other active reminder on that date requires an override.
- An emoji button at the top of the day panel opens the full picker with search,
  categories, skin tones, its built-in history, and Clear. The button shows the
  day's assigned emoji, or a picker icon when empty. Assignments start empty,
  appear in both views, scale with zoom, and are saved on the server.
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

Calendar arithmetic uses date-only keys and UTC to avoid daylight saving errors.
The server initially seeds today in UTC. After hydration the browser uses its
local calendar date, refreshing every minute and on window focus.

## Project map

- `src/routes/[[view=appView]]/+page.server.ts`: initial server data.
- `src/routes/[[view=appView]]/+page.svelte`: shared app views, range controls, selection.
- `src/lib/app-views.ts`: view labels, URLs, and calendar modes.
- `src/params.ts`: route matcher for supported views.
- `src/lib/calendar.ts`: date-only calendar operations.
- `src/lib/components/TimelineGrid.svelte`: continuous horizontal and vertical layouts.
- `src/lib/components/DaySquare.svelte`: day appearance, selection, and keyboard input.
- `src/lib/components/DayDetail.svelte`: compact selected-day readout.
- `src/lib/components/DayPanel.svelte`: selected-day sidebar in Grid view.
- `src/lib/components/EmojiSelector.svelte`: reusable emoji button and full picker dialog.
- `src/lib/widgets.ts`: widget definitions, typed settings, defaults, and day lifecycle.
- `src/lib/components/DayWidgets.svelte`: day widget rendering and add menu.
- `src/lib/components/BuiltInWidget.svelte`: shared day/preview renderer.
- `src/lib/components/WidgetPreview.svelte`: live previews and animated skin selection.
- `src/lib/validation.ts`: shared object and date-map normalization.
- `src/lib/components/LayoutManager.svelte`: widget settings, previews, and custom measure management.
- `src/lib/components/NutritionPanel.svelte`: daily totals and nutrition item table.
- `src/lib/components/NutritionItemRow.svelte`: inline editing and quantity controls.
- `src/lib/components/DayMeasures.svelte`: custom measurement value cards.
- `src/lib/measures.ts`: palettes, measure types, storage validation, and deletion.
- `src/lib/components/RemindersManager.svelte`: reminder creation and management.
- `src/lib/components/ReminderEditor.svelte`: saved reminder drawer and deletion controls.
- `src/lib/components/ReminderForm.svelte`: independent settings form per reminder.
- `src/lib/components/DatePicker.svelte`: date field and calendar with past/future styling.
- `src/lib/components/DayReminders.svelte`: reminders due on the selected day.
- `src/lib/reminders.ts`: recurrence rules and saved-reminder validation.
- `src/lib/view-state.ts`: validation of saved browser view state.
- `src/lib/day-emojis.ts`: emoji validation and day emoji assignments.
- `src/app.css`: shared visual styles.
- `tests/calendar.test.ts`: leap-year, date-boundary, and timezone-safe arithmetic checks.

The [original project overview](docs/original-project.md) records the previous
implementation and useful historical commits. The old application remains in
Git history. Tags, tasks, an agenda, and accounts
are outside this first rebuild.
