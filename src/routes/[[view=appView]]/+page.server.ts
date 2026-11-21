import { calendar } from '../../lib/server/database';
import { currentEraDay } from '../../lib/server/era-day';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const { date: today, timeZone } = currentEraDay();
	return { calendar: calendar().read(), today, timeZone };
};
