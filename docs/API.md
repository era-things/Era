# Era HTTP API

Base URL in development: `http://127.0.0.1:5173/api`.

Requests use JSON with `Content-Type: application/json`. Era's API is
unauthenticated and intended for use on a private LAN.
A successful write replaces the addressed value using the latest backend state.
Writes are validated and committed in a SQLite transaction.

## Discover widgets and settings

| Method | Path           | Result                                                                                                                |
| ------ | -------------- | --------------------------------------------------------------------------------------------------------------------- |
| GET    | `/widgets`     | `{widgets: [...]}` with IDs, names, kinds, units where relevant, skins, settings, default values, and editable fields |
| GET    | `/widgets/:id` | One widget definition and its settings                                                                                |
| PATCH  | `/widgets/:id` | Change `visibility` or `skin`                                                                                         |

Built-in IDs: `nutrition`, `weight`, `steps`, `sleep`, `phone`, `gym`, `reading`,
`movie`, `steam`, `note`. New visual widget types still require application code.
Custom numeric and boolean measures can be created through the API below.

Pin Reading:

```sh
curl -X PATCH http://127.0.0.1:5173/api/widgets/reading \
  -H 'Content-Type: application/json' \
  -d '{"visibility":"pinned"}'
```

`pinned` shows the widget every day. `available` shows saved entries and offers the
widget in Add widget on other days. `with-data` shows days with nonempty widget
values. An empty attachment or a zero-minute activity stays stored but is hidden.
`hidden` hides the widget from the day view and Add widget. The dedicated daily
widget endpoint supports reads and writes in every mode. Changing visibility
preserves the widget's skin and daily values.

## Daily widgets

| Method | Path                                | Result                                                                                                            |
| ------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| GET    | `/days/:date`                       | `{date, emoji, widgets, measures}` with the widgets visible on that day |
| GET    | `/days/:date/widgets/:id`           | Read the effective value and both stored values                                                                   |
| PUT    | `/days/:date/widgets/:id`           | Set the manual value and return the daily widget                                                                  |
| PUT    | `/days/:date/widgets/:id/automated` | Set the automated value and return 204                                                                            |
| DELETE | `/days/:date/widgets/:id/manual`    | Remove the manual value and return 204                                                                            |
| DELETE | `/days/:date/widgets/:id`           | Remove both values and return 204                                                                                 |

Dates must be real `YYYY-MM-DD` dates. Daily widget responses include `date`,
`id`, `attached`, `visible`, `value`, `source`, `manualValue`, and
`automatedValue`. Each value uses the same shape as a PUT body. The effective
`value` comes from the automated value when present and from the manual value
otherwise. `source` is `"automated"`, `"manual"`, or `null`. An absent stored
value is `null` at the response’s top level. A stored body such as
`{"durationMinutes":null}` still counts as a value for precedence and attachment.
A pinned widget without either value remains visible and renders its default.
Both DELETE operations return 204 even if the addressed values are already absent.

Both PUT endpoints use the same validation. This example reports 222 minutes
of phone use.

```sh
curl -X PUT http://127.0.0.1:5173/api/days/2026-11-17/widgets/phone/automated \
  -H 'Content-Type: application/json' \
  -d '{"durationMinutes":222}'
```

### Bodies by widget

| Widget                                      | PUT body                                     | Limits                                                                         |
| ------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------ |
| `phone`, `gym`, `reading`, `movie`, `steam` | `{"durationMinutes":45}`                     | Integer 0–1440, or null                                                        |
| `weight`                                    | `{"value":72.5}`                             | Non-negative finite number up to `Number.MAX_SAFE_INTEGER`, or null; kilograms |
| `steps`                                     | `{"value":8200}`                             | Non-negative safe integer, or null                                             |
| `note`                                      | `{"text":"A walk after lunch."}`             | String; an empty string preserves the attachment                               |
| `nutrition`                                 | `{"items":[...]}`                            | Full array of food items; an empty array preserves the attachment              |
| `sleep`                                     | `{"startTime":"23:00","wakeUpTime":"06:30"}` | Clock times and/or duration, described below                                   |

