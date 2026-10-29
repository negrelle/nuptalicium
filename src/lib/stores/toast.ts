import { writable } from 'svelte/store';

interface ToastMessage {
	id: number;
	message: string;
}

const TOAST_DURATION_MS = 3000;
let nextToastId = 0;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;

export const toastStore = writable<ToastMessage | null>(null);

export function showValidationToast(message: string) {
	if (dismissTimer) clearTimeout(dismissTimer);

	const toast = { id: ++nextToastId, message: message.trim() || 'Revise os dados informados.' };
	toastStore.set(toast);
	dismissTimer = setTimeout(() => {
		toastStore.update((current) => (current?.id === toast.id ? null : current));
		dismissTimer = null;
	}, TOAST_DURATION_MS);
}

export function dismissToast() {
	if (dismissTimer) clearTimeout(dismissTimer);
	dismissTimer = null;
	toastStore.set(null);
}
