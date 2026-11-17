import {
	reply,
	noContent,
	fail,
	invalid,
	object,
	resourceId,
	type ApiContext,
	type ApiRoute
} from './shared';
import { isDeepStrictEqual } from 'node:util';
import { normalizeReminders, type Reminder } from '../../reminders';
function listReminders({ store }: ApiContext) {
	return reply({ reminders: store.read().reminders });
}
function getReminder({ store, params }: ApiContext) {
	const id = resourceId(params.id);
	const item = store.read().reminders.find((item) => item.id === id);
	if (!item) fail(404, 'reminder_not_found', 'Unknown reminder.', 'id');
	return reply(item);
}
function putReminder({ store, body, params }: ApiContext) {
	const id = resourceId(params.id);
	const payload = object(
		body,
		['id', 'text', 'period', 'start', 'overrideEmoji', 'leadDays', 'completedDates'],
		['text', 'period', 'start', 'overrideEmoji', 'leadDays', 'completedDates']
	);
	if (Object.hasOwn(payload, 'id') && payload.id !== id) invalid('ID must match the URL.', 'id');
	const reminder = {
		...payload,
		id,
		text: typeof payload.text === 'string' ? payload.text.trim() : payload.text
	};
	if (!isDeepStrictEqual(normalizeReminders([reminder]), [reminder]))
		invalid('Invalid reminder fields.', 'body');
	store.update((data) => ({
		...data,
		reminders: data.reminders.some((item) => item.id === id)
			? data.reminders.map((item) => (item.id === id ? (reminder as Reminder) : item))
			: [...data.reminders, reminder as Reminder]
	}));
	return reply(reminder);
}
function deleteReminder({ store, params }: ApiContext) {
	const id = resourceId(params.id);
	store.update((data) => ({
		...data,
		reminders: data.reminders.filter((item) => item.id !== id)
	}));
	return noContent();
}
export const reminderRoutes = [
	{ pattern: /^reminders$/, methods: { GET: listReminders } },
	{
		pattern: /^reminders\/(?<id>[^/]+)$/,
		methods: { GET: getReminder, PUT: putReminder, DELETE: deleteReminder }
	}
] satisfies ApiRoute[];
