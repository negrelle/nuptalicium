<script lang="ts">
	let {
		steps,
		activeIndex = 0
	}: {
		steps: string[];
		activeIndex?: number;
	} = $props();
</script>

<div class="step-indicator">
	<div
		class="step-track"
		style:grid-template-columns="repeat({steps.length}, minmax(6.5rem, 1fr))"
		aria-label="Etapas do formulário"
	>
		{#each steps as step, index (step)}
			<div
				class="step"
				class:completed={index < activeIndex}
				class:current={index === activeIndex}
				aria-current={index === activeIndex ? 'step' : undefined}
			>
				<span class="dot" aria-hidden="true"></span>
				<span class="step-label">{step}</span>
			</div>
		{/each}
	</div>
</div>

<style>
	.step-indicator {
		overflow-x: auto;
		padding: 0.25rem 0 0.15rem;
	}

	.step-track {
		display: grid;
		width: 100%;
		min-width: max-content;
	}

	.step {
		position: relative;
		display: grid;
		justify-items: center;
		gap: 0.5rem;
		min-width: 6.5rem;
		text-align: center;
	}

	.step:not(:last-child)::before {
		position: absolute;
		z-index: 0;
		top: 0.375rem;
		left: calc(50% + 0.375rem);
		width: calc(100% - 0.75rem);
		height: 2px;
		background: var(--gray-100);
		content: '';
		transition: background-color 180ms ease;
	}

	.step.completed::before {
		background: var(--rose-300);
	}

	.dot {
		position: relative;
		z-index: 1;
		width: 0.75rem;
		height: 0.75rem;
		border: 2px solid var(--gray-300);
		border-radius: 50%;
		background: var(--surface);
		transition:
			border-color 180ms ease,
			background-color 180ms ease;
	}

	.completed .dot {
		border-color: var(--rose-300);
		background: var(--rose-300);
	}

	.current .dot {
		border-color: var(--rose-400);
		background: var(--rose-400);
	}

	.step-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--gray-500);
		line-height: 1.2;
		transition: color 180ms ease;
	}

	.completed .step-label {
		color: var(--gray-700);
	}

	.current .step-label {
		color: var(--rose-text);
	}
</style>
