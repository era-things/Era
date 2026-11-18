import type { openCalendar } from '../database';
import type { CalendarData } from '../../data-export';
import { isDateKey } from '../../calendar';
import { isRecord } from '../../validation';
import { PALETTES, type Measure } from '../../measures';
export type Store = ReturnType<typeof openCalendar>;
export type ApiMethod = 'GET' | 'PUT' | 'PATCH' | 'POST' | 'DELETE';
export type ApiContext = {
	store: Store;
	headers: Headers;
	body: unknown;
	params: Record<string, string>;
	method: string;
};
export type ApiHandler = (context: ApiContext) => Response | Promise<Response>;
export type ApiRoute = { pattern: RegExp; methods: Partial<Record<ApiMethod, ApiHandler>> };
export const reply = (value: unknown, status = 200, headers: Record<string, string> = {}) =>
	Response.json(value, { status, headers: { 'cache-control': 'no-store', ...headers } });
export class ApiError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string,
		public field?: string
	) {
		super(message);
	}
}

export function fail(status: number, code: string, message: string, field?: string): never {
	throw new ApiError(status, code, message, field);
}

export const noContent = () => new Response(null, { status: 204 });

export function invalid(message: string, field: string): never {
	return fail(400, 'invalid_value', message, field);
}

export function object(
	value: unknown,
	allowed: string[],
	required: string[] = []
): Record<string, unknown> {
	if (!isRecord(value)) invalid('Expected a JSON object.', 'body');
	for (const key of Object.keys(value))
		if (!allowed.includes(key)) fail(400, 'unknown_field', `Unknown field: ${key}.`, key);
	for (const key of required)
		if (!Object.hasOwn(value, key)) fail(400, 'required_field', `Missing field: ${key}.`, key);
	return value;
}

export function resourceId(value: unknown, field = 'id'): string {
	if (typeof value !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(value) || value in Object.prototype)
		invalid('Use 1–80 letters, digits, or hyphens.', field);
	return value;
}

export function dayKey(value: string) {
	if (!isDateKey(value)) invalid('Use a real calendar date in YYYY-MM-DD format.', 'date');
	return value;
}

export function measureFor(data: CalendarData, id: string) {
	const measure = data.measures.definitions.find((item) => item.id === id);
	if (!measure) fail(404, 'measure_not_found', 'Unknown measure.', 'id');
	return measure;
}

export function measureName(value: unknown): string {
	if (typeof value !== 'string' || !value.trim() || value.trim().length > 80)
		invalid('Use a name of 1–80 characters.', 'name');
	return value.trim();
}

export function palette(value: unknown): Measure['palette'] {
	if (!PALETTES.some((item) => item.id === value)) invalid('Unknown color palette.', 'palette');
	return value as Measure['palette'];
}

export function uniqueMeasureName(data: CalendarData, measure: Measure) {
	if (
		data.measures.definitions.some(
			(item) =>
				item.id !== measure.id && item.name.toLocaleLowerCase() === measure.name.toLocaleLowerCase()
		)
	)
		fail(409, 'duplicate_name', 'A measure with this name already exists.', 'name');
}
