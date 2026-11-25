<script lang="ts">
	import { dev } from '$app/env';
	import { asset } from '$app/paths';
	import '../app.css';
	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href={asset(dev ? 'favicon-dev.svg' : 'favicon.svg')} />
</svelte:head>

{@render children()}
