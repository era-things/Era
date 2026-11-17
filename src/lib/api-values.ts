import { formatSleepTime } from './sleep';
import {
	widgetFor,
	type WidgetKindValues,
	type WidgetKind,
	type WidgetId,
	type WidgetValues
} from './widgets';
import type { FoodItem } from './nutrition';

export type WidgetApiBodies = {
	time: { durationMinutes: number | null };
	counter: { value: number | null };
	note: { text: string };
	nutrition: { items: readonly FoodItem[] };
	sleep: { startTime: string | null; wakeUpTime: string | null; durationMinutes: number | null };
};
export type WidgetEncoders = {
	[K in WidgetKind]: (value: Readonly<WidgetKindValues[K]>) => WidgetApiBodies[K];
};
const encoders = {
	time: (value) => ({ durationMinutes: value }),
	counter: (value) => ({ value }),
	note: (value) => ({ text: value }),
	nutrition: (value) => ({ items: value }),
	sleep: (sleep) => ({
		startTime: formatSleepTime(sleep.start) || null,
		wakeUpTime: formatSleepTime(sleep.end) || null,
		durationMinutes: sleep.duration
	})
} satisfies WidgetEncoders;

export function widgetBody<K extends WidgetId>(
	id: K,
	value: Readonly<WidgetValues[NoInfer<K>]>
): WidgetApiBodies[ReturnType<typeof widgetFor<K>>['kind']];
export function widgetBody(
	id: WidgetId,
	value: Readonly<WidgetValues[WidgetId]>
): WidgetApiBodies[WidgetKind] {
	// The ID selects both the value type and encoder; TS cannot keep that
	// correlation when indexing the heterogeneous handler table.
	const encode = encoders[widgetFor(id).kind] as (
		value: Readonly<WidgetValues[WidgetId]>
	) => WidgetApiBodies[WidgetKind];
	return encode(value);
}
