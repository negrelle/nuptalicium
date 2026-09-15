<script lang="ts">
	let {
		steps,
		activeIndex = 0
	}: {
		steps: string[];
		activeIndex?: number;
	} = $props();
</script>

<div class="step-indicator" aria-label="Etapas do formulário">
	{#each steps as step, index (step)}
		<div class="step-wrap">
			<span
				class:done={index < activeIndex}
				class:active={index === activeIndex}
				class:pending={index > activeIndex}
				class="dot"
				aria-hidden="true"
			></span>
			<span class="step-label">{step}</span>
		</div>
	{/each}
</div>

<style>
	.step-indicator {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
		gap: 0.75rem;
	}

	.step-wrap {
		display: grid;
		justify-items: center;
		gap: 0.35rem;
		text-align: center;
	}

	.dot {
		width: 0.95rem;
		height: 0.95rem;
		border-radius: 999px;
		border: 1px solid var(--border-gray);
	}

	.dot.done {
		background: var(--rose-200);
	}

	.dot.active {
		background: var(--rose-300);
	}

	.dot.pending {
		background: var(--rose-100);
	}

	.step-label {
		font-size: 0.76rem;
		color: var(--gray-500);
		line-height: 1.2;
	}
</style>
