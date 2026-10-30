<script lang="ts">
	import { onMount } from 'svelte';
	import type Picker from 'emoji-picker-element/picker';
	import emojiDataUrl from 'emoji-picker-element-data/en/emojibase/data.json?url';
	import { normalizeEmoji } from '../day-emojis';

	let { value, onchange }: { value: string; onchange: (emoji: string) => void } = $props();
	const id = $props.id();
	let loading = $state(false);
	let loadError = $state('');
	let dialog: HTMLDialogElement;
	let pickerHost: HTMLDivElement;
	let picker: Picker | undefined;
	let disposed = false;

	onMount(() => {
		void loadPicker();
		return () => {
			disposed = true;
			dialog?.close();
			picker?.remove();
		};
	});

	function choose(value: string) {
		const emoji = normalizeEmoji(value);
		if (emoji === null) return;
		onchange(emoji);
		dialog.close();
	}

	function openPicker() {
		if (!dialog.open) dialog.showModal();
		if (picker) {
			picker.shadowRoot?.querySelector<HTMLInputElement>('input')?.focus();
			return;
		}
		void loadPicker();
	}

	async function loadPicker() {
		if (loading) return;
		loading = true;
		loadError = '';
		try {
			// This web component uses browser APIs; keep it out of server rendering.
			const { default: EmojiPicker } = await import('emoji-picker-element/picker');
			if (disposed) return;
			picker = new EmojiPicker({ dataSource: emojiDataUrl });
			picker.classList.add('light');
			picker.addEventListener('emoji-click', (event) => {
				if (event.detail.unicode) {
					choose(event.detail.unicode);
					// v1.29 refreshes Favorites when customEmoji changes. A new empty
					// array triggers that update without rebuilding the mounted picker.
					picker!.customEmoji = [];
				}
			});
			pickerHost.replaceChildren(picker);
			requestAnimationFrame(() => {
				if (!disposed && dialog.open)
					picker?.shadowRoot?.querySelector<HTMLInputElement>('input')?.focus();
			});
		} catch {
			if (!disposed) loadError = 'Could not load the emoji picker.';
		} finally {
			if (!disposed) loading = false;
		}
	}
</script>

<button
	type="button"
	class="emoji-button"
	aria-label="Choose emoji"
	title={value ? 'Change emoji (' + value + ')' : 'Choose emoji'}
	aria-haspopup="dialog"
	aria-controls={id + '-dialog'}
	onclick={openPicker}
>
	{#if value}{value}{:else}
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			width="20"
			height="20"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
		>
			<circle cx="12" cy="12" r="9" />
			<path d="M8 14.5c1 3 7 3 8 0" />
			<path d="M8.5 8.5v1M15.5 8.5v1" />
		</svg>
	{/if}
</button>

<dialog class="emoji-dialog" bind:this={dialog} id={id + '-dialog'} aria-labelledby={id + '-title'}>
	<header>
		<h3 id={id + '-title'}>Emoji</h3>
		<button type="button" class="clear-button" disabled={!value} onclick={() => choose('')}
			>Clear emoji</button
		>
		<button
			type="button"
			class="close-button"
			aria-label="Close emoji picker"
			onclick={() => dialog.close()}>×</button
		>
	</header>
	{#if loading}<p role="status">Loading emoji…</p>{/if}
	{#if loadError}<p role="alert">{loadError}</p>
		<button type="button" onclick={openPicker}>Retry</button>{/if}
	<div class="picker-host" bind:this={pickerHost}></div>
</dialog>

<style>
	.emoji-button {
		display: grid;
		place-items: center;
		width: 32px;
		border: 1px solid var(--line);
		border-radius: 3px;
		background: var(--paper);
		padding: 0;
		height: 32px;
		flex-shrink: 0;
		font:
			22px/1 'Segoe UI Emoji',
			'Apple Color Emoji',
			sans-serif;
	}
	.emoji-button:hover {
		background: #e5eae2;
	}
	.emoji-button svg {
		color: var(--muted);
		opacity: 0.65;
	}
	.emoji-dialog {
		/* Prepare layout while closed, without exposing controls to keyboard or screen readers. */
		display: block;
		position: fixed;
		inset: 0;
		width: min(360px, calc(100vw - 24px));
		max-height: calc(100dvh - 24px);
		padding: 12px;
		border: 1px solid var(--line);
		border-radius: 6px;
		background: var(--paper);
		color: var(--ink);
	}
	.emoji-dialog:not([open]) {
		visibility: hidden;
		pointer-events: none;
	}
	.emoji-dialog::backdrop {
		background: rgb(0 0 0 / 25%);
	}
	.emoji-dialog header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
	}
	h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
	}
	.emoji-dialog header button {
		border: 0;
		background: transparent;
		height: 32px;
		border-radius: 3px;
	}
	.clear-button {
		margin-left: auto;
		font-size: 12px;
	}
	.close-button {
		font-size: 22px;
		width: 32px;
	}
	.emoji-dialog header button:hover:not(:disabled) {
		background: #e5eae2;
	}
	.emoji-dialog p {
		font-size: 12px;
	}
	.picker-host :global(emoji-picker) {
		width: 100%;
		height: min(420px, calc(100dvh - 110px));
		--background: var(--paper);
		--border-color: var(--line);
		--button-hover-background: #e5eae2;
	}
	@media (max-width: 380px) {
		.picker-host :global(emoji-picker) {
			--num-columns: 7;
			--category-emoji-size: 1.125rem;
		}
	}
</style>
