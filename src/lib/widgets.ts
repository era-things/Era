import type { CalendarData } from './data-export';
import { isDateKey, type DateKey } from './calendar';
import { setNutritionItems, validFoodItem, type FoodItem } from './nutrition';
import { setDayNote } from './day-notes';
import { emptySleep, validSleep, type Sleep } from './sleep';

export const WIDGETS = [
	{
		id: 'nutrition',
		name: 'Nutrition',
		kind: 'nutrition',
		compact: false,
		pinned: false,
		skin: 'simple',
		skins: [{ id: 'simple', name: 'Simple' }],
		initial: [] as FoodItem[],
		sample: [
			{ id: 'example', name: 'Example', quantity: 1, kcal: 1850, protein: 110, fat: 65, carbs: 205 }
		]
	},
	{
		id: 'weight',
		name: 'Weight',
		kind: 'counter',
		compact: true,
		pinned: false,
		skin: 'scale',
		skins: [
			{ id: 'simple', name: 'Simple' },
			{ id: 'scale', name: 'Scale' },
			{ id: 'display', name: 'Display' }
		],
		unit: 'kg',
		integer: false,
		initial: null,
		sample: 72.5
	},
	{
		id: 'steps',
		name: 'Steps',
		kind: 'counter',
		compact: true,
		pinned: false,
		skin: 'simple',
		skins: [
			{ id: 'simple', name: 'Simple' },
			{ id: 'pedometer', name: 'Pedometer' }
		],
		unit: '',
		integer: true,
		initial: 0,
		sample: 8200
	},
	{
		id: 'sleep',
		name: 'Sleep',
		kind: 'sleep',
		compact: true,
		pinned: false,
		skin: 'lunar-seal',
		skins: [
			{ id: 'simple', name: 'Simple' },
			{ id: 'lunar-seal', name: 'Lunar seal' }
		],
		initial: emptySleep(),
		sample: { start: 1395, end: 405, duration: 450 } as Sleep
	},
	{
		id: 'note',
		name: 'Note',
		kind: 'note',
		compact: false,
		pinned: true,
		skin: 'simple',
		skins: [{ id: 'simple', name: 'Simple' }],
		initial: '',
		sample: 'A walk after lunch.\n\n- [ ] Pick up groceries'
	}
] as const;
export type Widget = (typeof WIDGETS)[number];
export type WidgetId = Widget['id'];
export type Counter = Extract<Widget, { kind: 'counter' }>;
export type CounterId = Counter['id'];
export type WidgetSkin<K extends WidgetId = WidgetId> = Extract<
	Widget,
	{ id: K }
>['skins'][number]['id'];
export type WidgetSettings = { pinned: boolean; skin: WidgetSkin };
export const COUNTERS = WIDGETS.filter((widget): widget is Counter => widget.kind === 'counter');
export type LayoutState = {
	widgets: { [K in WidgetId]: { pinned: boolean; skin: WidgetSkin<K> } };
};
export type WidgetValues = {
	sleep: Sleep;
	nutrition: FoodItem[];
	weight: number | null;
	steps: number | null;
	note: string;
};
export type WidgetInstance = {
	[K in WidgetId]: { id: K; skin: WidgetSkin<K>; value: WidgetValues[K] };
}[WidgetId];
export type WidgetData = Pick<
	CalendarData,
	'nutrition' | 'notes' | 'counters' | 'layout' | 'measures' | 'sleep'
>;
export const widgetFor = <K extends WidgetId>(id: K) =>
	WIDGETS.find((widget) => widget.id === id)! as Extract<Widget, { id: K }>;
export const emptyLayout = (): LayoutState => ({
	widgets: Object.fromEntries(
		WIDGETS.map(({ id, pinned, skin }) => [id, { pinned, skin }])
	) as LayoutState['widgets']
});
export const validWidgetSkin = (id: WidgetId, skin: unknown): skin is WidgetSkin =>
	widgetFor(id).skins.some((option) => option.id === skin);
export function validCounterValue(id: CounterId, value: unknown): value is number {
	return (
		typeof value === 'number' &&
		Number.isFinite(value) &&
		value >= 0 &&
		value <= Number.MAX_SAFE_INTEGER &&
		(!widgetFor(id).integer || Number.isSafeInteger(value))
	);
}
export function setWidgetSettings<K extends WidgetId>(
	layout: LayoutState,
	id: K,
	patch: Partial<LayoutState['widgets'][K]>
): LayoutState {
	return { widgets: { ...layout.widgets, [id]: { ...layout.widgets[id], ...patch } } };
}
export function widgetValue(data: WidgetData, day: DateKey, id: WidgetId) {
	return id === 'sleep'
		? data.sleep[day]
		: id === 'nutrition'
			? data.nutrition[day]
			: id === 'note'
				? data.notes[day]
				: data.counters[day]?.[id];
}
export const isAttached = (data: WidgetData, day: DateKey, id: WidgetId) =>
	widgetValue(data, day, id) !== undefined;
export const isVisible = (data: WidgetData, day: DateKey, id: WidgetId) =>
	data.layout.widgets[id].pinned || isAttached(data, day, id);
export function dayWidget(data: WidgetData, day: DateKey, id: WidgetId): WidgetInstance {
	const value = widgetValue(data, day, id);
	return {
		id,
		skin: data.layout.widgets[id].skin,
		value: value === undefined ? widgetFor(id).initial : value
	} as WidgetInstance;
}
export function setWidgetValue<T extends WidgetData, K extends WidgetId>(
	data: T,
	day: DateKey,
	id: K,
	value: WidgetValues[K]
): T {
	const valid =
		id === 'sleep'
			? validSleep(value)
			: id === 'nutrition'
				? Array.isArray(value) && value.every(validFoodItem)
				: id === 'note'
					? typeof value === 'string'
					: value === null || validCounterValue(id, value);
	if (!isDateKey(day) || !valid) return data;
	if (id === 'sleep') return { ...data, sleep: { ...data.sleep, [day]: value as Sleep } };
	if (id === 'nutrition')
		return { ...data, nutrition: setNutritionItems(data.nutrition, day, value as FoodItem[]) };
	if (id === 'note') return { ...data, notes: setDayNote(data.notes, day, value as string) };
	return { ...data, counters: { ...data.counters, [day]: { ...data.counters[day], [id]: value } } };
}
export const attachWidget = <T extends WidgetData>(data: T, day: DateKey, id: WidgetId) =>
	setWidgetValue(data, day, id, widgetFor(id).initial as WidgetValues[WidgetId]);
