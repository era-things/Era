<script lang="ts">
	import { onMount } from 'svelte';
	import type { MarkdownEditor } from '../markdown-editor';
	let {
		value,
		readonly,
		onchange
	}: { value: string; readonly: boolean; onchange: (value: string) => void } = $props();
	let host: HTMLDivElement;
	let editor = $state<MarkdownEditor | null>(null);
	let error = $state('');
	onMount(() => {
		let disposed = false;
		void import('../markdown-editor')
			.then(({ createMarkdownEditor }) => {
				if (disposed) return;
				editor = createMarkdownEditor(host, value, onchange, readonly);
			})
			.catch(() => {
				if (!disposed) error = 'Could not load the note editor.';
			});
		return () => {
			disposed = true;
			editor?.destroy();
		};
	});
	$effect(() => {
		editor?.setValue(value);
	});
</script>

<section class="note" aria-label="Day notes">
	<div bind:this={host}></div>
	{#if error}<p role="alert">{error}</p>{/if}
</section>

<style>
	.note {
		min-width: 0;
		min-height: 96px;
		--silkdown-h1-size: 1.6em;
		--silkdown-h2-size: 1.4em;
		--silkdown-h3-size: 1.2em;
		--silkdown-heading-weight: 600;
		--silkdown-link-color: var(--accent);
		--silkdown-blockquote-color: var(--muted);
		--silkdown-blockquote-border: 2px solid var(--muted);
		--silkdown-code-bg: rgb(0 0 0 / 5%);
	}
	.note :global(.cm-editor) {
		min-height: 96px;
		border: 1px solid transparent;
		border-radius: 4px;
		background: #e9ede6;
		color: var(--ink);
		font: inherit;
		font-size: 13px;
		line-height: 1.5;
	}
	.note :global(.cm-editor:hover) {
		border-color: var(--line);
	}
	.note :global(.cm-focused) {
		outline: 1px solid var(--accent);
		outline-offset: -1px;
	}
	.note :global(.cm-scroller) {
		min-height: 94px;
		max-height: 400px;
		overflow: auto;
		resize: vertical;
		font: inherit;
	}
	.note :global(.cm-content) {
		padding: 8px;
	}
	.note :global(.cm-line) {
		padding: 0;
	}
	.note :global(.cm-placeholder) {
		color: var(--muted);
		opacity: 0.6;
	}
	.note :global(.sd-list-bullet) {
		display: inline-block;
		width: 1ch;
		text-align: center;
		text-indent: 0;
		color: var(--muted);
	}
	.note :global(.sd-task-checkbox) {
		accent-color: var(--accent);
	}
</style>
