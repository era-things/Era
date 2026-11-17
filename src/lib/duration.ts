export type DurationUnit = 'hours' | 'minutes';

export const validTime = (value: unknown): value is number =>
	typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1440;

function parts(duration: number) {
	return { hours: Math.floor(duration / 60), minutes: duration % 60 };
}

export function changeDurationPart(
	duration: number | null,
	unit: DurationUnit,
	value: number | null
) {
	if (value === null) return null;
	const next = parts(duration ?? 0);
	next[unit] = value;
	return next.hours * 60 + next.minutes;
}

export function formatDurationPart(duration: number | null, unit: DurationUnit): string {
	if (duration === null) return '';
	return String(parts(duration)[unit]).padStart(unit === 'minutes' ? 2 : 1, '0');
}
