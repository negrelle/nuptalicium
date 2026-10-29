import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type Theme = 'light' | 'dark';

const storageKey = 'nuptalicium-theme';
let activeTheme: Theme = 'light';

export const themeStore = writable<Theme>(activeTheme);

function applyTheme(theme: Theme, persist: boolean) {
	activeTheme = theme;
	themeStore.set(theme);

	if (!browser) return;

	document.documentElement.dataset.theme = theme;
	document.documentElement.style.colorScheme = theme;
	if (persist) localStorage.setItem(storageKey, theme);
}

export function initializeTheme() {
	if (!browser) return;

	const savedTheme = localStorage.getItem(storageKey);
	const theme: Theme =
		savedTheme === 'dark' || savedTheme === 'light'
			? savedTheme
			: window.matchMedia('(prefers-color-scheme: dark)').matches
				? 'dark'
				: 'light';

	applyTheme(theme, false);
}

export function toggleTheme() {
	applyTheme(activeTheme === 'dark' ? 'light' : 'dark', true);
}