Set 45 minutes of reading:

```sh
curl -X PUT http://127.0.0.1:5173/api/days/2026-11-17/widgets/reading \
  -H 'Content-Type: application/json' \
  -d '{"durationMinutes":45}'
```

Repeating this request is safe. PUT replaces the addressed value, rather than
adding another 45 minutes.

Sleep accepts `startTime`, `wakeUpTime`, and `durationMinutes`. Times use `HH:mm`
in 24-hour format, or null; duration is whole minutes from 0 through 1439, or null.
At least one field must be supplied. Two non-null fields infer the omitted third
field, including across midnight. Three supplied values must agree. Explicit null
means cleared, and is not an omitted field. Other omitted fields are cleared by
PUT; the operation does not patch a previous sleep value.

Each nutrition item requires `id`, `name`, `quantity`, `kcal`, `protein`, `fat`,
and `carbs`. IDs are unique within the day, using 1–80 letters, digits, or hyphens.
Name is at most 120 characters. Quantity ranges from 0.01 to
`Number.MAX_SAFE_INTEGER` with up to two decimal places. Nutrients
are non-negative finite numbers up to `Number.MAX_SAFE_INTEGER`, per item;
quantity multiplies them in the UI.

### Individual nutrition items

These routes use the manual food log for a single date. Use the daily widget
endpoint to read the effective list when an automated value is present.

| Method | Path relative to `/days/:date/widgets/nutrition` | Result |
| ------ | ------------------------------------------------ | ------ |
| GET    | `/items`                                        | `{"items":[...]}` in entry order, or an empty list |
| GET    | `/items/:itemId`                                | One food item, or 404 |
| PUT    | `/items/:itemId`                                | Create or replace one item using all six editable fields |
| PATCH  | `/items/:itemId`                                | Update only the supplied fields of an existing item, or 404 |
| DELETE | `/items/:itemId`                                | Remove one item and return 204, including when it is already absent |

Choose an item ID unique within the day. Retrying a PUT to the same ID updates
the same entry. An optional body `id` on PUT must match the URL. PUT and PATCH
return the saved item. Deleting the last item leaves the day’s food log attached.

```sh
curl -X PUT http://127.0.0.1:5173/api/days/2026-11-17/widgets/nutrition/items/lunch \
  -H 'Content-Type: application/json' \
  -d '{"name":"Lunch","quantity":1,"kcal":500,"protein":25.5,"fat":10,"carbs":60}'

curl -X PATCH http://127.0.0.1:5173/api/days/2026-11-17/widgets/nutrition/items/lunch \
  -H 'Content-Type: application/json' \
  -d '{"quantity":0.75}'
```

### Individual phone apps and GitHub repositories

These collections use the same list, read, PUT, PATCH, and DELETE methods as
nutrition. GET on a collection returns `{"items":[...]}`. Append the item key to
read or change one entry.

| Collection below `/api/days/:date` | Item key | Required PUT fields | Optional fields |
| --- | --- | --- | --- |
| `/widgets/phone/apps` | `package`, such as `com.example.app` | `name`, `minutes` | `lastUsed` |
| `/github-activity/repositories` | `name`, such as `era-things%2FEra` | `commits`, `additions`, `deletions` | `url` |

URL-encode item keys. Repository names match case-insensitively, following the
same uniqueness rule as the daily report. PUT can also include the key field
when it matches the URL. PATCH accepts any subset of the editable fields and
preserves the others.

Before creating an item, save the day’s automated phone duration or GitHub
totals through its existing report endpoint. Item writes preserve the reported
totals and neighboring entries.

## GitHub activity

`PUT /api/days/:date/github-activity` replaces a day's GitHub totals and returns 204.
Send `commits`, `additions`, and `deletions` as non-negative whole numbers.
Include an optional `repositories` array with a distinct `name` and the same
three counts for each repository. Names can include the owner. Add a `url` with
the repository's absolute HTTP or HTTPS address to link its row in the drawer.
`GET` on the same path returns `{ date, value }`, with `value: null` for an
unrecorded day. The daily records are included in exports as `githubActivity`.

