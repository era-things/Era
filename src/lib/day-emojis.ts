import { asDate, type DateKey } from './calendar.ts';

export const DAY_EMOJIS_STORAGE_KEY = 'era:day-emojis:v1';
export type DayEmojis = Record<DateKey, string>;
const segments = new Intl.Segmenter('en', { granularity: 'grapheme' });

/** Preserve joined emoji, flags and skin tones; reject text or multiple emoji. */
export function normalizeEmoji(value: string): string | null {
	const emoji = value.trim();
	if (!emoji) return '';
	if ([...segments.segment(emoji)].length !== 1) return null;
	if (
		/\p{Extended_Pictographic}/u.test(emoji) ||
		/^\p{Regional_Indicator}{2}$/u.test(emoji) ||
		/^[0-9#*]\uFE0F?\u20E3$/u.test(emoji)
	)
		return emoji;
	return null;
}

export function parseDayEmojis(raw: string | null): DayEmojis {
	try {
		if (!raw) return {};
		const saved = JSON.parse(raw);
		if (
			saved?.version !== 1 ||
			!saved.days ||
			typeof saved.days !== 'object' ||
			Array.isArray(saved.days)
		)
			return {};
		const days: DayEmojis = {};
		for (const [key, value] of Object.entries(saved.days)) {
			if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || typeof value !== 'string') continue;
			const date = asDate(key);
			if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== key) continue;
			const emoji = normalizeEmoji(value);
			if (emoji) days[key] = emoji;
		}
		return days;
	} catch {
		return {};
	}
}
