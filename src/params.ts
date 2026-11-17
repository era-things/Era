import { defineParams } from '@sveltejs/kit/params';
import { appViewForPath } from './lib/app-views';

export const params = defineParams({
	appView: (value) => (appViewForPath('/' + value) ? value : undefined)
});
