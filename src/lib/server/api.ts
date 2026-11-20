import { calendar } from './database';
import { BackupChanged, InvalidBackup, previewBackup, restoreBackup } from './backup';
import {
	ApiError,
	fail,
	reply,
	type ApiContext,
	type ApiRoute,
	type ApiMethod,
	type Store
} from './api/shared';
import { widgetRoutes } from './api/widgets';
import { dayRoutes } from './api/days';
import { measureRoutes } from './api/measures';
import { reminderRoutes } from './api/reminders';
import { nutritionItemRoutes } from './api/nutrition-items';
import { activityItemRoutes } from './api/activity-items';

function backupResponse(run: () => unknown) {
	try {
		return reply(run());
	} catch (error) {
		if (error instanceof InvalidBackup) fail(400, 'invalid_backup', error.message, 'body');
		if (error instanceof BackupChanged)
			return reply(
				{
					error: { code: 'import_preview_changed', message: error.message },
					preview: error.preview
				},
				409
			);
		throw error;
	}
}

function importData({ store, body, headers }: ApiContext) {
	const preview = headers.get('x-era-import-preview');
	let expectedPreview: unknown;
	if (preview !== null) {
		try {
			expectedPreview = JSON.parse(preview);
		} catch {
			fail(400, 'invalid_preview', 'Use a valid import summary.');
		}
	}
	return backupResponse(() => restoreBackup(store, body, expectedPreview));
}

const routes: ApiRoute[] = [
	{ pattern: /^data$/, methods: { GET: ({ store }) => reply(store.read()) } },
	{ pattern: /^data\/import$/, methods: { POST: importData } },
	{
		pattern: /^data\/import\/preview$/,
		methods: { POST: ({ store, body }) => backupResponse(() => previewBackup(store, body)) }
	},
	...widgetRoutes,
	...dayRoutes,
	...nutritionItemRoutes,
	...activityItemRoutes,
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
		return await handler({
			store,
			headers: request.headers,
			body,
			params: matched.match.groups ?? {},
			method
		});
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
