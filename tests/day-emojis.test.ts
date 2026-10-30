import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeEmoji, parseDayEmojis } from '../src/lib/day-emojis.ts';

test('accepts single emoji including flags, skin tones, keycaps and joined sequences', () => {
	for (const emoji of ['🎉', '❤️', '🇫🇷', '👍🏽', '👨‍👩‍👧‍👦', '1️⃣', '👩🏽‍💻'])
		assert.equal(normalizeEmoji(emoji), emoji);
	assert.equal(normalizeEmoji(' 🎉 '), '🎉');
	assert.equal(normalizeEmoji(''), '');
});

test('rejects ordinary text and more than one emoji', () => {
	for (const value of ['hello', '1', '🎉🎂', 'happy 🎉', '🇫'])
		assert.equal(normalizeEmoji(value), null);
});

test('keeps independent day assignments across a storage round trip', () => {
	const days = { '2026-10-30': '🎉', '2026-10-31': '👩🏽‍💻' };
	assert.deepEqual(parseDayEmojis(JSON.stringify({ version: 1, days })), days);
});

test('invalid storage starts empty, and bad entries do not discard valid days', () => {
	for (const raw of [null, '{', 'null', '[]', '{"version":2,"days":{}}'])
		assert.deepEqual(parseDayEmojis(raw), {});
	assert.deepEqual(
		parseDayEmojis(
			JSON.stringify({
				version: 1,
				days: {
					'2026-10-30': '🎉',
					'2026-02-30': '🎂',
					'bad-key': '⭐',
					'2026-10-31': 'not emoji',
					'2026-11-01': '',
					'2026-11-02': 42
				}
			})
		),
		{ '2026-10-30': '🎉' }
	);
});
