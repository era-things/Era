import { DEFAULT_ERA_TIME_ZONE, eraToday } from '../calendar';

const timeZone = process.env.ERA_TIME_ZONE ?? DEFAULT_ERA_TIME_ZONE;

export function currentEraDay() {
	return { date: eraToday(undefined, timeZone), timeZone };
}
