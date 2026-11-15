import { isDateKey, type DateKey } from './calendar.ts';
import { isRecord, normalizeDays } from './validation';

export const PALETTES = [
	{ id: 'green', name: 'Green', faint: '#e7efe4', medium: '#9abb8b', bright: '#397440' },
	{ id: 'blue', name: 'Blue', faint: '#e5edf6', medium: '#91b5d9', bright: '#326ca8' },
	{ id: 'amber', name: 'Amber', faint: '#f5eddb', medium: '#d7b568', bright: '#936716' },
	{ id: 'rose', name: 'Rose', faint: '#f5e5e8', medium: '#d69aa8', bright: '#a54460' },
	{ id: 'violet', name: 'Violet', faint: '#eee7f5', medium: '#b49bd1', bright: '#7850a3' },
	{ id: 'teal', name: 'Teal', faint: '#e0efed', medium: '#84bdb6', bright: '#287c73' }
] as const;
export type PaletteId = (typeof PALETTES)[number]['id'];
export type Measure = { id: string; name: string; type: 'uint' | 'boolean'; palette: PaletteId };
export type MeasureValue = number | boolean | null;
export type MeasuresState = {
	definitions: Measure[];
	days: Record<DateKey, Record<string, MeasureValue>>;
};
export const emptyMeasures = (): MeasuresState => ({ definitions: [], days: {} });
export const paletteFor = (id: PaletteId) => PALETTES.find((p) => p.id === id)!;
export function validMeasureValue(type: Measure['type'], value: unknown): value is MeasureValue {
	return type === 'boolean'
		? typeof value === 'boolean'
		: value === null || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0);
}

export function removeMeasure(state: MeasuresState, id: string): MeasuresState {
	const days: MeasuresState['days'] = {};
	for (const [date, values] of Object.entries(state.days)) {
		const remaining = Object.fromEntries(Object.entries(values).filter(([key]) => key !== id));
		if (Object.keys(remaining).length) days[date] = remaining;
	}
	return { definitions: state.definitions.filter((m) => m.id !== id), days };
}

export function setDayMeasure(
	state: MeasuresState,
	day: DateKey,
	id: string,
	value?: MeasureValue
): MeasuresState {
	const definition = state.definitions.find((measure) => measure.id === id);
	if (
		!definition ||
		!isDateKey(day) ||
		(value !== undefined && !validMeasureValue(definition.type, value))
	)
		return state;
	const values = { ...state.days[day] },
		days = { ...state.days };
	if (value === undefined) delete values[id];
	else values[id] = value;
	if (Object.keys(values).length) days[day] = values;
	else delete days[day];
	return { ...state, days };
}

export function normalizeMeasures(saved: unknown): MeasuresState {
	if (!isRecord(saved) || !Array.isArray(saved.definitions)) return emptyMeasures();
	const definitions: Measure[] = [];
	for (const item of saved.definitions) {
		if (
			!item ||
			typeof item.id !== 'string' ||
			!/^[a-zA-Z0-9-]{1,80}$/.test(item.id) ||
			definitions.some((m) => m.id === item.id) ||
			typeof item.name !== 'string' ||
			!item.name.trim() ||
			item.name.trim().length > 80 ||
			!['uint', 'boolean'].includes(item.type) ||
			!PALETTES.some((p) => p.id === item.palette)
		)
			continue;
		definitions.push({
			id: item.id,
			name: item.name.trim(),
			type: item.type,
			palette: item.palette
		});
	}
	const days = normalizeDays(saved.days, (values) => {
		if (!isRecord(values)) return;
		const valid: Record<string, MeasureValue> = {};
		for (const measure of definitions) {
			const value = values[measure.id];
			if (Object.hasOwn(values, measure.id) && validMeasureValue(measure.type, value))
				valid[measure.id] = value;
		}
		return Object.keys(valid).length ? valid : undefined;
	});
	return { definitions, days };
}
