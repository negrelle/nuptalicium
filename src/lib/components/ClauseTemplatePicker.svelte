<script lang="ts">
	import type { ClauseTemplate } from '$lib/api/clause-templates';

	let {
		templates,
		selectedId = $bindable(),
		onSelect
	}: {
		templates: ClauseTemplate[];
		selectedId: string;
		onSelect?: (id: string) => void;
	} = $props();
</script>

<label class="field">
	<span class="label">Modelo de cláusula</span>
	<select bind:value={selectedId} onchange={() => onSelect?.(selectedId)}>
		<option value="">Escolha um modelo</option>
		{#each templates as template (template.id)}
			<option value={template.id}>{template.title}</option>
		{/each}
	</select>
</label>
