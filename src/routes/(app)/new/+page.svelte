<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		createClause,
		createContract,
		createPenalty,
		submitContract,
		type ClauseKind,
		type PenaltyType
	} from '$lib/api/contracts';
	import type { UserSearchResult } from '$lib/api/users';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Input from '$lib/components/Input.svelte';
	import StepIndicator from '$lib/components/StepIndicator.svelte';
	import UserPicker from '$lib/components/UserPicker.svelte';
	import { authStore } from '$lib/stores/auth';
	import type { AuthSession } from '$lib/types';
	import { onMount } from 'svelte';

	interface LocalPenalty {
		id: string;
		type: PenaltyType;
		value: number;
		condition: string;
		description: string;
	}

	interface LocalClause {
		id: string;
		title: string;
		kind: ClauseKind;
		description: string;
		penalties: LocalPenalty[];
	}

	const steps = ['Participantes', 'Cláusulas', 'Revisão'];
	let session = $state<AuthSession | null>(null);
	let step = $state(0);
	let title = $state('');
	let spouseB = $state<UserSearchResult | null>(null);
	let arbitratorA = $state<UserSearchResult | null>(null);
	let arbitratorB = $state<UserSearchResult | null>(null);
	let neutral = $state<UserSearchResult | null>(null);
	let feeA = $state(0);
	let feeB = $state(0);
	let feeNeutral = $state(0);
	let expiresAt = $state('');
	let clauses = $state<LocalClause[]>([]);
	let clauseTitle = $state('');
	let clauseKind = $state<ClauseKind>('CONCEPT');
	let clauseDescription = $state('');
	let penaltyClauseId = $state('');
	let penaltyType = $state<PenaltyType>('PERCENTAGE');
	let penaltyValue = $state(1);
	let penaltyCondition = $state('');
	let penaltyDescription = $state('');
	let saving = $state(false);
	let error = $state('');
	let createdContractId = $state('');

	onMount(() => authStore.subscribe((value) => (session = value)));

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
			session.user.publicKey.toLowerCase(),
			spouseB.publicKey.toLowerCase(),
			arbitratorA.publicKey.toLowerCase(),
			arbitratorB.publicKey.toLowerCase()
		];
		if (neutral) keys.push(neutral.publicKey.toLowerCase());
		if (new Set(keys).size !== keys.length) {
			throw new Error('Cada participante precisa usar uma chave Nostr diferente.');
		}
		if (neutral && feeNeutral <= 0) {
			throw new Error('Informe a taxa do árbitro neutro.');
		}
		if (!neutral && feeNeutral > 0) {
			throw new Error('Informe o árbitro neutro ou remova a taxa dele.');
		}
		if (feeA + feeB + feeNeutral > 100) {
			throw new Error('A soma das taxas dos árbitros não pode ultrapassar 100%.');
		}
	}

	function nextStep() {
		error = '';
		try {
			if (step === 0) validateParticipants();
			step = Math.min(step + 1, steps.length - 1);
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Revise os dados informados.';
		}
	}

	function addClause() {
		error = '';
		if (!clauseTitle.trim() || !clauseDescription.trim()) {
			error = 'Informe o título e a descrição da cláusula.';
			return;
		}
		clauses.push({
			id: crypto.randomUUID(),
			title: clauseTitle.trim(),
			kind: clauseKind,
			description: clauseDescription.trim(),
			penalties: []
		});
		clauseTitle = '';
		clauseDescription = '';
		clauseKind = 'CONCEPT';
	}

	function removeClause(id: string) {
		clauses = clauses.filter((clause) => clause.id !== id);
		if (penaltyClauseId === id) penaltyClauseId = '';
	}

	function startPenalty(clauseId: string) {
		penaltyClauseId = clauseId;
		penaltyType = 'PERCENTAGE';
		penaltyValue = 1;
		penaltyCondition = '';
		penaltyDescription = '';
	}

	function addPenalty() {
		const clause = clauses.find((item) => item.id === penaltyClauseId);
		if (!clause || penaltyValue <= 0 || !penaltyDescription.trim()) {
			error = 'Informe um valor positivo e descreva a penalidade.';
			return;
		}
		clause.penalties.push({
			id: crypto.randomUUID(),
			type: penaltyType,
			value: penaltyValue,
			condition: penaltyCondition.trim(),
			description: penaltyDescription.trim()
		});
		penaltyClauseId = '';
		error = '';
	}

	function removePenalty(clauseId: string, penaltyId: string) {
		const clause = clauses.find((item) => item.id === clauseId);
		if (clause) clause.penalties = clause.penalties.filter((penalty) => penalty.id !== penaltyId);
	}

	async function save(submitAfterSave: boolean) {
		if (!session || saving || createdContractId) return;
		error = '';
		try {
			validateParticipants();
			if (submitAfterSave && clauses.length === 0) {
				throw new Error('Inclua ao menos uma cláusula antes de enviar para aceite.');
			}
			saving = true;
			const contract = await createContract(session.accessToken, {
				title: title.trim() || null,
				spouseBPublicKey: spouseB!.publicKey,
				arbitratorAPublicKey: arbitratorA!.publicKey,
				arbitratorBPublicKey: arbitratorB!.publicKey,
				arbitratorNeutralPublicKey: neutral?.publicKey || null,
				feePercArbitratorA: feeA,
				feePercArbitratorB: feeB,
				feePercArbitratorNeutral: neutral ? feeNeutral : null,
				expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
			});
			createdContractId = contract.id;

			for (const [position, clause] of clauses.entries()) {
				const savedClause = await createClause(session.accessToken, contract.id, {
					title: clause.title,
					kind: clause.kind,
					description: clause.description,
					position
				});
				for (const penalty of clause.penalties) {
					await createPenalty(session.accessToken, contract.id, savedClause.id, {
						type: penalty.type,
						value: penalty.value,
						condition: penalty.condition || null,
						description: penalty.description
					});
				}
			}
			if (submitAfterSave) await submitContract(session.accessToken, contract.id);
			await goto(resolve('/(app)/contracts/[id]', { id: contract.id }));
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Não foi possível salvar o contrato.';
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head><title>Nuptalicium — Novo contrato</title></svelte:head>

<div class="stack-lg">
	<div class="stack compact">
		<p class="muted">Novo contrato</p>
		<h1>Construa o acordo</h1>
		<p class="muted">Você será registrado como cônjuge A.</p>
		<p class="muted">Os demais participantes precisam ter uma conta ativa no Nuptalicium.</p>
	</div>
	<StepIndicator {steps} activeIndex={step} />

	{#if error}
		<div class="error surface">{error}</div>
	{/if}
	{#if createdContractId && error}
		<div class="notice surface-gray">
			<p>
				O rascunho foi criado, mas uma etapa posterior falhou. Abra-o para continuar sem duplicar o
				contrato.
			</p>
			<a href={resolve('/(app)/contracts/[id]', { id: createdContractId })}>Continuar no rascunho</a
			>
		</div>
	{/if}

	{#if step === 0}
		<Card>
			<form
				class="stack"
				onsubmit={(event) => {
					event.preventDefault();
					nextStep();
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
				<p class="muted">
					A taxa configurada pela plataforma também entra no limite total de 100% e será validada
					pela API.
				</p>
				<div class="row actions">
					<Button type="submit">Continuar</Button><Button href="/contracts" variant="ghost"
						>Cancelar</Button
					>
				</div>
			</form>
		</Card>
	{:else if step === 1}
		<div class="stack">
			<Card>
				<div class="stack">
					<h2>Adicionar cláusula</h2>
					<Input label="Título" bind:value={clauseTitle} required />
					<label class="field"
						><span class="label">Tipo</span><select bind:value={clauseKind}
							><option value="CONCEPT">Conceito</option><option value="RULE">Regra</option></select
						></label
					>
					<Input label="Descrição" bind:value={clauseDescription} textarea rows={5} required />
					<Button onClick={addClause}>Adicionar cláusula</Button>
				</div>
			</Card>

			{#each clauses as clause, index (clause.id)}
				<Card>
					<div class="stack">
						<div class="row clause-heading">
							<div>
								<span class="pill">{clause.kind === 'RULE' ? 'Regra' : 'Conceito'}</span>
								<h3>{index + 1}. {clause.title}</h3>
							</div>
							<button class="text-button" onclick={() => removeClause(clause.id)}>Remover</button>
						</div>
						<p>{clause.description}</p>
						{#each clause.penalties as penalty (penalty.id)}
							<div class="penalty surface-gray">
								<div>
									<strong
										>{penalty.type === 'PERCENTAGE'
											? `${penalty.value}%`
											: `${penalty.value} sats`}</strong
									>
									<p>{penalty.description}</p>
									{#if penalty.condition}<small>Condição: {penalty.condition}</small>{/if}
								</div>
								<button class="text-button" onclick={() => removePenalty(clause.id, penalty.id)}
									>Remover</button
								>
							</div>
						{/each}
						{#if clause.kind === 'RULE' && penaltyClauseId !== clause.id}<Button
								variant="ghost"
								onClick={() => startPenalty(clause.id)}>Adicionar penalidade</Button
							>{/if}
						{#if penaltyClauseId === clause.id}
							<div class="stack penalty-form surface-gray">
								<label class="field"
									><span class="label">Tipo da penalidade</span><select bind:value={penaltyType}
										><option value="PERCENTAGE">Percentual</option><option value="FIXED_AMOUNT"
											>Valor fixo em sats</option
										></select
									></label
								>
								<Input
									label="Valor"
									bind:value={penaltyValue}
									type="number"
									min={1}
									max={penaltyType === 'PERCENTAGE' ? 100 : undefined}
									step={1}
									required
								/>
								<Input label="Condição (opcional)" bind:value={penaltyCondition} />
								<Input label="Descrição" bind:value={penaltyDescription} textarea required />
								<div class="row">
									<Button onClick={addPenalty}>Salvar penalidade</Button><Button
										variant="ghost"
										onClick={() => (penaltyClauseId = '')}>Fechar</Button
									>
								</div>
							</div>
						{/if}
					</div>
				</Card>
			{/each}
			<div class="row actions">
				<Button onClick={nextStep}>Revisar contrato</Button><Button
					variant="ghost"
					onClick={() => (step = 0)}>Voltar</Button
				>
			</div>
		</div>
	{:else}
		<Card>
			<div class="stack">
				<h2>{title || 'Contrato sem título'}</h2>
				<div class="review-grid">
					<span>Cláusulas</span><strong>{clauses.length}</strong><span>Taxas dos árbitros</span
					><strong>{feeA + feeB + feeNeutral}%</strong><span>Taxa da plataforma</span><strong
						>Definida pela API</strong
					><span>Prazo</span><strong>{expiresAt || 'Sem prazo'}</strong>
				</div>
				<div class="divider"></div>
				<p>
					Ao enviar para aceite, o conteúdo fica congelado e cada participante deverá assinar o hash
					atual com sua identidade Nostr.
				</p>
				<div class="row actions">
					<Button disabled={saving} onClick={() => save(true)}
						>{saving ? 'Salvando…' : 'Salvar e enviar para aceite'}</Button
					><Button variant="ghost" disabled={saving} onClick={() => save(false)}
						>Somente salvar rascunho</Button
					><Button variant="ghost" disabled={saving} onClick={() => (step = 1)}>Voltar</Button>
				</div>
			</div>
		</Card>
	{/if}
</div>

<style>
	.compact {
		gap: 0.35rem;
	}
	.error,
	.notice,
	.penalty-form {
		padding: 1rem;
	}
	.error {
		color: var(--rose-text);
		border-color: var(--rose-300);
	}
	.notice a {
		color: var(--rose-text);
		text-decoration: underline;
	}
	.field {
		display: grid;
		gap: 0.4rem;
	}
	.label {
		color: var(--gray-500);
		font-size: 0.69rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	select {
		width: 100%;
		padding: 0.9rem 1rem;
		border-radius: 12px;
		border: 1px solid var(--border-gray);
		background: var(--gray-bg);
		color: var(--gray-900);
	}
	.actions,
	.clause-heading {
		justify-content: space-between;
	}
	.clause-heading {
		align-items: start;
	}
	.clause-heading h3 {
		margin-top: 0.65rem;
	}
	.text-button {
		border: 0;
		background: transparent;
		color: var(--rose-text);
		padding: 0;
	}
	.penalty {
		padding: 0.9rem;
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}
	.review-grid {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.75rem 1rem;
	}
</style>
