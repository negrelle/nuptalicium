import { writable } from 'svelte/store';

export type AlertVariant = 'warning' | 'danger' | 'success';

export interface AlertOptions {
	title?: string;
	message: string;
	variant?: AlertVariant;
	confirmLabel?: string;
	cancelLabel?: string;
}

export interface ActiveAlert extends Required<Omit<AlertOptions, 'cancelLabel'>> {
	id: number;
	cancelLabel: string | null;
	resolve: ((confirmed: boolean) => void) | null;
}

let nextAlertId = 0;
let currentResolver: ((confirmed: boolean) => void) | null = null;

export const alertStore = writable<ActiveAlert | null>(null);

function openAlert(options: AlertOptions, resolve: ((confirmed: boolean) => void) | null = null) {
	currentResolver?.(false);
	currentResolver = resolve;
	alertStore.set({
		id: ++nextAlertId,
		title: options.title ?? 'Atenção',
		message: options.message.trim() || 'Revise os dados informados.',
		variant: options.variant ?? 'warning',
		confirmLabel: options.confirmLabel ?? 'Entendi',
		cancelLabel: options.cancelLabel ?? null,
		resolve
	});
}

export function showValidationAlert(message: string) {
	openAlert({ title: 'Revise as informações', message, variant: 'warning' });
}

export function confirmAlert(options: AlertOptions) {
	return new Promise<boolean>((resolve) => openAlert(options, resolve));
}

export function resolveAlert(confirmed: boolean) {
	const resolver = currentResolver;
	currentResolver = null;
	alertStore.set(null);
	resolver?.(confirmed);
}

export function dismissAlert() {
	resolveAlert(false);
}
