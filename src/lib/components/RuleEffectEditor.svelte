<script lang="ts">
	import type { AmountType, RuleEffect, RuleSchema } from '$lib/contract-rules';

	let {
		effect = $bindable(),
		schema
	}: { effect: RuleEffect; schema: RuleSchema['effects'][number] } = $props();

	function changeAmountType(event: Event) {
		effect = {
			...effect,
			amount: {
				...effect.amount,
				type: (event.currentTarget as HTMLSelectElement).value as AmountType
			}
		};
	}

	function changePair(event: Event) {
		const index = Number((event.currentTarget as HTMLSelectElement).value);
		const pair = schema.allowedPartyPairs[index];
		effect = { ...effect, from: pair.from, to: pair.to };
	}
</script>

<div class="stack surface-gray effect">
	<div class="grid-2">
		<label class="field">
			<span class="label">Consequência</span>
			<input class="control" value={schema.label} readonly />
		</label>
		<label class="field">
			<span class="label">Origem e destino</span>
			<select onchange={changePair}>
				{#each schema.allowedPartyPairs as pair, index (`${pair.from}-${pair.to}`)}
					<option value={index} selected={pair.from === effect.from && pair.to === effect.to}>
						{pair.from} → {pair.to}
					</option>
				{/each}
			</select>
		</label>
		<label class="field">
			<span class="label">Tipo do valor</span>
			<select value={effect.amount.type} onchange={changeAmountType}>
				{#each schema.amountTypes as amountType (amountType)}
					<option value={amountType}>{amountType === 'PERCENTAGE' ? 'Percentual' : 'Sats'}</option>
				{/each}
			</select>
		</label>
		<label class="field">
			<span class="label">Valor</span>
			<input
				class="control"
				type="number"
				min={effect.amount.type === 'PERCENTAGE' ? 0.01 : 1}
				max={effect.amount.type === 'PERCENTAGE' ? 100 : undefined}
				step={effect.amount.type === 'PERCENTAGE' ? 0.01 : 1}
				bind:value={effect.amount.value}
			/>
		</label>
	</div>
</div>

<style>
	.effect {
		padding: 1rem;
	}
</style>
