# Era HTTP API

Base URL in development: `http://127.0.0.1:5173/api`.

Requests use ordinary JSON with `Content-Type: application/json`. There is no
authentication, API version prefix, version field, ETag, or conditional update
requirement. A successful write replaces the addressed value using the latest
backend state. For the same value, the last write wins; other widgets and dates
remain untouched. Writes are validated and committed in a SQLite transaction.

## Discover widgets and settings

| Method | Path           | Result                                                                                                                |
| ------ | -------------- | --------------------------------------------------------------------------------------------------------------------- |
| GET    | `/widgets`     | `{widgets: [...]}` with IDs, names, kinds, units where relevant, skins, settings, default values, and editable fields |
| GET    | `/widgets/:id` | One widget definition and its settings                                                                                |
| PATCH  | `/widgets/:id` | Change any of `pinned`, `archived`, or `skin`                                                                         |

Built-in IDs: `nutrition`, `weight`, `steps`, `sleep`, `phone`, `gym`, `reading`,
`movie`, `steam`, `note`. New visual widget types still require application code.
Custom numeric and boolean measures can be created through the API below.

Restore Reading from the catalog and pin it:

```sh
curl -X PATCH http://127.0.0.1:5173/api/widgets/reading \
  -H 'Content-Type: application/json' \
  -d '{"archived":false,"pinned":true}'
```

Archiving automatically unpins a widget. Archived widgets cannot be attached to
new days, but their existing day entries remain readable and editable. Restoring
a widget preserves its skin and daily values.

## Daily widgets

| Method | Path                      | Result                                                                                                            |
| ------ | ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| GET    | `/days/:date`             | `{date, emoji, widgets, measures}` for that day; widgets include the visible pinned defaults and existing entries |
| GET    | `/days/:date/widgets/:id` | `{date, id, attached, visible, value}`                                                                            |
| PUT    | `/days/:date/widgets/:id` | Attach or replace that day's value                                                                                |
| DELETE | `/days/:date/widgets/:id` | Remove the daily attachment; return 204                                                                           |

Dates must be real `YYYY-MM-DD` dates. An unattached widget has `attached:false`
and `value:null`. A pinned widget can remain visible without a daily attachment;
the UI renders its default value. Clearing a nullable field keeps its daily
attachment; DELETE removes it. Deleting an already absent attachment also returns 204. Pinning can still make the widget visible after DELETE.

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
Name is at most 120 characters. Quantity is a positive safe integer. Nutrients
are non-negative finite numbers up to `Number.MAX_SAFE_INTEGER`, per item;
quantity multiplies them in the UI.

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
  is read-only; use resource endpoints for edits.

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

400 means an invalid value, unknown field, or malformed JSON; 404 means an unknown
resource; 405 means an unsupported method; 409 means a duplicate definition/name
or an archived widget that cannot be newly attached or pinned; 415 means the
content type must be JSON. Cross-site browser writes return 403. This is not
authentication; direct HTTP agents require no token.

There are no stale-version conflicts or `before`/`after` payloads. `/api/calendar`
has been removed. No OpenAPI schema is generated.
