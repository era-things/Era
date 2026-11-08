import { Decoration, WidgetType } from "@codemirror/view";
import type { EditorSelection, Range, Text } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";
import { children } from "../util/tree.js";
import { TaskCheckboxWidget } from "../widgets/task.js";
import { selectionTouchesLineRange } from "../util/selection.js";
import { HIDE, MUTED_MARK, pushAtomicRange } from "./shared.js";

class BulletWidget extends WidgetType {
  override toDOM(): HTMLElement {
    const bullet = document.createElement("span");
    bullet.className = "sd-list-bullet";
    bullet.textContent = "•";
    bullet.setAttribute("aria-hidden", "true");
    return bullet;
  }
}
const BULLET = Decoration.replace({ widget: new BulletWidget() });

export function decorateListItem(
  ranges: Range<Decoration>[],
  atomicRanges: Range<Decoration>[],
  node: SyntaxNode,
  doc: Text,
  sel: EditorSelection | null,
): void {
  const startLine = doc.lineAt(node.from);
  const mark = node.firstChild;
  if (mark?.name === "ListMark") {
    const contentColumn = mark.to - startLine.from + 1;
    ranges.push(Decoration.line({
      class: "sd-list-item",
      attributes: { style: `padding-left: ${contentColumn}ch; text-indent: -${contentColumn}ch` },
    }).range(startLine.from));
    const isTask = [...children(node)].some(child => child.name === "Task");
    if (isTask) {
      pushAtomicRange(ranges, atomicRanges, HIDE, mark.from, mark.to + 1);
    } else if (selectionTouchesLineRange(doc, sel, startLine.from, startLine.to)) {
      ranges.push(MUTED_MARK.range(mark.from, mark.to));
    } else if (node.parent?.name === "BulletList") {
      pushAtomicRange(ranges, atomicRanges, BULLET, mark.from, mark.to);
    }
  }

  // GFM task shape: ListItem > Task > TaskMarker covers the literal "[ ]" / "[x]".
  for (const child of children(node)) {
    if (child.name !== "Task") continue;
    for (const inner of children(child)) {
      if (inner.name !== "TaskMarker") continue;
      const text = doc.sliceString(inner.from, inner.to);
      const checked = text.toLowerCase().includes("x");
      pushAtomicRange(
        ranges,
        atomicRanges,
        Decoration.replace({
          widget: new TaskCheckboxWidget(checked, inner.from, inner.to),
        }),
        inner.from,
        inner.to,
      );
    }
  }
}
