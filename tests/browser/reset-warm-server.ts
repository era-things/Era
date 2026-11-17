import { request } from '@playwright/test';
import { emptyCalendar } from '../../src/lib/calendar-records';
import { seedData } from './api-helpers';

export default async function resetWarmServer() {
	const api = await request.newContext({ baseURL: process.env.ERA_VERIFY_URL, timeout: 4000 });
	try {
		const health = await api.get(process.env.ERA_VERIFY_HEALTH!);
		if (!health.ok() || (await health.text()) !== 'Era verification server') {
			throw new Error('The Era verification server changed before the run started.');
		}
		await seedData(api, emptyCalendar());
	} finally {
		await api.dispose();
	}
}
