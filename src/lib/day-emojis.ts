import type { DateKey } from './calendar.ts';
import { normalizeDays } from './validation';

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

export const normalizeDayEmojis = (value: unknown): DayEmojis =>
	normalizeDays(value, (entry) =>
		typeof entry === 'string' ? normalizeEmoji(entry) || undefined : undefined
	);
