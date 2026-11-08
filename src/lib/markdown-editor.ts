import { EditorState, Prec, Transaction } from '@codemirror/state';
import { EditorView, drawSelection, keymap, placeholder } from '@codemirror/view';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import {
	HighlightStyle,
	defaultHighlightStyle,
	indentUnit,
	syntaxHighlighting
} from '@codemirror/language';
import {
	deleteMarkupBackward,
	insertNewlineContinueMarkupCommand
} from '@codemirror/lang-markdown';
import { tags } from '@lezer/highlight';
import { silkdown } from '@silkdown/core';
import '@silkdown/core/theme.css';

export type MarkdownEditor = { setValue: (value: string) => void; destroy: () => void };

const highlighting = HighlightStyle.define(
	defaultHighlightStyle.specs.filter((style) => style.tag !== tags.heading)
);

export function createMarkdownEditor(
	root: HTMLElement,
	value: string,
	onchange: (value: string) => void
): MarkdownEditor {
	let syncing = false;
	const view = new EditorView({
		parent: root,
		state: EditorState.create({
			doc: value,
			extensions: [
				silkdown(),
				indentUnit.of('  '),
				Prec.highest(
					keymap.of([
						{ key: 'Enter', run: insertNewlineContinueMarkupCommand({ nonTightLists: false }) },
						{ key: 'Backspace', run: deleteMarkupBackward }
					])
				),
				keymap.of([...defaultKeymap, indentWithTab]),
				drawSelection(),
				syntaxHighlighting(highlighting),
				placeholder('Note'),
				EditorView.contentAttributes.of({ 'aria-label': 'Notes', 'aria-multiline': 'true' }),
				EditorView.updateListener.of((update) => {
					if (update.docChanged && !syncing) onchange(update.state.doc.toString());
				})
			]
		})
	});
	return {
		setValue(value) {
			const current = view.state.doc.toString();
			if (value === current) return;
			// Update only the differing range so external edits preserve the cursor.
			let from = 0;
			while (from < current.length && from < value.length && current[from] === value[from]) from++;
			let to = current.length,
				end = value.length;
			while (to > from && end > from && current[to - 1] === value[end - 1]) {
				to--;
				end--;
			}
			syncing = true;
			try {
				view.dispatch({
					changes: { from, to, insert: value.slice(from, end) },
					annotations: Transaction.addToHistory.of(false)
				});
			} finally {
				syncing = false;
			}
		},
		destroy() {
			view.destroy();
		}
	};
}
