import { calendar } from './lib/server/database';

let rollover: ReturnType<typeof setInterval> | undefined;

export function init() {
	calendar();
	rollover = setInterval(() => {
		try {
			calendar();
		} catch (error) {
			console.error('Could not mark active era days', error);
		}
	}, 60_000);
	rollover.unref();
}

if (import.meta.hot) import.meta.hot.dispose(() => clearInterval(rollover));
