import { calendar } from '../../lib/server/database';
import { currentEraDay } from '../../lib/server/era-day';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ cookies }) => {
	const { date: today, timeZone } = currentEraDay();
	let timelineDayLimit: number | undefined;
	if (process.env.ERA_VERIFY_TIMELINE === '1') {
		const override = cookies.get('era-verify-timeline');
		if (override !== 'full') {
			const days = Number(override);
			timelineDayLimit = Number.isSafeInteger(days) && days >= 100 ? days : 100;
		}
	}
	return { calendar: calendar().read(), today, timeZone, timelineDayLimit };
};
