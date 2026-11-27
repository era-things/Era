import type { DateKey } from './calendar';
import {
	eraIntensity,
	eraNumberRange,
	eraPalette,
	eraValueLabel,
	type Era,
	type EraDay,
	type EraDays
} from './eras';

export type EraDayColor = { color: string; detail: string; intensity: number };

export function timelineEraColors(eras: Era[], days: EraDays) {
	const entries = new Map(eras.map((era) => [era.id, { era, days: new Map<DateKey, EraDay>() }]));
	for (const [date, day] of Object.entries(days)) {
		for (const [id, entry] of Object.entries(day)) entries.get(id)?.days.set(date, entry);
	}

	const colors: Record<DateKey, EraDayColor[]> = {};
	for (const { era, days: eraEntries } of entries.values()) {
		const { medium, bright } = eraPalette(era);
		const kind = era.linkedValue;
		const range = kind === 'number' ? eraNumberRange(eraEntries.values()) : undefined;
		for (const [date, entry] of eraEntries) {
			const intensity = eraIntensity(kind, entry, range);
			const color =
				intensity === 0
					? medium
					: intensity === 1
						? bright
						: `color-mix(in srgb, ${bright} ${intensity * 100}%, ${medium})`;
			const label = eraValueLabel(kind, entry);
			const detail = label ? `${era.name} (${label})` : era.name;
			(colors[date] ??= []).push({ color, detail, intensity });
		}
	}
	return colors;
}

export function eraOverlapFill(colors: EraDayColor[], future: boolean): string {
	// A ray sweeping equal lengths along the square's perimeter covers equal areas.
	// Start at the top-right corner so two eras divide the square diagonally.
	const boundary = (index: number) => {
		const position = (4 * index) / colors.length;
		const edge = Math.floor(position);
		return 90 * edge + 45 + (Math.atan(2 * (position - edge) - 1) * 180) / Math.PI;
	};
	const stops = colors.map(({ color }, index) => {
		const shade = future ? `color-mix(in srgb, ${color} 22%, var(--paper))` : color;
		return `${shade} ${boundary(index)}deg ${boundary(index + 1)}deg`;
	});
	return `conic-gradient(from 45deg, ${stops.join(', ')})`;
}
