import assert from 'node:assert/strict';
import test from 'node:test';
import { browserStorage } from '../src/lib/browser-storage.ts';

test('browser storage loads, serializes, syncs only its key and disconnects', (t) => {
	const target = new EventTarget();
	let raw = '{"value":2}';
	let fail = false;
	let value = 0;
	let error = '';
	const original = ['localStorage', 'window'].map(
		(key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const
	);
	t.after(() => {
		for (const [key, descriptor] of original) {
			if (descriptor) Object.defineProperty(globalThis, key, descriptor);
			else Reflect.deleteProperty(globalThis, key);
		}
	});
	Object.defineProperty(globalThis, 'window', { configurable: true, value: target });
	Object.defineProperty(globalThis, 'localStorage', {
		configurable: true,
		value: {
			getItem: () => {
				if (fail) throw new Error('blocked');
				return raw;
			},
			setItem: (_key: string, next: string) => {
				if (fail) throw new Error('full');
				raw = next;
			}
		}
	});
	const storage = browserStorage({
		key: 'test',
		label: 'Test',
		parse: (raw) => JSON.parse(raw ?? '{"value":0}').value as number,
		serialize: (value: number) => JSON.stringify({ value }),
		apply: (next) => (value = next),
		error: (next) => (error = next)
	});
	const disconnect = storage.connect();
	assert.equal(value, 2);
	assert.equal(storage.save(3), true);
	assert.equal(raw, '{"value":3}');
	const sync = (key: string | null, newValue: string | null) =>
		target.dispatchEvent(Object.assign(new Event('storage'), { key, newValue }));
	sync('other', '{"value":4}');
	assert.equal(value, 3);
	sync('test', '{"value":4}');
	assert.equal(value, 4);
	sync(null, null);
	assert.equal(value, 0);
	fail = true;
	assert.equal(storage.save(5), false);
	assert.equal(value, 0);
	assert.match(error, /Could not save/);
	const blockedDisconnect = storage.connect();
	assert.match(error, /unavailable/);
	blockedDisconnect();
	fail = false;
	assert.equal(storage.save(6), true);
	assert.equal(error, '');
	disconnect();
	sync('test', '{"value":7}');
	assert.equal(value, 6);
});
