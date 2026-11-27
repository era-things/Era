export const APP_VIEWS = [
	{
		id: 'eras',
		label: 'Eras',
		path: '/eras',
		section: 'calendar',
		mode: 'horizontal'
	},
	{ id: 'vertical', label: 'Grid', path: '/', section: 'calendar', mode: 'vertical' },
	{ id: 'today', label: 'Today', path: '/today', section: 'today' },
	{ id: 'layout', label: 'Layout', path: '/layout', section: 'layout' },
	{ id: 'reminders', label: 'Reminders', path: '/reminders', section: 'reminders' },
	{ id: 'settings', label: 'Settings', path: '/settings', section: 'settings' }
] as const;
export type AppViewId = (typeof APP_VIEWS)[number]['id'];
export const appViewForPath = (path: string) => APP_VIEWS.find((view) => view.path === path);
