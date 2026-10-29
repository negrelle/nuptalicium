<script lang="ts">
	type Variant = 'corner' | 'divider';

	let {
		variant = 'corner',
		className = ''
	}: {
		variant?: Variant;
		className?: string;
	} = $props();
</script>

{#if variant === 'divider'}
	<svg
		class={`arabesque arabesque-divider ${className}`}
		viewBox="0 0 220 32"
		fill="none"
		aria-hidden="true"
		focusable="false"
	>
		<path d="M8 16h72c13 0 18-6 18-12 0 15 24 15 24 0 0 6 5 12 18 12h72" />
		<path d="M87 16c7 0 11 5 11 11M133 16c-7 0-11 5-11 11" />
		<path d="M104 16c0-4 2-7 6-9 4 2 6 5 6 9-3 2-9 2-12 0Z" />
		<circle cx="80" cy="16" r="2" />
		<circle cx="140" cy="16" r="2" />
	</svg>
{:else}
	<svg
		class={`arabesque corner ${className}`}
		viewBox="0 0 180 180"
		fill="none"
		aria-hidden="true"
		focusable="false"
	>
		<path d="M8 92V8h84" />
		<path d="M22 92V22h70" />
		<path d="M8 60c18 0 30-7 30-22 0 28 21 41 54 41" />
		<path d="M60 8c0 18-7 30-22 30 28 0 41 21 41 54" />
		<path d="M39 39c15-15 38-15 48-3 8 10 3 25-9 25-9 0-13-8-9-14" />
		<path d="M39 39c-15 15-15 38-3 48 10 8 25 3 25-9 0-9-8-13-14-9" />
		<path d="M94 79c24 0 39 13 39 32 0 13-10 22-22 22-9 0-15-6-15-13 0-6 5-10 10-10" />
		<path d="M79 94c0 24 13 39 32 39" />
		<path d="M106 110c13-4 25 3 28 15 2 9-3 18-11 22" />
		<path d="M22 22c5 1 9 5 10 10-5-1-9-5-10-10Z" />
	</svg>
{/if}

<style>
	.arabesque {
		display: block;
		color: var(--rose-300);
		stroke: currentColor;
		stroke-width: 1.55;
		stroke-linecap: round;
		stroke-linejoin: round;
		vector-effect: non-scaling-stroke;
	}

	.arabesque :global(circle) {
		fill: currentColor;
		stroke: none;
	}

	.corner {
		width: 10rem;
	}

	.arabesque-divider {
		width: min(12rem, 52vw);
		height: auto;
		stroke-width: 1.35;
	}
</style>
