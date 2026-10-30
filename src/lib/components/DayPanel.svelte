<script lang="ts">
	import { formatDate, relativeDay, type DateKey } from '../calendar';
	let {
		selected,
		today,
		firstYear,
		lastYear,
		onNavigate
	}: {
		selected: DateKey;
		today: DateKey;
		firstYear: number;
		lastYear: number;
		onNavigate: (key: DateKey, offset: number) => void;
	} = $props();
</script>

<aside class="day-panel" aria-label="Selected day">
	<div class="panel-date" aria-live="polite" aria-atomic="true">
		<h2><time datetime={selected}>{formatDate(selected)}</time></h2>
		<p>{relativeDay(selected, today)}</p>
	</div>
	<nav class="day-navigation" aria-label="Day navigation">
		<button
			type="button"
			aria-label="Previous day"
			title="Previous day"
			disabled={selected <= firstYear + '-01-01'}
			onclick={() => onNavigate(selected, -1)}>←</button
		>
		<button
			type="button"
			aria-label="Next day"
			title="Next day"
			disabled={selected >= lastYear + '-12-31'}
			onclick={() => onNavigate(selected, 1)}>→</button
		>
	</nav>
</aside>
