import { asDate, type DateKey } from './calendar.ts';

export const MEASURES_STORAGE_KEY = 'era:measures:v1';
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

export function parseMeasures(raw: string | null): MeasuresState {
	try {
		const saved = JSON.parse(raw ?? 'null');
		if (saved?.version !== 1 || !Array.isArray(saved.definitions)) return emptyMeasures();
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
		const days: MeasuresState['days'] = {};
		if (saved.days && typeof saved.days === 'object' && !Array.isArray(saved.days)) {
			for (const [date, values] of Object.entries(saved.days)) {
				if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
				const parsed = asDate(date);
				if (
					!Number.isFinite(parsed.getTime()) ||
					parsed.toISOString().slice(0, 10) !== date ||
					!values ||
					typeof values !== 'object' ||
					Array.isArray(values)
				)
					continue;
				const valid: Record<string, MeasureValue> = {};
				for (const measure of definitions) {
					if (Object.hasOwn(values, measure.id)) {
						const value = (values as Record<string, unknown>)[measure.id];
						if (validMeasureValue(measure.type, value)) valid[measure.id] = value;
					}
				}
				if (Object.keys(valid).length) days[date] = valid;
			}
		}
		return { definitions, days };
	} catch {
		return emptyMeasures();
	}
}
