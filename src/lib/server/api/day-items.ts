import type { DateKey } from '../../calendar';
import type { CalendarData } from '../../data-export';
import {
	dayKey,
	fail,
	invalid,
	noContent,
	object,
	reply,
	type ApiContext,
	type ApiRoute
} from './shared';

type DayItems<Item extends object> = {
	collectionPath: RegExp;
	itemPath: RegExp;
	idField: keyof Item & string;
	parseId: (value: unknown, field?: string) => string;
	normalizeId?: (id: string) => string;
	required: readonly (keyof Item & string)[];
	optional?: readonly (keyof Item & string)[];
	valid: (value: unknown) => value is Item;
	label: string;
	notFoundCode: string;
	read: (data: CalendarData, date: DateKey) => Item[] | undefined;
	write: (data: CalendarData, date: DateKey, items: Item[]) => CalendarData;
};

export function nonBlankItemId(value: unknown, field = 'id'): string {
	if (typeof value !== 'string' || !value.trim()) invalid('Expected a non-empty identifier.', field);
	return value;
}

export function dayItemRoutes<Item extends object>(config: DayItems<Item>): ApiRoute[] {
	const { idField, read, write } = config;
	const editable = [...config.required, ...(config.optional ?? [])];
	const normalizeId = config.normalizeId ?? ((id) => id);
	const matches = (item: Item, id: string) => normalizeId(String(item[idField])) === normalizeId(id);
	const missingItem = () =>
		fail(404, config.notFoundCode, `Unknown ${config.label}.`, idField);

	function listItems({ store, params }: ApiContext) {
		return reply({ items: read(store.read(), dayKey(params.date)) ?? [] });
	}

	function getItem({ store, params }: ApiContext) {
		const date = dayKey(params.date);
		const id = config.parseId(params.id, idField);
		return reply(read(store.read(), date)?.find((item) => matches(item, id)) ?? missingItem());
	}

	function writeItem({ store, params, body, method }: ApiContext) {
		const date = dayKey(params.date);
		const id = config.parseId(params.id, idField);
		const patch = method === 'PATCH';
		const payload = patch
			? object(body, editable)
			: object(body, [idField, ...editable], [...config.required]);
		if (Object.hasOwn(payload, idField)) {
			const supplied = config.parseId(payload[idField], idField);
			if (normalizeId(supplied) !== normalizeId(id))
				invalid('Identifier must match the URL.', idField);
		}
		const saved = store.update((data) => {
			const items = [...(read(data, date) ?? [])];
			const index = items.findIndex((item) => matches(item, id));
			if (patch && index === -1) missingItem();
			const storedId = items[index]?.[idField];
			const value = patch
				? { ...items[index], ...payload }
				: { ...payload, [idField]: payload[idField] ?? storedId ?? id };
			if (!config.valid(value)) invalid(`Invalid ${config.label}.`, 'body');
			if (index === -1) items.push(value);
			else items[index] = value;
			return write(data, date, items);
		});
		return reply(read(saved, date)?.find((item) => matches(item, id)));
	}

	function deleteItem({ store, params }: ApiContext) {
		const date = dayKey(params.date);
		const id = config.parseId(params.id, idField);
		store.update((data) => {
			const items = read(data, date);
			if (!items?.some((item) => matches(item, id))) return data;
			return write(data, date, items.filter((item) => !matches(item, id)));
		});
		return noContent();
	}

	return [
		{ pattern: config.collectionPath, methods: { GET: listItems } },
		{
			pattern: config.itemPath,
			methods: { GET: getItem, PUT: writeItem, PATCH: writeItem, DELETE: deleteItem }
		}
	];
}
