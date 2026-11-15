<script lang="ts">
	let {
		direction = 'right',
		size = 16
	}: { direction?: 'left' | 'right' | 'up' | 'down'; size?: number } = $props();
</script>

<svg
	aria-hidden="true"
	viewBox="0 0 16 16"
	width={size}
	height={size}
	fill="none"
	stroke="currentColor"
	stroke-width="1.75"
	stroke-linecap="round"
	stroke-linejoin="round"
	style:transform={`rotate(${{ right: 0, down: 90, left: 180, up: 270 }[direction]}deg)`}
	><path d="m6 4 4 4-4 4" /></svg
>
