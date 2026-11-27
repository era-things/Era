import { addDays, daysBetween, isDateKey, type DateKey } from './calendar';
import { formatDuration, validTime } from './duration';
import { PALETTES, paletteFor, type PaletteId } from './measures';
import { isRecord, normalizeDays } from './validation';

export type Era = {
	id: string;
	name: string;
	description: string;
	archived: boolean;
	linkedValue: EraLinkedValue;
	palette?: PaletteId;
	autoMarkedThrough?: DateKey;
};

export const ERA_LINKED_VALUES = {
	none: 'None',
	boolean: 'Boolean',
	number: 'Number',
	hours: 'Hours'
} as const;
export type EraLinkedValue = keyof typeof ERA_LINKED_VALUES;
export type EraValues = { boolean: boolean; number: number; hours: number };
export type EraValueKind = keyof EraValues;
export type EraDay = { marked?: true; values?: Partial<EraValues> };
export type EraNumberRange = { min: number; max: number };
export type EraDays = Record<DateKey, Record<string, EraDay>>;
export const ERA_NAME_LIMIT = 80;
export const ERA_DESCRIPTION_LIMIT = 4000;
export const ERA_FIELDS = ['name', 'description', 'archived', 'palette', 'linkedValue'] as const;
export const eraPalette = (era: Pick<Era, 'palette'>) => paletteFor(era.palette ?? 'green');

const valueValidators = {
	boolean: (value: unknown) => typeof value === 'boolean',
	number: (value: unknown) => typeof value === 'number' && Number.isFinite(value),
	hours: validTime
} satisfies Record<EraValueKind, (value: unknown) => boolean>;

export const ERA_VALUE_KINDS = Object.keys(valueValidators) as EraValueKind[];
export function isEraValueKind(kind: unknown): kind is EraValueKind {
	return typeof kind === 'string' && Object.hasOwn(valueValidators, kind);
}
export function isEraValue<K extends EraValueKind>(kind: K, value: unknown): value is EraValues[K] {
	return valueValidators[kind](value);
}

export function eraValueLabel(kind: EraLinkedValue, entry: EraDay): string {
	if (kind === 'none') return '';
	const value = entry.values?.[kind];
	if (value === undefined) return '';
	if (typeof value === 'boolean') return value ? 'On' : 'Off';
	return kind === 'hours' ? formatDuration(value) : String(value);
}

export function eraStats(kind: EraLinkedValue, entries: Iterable<EraDay>) {
	if (kind === 'none') return;
	if (kind === 'boolean') {
		let on = 0;
		let count = 0;
		for (const entry of entries) {
			const value = entry.values?.boolean;
			if (value !== undefined) {
				count++;
				if (value) on++;
			}
		}
		return count ? { kind, on, count } : undefined;
	}
	const values: number[] = [];
	for (const entry of entries) {
		const value = entry.values?.[kind];
		if (value !== undefined) values.push(value);
	}
	if (!values.length) return;
	let total = 0;
	let min = values[0];
	let max = min;
	for (const value of values) {
		total += value;
		min = Math.min(min, value);
		max = Math.max(max, value);
	}
	const average = Number.isFinite(total)
		? total / values.length
		: values.reduce((sum, value) => sum + value / values.length, 0);
	return { kind, total, average, min, max, count: values.length };
}

export function eraNumberRange(entries: Iterable<EraDay>): EraNumberRange | undefined {
	let range: EraNumberRange | undefined;
	for (const entry of entries) {
		const value = entry.values?.number;
		if (value === undefined) continue;
		if (range) {
			range.min = Math.min(range.min, value);
			range.max = Math.max(range.max, value);
		} else range = { min: value, max: value };
	}
	return range;
}

export function eraIntensity(kind: EraLinkedValue, entry: EraDay, range?: EraNumberRange): number {
	if (kind === 'boolean') return Number(entry.values?.boolean === true);
	if (kind === 'hours') return Math.min((entry.values?.hours ?? 0) / 480, 1);
	const value = entry.values?.number;
	if (kind !== 'number' || value === undefined || !range || range.min === range.max) return 0;
	// Halving the range prevents overflow for finite values of opposite signs.
	const width = range.max - range.min;
	return Number.isFinite(width)
		? (value - range.min) / width
		: (value / 2 - range.min / 2) / (range.max / 2 - range.min / 2);
}

