import { isDateKey } from '../../calendar';
import type { CalendarData } from '../../data-export';
import {
	ERA_FIELDS,
	isEraValue,
	isEraValueKind,
	normalizeEra,
	setEraMarks,
	setEraValue
} from '../../eras';
import {
	dayKey,
	fail,
	invalid,
	noContent,
	object,
	palette,
	reply,
	resourceId,
	type ApiContext,
	type ApiRoute
} from './shared';
import { currentEraDay } from '../era-day';

function findEra(data: CalendarData, id: string) {
	const era = data.eras.find((item) => item.id === id);
	if (!era) fail(404, 'era_not_found', 'Unknown era.', 'id');
	return era;
}

function saveEra({ store, params, body, method }: ApiContext) {
	const id = resourceId(params.id);
	const payload = object(
		body,
		[...ERA_FIELDS, 'active'],
		method === 'PUT' ? ['name', 'description', 'archived', 'linkedValue'] : []
	);
	if (Object.hasOwn(payload, 'palette'))
		payload.palette = payload.palette === null ? undefined : palette(payload.palette);
	const { active, ...fields } = payload;
	if (active !== undefined && typeof active !== 'boolean') invalid('Use true or false.', 'active');
	const next = store.update((data) => {
		const previous =
			method === 'PATCH' ? findEra(data, id) : data.eras.find((item) => item.id === id);
		const archived = fields.archived ?? previous?.archived;
		const autoMarkedThrough =
			archived === true || active === false
				? undefined
				: (previous?.autoMarkedThrough ?? (active ? currentEraDay().date : undefined));
		const era = normalizeEra({ ...previous, ...fields, id, autoMarkedThrough });
		if (!era)
			invalid(
				'Use a name of 1–80 characters, a description of up to 4000 characters, a boolean archive status, and a valid linked value type.',
				'body'
			);
		return {
			...data,
			eras: previous ? data.eras.map((item) => (item.id === id ? era : item)) : [...data.eras, era]
		};
	});
	return reply(findEra(next, id));
}

function deleteEra({ store, params }: ApiContext) {
	const id = resourceId(params.id);
	store.update((data) => {
		const eraDays = { ...data.eraDays };
		for (const [day, entries] of Object.entries(eraDays)) {
			if (!Object.hasOwn(entries, id)) continue;
			const remaining = { ...entries };
			delete remaining[id];
			if (Object.keys(remaining).length) eraDays[day] = remaining;
			else delete eraDays[day];
		}
		return { ...data, eras: data.eras.filter((era) => era.id !== id), eraDays };
	});
	return noContent();
}

function dates(value: unknown, field: string): string[] {
	if (!Array.isArray(value) || !value.every(isDateKey))
		invalid('Use a list of calendar dates.', field);
	return value;
}

function patchMarks({ store, params, body }: ApiContext) {
	const id = resourceId(params.id);
	const payload = object(body, ['mark', 'unmark']);
	const mark = dates(payload.mark ?? [], 'mark');
	const unmark = dates(payload.unmark ?? [], 'unmark');
	const marking = new Set(mark);
	if (unmark.some((date) => marking.has(date)))
		invalid('A date can only be marked or unmarked in one request.', 'unmark');
	store.update((data) => {
		findEra(data, id);
		return { ...data, eraDays: setEraMarks(data.eraDays, id, mark, unmark) };
	});
	return noContent();
}

function updateValue({ store, params, body, method }: ApiContext) {
	const id = resourceId(params.id);
	const date = dayKey(params.date);
	const kind = params.kind;
	if (!isEraValueKind(kind)) invalid('Choose boolean, number, or hours.', 'kind');
	let value = null;
	if (method === 'PUT') {
		const input = object(body, ['value'], ['value']).value;
		if (!isEraValue(kind, input)) invalid('Enter a valid linked value.', 'value');
		value = input;
	}
	store.update((data) => {
		findEra(data, id);
		return { ...data, eraDays: setEraValue(data.eraDays, date, id, kind, value) };
	});
	return noContent();
}

export const eraRoutes = [
	{ pattern: /^eras$/, methods: { GET: ({ store }) => reply({ eras: store.read().eras }) } },
	{
		pattern: /^eras\/(?<id>[^/]+)$/,
		methods: {
			GET: ({ store, params }) => {
				const data = store.read();
				const id = resourceId(params.id);
				const era = findEra(data, id);
				const days = Object.fromEntries(
					Object.entries(data.eraDays).flatMap(([date, entries]) =>
						entries[id] ? [[date, entries[id]]] : []
					)
				);
				return reply({ ...era, days });
			},
			PUT: saveEra,
			PATCH: saveEra,
			DELETE: deleteEra
		}
	},
	{ pattern: /^eras\/(?<id>[^/]+)\/days$/, methods: { PATCH: patchMarks } },
	{
		pattern: /^days\/(?<date>[^/]+)\/eras\/(?<id>[^/]+)\/values\/(?<kind>[^/]+)$/,
		methods: { PUT: updateValue, DELETE: updateValue }
	}
] satisfies ApiRoute[];
