import { isRecord } from './validation';
import { WIDGETS, emptyLayout, validWidgetSkin, type LayoutState } from './widgets';

export function normalizeLayout(value: unknown): LayoutState {
	const layout = emptyLayout();
	if (!isRecord(value) || !isRecord(value.widgets)) return layout;
	for (const { id } of WIDGETS) {
		const settings = value.widgets[id];
		if (
			isRecord(settings) &&
			typeof settings.pinned === 'boolean' &&
			validWidgetSkin(id, settings.skin)
		)
			Object.assign(layout.widgets[id], { pinned: settings.pinned, skin: settings.skin });
	}
	return layout;
}
