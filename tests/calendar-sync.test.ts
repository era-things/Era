import { expect, test } from 'bun:test';
import { createCalendarSync } from '../src/lib/calendar-sync';
import { emptyCalendar } from '../src/lib/calendar-records';

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}
const ok = () => Response.json({});
const day = '2026-11-17';

test('edits are optimistic and sent in order; export waits for all writes', async () => {
	const initial = emptyCalendar();
	const latest = { ...initial, notes: { [day]: 'Second' } };
	const first = deferred<Response>();
	const calls: { url: string; body?: BodyInit | null }[] = [];
	const sync = createCalendarSync(
		initial,
		() => {},
		async (url, init) => {
			calls.push({ url, body: init?.body });
			if (calls.length === 1) return first.promise;
			return url === '/api/data' ? Response.json(latest) : ok();
		}
	);
	sync.save('notes', { [day]: 'First' });
	sync.save('notes', latest.notes);
	expect(sync.state.data).toEqual(latest);
	expect(calls).toHaveLength(1);
	expect(sync.hasPendingEdits).toBe(true);
	const exported = sync.readExport();
	first.resolve(ok());
	expect(await exported).toEqual(latest);
	expect(calls.map(({ url }) => url)).toEqual([
		`/api/days/${day}/widgets/note`,
		`/api/days/${day}/widgets/note`,
		'/api/data'
	]);
	expect(calls.slice(0, 2).map(({ body }) => JSON.parse(String(body)).text)).toEqual([
		'First',
		'Second'
	]);
	expect(sync.hasPendingEdits).toBe(false);
});

test('network and server failures retain edits for retry and prevent an incomplete export', async () => {
	let writes = 0;
	const sync = createCalendarSync(
		emptyCalendar(),
		() => {},
		async (url) => {
			if (url === '/api/data') return Response.json(sync.state.data);
			writes++;
			if (writes === 1) throw new TypeError('Network unavailable');
			if (writes === 2)
				return Response.json({ error: { message: 'Database unavailable' } }, { status: 503 });
			return ok();
		}
	);
	sync.save('notes', { [day]: 'Keep this edit' });
	await sync.flush();
	expect(sync.state.retryable).toBe(true);
	expect(sync.state.error).toBe('Changes are waiting to be saved.');
	expect(sync.hasPendingEdits).toBe(true);
	await expect(sync.readExport()).rejects.toThrow('Unsaved edits');
	expect(sync.state.error).toBe('Database unavailable');
	await sync.flush();
	expect(writes).toBe(3);
	expect(sync.state.error).toBe('');
	expect(sync.state.retryable).toBe(false);
	expect(sync.hasPendingEdits).toBe(false);
	expect((await sync.readExport()).notes[day]).toBe('Keep this edit');
});

test('rejected edits refresh authoritative state and do not block later writes', async () => {
	const server = emptyCalendar();
	let reject = true;
	const sync = createCalendarSync(
		server,
		() => {},
		async (url) => {
			if (url === '/api/data') return Response.json(server);
			return reject
				? Response.json({ error: { message: 'Widget archived' } }, { status: 409 })
				: ok();
		}
	);
	sync.save('notes', { [day]: 'Rejected' });
	await sync.flush();
	expect(sync.state.data).toEqual(server);
	expect(sync.state.error).toBe('Widget archived');
	expect(sync.state.retryable).toBe(false);
	expect(sync.hasPendingEdits).toBe(false);
	sync.dismiss();
	expect(sync.state.error).toBe('');
	reject = false;
	sync.save('notes', { [day]: 'Accepted' });
	await sync.flush();
	expect(sync.state.data.notes[day]).toBe('Accepted');
	expect(sync.hasPendingEdits).toBe(false);
});

test('a stale refresh cannot overwrite an edit even after that edit has saved', async () => {
	const initial = emptyCalendar();
	const latest = { ...initial, notes: { [day]: 'Newer edit' }, emojis: { [day]: '🎉' } };
	const stale = deferred<Response>();
	let reads = 0;
	const sync = createCalendarSync(
		initial,
		() => {},
		async (url) => {
			if (url === '/api/data') {
				reads++;
				return reads === 1 ? stale.promise : Response.json(latest);
			}
			return ok();
		}
	);
	const refreshing = sync.refresh();
	sync.save('notes', { [day]: 'Newer edit' });
	const notified = sync.refresh(); // a notification while saving defers its refresh
	expect(reads).toBe(1);
	await notified;
	await sync.flush();
	stale.resolve(Response.json(initial));
	await refreshing;
	expect(reads).toBe(2);
	expect(sync.state.data).toEqual(latest);
});

test('an edit arriving during rejection recovery is drained before export', async () => {
	const initial = emptyCalendar();
	const recovering = deferred<void>();
	const stale = deferred<Response>();
	let writes = 0;
	let reads = 0;
	const latest = { ...initial, notes: { [day]: 'Later edit' } };
	const sync = createCalendarSync(
		initial,
		() => {},
		async (url) => {
			if (url === '/api/data') {
				reads++;
				if (reads === 1) {
					recovering.resolve();
					return stale.promise;
				}
				return Response.json(latest);
			}
			writes++;
			return writes === 1 ? new Response(null, { status: 400 }) : ok();
		}
	);
	sync.save('notes', { [day]: 'Rejected' });
	await recovering.promise;
	sync.save('notes', latest.notes);
	const exporting = sync.readExport();
	stale.resolve(Response.json(initial));
	expect(await exporting).toEqual(latest);
	expect(writes).toBe(2);
	expect(sync.state.data).toEqual(latest);
	expect(sync.hasPendingEdits).toBe(false);
});

test('only the newest overlapping refresh is applied', async () => {
	const older = deferred<Response>();
	const newer = deferred<Response>();
	let reads = 0;
	const sync = createCalendarSync(
		emptyCalendar(),
		() => {},
		async () => (++reads === 1 ? older.promise : newer.promise)
	);
	const first = sync.refresh();
	const second = sync.refresh();
	newer.resolve(Response.json({ ...emptyCalendar(), notes: { [day]: 'Newest' } }));
	await second;
	older.resolve(Response.json(emptyCalendar()));
	await first;
	expect(sync.state.data.notes[day]).toBe('Newest');
});
