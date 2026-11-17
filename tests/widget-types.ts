// Compile-time contracts: svelte-check must reject mismatched kinds and values.
import { widgetBody, type WidgetEncoders } from '../src/lib/api-values';
import { parseWidget, type WidgetParsers } from '../src/lib/server/api/widget-values';
import type { WidgetHandlers, WidgetInstanceOfKind } from '../src/lib/widgets';

function widgetTypeContracts() {
	widgetBody('note', 'A note').text.toUpperCase();
	parseWidget('note', {}).toUpperCase();
	const sleep = parseWidget('sleep', {});
	widgetBody('sleep', sleep).startTime?.toUpperCase();
	// @ts-expect-error Sleep accepts a sleep record, never a counter value.
	widgetBody('sleep', 60);
	// @ts-expect-error Note accepts text, never a duration.
	widgetBody('note', 60);
	// @ts-expect-error Sleep encoding must accept sleep records.
	const encoder: WidgetEncoders['sleep'] = (value: number) => ({ durationMinutes: value });
	// @ts-expect-error A note parser must return text.
	const parser: WidgetParsers['note'] = () => 60;
	// @ts-expect-error A note parser cannot require a sleep widget ID.
	const wrongId: WidgetParsers['note'] = (_id: 'sleep') => '';
	// @ts-expect-error Render handlers cannot accept another kind's instance.
	const renderer: WidgetHandlers<void>['sleep'] = (_widget: WidgetInstanceOfKind<'counter'>) => {};
	return { encoder, parser, renderer, wrongId };
}
void widgetTypeContracts;