export function normalizeEra(value: unknown): Era | undefined {
	if (!isRecord(value)) return;
	const { id, name, description, archived, palette, linkedValue, autoMarkedThrough } = value;
	const color = PALETTES.find(({ id }) => id === palette);
	if (
		typeof id !== 'string' ||
		!/^[a-zA-Z0-9-]{1,80}$/.test(id) ||
		id in Object.prototype ||
		typeof name !== 'string' ||
		!name.trim() ||
		name.trim().length > ERA_NAME_LIMIT ||
		typeof description !== 'string' ||
		description.trim().length > ERA_DESCRIPTION_LIMIT ||
		typeof archived !== 'boolean' ||
		(linkedValue !== 'none' && !isEraValueKind(linkedValue)) ||
		(palette !== undefined && !color) ||
		(autoMarkedThrough !== undefined && (archived || !isDateKey(autoMarkedThrough)))
	)
		return;
	return {
		id,
		name: name.trim(),
		description: description.trim(),
		archived,
		linkedValue,
		...(color && { palette: color.id }),
		...(isDateKey(autoMarkedThrough) && { autoMarkedThrough })
	};
}

export function normalizeEras(value: unknown): Era[] {
	const eras = new Map<string, Era>();
	if (Array.isArray(value))
		for (const item of value) {
			const era = normalizeEra(item);
			if (era) eras.set(era.id, era);
		}
	return [...eras.values()];
}

export function normalizeEraDays(value: unknown, eras: Era[]): EraDays {
	const ids = new Set(eras.map(({ id }) => id));
	return normalizeDays(value, (entries) => {
		if (!isRecord(entries)) return;
		const day: Record<string, EraDay> = {};
		for (const [id, entry] of Object.entries(entries)) {
			if (!ids.has(id) || !isRecord(entry)) continue;
			const { marked, values } = entry;
			const validValues = isRecord(values)
				? Object.fromEntries(
						ERA_VALUE_KINDS.filter((kind) => isEraValue(kind, values[kind])).map((kind) => [
							kind,
							values[kind]
						])
					)
				: {};
			const hasValues = Object.keys(validValues).length > 0;
			if (marked === true || hasValues)
				day[id] = {
					...(marked === true ? { marked } : {}),
					...(hasValues ? { values: validValues as Partial<EraValues> } : {})
				};
		}
		if (Object.keys(day).length) return day;
	});
}

function writeEntry(days: EraDays, date: DateKey, id: string, entry: EraDay) {
	const day = { ...days[date] };
	if (entry.marked || entry.values) day[id] = entry;
	else delete day[id];
	if (Object.keys(day).length) days[date] = day;
	else delete days[date];
}

export function setEraMarks(
	days: EraDays,
	id: string,
	mark: readonly DateKey[],
	unmark: readonly DateKey[]
): EraDays {
	const next = { ...days };
	for (const date of mark) writeEntry(next, date, id, { ...next[date]?.[id], marked: true });
	for (const date of unmark) {
		const values = next[date]?.[id]?.values;
		writeEntry(next, date, id, values ? { values } : {});
	}
	return next;
}

export function setEraValue<K extends EraValueKind>(
	days: EraDays,
	date: DateKey,
	id: string,
	kind: K,
	value: EraValues[K] | null
): EraDays {
	const next = { ...days };
	const marked = days[date]?.[id]?.marked;
	const values = { ...days[date]?.[id]?.values };
	if (value === null) delete values[kind];
	else values[kind] = value;
	writeEntry(next, date, id, {
		...(marked ? { marked } : {}),
		...(Object.keys(values).length > 0 ? { values } : {})
	});
	return next;
}

export function datesToMark(from: DateKey, through: DateKey): DateKey[] | undefined {
	if (!isDateKey(from) || !isDateKey(through) || through < from) return;
	return Array.from({ length: daysBetween(from, through) + 1 }, (_, i) => addDays(from, i));
}
