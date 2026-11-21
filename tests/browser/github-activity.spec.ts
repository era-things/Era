import { test, expect } from './fixtures';
import { eraToday } from '../../src/lib/calendar';

test('GitHub shows daily totals and expands when repository details arrive', async ({
	page,
	request
}) => {
	const url = `/api/days/${eraToday()}/github-activity`;
	const repoUrl = 'https://github.com/era-things/Era';
	const totals = { commits: 6, additions: 418, deletions: 92 };
	const today = page.getByRole('complementary', { name: 'Today', exact: true });
	const widget = today.getByRole('region', { name: 'GitHub activity', exact: true });
	const summary = widget.locator('summary');
	const drawer = widget.getByRole('list', { name: 'Updated repositories' });

	await page.goto('/today');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await expect(widget).toHaveCount(0);
	expect((await request.put(url, { data: totals })).status()).toBe(204);
	await page.reload();
	await expect(widget).toContainText(/6 commits.*\+418.*−92/);
	await expect(widget.locator('.brand svg')).toBeVisible();
	await expect(summary).toHaveCount(0);

	const repos = [
		{ name: 'dotfiles', commits: 1, additions: 38, deletions: 20 },
		{ name: 'Atlas', commits: 1, additions: 100, deletions: 12 }
	];
	expect((await request.put(url, { data: { ...totals, repositories: repos } })).status()).toBe(204);
	const repo = `${url}/repositories/${encodeURIComponent('era-things/Era')}`;
	expect(
		(await request.put(repo, { data: { url: repoUrl, commits: 3, additions: 280, deletions: 60 } })).ok()
	).toBe(true);
	const edited = await request.patch(repo, { data: { commits: 4 } });
	expect(await edited.json()).toMatchObject({ name: 'era-things/Era', url: repoUrl, commits: 4 });
	await page.reload();
	await page.setViewportSize({ width: 390, height: 800 });
	await expect(summary).toContainText(/6 commits.*Era.*\+2/);
	expect((await summary.boundingBox())?.height).toBe(26);
	await expect(drawer).toHaveCount(0);
	await summary.press('Enter');
	await expect(drawer.getByRole('listitem')).toHaveCount(3);
	await expect(drawer.getByRole('listitem').first()).toContainText(
		/era-things\/Era.*4 commits.*\+280.*−60/
	);
	const link = drawer.getByRole('link', { name: /era-things\/Era/ });
	await expect(link).toHaveAttribute('href', repoUrl);
	await expect(drawer.getByRole('link')).toHaveCount(1);
	await page.context().route(repoUrl, (route) => route.fulfill({ body: 'Example repository' }));
	const [repository] = await Promise.all([
		page.waitForEvent('popup'),
		link.getByText('+280', { exact: true }).click()
	]);
	await expect(repository).toHaveURL(repoUrl);
	await repository.close();
	await expect(drawer).toBeVisible();
	await summary.click();
	await expect(drawer).toHaveCount(0);
});
