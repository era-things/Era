type Options<T> = {
	key: string;
	label: string;
	parse: (raw: string | null) => T;
	serialize?: (value: T) => string;
	apply: (value: T) => void;
	error: (message: string) => void;
};

export function browserStorage<T>({
	key,
	label,
	parse,
	serialize = JSON.stringify,
	apply,
	error
}: Options<T>) {
	return {
		connect() {
			try {
				apply(parse(localStorage.getItem(key)));
			} catch {
				error(label + ' storage is unavailable in this browser.');
			}
			const sync = (event: StorageEvent) => {
				if (event.key === key || event.key === null) apply(parse(event.newValue));
			};
			window.addEventListener('storage', sync);
			return () => window.removeEventListener('storage', sync);
		},
		save(value: T): boolean {
			try {
				localStorage.setItem(key, serialize(value));
				apply(value);
				error('');
				return true;
			} catch {
				error('Could not save ' + label.toLowerCase() + ' in this browser.');
				return false;
			}
		}
	};
}
