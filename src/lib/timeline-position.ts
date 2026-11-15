import type { TimelinePosition } from './view-state';

/** Record a day near the viewport's center, including its offset from that center. */
export function capturePosition(viewport: HTMLElement): TimelinePosition | null {
	const grid = viewport.querySelector<HTMLElement>('.vertical-days, .horizontal-days');
	if (!grid || !viewport.clientWidth || !viewport.clientHeight) return null;
	const bounds = viewport.getBoundingClientRect();
	const rect = grid.getBoundingClientRect();
	const style = getComputedStyle(grid);
	const columns = style.gridTemplateColumns.split(' ').length;
	const rows = style.gridTemplateRows.split(' ').length;
	const cell = grid.querySelector<HTMLElement>('.day');
	if (!cell) return null;
	const column = Math.max(
		0,
		Math.min(
			columns - 1,
			Math.floor(
				(bounds.left + viewport.clientWidth / 2 - rect.left) /
					(cell.offsetWidth + parseFloat(style.columnGap))
			)
		)
	);
	const row = Math.max(
		0,
		Math.min(
			rows - 1,
			Math.floor(
				(bounds.top + viewport.clientHeight / 2 - rect.top) /
					(cell.offsetHeight + parseFloat(style.rowGap))
			)
		)
	);
	const index = style.gridAutoFlow === 'column' ? column * rows + row : row * columns + column;
	const day = grid.children[Math.min(index, grid.children.length - 1)] as HTMLElement;
	if (!day?.classList.contains('day')) return null;
	const anchor = day.getBoundingClientRect();
	return {
		day: day.id.slice(4),
		x: anchor.left - bounds.left - viewport.clientWidth / 2,
		y: anchor.top - bounds.top - viewport.clientHeight / 2
	};
}

/** Scroll only the timeline, leaving the document and day editor untouched. */
export function restorePosition(viewport: HTMLElement, position: TimelinePosition) {
	const day = viewport.querySelector<HTMLElement>('#day-' + position.day);
	if (!day) return;
	const bounds = viewport.getBoundingClientRect();
	const anchor = day.getBoundingClientRect();
	viewport.scrollLeft += anchor.left - bounds.left - viewport.clientWidth / 2 - position.x;
	viewport.scrollTop += anchor.top - bounds.top - viewport.clientHeight / 2 - position.y;
}
