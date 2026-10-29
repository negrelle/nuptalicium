<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		createPublishedClause,
		publishClause,
		type PublishedClausePayload
	} from '$lib/api/published-clauses';
	import Card from '$lib/components/Card.svelte';
	import PublishedClauseForm from '$lib/components/PublishedClauseForm.svelte';
	import { getAuthSnapshot } from '$lib/stores/auth';

	async function publish(payload: PublishedClausePayload) {
		const session = getAuthSnapshot();
		if (!session) return;
		const created = await createPublishedClause(session.accessToken, payload);
		const published = await publishClause(session.accessToken, created.id);
		await goto(resolve(`/clauses/${published.id}`));
	}

	async function saveDraft(payload: PublishedClausePayload) {
		const session = getAuthSnapshot();
		if (!session) return;
		const created = await createPublishedClause(session.accessToken, payload);
		await goto(resolve(`/clauses/${created.id}`));
	}
</script>

<svelte:head><title>Nuptalicium — Nova cláusula</title></svelte:head>
<div class="stack-lg">
	<div class="stack compact">
		<h1>Nova cláusula</h1>
		<p class="muted">
			Publicar é a ação principal. Depois da publicação, o conteúdo não poderá mais ser editado.
		</p>
	</div>
	<Card
		><PublishedClauseForm
			submitLabel="Publicar agora"
			secondarySubmitLabel="Salvar como rascunho"
			onSave={publish}
			onSecondarySave={saveDraft}
		/></Card
	>
</div>
