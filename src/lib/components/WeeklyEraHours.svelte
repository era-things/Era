<script lang="ts">
	import { onMount } from 'svelte';
	import type { ComposeOption, EChartsType } from 'echarts/core';
	import type { BarSeriesOption } from 'echarts/charts';
	import type { GridComponentOption, TooltipComponentOption } from 'echarts/components';
	import { addDays, asDate } from '../calendar';
	import { formatDuration } from '../duration';
	import { eraPalette } from '../eras';
	import type { weeklyEraHours } from '../weekly-era-hours';

	type ChartOption = ComposeOption<BarSeriesOption | GridComponentOption | TooltipComponentOption>;

	let { data }: { data: ReturnType<typeof weeklyEraHours> } = $props();
	let plot: HTMLDivElement;
	let width = $state(0);
	let chart = $state.raw<EChartsType>();
	const inset = 9;
	const interval = $derived(Math.max(1, Math.ceil(Math.max(...data.totals) / 180)));
	const ticks = $derived([3 * interval, 2 * interval, interval, 0]);
	const dateFormat = new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC'
	});

	onMount(() => {
		let mounted = true;
		const viewport = plot.closest('.timeline-scroll');
		const hideTooltip = () => chart?.dispatchAction({ type: 'hideTip' });
		viewport?.addEventListener('scroll', hideTooltip, { passive: true });
		void Promise.all([
			import('echarts/core'),
			import('echarts/charts'),
			import('echarts/components'),
			import('echarts/renderers')
		]).then(([core, charts, components, renderers]) => {
			if (!mounted) return;
			core.use([
				charts.BarChart,
				components.GridComponent,
				components.TooltipComponent,
				renderers.SVGRenderer
			]);
			chart = core.init(plot, undefined, { renderer: 'svg' });
		});
		return () => {
			mounted = false;
			viewport?.removeEventListener('scroll', hideTooltip);
			chart?.dispose();
		};
	});

	function weekTooltip(index: number) {
		const { weeks, series, totals } = data;
		const monday = weeks[index];
		if (!monday || !totals[index]) return '';
		const tooltip = document.createElement('div');
		tooltip.style.cssText = 'max-width:min(260px,70vw);white-space:normal;overflow-wrap:anywhere';
		const heading = document.createElement('strong');
		heading.textContent = dateFormat.formatRange(asDate(monday), asDate(addDays(monday, 6)));
		tooltip.append(heading);
		for (const { era, minutes } of series) {
			if (!minutes[index]) continue;
			const item = document.createElement('div');
			const swatch = document.createElement('span');
			swatch.style.cssText =
				'display:inline-block;width:8px;height:8px;border-radius:50%;margin-inline-end:6px';
			swatch.style.background = eraPalette(era).medium;
			item.append(swatch, `${era.name} · ${formatDuration(minutes[index])}`);
			tooltip.append(item);
		}
		const total = document.createElement('div');
		total.textContent = `Total · ${formatDuration(totals[index])}`;
		tooltip.append(total);
		return tooltip;
	}

	$effect(() => {
		if (!chart || !width) return;
		const style = getComputedStyle(plot);
		const cellWidth = parseFloat(style.getPropertyValue('--cell'));
		// The calendar has gaps between columns, while the chart needs full-width week bands.
		const halfGap = parseFloat(style.getPropertyValue('--gap')) / 2;
		chart.resize({ width, silent: true });
		chart.setOption<ChartOption>(
			{
				animation: false,
				grid: {
					left: -halfGap,
					right: -halfGap,
					top: inset,
					bottom: inset,
					outerBoundsMode: 'none'
				},
				xAxis: {
					type: 'category',
					data: data.weeks,
					boundaryGap: true,
					axisLabel: { show: false },
					axisTick: { show: false },
					axisLine: { show: false },
					axisPointer: { type: 'shadow' }
				},
				yAxis: {
					type: 'value',
					min: 0,
					max: ticks[0],
					interval,
					axisLabel: { show: false },
					splitLine: { lineStyle: { color: style.getPropertyValue('--line').trim() } }
				},
				tooltip: {
					trigger: 'axis',
					appendTo: document.body,
					backgroundColor: style.getPropertyValue('--paper').trim(),
					borderColor: style.getPropertyValue('--line').trim(),
					textStyle: { color: style.getPropertyValue('--ink').trim(), fontSize: 12 },
					position: ([x, y], _params, _element, _rect, { contentSize: [w, h] }) => {
						const { left, top } = plot.getBoundingClientRect();
						return [
							x + left + w + 12 > window.innerWidth ? x - w - 12 : x + 12,
							Math.max(4 - top, y - h - 8)
						];
					},
					formatter: (params) =>
						Array.isArray(params) && params.length ? weekTooltip(params[0].dataIndex) : ''
				},
				series: data.series.map(({ era, minutes }) => ({
					id: era.id,
					name: era.name,
					type: 'bar',
					stack: 'hours',
					barWidth: cellWidth,
					itemStyle: { color: eraPalette(era).medium },
					data: minutes.map((value) => (value ? value / 60 : null))
				}))
			},
			{ notMerge: true }
		);
	});
</script>

<div class="hours-scale" style:--inset={inset + 'px'} aria-hidden="true">
	{#each ticks as hours (hours)}
		<span>{hours}h</span>
	{/each}
</div>
<div
	class="hours-plot"
	role="img"
	aria-label="Weekly hours by era"
	bind:this={plot}
	bind:clientWidth={width}
></div>

<style>
	.hours-scale,
	.hours-plot {
		grid-row: 3;
		margin-top: 6px;
	}
	.hours-scale {
		grid-column: 1;
		position: sticky;
		left: 0;
		z-index: 4;
		background: var(--paper);
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding-block: calc(var(--inset) - 7px);
		font-size: 9px;
		line-height: 14px;
		font-variant-numeric: tabular-nums;
		color: var(--muted);
	}
	.hours-plot {
		grid-column: 2;
		min-width: 0;
		height: 200px;
	}
</style>
