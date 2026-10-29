<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		getPublishedClause,
		updatePublishedClause,
		type PublishedClause,
		type PublishedClausePayload
	} from '$lib/api/published-clauses';
	import Card from '$lib/components/Card.svelte';
	import PublishedClauseForm from '$lib/components/PublishedClauseForm.svelte';
	import { authStore, getAuthSnapshot } from '$lib/stores/auth';
	import { onMount } from 'svelte';

	let { data }: { data: { clauseId: string } } = $props();
	let clause = $state<PublishedClause | null>(null);
	let loading = $state(true);
	let error = $state('');

	onMount(() =>
		authStore.subscribe((session) => {
			if (!session) return;
			void getPublishedClause(session.accessToken, data.clauseId)
				.then((value) => {
					clause = value;
					if (value.status !== 'DRAFT') error = 'Somente rascunhos podem ser editados.';
				})
				.catch((caught) => {
					error =
						caught instanceof Error ? caught.message : 'Não foi possível carregar a cláusula.';
				})
				.finally(() => {
					loading = false;
				});
		})
	);

	async function save(payload: PublishedClausePayload) {
		const session = getAuthSnapshot();
		if (!session) return;
		await updatePublishedClause(session.accessToken, data.clauseId, payload);
		await goto(resolve(`/clauses/${data.clauseId}`));
	}
</script>

<svelte:head><title>Nuptalicium — Editar cláusula</title></svelte:head>
<div class="stack-lg">
	<h1>Editar rascunho</h1>
	{#if loading}<Card><p>Carregando…</p></Card>{:else if error}<Card
			><p class="error">{error}</p></Card
		>{:else if clause}<Card
			><PublishedClauseForm initial={clause} submitLabel="Salvar alterações" onSave={save} /></Card
		>{/if}
</div>
