<script lang="ts">
	import type { Snippet } from 'svelte';

	type Tone = 'default' | 'subtle' | 'transparent';
	type Padding = 'small' | 'medium' | 'large';

	let {
		children,
		className = '',
		tone = 'default',
		padding = 'medium'
	}: {
		children?: Snippet;
		className?: string;
		tone?: Tone;
		padding?: Padding;
	} = $props();
</script>

<section class={`card ${tone} ${padding} ${className}`}>
	{@render children?.()}
</section>

<style>
	.card {
		min-width: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
		box-shadow: var(--shadow-card);
	}

	.card.small {
		padding: 1rem;
	}

	.card.medium {
		padding: clamp(1.25rem, 2vw, 1.75rem);
	}

	.card.large {
		padding: clamp(1.5rem, 3vw, 2.5rem);
	}

	.card.subtle {
		background: var(--surface-muted);
		box-shadow: none;
	}

	.card.transparent {
		border-color: transparent;
		background: transparent;
		box-shadow: none;
	}
</style>
