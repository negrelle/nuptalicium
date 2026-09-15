<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children, className = '' }: { children?: Snippet; className?: string } = $props();
</script>

<section class={`surface card ${className}`}>
	{@render children?.()}
</section>

<style>
	.card {
		padding: 1.5rem;
	}
</style>
