<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { networks } from 'bitcoinjs-lib';
	import {
		listClauseTemplates,
		previewClauseTemplate,
		type ClauseTemplate
	} from '$lib/api/clause-templates';
	import {
		createClause,
		createClauseFromTemplate,
		createContract,
		createCustomRuleClause,
		deleteClause,
		initializeMultisig,
		submitContract,
		updateContract,
		type BitcoinWallet,
		type Contract,
		type ContractPayload
	} from '$lib/api/contracts';
	import { getRuleSchema, previewRule } from '$lib/api/rules';
	import type { UserSearchResult } from '$lib/api/users';
	import { createContractWallet, createPolicyDocument } from '$lib/bitcoin';
	import Button from '$lib/components/Button.svelte';
	import BitcoinPolicyStep from '$lib/components/BitcoinPolicyStep.svelte';
	import Card from '$lib/components/Card.svelte';
	import ClauseTemplatePicker from '$lib/components/ClauseTemplatePicker.svelte';
	import Input from '$lib/components/Input.svelte';
	import RuleBuilder from '$lib/components/RuleBuilder.svelte';
	import RulePreview from '$lib/components/RulePreview.svelte';
	import StepIndicator from '$lib/components/StepIndicator.svelte';
	import TemplateParameterForm from '$lib/components/TemplateParameterForm.svelte';
	import UserPicker from '$lib/components/UserPicker.svelte';
	import {
		cloneRule,
		DEFAULT_RULE,
		type ContractRulePayload,
		type RuleSchema
	} from '$lib/contract-rules';
	import { formatDateTime } from '$lib/date';
	import { authStore } from '$lib/stores/auth';
	import type { AuthSession } from '$lib/types';
	import { onMount } from 'svelte';

	type ClauseMode = 'TEMPLATE' | 'CUSTOM' | 'CONCEPT';

	const steps = ['Participantes', 'Cláusulas e regras', 'Política Bitcoin', 'Revisão'];
	let session = $state<AuthSession | null>(null);
	let step = $state(0);
	let contract = $state<Contract | null>(null);
	let wallet = $state<BitcoinWallet | null>(null);
	let schema = $state<RuleSchema | null>(null);
	let templates = $state<ClauseTemplate[]>([]);
	let loadingResources = $state(false);
	let saving = $state(false);
	let error = $state('');

	let title = $state('');
	let spouseB = $state<UserSearchResult | null>(null);
	let arbitratorA = $state<UserSearchResult | null>(null);
	let arbitratorB = $state<UserSearchResult | null>(null);
	let neutral = $state<UserSearchResult | null>(null);
	let feeA = $state(0);
	let feeB = $state(0);
	let feeNeutral = $state(0);
	let expiresAt = $state('');

	let clauseMode = $state<ClauseMode>('TEMPLATE');
	let clauseTitle = $state('');
	let conceptDescription = $state('');
	let customRule = $state<ContractRulePayload>(cloneRule(DEFAULT_RULE));
	let selectedTemplateId = $state('');
	let templateValues = $state<Record<string, number>>({});
	let previewDescription = $state<string | null>(null);
	let previewing = $state(false);

	let selectedTemplate = $derived(templates.find((item) => item.id === selectedTemplateId) ?? null);

	onMount(() => {
		let loadedFor = '';
		return authStore.subscribe((value) => {
			session = value;
			if (value && value.user.id !== loadedFor) {
				loadedFor = value.user.id;
				void loadResources(value);
			}
		});
	});

	async function loadResources(activeSession: AuthSession) {
		loadingResources = true;
		try {
			[schema, templates] = await Promise.all([
				getRuleSchema(activeSession.accessToken),
				listClauseTemplates(activeSession.accessToken)
			]);
		} catch (caught) {
			error = message(caught, 'Não foi possível carregar as opções de cláusula.');
		} finally {
			loadingResources = false;
		}
	}

	function message(caught: unknown, fallback: string) {
		return caught instanceof Error ? caught.message : fallback;
	}

	function userName(user: UserSearchResult | null) {
		return user?.displayName || (user ? `${user.publicKey.slice(0, 12)}…` : 'Não informado');
	}

	function excludedKeys(current: UserSearchResult | null) {
		return [
			session?.user.publicKey,
			...[spouseB, arbitratorA, arbitratorB, neutral]
				.filter((user) => user && user !== current)
				.map((user) => user!.publicKey)
		].filter((key): key is string => Boolean(key));
	}

	function validateParticipants() {
		if (!session) throw new Error('Sua sessão não está disponível. Entre novamente.');
		if (!spouseB || !arbitratorA || !arbitratorB) {
			throw new Error('Selecione o outro cônjuge e os dois árbitros obrigatórios.');
		}
		const keys = [
			session.user.publicKey,
			spouseB.publicKey,
			arbitratorA.publicKey,
			arbitratorB.publicKey
		];
		if (neutral) keys.push(neutral.publicKey);
		if (new Set(keys.map((key) => key.toLowerCase())).size !== keys.length) {
			throw new Error('Cada participante precisa usar uma chave Nostr diferente.');
		}
		if (neutral && feeNeutral <= 0) throw new Error('Informe a taxa do árbitro neutro.');
		if (!neutral && feeNeutral > 0)
			throw new Error('Informe o árbitro neutro ou remova a taxa dele.');
		if (feeA + feeB + feeNeutral > 100) {
			throw new Error('A soma das taxas dos árbitros não pode ultrapassar 100%.');
		}
	}

	function contractPayload(): ContractPayload {
		validateParticipants();
		return {
			title: title.trim() || null,
			spouseBPublicKey: spouseB!.publicKey,
			arbitratorAPublicKey: arbitratorA!.publicKey,
			arbitratorBPublicKey: arbitratorB!.publicKey,
			arbitratorNeutralPublicKey: neutral?.publicKey || null,
			feePercArbitratorA: feeA,
			feePercArbitratorB: feeB,
			feePercArbitratorNeutral: neutral ? feeNeutral : null,
			expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
		};
	}

	async function saveParticipants() {
		if (!session || saving) return;
		error = '';
		saving = true;
		try {
			const payload = contractPayload();
			contract = contract
				? await updateContract(session.accessToken, contract.id, payload)
				: await createContract(session.accessToken, payload);
			step = 1;
		} catch (caught) {
			error = message(caught, 'Não foi possível salvar os participantes.');
		} finally {
			saving = false;
		}
	}

	function selectTemplate(id: string) {
		const template = templates.find((item) => item.id === id);
		clauseTitle = template?.title ?? '';
		templateValues = Object.fromEntries(
			(template?.definition.parameters ?? []).map((parameter) => [
				parameter.name,
				parameter.defaultValue ?? parameter.minimum ?? 0
			])
		);
		previewDescription = null;
	}

	async function generatePreview() {
		if (!session) return;
		previewing = true;
		error = '';
		try {
			const result =
				clauseMode === 'TEMPLATE' && selectedTemplate
					? await previewClauseTemplate(
							session.accessToken,
							selectedTemplate.id,
							clauseTitle,
							templateValues
						)
					: await previewRule(session.accessToken, clauseTitle, customRule);
			previewDescription = result.description;
			if (!result.valid) error = result.errors.map((item) => item.message).join(' ');
		} catch (caught) {
			previewDescription = null;
			error = message(caught, 'Não foi possível gerar a prévia.');
		} finally {
			previewing = false;
		}
	}

	async function addClause() {
		if (!session || !contract || saving) return;
		error = '';
		saving = true;
		try {
			const position = contract.clauses.length;
			let clause;
			if (clauseMode === 'TEMPLATE') {
				if (!selectedTemplate) throw new Error('Escolha um modelo de cláusula.');
				clause = await createClauseFromTemplate(session.accessToken, contract.id, {
					templateId: selectedTemplate.id,
					title: clauseTitle.trim() || null,
					position,
					parameters: templateValues
				});
			} else if (clauseMode === 'CUSTOM') {
				if (!clauseTitle.trim()) throw new Error('Informe o título da regra.');
				clause = await createCustomRuleClause(session.accessToken, contract.id, {
					title: clauseTitle.trim(),
					position,
					rule: customRule
				});
			} else {
				if (!clauseTitle.trim() || !conceptDescription.trim()) {
					throw new Error('Informe o título e a descrição do conceito.');
				}
				clause = await createClause(session.accessToken, contract.id, {
					title: clauseTitle.trim(),
					kind: 'CONCEPT',
					description: conceptDescription.trim(),
					position
				});
			}
			contract = { ...contract, clauses: [...contract.clauses, clause] };
			clauseTitle = '';
			conceptDescription = '';
			selectedTemplateId = '';
			templateValues = {};
			customRule = cloneRule(DEFAULT_RULE);
			previewDescription = null;
		} catch (caught) {
			error = message(caught, 'Não foi possível adicionar a cláusula.');
		} finally {
			saving = false;
		}
	}

	async function removeClause(clauseId: string) {
		if (!session || !contract || saving) return;
		saving = true;
		error = '';
		try {
			await deleteClause(session.accessToken, contract.id, clauseId);
			contract = {
				...contract,
				clauses: contract.clauses.filter((clause) => clause.id !== clauseId)
			};
		} catch (caught) {
			error = message(caught, 'Não foi possível remover a cláusula.');
		} finally {
			saving = false;
		}
	}

	async function initializePolicy() {
		if (!session || !contract || !spouseB || !arbitratorA || !arbitratorB || saving) return;
		error = '';
		saving = true;
		try {
			const spouses: [string, string] = [session.user.publicKey, spouseB.publicKey];
			const arbitrators = [arbitratorA.publicKey, arbitratorB.publicKey];
			if (neutral) arbitrators.push(neutral.publicKey);
			const generated = createContractWallet(spouses, arbitrators, 2, networks.testnet);
			const policy = await createPolicyDocument(spouses, arbitrators, generated);
			wallet = await initializeMultisig(session.accessToken, contract.id, {
				network: 'testnet4',
				address: generated.multisigAddress,
				scriptPubKey: generated.multisigScriptHex,
				policyHash: policy.policyHash,
				policyDocument: policy.policyDocument,
				arbitratorsQuorum: 2
			});
		} catch (caught) {
			error = message(caught, 'Não foi possível inicializar a política Bitcoin.');
		} finally {
			saving = false;
		}
	}

	async function finish() {
		if (!session || !contract || !wallet || saving) return;
		saving = true;
		error = '';
		try {
			await submitContract(session.accessToken, contract.id);
			await goto(resolve('/(app)/contracts/[id]', { id: contract.id }));
		} catch (caught) {
			error = message(caught, 'Não foi possível enviar o contrato para aceite.');
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head><title>Nuptalicium — Novo contrato</title></svelte:head>

<div class="stack-lg">
	<div class="stack compact">
		<h1>Construa o acordo</h1>
		<p class="muted">Defina os participantes, as regras executáveis e a política Bitcoin.</p>
	</div>
	<StepIndicator {steps} activeIndex={step} />

	{#if error}<div class="error surface">{error}</div>{/if}
	{#if contract}
		<p class="draft-note muted">Rascunho salvo automaticamente: {contract.id}</p>
	{/if}

	{#if step === 0}
		<Card>
			<form
				class="stack"
				onsubmit={(event) => {
					event.preventDefault();
					void saveParticipants();
				}}
			>
				<Input label="Título" bind:value={title} placeholder="Ex.: Nosso acordo" />
				<UserPicker
					label="Outro cônjuge"
					bind:value={spouseB}
					accessToken={session?.accessToken || ''}
					excludePublicKeys={excludedKeys(spouseB)}
					required
				/>
				<div class="grid-2">
					<UserPicker
						label="Árbitro A"
						bind:value={arbitratorA}
						accessToken={session?.accessToken || ''}
						excludePublicKeys={excludedKeys(arbitratorA)}
						required
					/>
					<Input
						label="Taxa do árbitro A (%)"
						bind:value={feeA}
						type="number"
						min={0}
						max={100}
						step={0.01}
						required
					/>
					<UserPicker
						label="Árbitro B"
						bind:value={arbitratorB}
						accessToken={session?.accessToken || ''}
						excludePublicKeys={excludedKeys(arbitratorB)}
						required
					/>
					<Input
						label="Taxa do árbitro B (%)"
						bind:value={feeB}
						type="number"
						min={0}
						max={100}
						step={0.01}
						required
					/>
					<UserPicker
						label="Árbitro neutro (opcional)"
						bind:value={neutral}
						accessToken={session?.accessToken || ''}
						excludePublicKeys={excludedKeys(neutral)}
					/>
					<Input
						label="Taxa do neutro (%)"
						bind:value={feeNeutral}
						type="number"
						min={0}
						max={100}
						step={0.01}
					/>
				</div>
				<Input label="Prazo para aceite (opcional)" bind:value={expiresAt} type="datetime-local" />
				<div class="row actions">
					<Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Continuar'}</Button
					><Button href="/contracts" variant="ghost">Cancelar</Button>
				</div>
			</form>
		</Card>
	{:else if step === 1}
		<div class="stack-lg">
			<Card>
				<div class="stack">
					<h2>Adicionar cláusula</h2>
					<div class="mode-tabs" role="tablist" aria-label="Tipo da cláusula">
						{#each [['TEMPLATE', 'Usar modelo'], ['CUSTOM', 'Criar regra'], ['CONCEPT', 'Conceito']] as option (option[0])}
							<button
								type="button"
								class:active={clauseMode === option[0]}
								onclick={() => {
									clauseMode = option[0] as ClauseMode;
									previewDescription = null;
								}}>{option[1]}</button
							>
						{/each}
					</div>

					{#if loadingResources}
						<p class="muted">Carregando regras…</p>
					{:else if clauseMode === 'TEMPLATE'}
						<ClauseTemplatePicker
							{templates}
							bind:selectedId={selectedTemplateId}
							onSelect={selectTemplate}
						/>
						{#if selectedTemplate}
							<Input label="Título da cláusula" bind:value={clauseTitle} />
							<p class="muted">{selectedTemplate.description}</p>
							<TemplateParameterForm template={selectedTemplate} bind:values={templateValues} />
							<Button variant="secondary" onClick={generatePreview} disabled={previewing}
								>Gerar prévia</Button
							>
							<RulePreview description={previewDescription} loading={previewing} />
						{/if}
					{:else if clauseMode === 'CUSTOM'}
						<Input label="Título da regra" bind:value={clauseTitle} required />
						{#if schema}<RuleBuilder bind:value={customRule} {schema} />{/if}
						<Button variant="secondary" onClick={generatePreview} disabled={previewing}
							>Gerar prévia</Button
						>
						<RulePreview description={previewDescription} loading={previewing} />
					{:else}
						<Input label="Título do conceito" bind:value={clauseTitle} required />
						<Input label="Descrição" bind:value={conceptDescription} textarea rows={5} required />
					{/if}
					<Button onClick={addClause} disabled={saving}
						>{saving ? 'Adicionando…' : 'Adicionar ao contrato'}</Button
					>
				</div>
			</Card>

			{#each contract?.clauses ?? [] as clause, index (clause.id)}
				<Card>
					<div class="stack clause-card">
						<div class="row clause-heading">
							<div class="row">
								<span class="clause-type">{clause.kind === 'RULE' ? 'Regra' : 'Conceito'}</span
								><strong>{index + 1}. {clause.title}</strong>
							</div>
							<button
								class="text-button"
								disabled={saving}
								onclick={() => void removeClause(clause.id)}>Remover</button
							>
						</div>
						<p>{clause.description}</p>
					</div>
				</Card>
			{/each}
			<div class="row actions">
				<Button
					onClick={() => {
						if (!contract?.clauses.length) {
							error = 'Inclua ao menos uma cláusula.';
							return;
						}
						error = '';
						step = 2;
					}}>Continuar</Button
				><Button variant="ghost" disabled={Boolean(wallet)} onClick={() => (step = 0)}
					>Voltar</Button
				>
			</div>
		</div>
	{:else if step === 2}
		<Card>
			<BitcoinPolicyStep
				address={wallet?.address ?? ''}
				policyHash={wallet?.policyHash ?? ''}
				ready={Boolean(wallet)}
				busy={saving}
				onInitialize={initializePolicy}
			/>
			<div class="row actions policy-actions">
				<Button disabled={!wallet} onClick={() => (step = 3)}>Revisar contrato</Button><Button
					variant="ghost"
					onClick={() => (step = 1)}>Voltar</Button
				>
			</div>
		</Card>
	{:else}
		<Card>
			<div class="stack">
				<h2>{contract?.title || 'Contrato sem título'}</h2>
				<div class="review-grid">
					<span>Cláusulas</span><strong>{contract?.clauses.length ?? 0}</strong>
					<span>Taxas dos árbitros</span><strong>{feeA + feeB + feeNeutral}%</strong>
					<span>Prazo</span><strong>{formatDateTime(expiresAt)}</strong>
					<span>Rede Bitcoin</span><strong>Testnet4</strong>
					<span>Política</span><strong class="technical policy-hash">{wallet?.policyHash}</strong>
				</div>
				<div class="divider"></div>
				<h3>Participantes</h3>
				<div class="review-grid">
					<span>Cônjuge A</span><strong>Você</strong>
					<span>Cônjuge B</span><strong>{userName(spouseB)}</strong>
					<span>Árbitro A</span><strong>{userName(arbitratorA)} · {feeA}%</strong>
					<span>Árbitro B</span><strong>{userName(arbitratorB)} · {feeB}%</strong>
					{#if neutral}<span>Árbitro neutro</span><strong
							>{userName(neutral)} · {feeNeutral}%</strong
						>{/if}
				</div>
				<div class="divider"></div>
				<h3>Cláusulas e consequências</h3>
				{#each contract?.clauses ?? [] as clause, index (clause.id)}
					<div class="review-clause surface-gray">
						<strong>{index + 1}. {clause.title}</strong>
						<p>{clause.description}</p>
						{#if clause.rule}
							<small>
								Efeito econômico: {clause.rule.definition.effect.amount.value}{clause.rule
									.definition.effect.amount.type === 'PERCENTAGE'
									? '%'
									: ' sats'} · {clause.rule.definition.effect.from} → {clause.rule.definition.effect
									.to}
							</small>
						{/if}
					</div>
				{/each}
				<p>
					Ao enviar, cláusulas e política Bitcoin ficam congeladas no conteúdo que todos os
					participantes assinarão.
				</p>
				<div class="row actions">
					<Button disabled={saving || !wallet} onClick={finish}
						>{saving ? 'Enviando…' : 'Enviar para aceite'}</Button
					><Button variant="ghost" disabled={saving} onClick={() => (step = 2)}>Voltar</Button>
				</div>
			</div>
		</Card>
	{/if}
</div>

<style>
	.compact {
		gap: 0.35rem;
	}
	.error {
		padding: 1rem;
		color: var(--rose-text);
		border-color: var(--rose-300);
	}
	.draft-note {
		font-size: 0.82rem;
		overflow-wrap: anywhere;
	}
	.actions,
	.clause-heading {
		justify-content: space-between;
	}
	.mode-tabs {
		display: flex;
		gap: 0.4rem;
		padding: 0.3rem;
		background: var(--gray-100);
		border-radius: var(--radius-md);
	}
	.mode-tabs button {
		flex: 1;
		padding: 0.65rem;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--gray-600);
		font-weight: 600;
	}
	.mode-tabs button.active {
		background: var(--surface);
		color: var(--rose-text);
		box-shadow: var(--shadow-sm);
	}
	.clause-card {
		gap: 0.65rem;
	}
	.clause-type {
		padding: 0.2rem 0.5rem;
		border: 1px solid var(--rose-300);
		border-radius: var(--radius-sm);
		color: var(--rose-text);
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.policy-actions {
		margin-top: 1.5rem;
	}
	.review-grid {
		display: grid;
		grid-template-columns: minmax(8rem, 1fr) minmax(0, 2fr);
		gap: 0.8rem 1rem;
	}
	.policy-hash {
		overflow-wrap: anywhere;
	}
	.review-clause {
		padding: 1rem;
	}
	.review-clause p {
		margin: 0.4rem 0;
	}
	@media (max-width: 640px) {
		.mode-tabs,
		.actions {
			align-items: stretch;
			flex-direction: column;
		}
	}
</style>
