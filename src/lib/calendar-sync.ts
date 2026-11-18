import { apiRequests, type ApiRequest } from './api-client';
import type { BackupPreview, CalendarData } from './data-export';

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
	let importing = false;
	let generation = 0;
	let channel: BroadcastChannel | undefined;
	const publish = (patch: Partial<SyncState>) => {
		state = { ...state, ...patch };
		onchange(state);
	};

	async function refresh() {
		if (queue.length || importing) return;
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
		if (importing) return false;
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

	async function postBackup(url: string, body: string, preview?: BackupPreview) {
		await flush();
		if (queue.length) throw new Error('Save your pending edits before importing.');
		const response = await request(url, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				...(preview ? { 'x-era-import-preview': JSON.stringify(preview) } : {})
			},
			body
		});
		if (response.ok || (preview && response.status === 409)) return response;
		const payload = await response.json().catch(() => null);
		throw new Error(payload?.error?.message ?? 'Could not import data. Try again.');
	}

	async function previewImport(body: string): Promise<BackupPreview> {
		const response = await postBackup('/api/data/import/preview', body);
		return response.json();
	}

	async function importBackup(
		body: string,
		preview: BackupPreview
	): Promise<BackupPreview | undefined> {
		if (importing) throw new Error('An import is already in progress.');
		importing = true;
		generation++;
		try {
			const response = await postBackup('/api/data/import', body, preview);
			if (response.status === 409) return (await response.json()).preview;
			publish({ data: await response.json(), error: '', retryable: false });
			channel?.postMessage('saved');
		} finally {
			importing = false;
		}
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
		previewImport,
		importBackup,
		dismiss: () => publish({ error: '' }),
		connect
	};
}