```json
{
  "commits": 6,
  "additions": 418,
  "deletions": 92,
  "repositories": [
    { "name": "era-things/Era", "url": "https://github.com/era-things/Era", "commits": 4, "additions": 280, "deletions": 60 },
    { "name": "Atlas", "commits": 1, "additions": 100, "deletions": 12 },
    { "name": "dotfiles", "commits": 1, "additions": 38, "deletions": 20 }
  ]
}
```

## Custom measures

| Method | Path                       | Result                                                   |
| ------ | -------------------------- | -------------------------------------------------------- |
| GET    | `/measures`                | `{measures: [...], palettes: [...]}`                     |
| POST   | `/measures`                | Create `{id?, name, type, palette?}`; return 201         |
| GET    | `/measures/:id`            | Read a definition                                        |
| PATCH  | `/measures/:id`            | Update `name` and/or `palette`; type and ID are fixed    |
| DELETE | `/measures/:id`            | Remove the definition and all its day values; return 204 |
| GET    | `/days/:date/measures/:id` | `{date, id, attached, value}`                            |
| PUT    | `/days/:date/measures/:id` | Set `{"value":...}`                                      |
| DELETE | `/days/:date/measures/:id` | Remove that day's value; return 204                      |

Type is `uint` (non-negative safe integer or null) or `boolean` (true or false).
Names are trimmed, 1–80 characters, and unique ignoring case. Palette defaults to
`green`; discover all choices with GET `/measures`.

IDs use 1–80 letters, digits, or hyphens. Omit an ID to generate one, or supply a
stable ID to make creation retry-safe: repeating POST with the same ID and
definition returns 200; reusing it for a different definition returns 409.

```sh
curl -X POST http://127.0.0.1:5173/api/measures \
  -H 'Content-Type: application/json' \
  -d '{"id":"water","name":"Glasses of water","type":"uint","palette":"blue"}'

curl -X PUT http://127.0.0.1:5173/api/days/2026-11-17/measures/water \
  -H 'Content-Type: application/json' \
  -d '{"value":4}'
```

## Emojis, reminders, and full export

- GET or PUT `/days/:date/emoji`. PUT body: `{"emoji":"⭐"}`. Null or an empty
  string clears it.
- GET `/reminders` returns `{reminders:[...]}`. GET `/reminders/:id` reads one.
- PUT `/reminders/:id` creates or replaces a reminder. Required fields: `text`,
  `period` (`once`, `weekly`, `monthly`, `yearly`), `start` (`YYYY-MM-DD`),
  `overrideEmoji` (boolean), `leadDays` (non-negative safe integer or `"always"`),
  and `completedDates` (array of real dates). Optional `id` must match the URL.
  Text is trimmed, nonempty, and at most 500 characters. DELETE removes it and
  returns 204, including when already absent.
- GET `/data` returns the complete app state used by refresh and JSON export. It
  includes the manual widget sections and the `automated` section keyed by date
  and widget ID.
- POST `/data/import/preview` accepts an Era export and returns
  `{days, overwrittenDays, overwritesOtherData}` without writing to the database.
  `overwrittenDays` counts distinct dates where an existing value would change.
- POST `/data/import` merges the same export format and returns the merged app
  state. Entries match by their record keys, such as date and widget ID for
  daily values or date and item ID for nutrition. Manual and automated values
  are independent. Omitted records and sections are preserved. Invalid or
  incompatible data returns 400. If supplied, the `X-Era-Import-Preview` header
  holds the preview object as JSON. A changed preview returns 409 with the new
  summary in `preview` and leaves the database unchanged.

## Errors

```json
{
	"error": {
		"code": "invalid_value",
		"message": "Use whole minutes from 0 through 1440, or null.",
		"field": "durationMinutes"
	}
}
```

400 means an invalid value, unknown field, or malformed JSON. 403 means a
cross-site browser write. 404 means an unknown resource, 405 means an unsupported method,
409 means a duplicate definition or name, or a missing daily report for a new item, and
415 means the content type must be JSON.

There are no stale-version conflicts or `before`/`after` payloads. `/api/calendar`
has been removed. No OpenAPI schema is generated.
