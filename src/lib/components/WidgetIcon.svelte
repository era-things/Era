<script lang="ts">
	import type { WidgetIcon } from '../widget-icons';
	let {
		icon,
		size = 16,
		strokeWidth = 1.5
	}: { icon: WidgetIcon; size?: number; strokeWidth?: number } = $props();
</script>

<svg
	aria-hidden="true"
	viewBox="0 0 24 24"
	width={size}
	height={size}
	fill={icon.fill ?? 'none'}
	stroke={icon.stroke ?? 'currentColor'}
	stroke-width={strokeWidth}
	stroke-linecap="round"
	stroke-linejoin="round"
>
	{#each icon.rects ?? [] as rect}<rect {...rect} />{/each}
	{#each icon.paths ?? [] as path}<path {...path} />{/each}
</svg>
