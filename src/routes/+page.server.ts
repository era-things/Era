import { calendar } from '../lib/server/database';
import type { PageServerLoad } from './$types';

// Render a complete overview on the server. The browser refines "today" to its local date.
export const load: PageServerLoad = () => ({
	calendar: calendar().read(),
	today: new Date().toISOString().slice(0, 10)
});
