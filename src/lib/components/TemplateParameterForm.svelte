<script lang="ts">
	import type { ClauseTemplate } from '$lib/api/clause-templates';

	let {
		template,
		values = $bindable()
	}: { template: ClauseTemplate; values: Record<string, number> } = $props();
</script>

<div class="grid-2">
	{#each template.definition.parameters as parameter (parameter.name)}
		<label class="field">
			<span class="label">{parameter.label}</span>
			<input
				class="control"
				type="number"
				min={parameter.minimum ?? undefined}
				max={parameter.maximum ?? undefined}
				step={parameter.valueType === 'PERCENTAGE' ? 0.01 : 1}
				bind:value={values[parameter.name]}
				required={parameter.required}
			/>
		</label>
	{/each}
</div>
