<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import type { Snippet } from 'svelte';

	type Variant = 'primary' | 'ghost';

	let {
		children,
		href,
		variant = 'primary',
		type = 'button',
		disabled = false,
		onClick
	}: {
		children?: Snippet;
		href?: Pathname;
		variant?: Variant;
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		onClick?: (event: MouseEvent) => void;
	} = $props();

	const baseClass = 'button';
</script>

{#if href}
	<a
		class={`${baseClass} ${variant}`}
		href={resolve(href)}
		aria-disabled={disabled}
		tabindex={disabled ? -1 : 0}
	>
		{@render children?.()}
	</a>
{:else}
	<button class={`${baseClass} ${variant}`} {type} {disabled} onclick={onClick}>
		{@render children?.()}
	</button>
{/if}

<style>
	.button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		min-height: 2.75rem;
		padding: 0.75rem 1rem;
		border-radius: 999px;
		border: 1px solid transparent;
		transition:
			transform 200ms ease,
			border-color 200ms ease,
			background-color 200ms ease,
			color 200ms ease;
	}

	.button:hover {
		transform: translateY(-1px);
	}

	.button.primary {
		background: var(--rose-400);
		color: white;
	}

	.button.ghost {
		background: transparent;
		border-color: var(--border-gray);
		color: var(--gray-700);
	}

	.button[aria-disabled='true'] {
		pointer-events: none;
		opacity: 0.55;
	}
</style>
