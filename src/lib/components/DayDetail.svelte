<script lang="ts">
	import { formatDate, relativeDay, type DateKey } from '../calendar';
	let { selected, today }: { selected: DateKey; today: DateKey } = $props();
</script>

<div
	class="date-readout"
	role="status"
	aria-label="Selected day"
	aria-live="polite"
	aria-atomic="true"
>
	<time datetime={selected}>{formatDate(selected)}</time>
	<span>{relativeDay(selected, today)}</span>
</div>
