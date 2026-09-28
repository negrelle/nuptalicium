<script lang="ts">
	import type {
		ConditionField,
		ContractRulePayload,
		RuleCondition,
		RuleSchema,
		RuleSubject
	} from '$lib/contract-rules';
	import RuleConditionEditor from './RuleConditionEditor.svelte';
	import RuleEffectEditor from './RuleEffectEditor.svelte';

	let { value = $bindable(), schema }: { value: ContractRulePayload; schema: RuleSchema } =
		$props();

	let triggerSchema = $derived(schema.triggers[0]);
	let subjectSchema = $derived(
		triggerSchema.subjects.find((item) => item.value === value.definition.trigger.subject) ??
			triggerSchema.subjects[0]
	);

	function changeSubject(event: Event) {
		const subject = (event.currentTarget as HTMLSelectElement).value as RuleSubject;
		const selected = triggerSchema.subjects.find((item) => item.value === subject)!;
		const field = selected.fields[0];
		value = {
			...value,
			definition: {
				...value.definition,
				trigger: { type: 'ARBITRATION_DECISION', subject },
				conditions: [conditionFor(field)]
			}
		};
	}

	function conditionFor(field: (typeof subjectSchema.fields)[number]): RuleCondition {
		return {
			field: field.value,
			operator: 'GREATER_OR_EQUAL',
			value: 1,
			unit: field.units[0]
		};
	}

	function addCondition() {
		const used = new Set(value.definition.conditions.map((condition) => condition.field));
		const available = subjectSchema.fields.find((field) => !used.has(field.value));
		if (!available) return;
		value = {
			...value,
			definition: {
				...value.definition,
				conditions: [...value.definition.conditions, conditionFor(available)]
			}
		};
	}

	function removeCondition(index: number) {
		value = {
			...value,
			definition: {
				...value.definition,
				conditions: value.definition.conditions.filter((_, itemIndex) => itemIndex !== index)
			}
		};
	}

	function fieldSchema(field: ConditionField) {
		return subjectSchema.fields.find((item) => item.value === field)!;
	}
</script>

<div class="stack builder">
	<div class="grid-2">
		<label class="field">
			<span class="label">Quando</span>
			<input class="control" value={triggerSchema.label} readonly />
		</label>
		<label class="field">
			<span class="label">Sobre</span>
			<select value={value.definition.trigger.subject} onchange={changeSubject}>
				{#each triggerSchema.subjects as subject (subject.value)}
					<option value={subject.value}>{subject.label}</option>
				{/each}
			</select>
		</label>
	</div>

	<div class="stack">
		<div class="row heading">
			<h3>Se todas as condições forem satisfeitas</h3>
			<button
				type="button"
				class="text-button"
				disabled={value.definition.conditions.length >= subjectSchema.fields.length}
				onclick={addCondition}>Adicionar condição</button
			>
		</div>
		{#each value.definition.conditions as condition, index (`${condition.field}-${index}`)}
			<RuleConditionEditor
				bind:condition={value.definition.conditions[index]}
				fieldSchema={fieldSchema(condition.field)}
				onRemove={() => removeCondition(index)}
			/>
		{/each}
	</div>

	<div class="stack">
		<h3>Então</h3>
		<RuleEffectEditor bind:effect={value.definition.effect} schema={schema.effects[0]} />
	</div>
</div>

<style>
	.builder {
		gap: 1.5rem;
	}
	.heading {
		justify-content: space-between;
	}
	.heading h3 {
		font-size: 1rem;
	}
</style>
