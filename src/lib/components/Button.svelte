<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import type { Snippet } from 'svelte';

	type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
	type Size = 'small' | 'medium' | 'large';

	let {
		children,
		href,
		variant = 'primary',
		size = 'medium',
		fullWidth = false,
		type = 'button',
		disabled = false,
		onClick
	}: {
		children?: Snippet;
		href?: Pathname;
		variant?: Variant;
		size?: Size;
		fullWidth?: boolean;
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		onClick?: (event: MouseEvent) => void;
	} = $props();

	const classes = $derived(`button ${variant} ${size}${fullWidth ? ' full-width' : ''}`);
</script>

{#if href}
	<a class={classes} href={resolve(href)} aria-disabled={disabled} tabindex={disabled ? -1 : 0}>
		{@render children?.()}
	</a>
{:else}
	<button class={classes} {type} {disabled} onclick={onClick}>
		{@render children?.()}
	</button>
{/if}

<style>
	.button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		min-height: var(--control-height);
		padding: 0.72rem 1.15rem;
		border-radius: var(--radius-md);
		border: 1px solid transparent;
		font-size: 0.94rem;
		font-weight: 600;
		line-height: 1.1;
		white-space: nowrap;
		transition:
			transform 160ms ease,
			box-shadow 160ms ease,
			border-color 160ms ease,
			background-color 160ms ease,
			color 160ms ease;
	}

	.button:hover:not([aria-disabled='true']):not(:disabled) {
		transform: translateY(-1px);
	}

	.button.primary {
		background: var(--rose-400);
		color: white;
		box-shadow: 0 5px 14px rgba(124, 67, 67, 0.14);
	}

	.button.primary:hover:not([aria-disabled='true']):not(:disabled) {
		background: var(--rose-500);
		color: white;
	}

	.button.secondary {
		background: var(--surface);
		border-color: var(--rose-300);
		color: var(--rose-text);
	}

	.button.ghost {
		background: transparent;
		border-color: var(--border-gray);
		color: var(--gray-700);
	}

	.button.secondary:hover:not([aria-disabled='true']):not(:disabled),
	.button.ghost:hover:not([aria-disabled='true']):not(:disabled) {
		background: var(--rose-100);
		border-color: var(--rose-300);
	}

	.button.danger {
		background: var(--rose-text);
		color: white;
	}

	.button.small {
		min-height: 2.35rem;
		padding: 0.55rem 0.85rem;
		font-size: 0.86rem;
	}

	.button.large {
		min-height: 3.35rem;
		padding-inline: 1.4rem;
		font-size: 1rem;
	}

	.button.full-width {
		width: 100%;
	}

	.button[aria-disabled='true'] {
		pointer-events: none;
		opacity: 0.55;
	}

	.button:disabled {
		transform: none;
	}
</style>
