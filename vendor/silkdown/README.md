# Silkdown core (vendored)

Source: https://github.com/magarcia/silkdown/tree/2b7a2b4ad5e7b54a9584c52e2ebf9cb4c0ac6ee9/packages/core
Revision: `2b7a2b4ad5e7b54a9584c52e2ebf9cb4c0ac6ee9`
License: MIT (see LICENSE).

The documented npm package was unavailable when integrated. This local package
contains the upstream core source with the local patches below. Its package exports point to source
files so Vite can compile them; upstream build scripts and development dependencies
are omitted. CodeMirror and Lezer remain peer dependencies supplied by Era.

Local patch: `src/decorate/list.ts` renders inactive unordered markers as bullets,
reveals active markers, hides redundant task bullets, and indents wrapped items.

Focus patch: the rendering plugin rebuilds on focus changes and supplies no active
selection while blurred, so every Markdown line is rendered outside the editor.

To update, preserve these patches when replacing `src/` from a reviewed upstream revision and update this record.
