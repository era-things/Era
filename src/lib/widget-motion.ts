import { cubicOut } from 'svelte/easing';
import { slide, type TransitionConfig } from 'svelte/transition';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function unfold(node: Element): TransitionConfig {
	return slide(node, { duration: reducedMotion() ? 0 : 180, easing: cubicOut });
}

export function pop(node: Element): TransitionConfig {
	if (reducedMotion()) return { duration: 0 };

	const { opacity } = getComputedStyle(node);
	return {
		duration: 170,
		easing: cubicOut,
		css: (t) => `opacity: ${Number(opacity) * t}; scale: ${0.96 + 0.04 * t}`
	};
}

export function reflow(container: HTMLElement) {
	let pending = false;
	const animations = new Map<Element, Animation>();
	function positions() {
		const { left, top } = container.getBoundingClientRect();
		const result = new Map<Element, { x: number; y: number }>();
		for (const child of container.children) {
			if (!child.getClientRects().length) continue;
			const rect = child.getBoundingClientRect();
			result.set(child, { x: rect.left - left, y: rect.top - top });
		}
		return result;
	}
	function onOutro(event: Event) {
		if (pending || reducedMotion()) return;
		const removed = event.target as Element;
		const before = positions();
		pending = true;
		queueMicrotask(() => {
			pending = false;
			if (!container.isConnected || removed.isConnected) return;
			for (const animation of animations.values()) animation.cancel();
			animations.clear();
			for (const [child, next] of positions()) {
				const previous = before.get(child);
				if (!previous) continue;
				const x = previous.x - next.x;
				const y = previous.y - next.y;
				if (!x && !y) continue;
				const animation = child.animate([{ translate: `${x}px ${y}px` }, { translate: 'none' }], {
					duration: 160,
					easing: 'ease-out',
					id: 'widget-reflow'
				});
				animations.set(child, animation);
				animation.onfinish = () => animations.delete(child);
			}
		});
	}
	container.addEventListener('outroend', onOutro, true);
	return {
		destroy() {
			container.removeEventListener('outroend', onOutro, true);
			for (const animation of animations.values()) animation.cancel();
		}
	};
}

type RemoteValue = { revision: number; value: string | number | boolean | null | undefined };

export function highlightRemote(node: HTMLElement, previous: RemoteValue) {
	let animation: Animation | undefined;
	return {
		update(next: RemoteValue) {
			const changed =
				next.revision > 0 && next.revision !== previous.revision && next.value !== previous.value;
			previous = next;
			if (!changed || document.hidden || reducedMotion() || !node.getClientRects().length) return;
			const { top, bottom } = node.getBoundingClientRect();
			if (bottom <= 0 || top >= window.innerHeight) return;
			animation?.cancel();
			animation = node.animate([{ filter: 'brightness(1.12) saturate(1.2)' }, { filter: 'none' }], {
				duration: 480,
				easing: 'ease-out',
				id: 'remote-value'
			});
		},
		destroy() {
			animation?.cancel();
		}
	};
}
