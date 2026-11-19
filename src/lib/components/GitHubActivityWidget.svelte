<script lang="ts">
	import type { GitHubActivity, GitHubRepository } from '../github-activity';
	import Chevron from './Chevron.svelte';

	let { activity }: { activity: GitHubActivity } = $props();
	const number = new Intl.NumberFormat('en-US');
	const repositories = $derived(
		[...(activity.repositories ?? [])].sort((a, b) => b.commits - a.commits)
	);
	const top = $derived(repositories[0]);
	const topName = $derived(top?.name.trim().split('/').at(-1) || top?.name.trim());

	function commits(count: number) {
		return `${number.format(count)} ${count === 1 ? 'commit' : 'commits'}`;
	}
</script>

{#snippet lines(added: number, deleted: number)}
	<span class="line-totals">
		<span class="added">+{number.format(added)}</span>
		<span class="deleted">−{number.format(deleted)}</span>
	</span>
{/snippet}

{#snippet collapsed()}
	<span class="brand">
		<!-- GitHub mark from Primer Octicons, copyright GitHub Inc. (MIT). -->
		<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
			<path
				d="M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656"
			/>
		</svg>
		GitHub
	</span>
	<span class="commit-total">{commits(activity.commits)}</span>
	{#if top}
		<span class="project-preview">
			<span class="project-name" title={top.name.trim()}>{topName}</span>
			{#if repositories.length > 1}<span>+{repositories.length - 1}</span>{/if}
		</span>
		<span class="chevron"><Chevron direction="down" size={12} /></span>
	{:else}
		{@render lines(activity.additions, activity.deletions)}
	{/if}
{/snippet}

{#snippet repository(repo: GitHubRepository)}
	<span>
		<span class="repo-name">{repo.name.trim()}</span>
		<span class="repo-commits">{commits(repo.commits)}</span>
	</span>
	{@render lines(repo.additions, repo.deletions)}
{/snippet}

<section class="github-activity" aria-label="GitHub activity">
	{#if top}
		<details>
			<summary class="activity-row">{@render collapsed()}</summary>
			<ul class="repository-list" aria-label="Updated repositories" role="list">
				{#each repositories as repo (repo.name)}
					<li>
						{#if repo.url}
							<a class="repository-row" href={repo.url} target="_blank" rel="noopener noreferrer">
								{@render repository(repo)}
							</a>
						{:else}
							<div class="repository-row">{@render repository(repo)}</div>
						{/if}
					</li>
				{/each}
			</ul>
		</details>
	{:else}
		<div class="activity-row">{@render collapsed()}</div>
	{/if}
</section>

<style>
	.github-activity {
		--activity-surface: #343f49;
		--activity-text: #f0f3f4;
		--activity-muted: #c2cfd8;
		font-variant-numeric: tabular-nums;
	}
	.activity-row {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 26px;
		padding: 0 7px;
		border-radius: 4px;
		background: var(--activity-surface);
		color: var(--activity-text);
		font-size: 12px;
		white-space: nowrap;
	}
	summary {
		list-style: none;
		cursor: pointer;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary:hover {
		background: #3e4b56;
	}
	summary:focus-visible {
		outline: 1px solid var(--activity-muted);
		outline-offset: -1px;
	}
	details[open] > summary {
		border-end-start-radius: 0;
		border-end-end-radius: 0;
	}
	.brand,
	.project-preview,
	.line-totals {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.brand,
	.project-preview {
		color: var(--activity-muted);
	}
	.brand,
	.chevron {
		flex: none;
	}
	.chevron {
		display: inline-flex;
		color: var(--activity-muted);
	}
	details[open] .chevron {
		transform: rotate(180deg);
	}
	.commit-total,
	.project-preview,
	.project-name {
		min-width: 0;
	}
	.commit-total,
	.project-name {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.project-preview,
	.activity-row .line-totals {
		margin-inline-start: auto;
	}
	.project-name {
		color: var(--activity-text);
	}
	.activity-row .added {
		color: #a7d2ad;
	}
	.activity-row .deleted {
		color: #eab0b1;
	}
	.repository-list {
		list-style: none;
		margin: 0;
		padding: 3px 8px;
		border-radius: 0 0 4px 4px;
		background: #edf1f3;
		color: var(--ink);
		font-size: 12px;
	}
	.repository-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 8px;
		padding-block: 5px;
	}
	li + li {
		border-top: 1px solid #d7dfe2;
	}
	a.repository-row {
		color: inherit;
		text-decoration: none;
	}
	a.repository-row:hover,
	a.repository-row:focus-visible {
		background: #e1e8ec;
	}
	a.repository-row:focus-visible {
		outline: 1px solid var(--accent);
		outline-offset: -1px;
	}
	a .repo-name {
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.repo-name {
		overflow-wrap: anywhere;
	}
	.repo-commits {
		display: block;
		color: #536167;
		font-size: 11px;
	}
	.added {
		color: #2c6b47;
	}
	.deleted {
		color: #94454b;
	}
</style>
