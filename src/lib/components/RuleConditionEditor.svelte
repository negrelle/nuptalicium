<script lang="ts">
	import { RULE_OPERATOR_LABELS } from '$lib/contract-rules';
	import type { RuleCondition, RuleOperator, RuleSchema } from '$lib/contract-rules';

	let {
		condition = $bindable(),
		fieldSchema,
		readonly = false,
		onRemove
	}: {
		condition: RuleCondition;
		fieldSchema: RuleSchema['triggers'][number]['subjects'][number]['fields'][number];
		readonly?: boolean;
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
		<select value={condition.operator} onchange={setOperator} disabled={readonly}>
			{#each fieldSchema.operators as operator (operator)}
				<option value={operator}>{RULE_OPERATOR_LABELS[operator]}</option>
			{/each}
		</select>
	</label>
	<label class="field">
		<span class="label">Valor</span>
		<input
			class="control"
			type="number"
			min="1"
			step="1"
			bind:value={condition.value}
			disabled={readonly}
		/>
	</label>
	<label class="field">
		<span class="label">Unidade</span>
		<input class="control" value={condition.unit === 'DAY' ? 'dias' : 'ocorrências'} readonly />
	</label>
	{#if !readonly}<button type="button" class="text-button remove" onclick={onRemove}>Remover</button
		>{/if}
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
