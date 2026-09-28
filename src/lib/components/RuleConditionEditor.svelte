<script lang="ts">
	import type { RuleCondition, RuleOperator, RuleSchema } from '$lib/contract-rules';

	let {
		condition = $bindable(),
		fieldSchema,
		onRemove
	}: {
		condition: RuleCondition;
		fieldSchema: RuleSchema['triggers'][number]['subjects'][number]['fields'][number];
		onRemove: () => void;
	} = $props();

	function setOperator(event: Event) {
		condition = {
			...condition,
			operator: (event.currentTarget as HTMLSelectElement).value as RuleOperator
		};
	}
</script>

<div class="condition surface-gray">
	<label class="field">
		<span class="label">Campo</span>
		<input class="control" value={fieldSchema.label} readonly />
	</label>
	<label class="field">
		<span class="label">Operador</span>
		<select value={condition.operator} onchange={setOperator}>
			{#each fieldSchema.operators as operator (operator)}
				<option value={operator}>{operator}</option>
			{/each}
		</select>
	</label>
	<label class="field">
		<span class="label">Valor</span>
		<input class="control" type="number" min="1" step="1" bind:value={condition.value} />
	</label>
	<label class="field">
		<span class="label">Unidade</span>
		<input class="control" value={condition.unit === 'DAY' ? 'dias' : 'ocorrências'} readonly />
	</label>
	<button type="button" class="text-button remove" onclick={onRemove}>Remover</button>
</div>

<style>
	.condition {
		display: grid;
		grid-template-columns: 1.2fr 1.2fr 0.75fr 0.85fr auto;
		gap: 0.75rem;
		align-items: end;
		padding: 1rem;
	}
	.remove {
		margin-bottom: 0.45rem;
	}
	@media (max-width: 850px) {
		.condition {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
