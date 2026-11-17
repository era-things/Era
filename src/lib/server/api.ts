import { calendar } from './database';
import { ApiError, fail, reply, type ApiRoute, type ApiMethod, type Store } from './api/shared';
import { widgetRoutes } from './api/widgets';
import { dayRoutes } from './api/days';
import { measureRoutes } from './api/measures';
import { reminderRoutes } from './api/reminders';
const routes: ApiRoute[] = [
	{ pattern: /^data$/, methods: { GET: ({ store }) => reply(store.read()) } },
	...widgetRoutes,
	...dayRoutes,
	...measureRoutes,
	...reminderRoutes
];
export async function handleApi(
	request: Request,
	path: string,
	store: Store = calendar()
): Promise<Response> {
	try {
		const method = request.method === 'HEAD' ? 'GET' : request.method;
		const origin = request.headers.get('origin');
		if (
			method !== 'GET' &&
			(request.headers.get('sec-fetch-site') === 'cross-site' ||
				(origin !== null && origin !== new URL(request.url).origin))
		)
			fail(403, 'cross_site_request', 'Cross-site writes are not allowed.');
		const matched = routes
			.map((route) => ({ route, match: route.pattern.exec(path) }))
			.find((item) => item.match);
		if (!matched?.match) fail(404, 'not_found', 'Unknown API resource.');
		if (!Object.hasOwn(matched.route.methods, method)) {
			const allowed = Object.keys(matched.route.methods).join(', ');
			return reply(
				{ error: { code: 'method_not_allowed', message: 'Supported methods: ' + allowed + '.' } },
				405,
				{ allow: allowed }
			);
		}
		let body: unknown;
		if (['PUT', 'PATCH', 'POST'].includes(method)) {
			if (
				request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !==
				'application/json'
			)
				fail(415, 'unsupported_media_type', 'Use Content-Type: application/json.');
			try {
				body = await request.json();
			} catch {
				fail(400, 'invalid_json', 'Request body is not valid JSON.', 'body');
			}
		}
		const handler = matched.route.methods[method as ApiMethod]!;
		return await handler({ store, body, params: matched.match.groups ?? {}, method });
	} catch (error) {
		if (error instanceof ApiError)
			return reply(
				{
					error: {
						code: error.code,
						message: error.message,
						...(error.field ? { field: error.field } : {})
					}
				},
				error.status
			);
		console.error('API request failed', error);
		return reply(
			{ error: { code: 'internal_error', message: 'Could not complete this request.' } },
			500
		);
	}
}
