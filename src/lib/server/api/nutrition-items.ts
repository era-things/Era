import { FOOD_ITEM_FIELDS, validFoodItem, type FoodItem } from '../../nutrition';
import { setWidgetValue } from '../../widgets';
import { invalid, object, resourceId } from './shared';
import { dayItemRoutes } from './day-items';

const itemFields = ['id', ...FOOD_ITEM_FIELDS];

export function parseFoodItem(value: unknown, field: string) {
	const item = object(value, itemFields, itemFields);
	resourceId(item.id, field === 'body' ? 'id' : `${field}.id`);
	if (!validFoodItem(item)) invalid('Invalid food item.', field);
	return item;
}

export const nutritionItemRoutes = dayItemRoutes<FoodItem>({
	collectionPath: /^days\/(?<date>[^/]+)\/widgets\/nutrition\/items$/,
	itemPath: /^days\/(?<date>[^/]+)\/widgets\/nutrition\/items\/(?<id>[^/]+)$/,
	idField: 'id',
	parseId: resourceId,
	required: FOOD_ITEM_FIELDS,
	valid: validFoodItem,
	label: 'food item',
	notFoundCode: 'food_item_not_found',
	read: (data, date) => data.nutrition[date],
	write: (data, date, items) => setWidgetValue(data, date, 'nutrition', items)
});
