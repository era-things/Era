import { json, error } from '@sveltejs/kit';
import { calendar, Conflict } from '../../../lib/server/database';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = () =>
	json(calendar().read(), { headers: { 'cache-control': 'no-store' } });
export const POST: RequestHandler = async ({ request }) => {
	// JSON-only requests require a CORS preflight from other origins.
	if (request.headers.get('sec-fetch-site') === 'cross-site') error(403);
	if (request.headers.get('content-type') !== 'application/json') error(415);
	const edits = await request.json().catch(() => null);
	if (
		!Array.isArray(edits) ||
		edits.some(
			(e) =>
				!e ||
				typeof e.key !== 'string' ||
				![e.before, e.after].every((v) => v === null || typeof v === 'string')
		)
	)
		error(400, 'Invalid edits');
	try {
		calendar().apply(edits);
	} catch (e) {
		if (e instanceof Conflict) error(409, 'Record changed on another device');
		throw error(400, 'Could not save these changes');
	}
	return new Response(null, { status: 204 });
};
