<script lang="ts">
	import {
		CATEGORY_LABELS,
		type PublishedClause,
		type PublishedClauseCategory,
		type PublishedClausePayload,
		type PublishedClauseType,
		type PublishedClauseVisibility
	} from '$lib/api/published-clauses';
	import { getRuleSchema } from '$lib/api/rules';
	import type { ContractRulePayload, RuleSchema } from '$lib/contract-rules';
	import { cloneRule, DEFAULT_RULE } from '$lib/contract-rules';
	import { getAuthSnapshot } from '$lib/stores/auth';
	import { showValidationToast } from '$lib/stores/toast';
	import Button from './Button.svelte';
	import Input from './Input.svelte';
	import RuleBuilder from './RuleBuilder.svelte';
	import { onMount } from 'svelte';

	let {
		initial = null,
		submitLabel = 'Salvar rascunho',
		secondarySubmitLabel = null,
		onSave,
		onSecondarySave = null
	}: {
		initial?: PublishedClause | null;
		submitLabel?: string;
		secondarySubmitLabel?: string | null;
		onSave: (payload: PublishedClausePayload) => Promise<void>;
		onSecondarySave?: ((payload: PublishedClausePayload) => Promise<void>) | null;
	} = $props();

	let type = $state<PublishedClauseType>('RULE');
	let visibility = $state<PublishedClauseVisibility>('PUBLIC');
	let title = $state('');
	let summary = $state('');
	let category = $state<PublishedClauseCategory>('OTHER');
	let conceptText = $state('');
	let rule = $state<ContractRulePayload>(cloneRule(DEFAULT_RULE));
	let initialized = $state(false);
	let schema = $state<RuleSchema | null>(null);
	let saving = $state(false);
	let editorError = $state('');

	$effect(() => {
		if (!initial || initialized) return;
		type = initial.type;
		visibility = initial.visibility;
		title = initial.title;
		summary = initial.summary ?? '';
		category = initial.category;
		conceptText = initial.conceptText ?? '';
		if (initial.ruleDefinition) {
			rule = cloneRule({
				dslVersion: initial.dslVersion ?? '1',
				definition: initial.ruleDefinition
			});
		}
		initialized = true;
	});

	onMount(async () => {
		const session = getAuthSnapshot();
		if (!session) return;
		try {
			schema = await getRuleSchema(session.accessToken);
		} catch (caught) {
			editorError =
				caught instanceof Error ? caught.message : 'Não foi possível carregar o editor de regras.';
		}
	});

	function payload(): PublishedClausePayload | null {
		if (!title.trim()) {
			showValidationToast('Informe o título da cláusula.');
			return null;
		}
		if (type === 'CONCEPT' && !conceptText.trim()) {
			showValidationToast('Informe o texto do conceito.');
			return null;
		}
		return {
			type,
			visibility,
			title: title.trim(),
			summary: summary.trim() || null,
			category,
			conceptText: type === 'CONCEPT' ? conceptText.trim() : null,
			rule: type === 'RULE' ? rule : null
		};
	}

	async function save(action: (value: PublishedClausePayload) => Promise<void>) {
		const value = payload();
		if (!value) return;
		saving = true;
		try {
			await action(value);
		} catch (caught) {
			showValidationToast(
				caught instanceof Error ? caught.message : 'Não foi possível salvar a cláusula.'
			);
		} finally {
			saving = false;
		}
	}
</script>

<div class="stack-lg">
	<div class="grid-2">
		<label class="field">
			<span class="label">Tipo</span>
			<select bind:value={type}>
				<option value="RULE">Regra</option>
				<option value="CONCEPT">Conceito</option>
			</select>
		</label>
		<label class="field">
			<span class="label">Visibilidade</span>
			<select bind:value={visibility}>
				<option value="PUBLIC">Pública</option>
				<option value="PRIVATE">Privada</option>
			</select>
		</label>
	</div>
	<Input label="Título" bind:value={title} required />
	<Input label="Resumo" bind:value={summary} textarea rows={3} />
	<label class="field">
		<span class="label">Categoria</span>
		<select bind:value={category}>
			{#each Object.entries(CATEGORY_LABELS) as [value, label] (value)}
				<option {value}>{label}</option>
			{/each}
		</select>
	</label>

	{#if type === 'RULE'}
		{#if schema}<RuleBuilder bind:value={rule} {schema} />{:else}<p class="muted">
				Carregando editor…
			</p>{/if}
	{:else}
		<Input label="Texto do conceito" bind:value={conceptText} textarea rows={8} required />
	{/if}

	{#if editorError}<p class="error">{editorError}</p>{/if}
	<div class="row actions">
		<Button disabled={saving} onClick={() => void save(onSave)}
			>{saving ? 'Salvando…' : submitLabel}</Button
		>
		{#if secondarySubmitLabel && onSecondarySave}<Button
				variant="secondary"
				disabled={saving}
				onClick={() => void save(onSecondarySave)}>{secondarySubmitLabel}</Button
			>{/if}
		<Button href="/clauses/mine" variant="ghost">Cancelar</Button>
	</div>
</div>
