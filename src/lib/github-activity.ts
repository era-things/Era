import { isRecord, normalizeDays } from './validation';

type GitHubTotals = { commits: number; additions: number; deletions: number };
export type GitHubRepository = GitHubTotals & { name: string; url?: string };
export type GitHubActivity = GitHubTotals & { repositories?: GitHubRepository[] };
export const repositoryKey = (name: string) => name.trim().toLowerCase();

function validTotals(value: Record<string, unknown>): boolean {
	return [value.commits, value.additions, value.deletions].every(
		(count) => typeof count === 'number' && Number.isSafeInteger(count) && count >= 0
	);
}

function validRepositoryUrl(value: unknown): value is string {
	if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return false;
	try {
		const url = new URL(value);
		return !url.username && !url.password;
	} catch {
		return false;
	}
}

export function validGitHubRepository(value: unknown): value is GitHubRepository {
	if (!isRecord(value) || !validTotals(value)) return false;
	const hasUrl = Object.hasOwn(value, 'url');
	return (
		Object.keys(value).length === (hasUrl ? 5 : 4) &&
		(!hasUrl || validRepositoryUrl(value.url)) &&
		typeof value.name === 'string' &&
		!!value.name.trim()
	);
}

export function validGitHubActivity(value: unknown): value is GitHubActivity {
	if (!isRecord(value) || !validTotals(value)) return false;
	if (!Object.hasOwn(value, 'repositories')) return Object.keys(value).length === 3;
	if (Object.keys(value).length !== 4 || !Array.isArray(value.repositories)) return false;

	const names = new Set<string>();
	for (const repo of value.repositories) {
		if (!validGitHubRepository(repo)) return false;
		const key = repositoryKey(repo.name);
		if (names.has(key)) return false;
		names.add(key);
	}
	return true;
}

export const normalizeGitHubActivity = (value: unknown) =>
	normalizeDays(value, (entry) => (validGitHubActivity(entry) ? entry : undefined));
