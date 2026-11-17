import { expect, type APIRequestContext } from '@playwright/test';
import { apiRequests } from '../../src/lib/api-client';
import type { CalendarData } from '../../src/lib/data-export';

export async function writeData(
	request: APIRequestContext,
	before: CalendarData,
	after: CalendarData
) {
	for (const edit of apiRequests(before, after)) {
		const response = await request.fetch(edit.url, {
			method: edit.method,
			...(edit.body === undefined ? {} : { data: edit.body })
		});
		expect(response.ok(), `${edit.method} ${edit.url}: ${await response.text()}`).toBe(true);
	}
}

export async function seedData(request: APIRequestContext, data: CalendarData) {
	const response = await request.get('/api/data');
	expect(response.ok(), `GET /api/data returned ${response.status()}`).toBe(true);
	await writeData(request, await response.json(), data);
}
