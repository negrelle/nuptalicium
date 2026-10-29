<script lang="ts">
	let {
		value,
		disabled = false,
		onRate,
		onRemove
	}: {
		value: number | null;
		disabled?: boolean;
		onRate: (rating: number) => void;
		onRemove: () => void;
	} = $props();
</script>

<div class="stack compact rating-control">
	<span class="label">Sua avaliação</span>
	<div class="row stars" aria-label="Avaliação de um a cinco">
		{#each [1, 2, 3, 4, 5] as rating (rating)}
			<button
				type="button"
				class:active={value !== null && rating <= value}
				{disabled}
				onclick={() => onRate(rating)}
				aria-label={`${rating} estrela${rating === 1 ? '' : 's'}`}>★</button
			>
		{/each}
		{#if value !== null}<button class="remove" type="button" {disabled} onclick={onRemove}
				>Remover</button
			>{/if}
	</div>
</div>

<style>
	.stars {
		justify-content: flex-start;
		gap: 0.25rem;
	}
	.stars button {
		border: 0;
		background: transparent;
		color: var(--gray-300);
		font-size: 1.65rem;
		cursor: pointer;
		padding: 0.15rem;
	}
	.stars button.active {
		color: var(--rating);
	}
	.stars button:disabled {
		cursor: default;
		opacity: 0.6;
	}
	.stars .remove {
		color: var(--gray-600);
		font-size: 0.85rem;
		margin-left: 0.5rem;
	}
</style>
