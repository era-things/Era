import {
	repositoryKey,
	validGitHubRepository,
	type GitHubRepository
} from '../../github-activity';
import { validScreenApp, type ScreenApp } from '../../screen-apps';
import { dayItemRoutes, nonBlankItemId } from './day-items';
import { fail } from './shared';

const phoneAppRoutes = dayItemRoutes<ScreenApp>({
	collectionPath: /^days\/(?<date>[^/]+)\/widgets\/phone\/apps$/,
	itemPath: /^days\/(?<date>[^/]+)\/widgets\/phone\/apps\/(?<id>[\s\S]+)$/,
	idField: 'package',
	parseId: nonBlankItemId,
	required: ['name', 'minutes'],
	optional: ['lastUsed'],
	valid: validScreenApp,
	label: 'phone app',
	notFoundCode: 'phone_app_not_found',
	read: (data, date) =>
		data.automated[date]?.phone === undefined ? undefined : data.screenApps[date],
	write: (data, date, items) => {
		if (data.automated[date]?.phone === undefined)
			fail(409, 'phone_report_missing', 'Record automated phone duration for this day first.');
		return { ...data, screenApps: { ...data.screenApps, [date]: items } };
	}
});

const gitHubRepositoryRoutes = dayItemRoutes<GitHubRepository>({
	collectionPath: /^days\/(?<date>[^/]+)\/github-activity\/repositories$/,
	// The router decodes the path, including the slash in an encoded owner/name.
	itemPath: /^days\/(?<date>[^/]+)\/github-activity\/repositories\/(?<id>[\s\S]+)$/,
	idField: 'name',
	parseId: nonBlankItemId,
	normalizeId: repositoryKey,
	required: ['commits', 'additions', 'deletions'],
	optional: ['url'],
	valid: validGitHubRepository,
	label: 'GitHub repository',
	notFoundCode: 'github_repository_not_found',
	read: (data, date) => data.githubActivity[date]?.repositories,
	write: (data, date, items) => {
		const activity = data.githubActivity[date];
		if (!activity) fail(409, 'github_report_missing', 'Record GitHub totals for this day first.');
		return {
			...data,
			githubActivity: { ...data.githubActivity, [date]: { ...activity, repositories: items } }
		};
	}
});

export const activityItemRoutes = [...phoneAppRoutes, ...gitHubRepositoryRoutes];
