import {
	reply,
	noContent,
	fail,
	invalid,
	object,
	resourceId,
	measureFor,
	measureName,
	palette,
	uniqueMeasureName,
	type ApiContext,
	type ApiRoute
} from './shared';
import { isDeepStrictEqual } from 'node:util';
import { PALETTES, removeMeasure, type Measure } from '../../measures';
function listMeasures({ store }: ApiContext) {
	return reply({ measures: store.read().measures.definitions, palettes: PALETTES });
}
function createMeasure({ store, body }: ApiContext) {
	const payload = object(body, ['id', 'name', 'type', 'palette'], ['name', 'type']);
	if (payload.type !== 'uint' && payload.type !== 'boolean')
		invalid('Use uint or boolean.', 'type');
	const measure: Measure = {
		id: resourceId(payload.id ?? crypto.randomUUID()),
		name: measureName(payload.name),
		type: payload.type,
		palette: palette(payload.palette ?? 'green')
	};
	let created = true;
	store.update((data) => {
		const existing = data.measures.definitions.find((item) => item.id === measure.id);
		if (existing) {
			if (!isDeepStrictEqual(existing, measure))
				fail(409, 'duplicate_id', 'A different measure already uses this ID.', 'id');
			created = false;
			return data;
		}
		uniqueMeasureName(data, measure);
		return {
			...data,
			measures: { ...data.measures, definitions: [...data.measures.definitions, measure] }
		};
	});
	return reply(measure, created ? 201 : 200);
}
function getMeasure({ store, params }: ApiContext) {
	const id = resourceId(params.id);
	return reply(measureFor(store.read(), id));
}
function updateMeasure({ store, body, params }: ApiContext) {
	const id = resourceId(params.id);
	const payload = object(body, ['name', 'palette']);
	let updated!: Measure;
	store.update((data) => {
		updated = {
			...measureFor(data, id),
			...(Object.hasOwn(payload, 'name') ? { name: measureName(payload.name) } : {}),
			...(Object.hasOwn(payload, 'palette') ? { palette: palette(payload.palette) } : {})
		};
		uniqueMeasureName(data, updated);
		return {
			...data,
			measures: {
				...data.measures,
				definitions: data.measures.definitions.map((item) => (item.id === id ? updated : item))
			}
		};
	});
	return reply(updated);
}
function deleteMeasure({ store, params }: ApiContext) {
	const id = resourceId(params.id);
	store.update((data) => ({ ...data, measures: removeMeasure(data.measures, id) }));
	return noContent();
}
export const measureRoutes = [
	{ pattern: /^measures$/, methods: { GET: listMeasures, POST: createMeasure } },
	{
		pattern: /^measures\/(?<id>[^/]+)$/,
		methods: { GET: getMeasure, PATCH: updateMeasure, DELETE: deleteMeasure }
	}
] satisfies ApiRoute[];
