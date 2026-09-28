<script lang="ts">
	let { description, loading = false }: { description: string | null; loading?: boolean } =
		$props();
</script>

<section class="preview surface-gray" aria-live="polite">
	<span class="label">Prévia gerada pela API</span>
	{#if loading}
		<p class="muted">Gerando descrição…</p>
	{:else if description}
		<p>{description}</p>
	{:else}
		<p class="muted">Preencha uma regra válida para visualizar sua redação contratual.</p>
	{/if}
</section>

<style>
	.preview {
		padding: 1rem;
	}
</style>
