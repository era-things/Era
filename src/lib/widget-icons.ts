export type WidgetIcon = {
	fill?: string;
	stroke?: string;
	paths?: readonly {
		d: string;
		transform?: string;
		'stroke-width'?: string;
		'stroke-opacity'?: string;
		fill?: string;
		stroke?: string;
	}[];
	rects?: readonly {
		x: string | number;
		y: string | number;
		width: string | number;
		height: string | number;
		rx?: string | number;
	}[];
};

export const WIDGET_ICONS = {
	phone: {
		paths: [{ d: 'M10 5h4M11 19h2' }, { d: 'M9 9h6v6H9Z', 'stroke-opacity': '.45' }],
		rects: [{ x: '6', y: '2', width: '12', height: '20', rx: '2.5' }]
	},
	gym: {
		paths: [{ d: 'M7 12h10M3 9v6m4-9v12M21 9v6m-4-9v12M3 12h4m10 0h4', 'stroke-width': '2' }],
		rects: []
	},
	reading: {
		paths: [
			{
				d: 'M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v15M5 7h3M5 10h3m8-3h3m-3 3h3'
			}
		],
		rects: []
	},
	movie: {
		paths: [
			{ d: 'M6 4v16m12-16v16M2 8h4m-4 4h4m-4 4h4m12-8h4m-4 4h4m-4 4h4' },
			{ d: 'm10 9 5 3-5 3Z', fill: 'currentColor', stroke: 'none' }
		],
		rects: [{ x: '2', y: '4', width: '20', height: '16', rx: '1.5' }]
	},
	steam: {
		paths: [
			{
				d: 'M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z'
			}
		],
		rects: [],
		fill: 'currentColor',
		stroke: 'none'
	},
	weight: {
		rects: [{ x: 3, y: 3, width: 18, height: 18, rx: 4 }],
		paths: [{ d: 'M7 9a6 6 0 0 1 10 0l-2 3H9Z M12 10l2-3' }]
	},
	steps: {
		paths: [
			{ d: 'M7 2C5 2 3.5 4 3.5 6.5c0 2 1 3.5 1 5.5h5c0-2 1-3.5 1-5.5C10.5 4 9 2 7 2Z' },
			{ d: 'M4.5 15h5v1a2.5 2.5 0 0 1-5 0Z' },
			{
				d: 'M17 6c-2 0-3.5 2-3.5 4.5 0 2 1 3.5 1 5.5h5c0-2 1-3.5 1-5.5C20.5 8 19 6 17 6Z',
				transform: 'rotate(18 17 14)'
			},
			{ d: 'M14.5 19h5v1a2.5 2.5 0 0 1-5 0Z', transform: 'rotate(18 17 14)' }
		]
	}
} as const satisfies Record<string, WidgetIcon>;
