import { calendar } from '../../../lib/server/database';
import type { RequestHandler } from './$types';

const encoder = new TextEncoder();
const heartbeat = encoder.encode(': keep-alive\n\n');
const changed = encoder.encode('data: changed\n\n');
const headers = { 'content-type': 'text/event-stream', 'cache-control': 'no-store' };

export const HEAD: RequestHandler = () => new Response(null, { headers });

export const GET: RequestHandler = ({ request }) => {
	const { signal } = request;
	let cleanup: () => void;
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			if (signal.aborted) {
				controller.close();
				return;
			}
			const unsubscribe = calendar().subscribe(() => {
				if ((controller.desiredSize ?? 0) < 0) abort();
				else controller.enqueue(changed);
			});
			const timer = setInterval(() => {
				if ((controller.desiredSize ?? 0) > 0) controller.enqueue(heartbeat);
			}, 15_000);
			const abort = () => {
				cleanup();
				controller.close();
			};
			cleanup = () => {
				unsubscribe();
				clearInterval(timer);
				signal.removeEventListener('abort', abort);
			};
			signal.addEventListener('abort', abort, { once: true });
			controller.enqueue(heartbeat);
		},
		cancel() {
			cleanup?.();
		}
	});
	return new Response(stream, { headers });
};
