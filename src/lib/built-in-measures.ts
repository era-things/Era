export const BUILT_IN_MEASURES = [
	{ id: 'nutrition', name: 'Nutrition' },
	{ id: 'weight', name: 'Weight' },
	{ id: 'steps', name: 'Steps' }
] as const;
export type BuiltInMeasureId = (typeof BUILT_IN_MEASURES)[number]['id'];
