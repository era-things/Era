# Extension points

## Widgets

`src/lib/widgets.ts` is the widget registry. Each definition declares its kind,
placement, storage location, validator, API fields, defaults, samples, and skins.
Counter behavior is shared; activity widgets use the `timeWidget` factory.
Activity IDs and normalization are derived from these definitions, with no
separate ID list. Adding an activity requires its definition and icon.

- A widget using an existing kind reuses generic storage and value validation.
- Placement (`main`, `time`, `footer`) determines its location in the day panel.
- API encoding and parsing dispatch by kind, not by individual widget ID.
- `WidgetKindValues` binds each kind to its value type. Definition defaults,
  samples, validators, renderer snippets, and API codecs are checked against it.
  Instances carry their kind and definition, so renderers need no value casts.
  Dynamic dispatch assertions stay at the handler lookup boundaries.
- `BuiltInWidget.svelte` registers rendering snippets by kind. The registry is
  exhaustive: adding a kind requires supplying its renderer and API codecs.
- `widget-icons.ts` holds SVG primitives; `WidgetIcon.svelte` renders them.
  Activity widgets and counters declare their icons in their definitions.
- `duration.ts` shares hour/minute editing and formatting.

Adding a new behavior kind requires handlers in the rendering and API codec
tables. It does not require extending chains of ID comparisons. Domain-specific
validation, such as linked sleep times, stays in a named parser.

## API

`src/lib/server/api.ts` handles common request parsing, route lookup, method
selection, and error responses. Resource modules in `src/lib/server/api/` register
URL patterns and method-to-handler tables for widgets, days, measures, and
reminders. Add a resource handler to its table rather than extending a nested
dispatcher. Shared HTTP validation lives in `shared.ts`; widget value conversion
lives in `widget-values.ts`.

The public contract and examples are in [API.md](API.md).

## Browser synchronization

`calendar-sync.ts` owns optimistic calendar data, the ordered write queue,
retries, refresh ordering, export reads, and browser coordination. It publishes
state to the page and accepts an injected HTTP function for focused tests.
`connect()` installs focus, BroadcastChannel, and unsaved-edit listeners and
returns their cleanup function. Navigation and timeline view state stay in the
page.

`api-client.ts` derives widget storage sections from the registry when converting
local edits into resource requests.

## View routes

`app-views.ts` defines tab URLs and calendar modes. `src/params.ts` restricts the
optional view parameter to those URLs. The shared page at
`src/routes/[[view=appView]]/` stays mounted across tab navigations, preserving
the synchronization controller and calendar state. The URL determines the active
tab; navigation snapshots store calendar positions rather than tab selection.

## Persistence

`calendar-records.ts` serializes app state and dispatches record decoding through
a decoder table. `database.ts` validates and commits updates atomically. Adding a
storage record family requires a serializer and a registered decoder.

## Conditions

Registries describe extensible categories. Simple validation, editing state,
date arithmetic, and keyboard navigation conditions remain ordinary control flow
where that is clearer. Do not turn every boolean choice into a plugin system.
