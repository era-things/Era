# Era design

Design for a familiar user returning every day. Keep recurring tasks dense and
easy to scan. Follow the project principles in [AGENTS.md](AGENTS.md).

## Hours in a day

Sleep, phone screen time, gym time, reading, movies, and Steam games share one
visual family. The default view is a **26px-high, full-width row**.

```
[icon] [hours + minutes] [widget-specific information] [optional drawer control]
```

- Keep all content on one line, vertically centered. Never place these widgets
  beside one another or let them wrap into a half-width card.
- Keep the leading icon and duration in consistent columns. Use tabular numerals,
  explicit `h` and `m` units, and muted text for secondary information.
- Icons identify the activity; use the Steam logo for Steam game time. Supply an
  accessible name even when a visible activity label is unnecessary.
- Present all attached time widgets together in **one contiguous block**, one row
  after another. No unrelated widget or large card spacing between them. A small
  divider or skin change may separate activities within the block.
- Skins can express the activity through color, material, and restrained art.
  Preserve row height, information order, numeric alignment, and readable contrast.
  Decorative details must not obscure values or resemble recorded data.
- Leave widget-specific information minimal until its purpose is established.
  Sleep currently shows its start and wake-up times in 24-hour format. The other
  activities do not need session statistics, targets, or integrations yet.
- For now, Phone, Gym, Reading, Movie, and Steam show only their icon and duration.
  Leave the rest of each row empty; add secondary information and drawers later.
- Keep editing available without expanding the row when practical. Accept digit-only
  clock input and format it as `HH:mm`, as Sleep does.

### Optional drawer

A widget with more information or actions can expand directly below its row.
The collapsed row keeps the same height and content order.

- Use a clear disclosure control with `aria-expanded` and `aria-controls`.
  The non-editable part of a row may also toggle the drawer; editing a value must
  not toggle it. Do not nest inputs inside a button.
- Support keyboard operation and visible focus. Keep focus on the disclosure when
  opening; if collapsing hides focused content, return focus to the disclosure.
- Put additional actions and detailed information in the drawer. Do not invent
  extra content merely to justify expansion. Rows without useful detail stay flat.
- Opening a drawer grows the shared block in place. It does not change adjacent
  rows into cards or move them out of the block.

The [time-widget design preview](docs/time-widget-options/index.html) shows the
five activities together with Sleep. The application implements all six as daily
widgets with saved values, optional pinning, and a shared contiguous block.

## Layout settings

The normal widget list contains widgets available in the day's Add widget menu.
A collapsed **Widget catalog** drawer contains archived widgets, using the same
preview cards. Its star button moves a widget back to the normal list. Normal
cards have Archive beside Pin. Archive unpins the widget and excludes it from new
day attachments; it preserves skin settings and all existing daily entries.
Existing day entries remain visible and editable. All current widgets start in
the normal list. The catalog drawer starts closed on entering Layout.

Keep skin previews at their real proportions. Skin selectors sit close to the
bottom border: **4px bottom padding** on cards with a selector. Avoid empty space
below controls that a returning user does not need.

Use 24px pin buttons and 6px card top padding, matching the header-to-preview gap.
Align names and full-width previews
at the left edge; center compact previews such as Weight and Steps. Align pin
buttons with the title row and preview area's right edge.
Time-widget previews reserve only
their actual 26px height; do not center them inside a taller counter preview slot.
