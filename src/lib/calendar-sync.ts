import { apiRequests, type ApiRequest } from './api-client';
import type { CalendarData } from './data-export';

export type SyncState = { data: CalendarData; error: string; retryable: boolean };
export type SyncRequest = (url: string, init?: RequestInit) => Promise<Response>;

export function createCalendarSync(
	initial: CalendarData,
	onchange: (state: SyncState) => void,
	request: SyncRequest = (...args) => fetch(...args)
) {
	let state: SyncState = { data: initial, error: '', retryable: false };
	const queue: ApiRequest[] = [];
	let pending: Promise<void> | undefined;
	let generation = 0;
	let channel: BroadcastChannel | undefined;
	const publish = (patch: Partial<SyncState>) => {
		state = { ...state, ...patch };
		onchange(state);
	};

	async function refresh() {
		if (queue.length) return;
		const ticket = ++generation;
		try {
			const response = await request('/api/data', { cache: 'no-store' });
			if (!response.ok) return;
			const data: CalendarData = await response.json();
			if (ticket === generation && !queue.length) publish({ data });
		} catch {
			/* Retry on next focus. */
		}
	}

	async function send() {
		if (!queue.length) return;
		let rejected = '';
		try {
			while (queue.length) {
				const next = queue[0];
				const body = next.body === undefined ? undefined : JSON.stringify(next.body);
				const response = await request(next.url, {
					method: next.method,
					headers: { 'content-type': 'application/json' },
					body,
					keepalive: (body?.length ?? 0) < 16000
				});
				if (!response.ok) {
					const payload = await response.json().catch(() => null);
					const message = payload?.error?.message ?? 'Could not save this change.';
					if (response.status >= 400 && response.status < 500) {
						queue.shift();
						rejected = message;
						continue;
					}
					throw new Error(message);
				}
				queue.shift();
			}
			publish({ error: rejected, retryable: false });
			if (rejected) await refresh();
			channel?.postMessage('saved');
		} catch (error) {
			publish({
				retryable: true,
				error:
					error instanceof Error && !(error instanceof TypeError)
						? error.message
						: 'Changes are waiting to be saved.'
			});
		}
	}

	function flush(): Promise<void> {
		return (pending ??= (async () => {
			do {
				await send();
			} while (queue.length && !state.retryable);
		})().finally(() => {
			pending = undefined;
		}));
	}

	function saveData(data: CalendarData): boolean {
		const edits = apiRequests(state.data, data);
		if (edits.length) {
			generation++;
			queue.push(...edits);
			publish({ data });
			void flush();
		}
		return true;
	}

	async function readExport(): Promise<CalendarData> {
		await flush();
		if (queue.length) throw new Error('Unsaved edits');
		const response = await request('/api/data', { cache: 'no-store' });
		if (!response.ok) throw new Error('Export unavailable');
		return response.json();
	}

	function connect() {
		channel = new BroadcastChannel('era-saves');
		channel.onmessage = refresh;
		window.addEventListener('focus', refresh);
		const warn = (event: BeforeUnloadEvent) => {
			if (queue.length) {
				event.preventDefault();
				event.returnValue = '';
			}
		};
		window.addEventListener('beforeunload', warn);
		return () => {
			channel?.close();
			channel = undefined;
			generation++;
			window.removeEventListener('focus', refresh);
			window.removeEventListener('beforeunload', warn);
		};
	}

	return {
		get state() {
			return state;
		},
		get hasPendingEdits() {
			return queue.length > 0;
		},
		saveData,
		save<K extends keyof CalendarData>(key: K, value: CalendarData[K]) {
			return saveData({ ...state.data, [key]: value });
		},
		flush,
		refresh,
		readExport,
		dismiss: () => publish({ error: '' }),
		connect
	};
}
