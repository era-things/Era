import { reply, invalid, object, type ApiContext, type ApiRoute } from './shared';
import {
	WIDGETS,
	setWidgetSettings,
	validWidgetSkin,
	validWidgetVisibility,
	type WidgetSettings
} from '../../widgets';
import { widgetId, definition } from './widget-values';
function listWidgets({ store }: ApiContext) {
	const data = store.read();
	return reply({ widgets: WIDGETS.map((item) => definition(data, item.id)) });
}
function getWidget({ store, params }: ApiContext) {
	const id = widgetId(params.id);
	return reply(definition(store.read(), id));
}
function updateWidget({ store, body, params }: ApiContext) {
	const id = widgetId(params.id);
	const patch = object(body, ['visibility', 'skin']);
	if (Object.hasOwn(patch, 'visibility') && !validWidgetVisibility(patch.visibility))
		invalid('Unknown widget visibility.', 'visibility');
	if (Object.hasOwn(patch, 'skin') && !validWidgetSkin(id, patch.skin))
		invalid('Unknown skin for this widget.', 'skin');
	const data = store.update((current) => ({
		...current,
		layout: setWidgetSettings(current.layout, id, patch as Partial<WidgetSettings>)
	}));
	return reply(definition(data, id));
}
export const widgetRoutes = [
	{ pattern: /^widgets$/, methods: { GET: listWidgets } },
	{ pattern: /^widgets\/(?<id>[^/]+)$/, methods: { GET: getWidget, PATCH: updateWidget } }
] satisfies ApiRoute[];
