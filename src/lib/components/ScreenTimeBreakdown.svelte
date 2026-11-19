<script lang="ts">
	import type { ScreenAppShare } from '../screen-apps';
	let { apps }: { apps: readonly ScreenAppShare[] } = $props();
	const colors = ['#917bc5', '#789b87', '#6b94b7', '#bb8964', '#b97d9b'];

	function duration(minutes: number): string {
		const hours = Math.floor(minutes / 60);
		const remainder = minutes % 60;
		if (hours === 0) return `${remainder}m`;
		return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
	}
</script>

<div class="breakdown">
	<div class="share-track" aria-hidden="true">
		{#each apps as app, index (app.package)}
			<span style:width={`${app.share}%`} style:background={colors[index % colors.length]}></span>
		{/each}
	</div>
	<ul aria-label="Screen time by app" role="list">
		{#each apps as app, index (app.package)}
			<li>
				<span class="mark" style:background={colors[index % colors.length]} aria-hidden="true"
				></span>
				<span class="app-name">{app.name}</span>
				<span class="duration">{duration(app.minutes)}</span>
				<span class="percent">{Math.round(app.share)}%</span>
			</li>
		{/each}
	</ul>
</div>

<style>
	.breakdown {
		padding: 8px 7px 4px;
		background: #f0eef4;
		color: #322d40;
		font-size: 12px;
		font-variant-numeric: tabular-nums;
	}
	.share-track {
		display: flex;
		height: 5px;
		overflow: hidden;
		margin-bottom: 4px;
		border-radius: 2px;
		background: #e0dbe8;
	}
	.share-track span {
		flex: 0 0 auto;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li {
		display: grid;
		grid-template-columns: 6px minmax(0, 1fr) auto 4.25ch;
		align-items: center;
		gap: 8px;
		min-height: 24px;
		padding-block: 3px;
	}
	li + li {
		border-top: 1px solid #d9d3e1;
	}
	.mark {
		width: 6px;
		height: 6px;
		border-radius: 50%;
	}
	.app-name {
		overflow-wrap: anywhere;
	}
	.duration {
		white-space: nowrap;
	}
	.percent {
		text-align: right;
		color: #625976;
	}
</style>
