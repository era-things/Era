import { GFM, parser } from '@lezer/markdown';

const markdown = parser.configure(GFM);

export function notePreview(note: string): string {
	// Only the beginning can be visible in a single-line preview.
	const source = note.trimStart().slice(0, 512);
	let text = '';
	let offset = 0;
	markdown.parse(source).iterate({
		enter(node) {
			const name = node.name;
			const linkUrl = name === 'URL' && ['Link', 'Image'].includes(node.node.parent?.name ?? '');
			if (
				!linkUrl &&
				!name.endsWith('Mark') &&
				!['TaskMarker', 'LinkTitle', 'HTMLTag', 'CodeInfo'].includes(name)
			)
				return;
			text += source.slice(offset, node.from);
			offset = node.to;
			return false;
		}
	});
	return (text + source.slice(offset)).replace(/\s+/g, ' ').trim();
}
