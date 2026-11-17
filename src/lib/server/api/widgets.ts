import { reply, fail, invalid, object, type ApiContext, type ApiRoute } from './shared';
import { WIDGETS, setWidgetSettings, validWidgetSkin, type WidgetSettings } from '../../widgets';
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
	const patch = object(body, ['pinned', 'archived', 'skin']);
	for (const field of ['pinned', 'archived'])
		if (Object.hasOwn(patch, field) && typeof patch[field] !== 'boolean')
			invalid('Expected a boolean.', field);
	if (Object.hasOwn(patch, 'skin') && !validWidgetSkin(id, patch.skin))
		invalid('Unknown skin for this widget.', 'skin');
	if (patch.archived === true && patch.pinned === true)
		invalid('An archived widget cannot be pinned.', 'pinned');
	const data = store.update((current) => {
		if (patch.pinned === true && (patch.archived ?? current.layout.widgets[id].archived))
			fail(
				409,
				'widget_archived',
				'Restore this widget from the catalog before pinning it.',
				'archived'
			);
		return {
			...current,
			layout: setWidgetSettings(current.layout, id, patch as Partial<WidgetSettings>)
		};
	});
	return reply(definition(data, id));
}
export const widgetRoutes = [
	{ pattern: /^widgets$/, methods: { GET: listWidgets } },
	{ pattern: /^widgets\/(?<id>[^/]+)$/, methods: { GET: getWidget, PATCH: updateWidget } }
] satisfies ApiRoute[];
