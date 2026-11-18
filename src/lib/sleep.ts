import type { DateKey } from './calendar';
import { isRecord, normalizeDays } from './validation';

// Local clock minutes. An end earlier than start is on the following day.
export type SleepMetrics = { asleepMinutes: number; awakeMinutes: number; score: number };
export type Sleep = {
	start: number | null;
	end: number | null;
	duration: number | null;
	metrics?: SleepMetrics;
};
export type SleepDays = Record<DateKey, Sleep>;
export const emptySleep = (): Sleep => ({ start: null, end: null, duration: 450 });
const wrap = (minutes: number) => ((minutes % 1440) + 1440) % 1440;
const validMinutes = (value: unknown): value is number =>
	typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 1440;

export function validSleepMetrics(value: unknown): value is SleepMetrics {
	if (!isRecord(value) || Object.keys(value).length !== 3) return false;
	const wholeInRange = (entry: unknown, max: number) =>
		typeof entry === 'number' && Number.isInteger(entry) && entry >= 0 && entry <= max;
	return (
		wholeInRange(value.asleepMinutes, 1440) &&
		wholeInRange(value.awakeMinutes, 1440) &&
		wholeInRange(value.score, 100)
	);
}

export function validSleep(value: unknown): value is Sleep {
	if (!isRecord(value) || Object.keys(value).length !== (Object.hasOwn(value, 'metrics') ? 4 : 3))
		return false;
	if (Object.hasOwn(value, 'metrics') && !validSleepMetrics(value.metrics)) return false;
	const { start, end, duration } = value;
	if (![start, end, duration].every((v) => v === null || validMinutes(v))) return false;
	const known = [start, end, duration].filter((v) => v !== null).length;
	return known < 2 || (known === 3 && wrap((end as number) - (start as number)) === duration);
}

export const normalizeSleep = (value: unknown): SleepDays =>
	normalizeDays(value, (entry) => (validSleep(entry) ? entry : undefined));

export function changeSleep(
	sleep: Sleep,
	field: 'start' | 'end' | 'duration',
	value: number | null
): Sleep {
	if (value !== null && !validMinutes(value)) return sleep;
	const next = { ...sleep, [field]: value };
	if (value === null) {
		// Clearing duration also clears its dependent end; clearing an endpoint clears duration.
		if (field === 'duration') next.end = null;
		else next.duration = null;
	} else if (field === 'duration') {
		if (next.start !== null) next.end = wrap(next.start + value);
		else if (next.end !== null) next.start = wrap(next.end - value);
	} else if (next.start !== null && next.end !== null) {
		next.duration = wrap(next.end - next.start);
	} else if (next.duration !== null) {
		if (next.start !== null) next.end = wrap(next.start + next.duration);
		else if (next.end !== null) next.start = wrap(next.end - next.duration);
	}
	return next;
}

export function formatSleepTime(minutes: number | null): string {
	return minutes === null
		? ''
		: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function parseSleepTime(value: string): number | null {
	const match = /^(\d{1,2}):?([0-5]\d)$/.exec(value.trim());
	return match && Number(match[1]) < 24 ? Number(match[1]) * 60 + Number(match[2]) : null;
}
