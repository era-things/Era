export const DEFAULT_TIMELINE_COLOR = '#8b9390';

export const isTimelineColor = (value: unknown): value is string =>
	typeof value === 'string' && /^#[0-9a-f]{6}$/.test(value);
