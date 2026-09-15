<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		acceptContract,
		cancelContract,
		createClause,
		createPenalty,
		deleteClause,
		deletePenalty,
		getContract,
		submitContract,
		updateClause,
		updateContract,
		updatePenalty,
		type ClauseKind,
		type Contract,
		type ContractClause,
		type ContractParticipant,
		type ContractStatus,
		type ParticipantRole,
		type PenaltyType
	} from '$lib/api/contracts';
	import type { UserSearchResult } from '$lib/api/users';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Input from '$lib/components/Input.svelte';
	import UserPicker from '$lib/components/UserPicker.svelte';
	import { pubkeyToNpub, signContractAcceptance } from '$lib/nostr';
	import { authStore } from '$lib/stores/auth';
	import type { AuthSession } from '$lib/types';
	import { onMount } from 'svelte';

	let { data }: { data: { contractId: string } } = $props();
	const statusLabels: Record<ContractStatus, string> = {
		DRAFT: 'Rascunho',
		PENDING_ACCEPTANCE: 'Aguardando aceite',
		ACTIVE: 'Ativo',
		CLOSED: 'Encerrado',
		CANCELLED: 'Cancelado',
		EXPIRED: 'Expirado'
	};
	const roleLabels: Record<ParticipantRole, string> = {
		SPOUSE_A: 'Cônjuge A',
		SPOUSE_B: 'Cônjuge B',
		ARBITRATOR_A: 'Árbitro A',
		ARBITRATOR_B: 'Árbitro B',
		ARBITRATOR_NEUTRAL: 'Árbitro neutro'
	};

	let session = $state<AuthSession | null>(null);
	let contract = $state<Contract | null>(null);
	let loading = $state(true);
	let busy = $state(false);
	let error = $state('');
	let success = $state('');
	let editingDetails = $state(false);
	let title = $state('');
	let spouseB = $state<UserSearchResult | null>(null);
	let arbitratorA = $state<UserSearchResult | null>(null);
	let arbitratorB = $state<UserSearchResult | null>(null);
	let neutral = $state<UserSearchResult | null>(null);
	let feeA = $state(0);
	let feeB = $state(0);
	let feeNeutral = $state(0);
	let expiresAt = $state('');
	let editingClauseId = $state('');
	let clauseTitle = $state('');
	let clauseKind = $state<ClauseKind>('CONCEPT');
	let clauseDescription = $state('');
	let editingPenaltyId = $state('');
	let penaltyClauseId = $state('');
	let penaltyType = $state<PenaltyType>('PERCENTAGE');
	let penaltyValue = $state(1);
	let penaltyCondition = $state('');
	let penaltyDescription = $state('');

	onMount(() => {
		const unsubscribe = authStore.subscribe((value) => {
			session = value;
			if (value) void load(value);
		});
		return unsubscribe;
	});

	async function load(currentSession = session) {
		if (!currentSession) return;
		loading = true;
		error = '';
		try {
			contract = await getContract(currentSession.accessToken, data.contractId);
		} catch (caught) {
			error = messageOf(caught, 'Não foi possível carregar o contrato.');
		} finally {
			loading = false;
		}
	}

	function messageOf(caught: unknown, fallback: string) {
		return caught instanceof Error ? caught.message : fallback;
	}

	function participant(role: ParticipantRole) {
		return contract?.participants.find((item) => item.role === role);
	}

	function me() {
		return contract?.participants.find(
			(item) => item.publicKey.toLowerCase() === session?.user.publicKey.toLowerCase()
		);
	}

	function isSpouse() {
		return me()?.role === 'SPOUSE_A' || me()?.role === 'SPOUSE_B';
	}

	function formatIdentity(person: ContractParticipant | undefined) {
		if (!person) return 'Não informado';
		return person.displayName || pubkeyToNpub(person.publicKey);
	}

	function formatDate(value: string | null) {
		return value
			? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(
					new Date(value)
				)
			: 'Sem prazo';
	}

	function toLocalDateTime(value: string | null) {
		if (!value) return '';
		const date = new Date(value);
		const offset = date.getTimezoneOffset() * 60000;
		return new Date(date.getTime() - offset).toISOString().slice(0, 16);
	}

	function beginDetailsEdit() {
		if (!contract) return;
		title = contract.title || '';
		spouseB = toSearchResult(participant('SPOUSE_B'));
		arbitratorA = toSearchResult(participant('ARBITRATOR_A'));
		arbitratorB = toSearchResult(participant('ARBITRATOR_B'));
		neutral = toSearchResult(participant('ARBITRATOR_NEUTRAL'));
		feeA = contract.feePercArbitratorA;
		feeB = contract.feePercArbitratorB;
		feeNeutral = contract.feePercArbitratorNeutral || 0;
		expiresAt = toLocalDateTime(contract.expiresAt);
		editingDetails = true;
	}

	function toSearchResult(person: ContractParticipant | undefined): UserSearchResult | null {
		return person
			? { id: person.id, publicKey: person.publicKey, displayName: person.displayName }
			: null;
	}

	function excludedKeys(current: UserSearchResult | null) {
		return [
			session?.user.publicKey,
			...[spouseB, arbitratorA, arbitratorB, neutral]
				.filter((user) => user && user !== current)
				.map((user) => user!.publicKey)
		].filter((key): key is string => Boolean(key));
	}

	async function saveDetails() {
		if (!contract || !session) return;
		if (!spouseB || !arbitratorA || !arbitratorB) {
			error = 'Selecione o outro cônjuge e os dois árbitros obrigatórios.';
			return;
		}
		if ((neutral && feeNeutral <= 0) || (!neutral && feeNeutral > 0)) {
			error = 'O árbitro neutro e sua taxa devem ser informados juntos.';
			return;
		}
		await perform(async () => {
			contract = await updateContract(session!.accessToken, contract!.id, {
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
			editingDetails = false;
			success = 'Dados do contrato atualizados.';
		});
	}

	function resetClauseForm() {
		editingClauseId = '';
		clauseTitle = '';
		clauseKind = 'CONCEPT';
		clauseDescription = '';
	}

	function editClause(clause: ContractClause) {
		editingClauseId = clause.id;
		clauseTitle = clause.title;
		clauseKind = clause.kind;
		clauseDescription = clause.description;
	}

	async function saveClause() {
		if (!contract || !session || !clauseTitle.trim() || !clauseDescription.trim()) {
			error = 'Informe título e descrição da cláusula.';
			return;
		}
		await perform(async () => {
			const payload = {
				title: clauseTitle.trim(),
				kind: clauseKind,
				description: clauseDescription.trim(),
				position: editingClauseId
					? contract!.clauses.find((item) => item.id === editingClauseId)!.position
					: contract!.clauses.length
			};
			if (editingClauseId)
				await updateClause(session!.accessToken, contract!.id, editingClauseId, payload);
			else await createClause(session!.accessToken, contract!.id, payload);
			resetClauseForm();
			await refresh();
			success = 'Cláusula salva.';
		});
	}

	async function removeClause(clauseId: string) {
		if (!confirm('Remover esta cláusula e suas penalidades?')) return;
		await perform(async () => {
			await deleteClause(session!.accessToken, contract!.id, clauseId);
			await refresh();
			success = 'Cláusula removida.';
		});
	}

	function resetPenaltyForm() {
		editingPenaltyId = '';
		penaltyClauseId = '';
		penaltyType = 'PERCENTAGE';
		penaltyValue = 1;
		penaltyCondition = '';
		penaltyDescription = '';
	}

	function beginPenalty(clauseId: string, penalty?: ContractClause['penalties'][number]) {
		penaltyClauseId = clauseId;
		editingPenaltyId = penalty?.id || '';
		penaltyType = penalty?.type || 'PERCENTAGE';
		penaltyValue = penalty?.value || 1;
		penaltyCondition = penalty?.condition || '';
		penaltyDescription = penalty?.description || '';
	}

	async function savePenalty() {
		if (
			!contract ||
			!session ||
			!penaltyClauseId ||
			penaltyValue <= 0 ||
			!penaltyDescription.trim()
		) {
			error = 'Informe um valor positivo e a descrição da penalidade.';
			return;
		}
		await perform(async () => {
			const payload = {
				type: penaltyType,
				value: penaltyValue,
				condition: penaltyCondition.trim() || null,
				description: penaltyDescription.trim()
			};
			if (editingPenaltyId)
				await updatePenalty(
					session!.accessToken,
					contract!.id,
					penaltyClauseId,
					editingPenaltyId,
					payload
				);
			else await createPenalty(session!.accessToken, contract!.id, penaltyClauseId, payload);
			resetPenaltyForm();
			await refresh();
			success = 'Penalidade salva.';
		});
	}

	async function removePenalty(clauseId: string, penaltyId: string) {
		if (!confirm('Remover esta penalidade?')) return;
		await perform(async () => {
			await deletePenalty(session!.accessToken, contract!.id, clauseId, penaltyId);
			await refresh();
			success = 'Penalidade removida.';
		});
	}

	async function submitForAcceptance() {
		if (!confirm('Enviar o contrato para aceite? O conteúdo não poderá mais ser editado.')) return;
		await perform(async () => {
			contract = await submitContract(session!.accessToken, contract!.id);
			success = 'Contrato enviado para aceite.';
		});
	}

	async function accept() {
		await perform(async () => {
			const event = await signContractAcceptance(contract!.id, contract!.payloadHash);
			contract = await acceptContract(session!.accessToken, contract!.id, event);
			success = 'Seu aceite foi registrado.';
		});
	}

	async function cancel() {
		if (!confirm('Cancelar este contrato? Essa ação não pode ser desfeita.')) return;
		await perform(async () => {
			contract = await cancelContract(session!.accessToken, contract!.id);
			success = 'Contrato cancelado.';
		});
	}

	async function refresh() {
		contract = await getContract(session!.accessToken, data.contractId);
	}

	async function perform(action: () => Promise<void>) {
		if (busy) return;
		busy = true;
		error = '';
		success = '';
		try {
			await action();
		} catch (caught) {
			error = messageOf(caught, 'Não foi possível concluir a operação.');
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Nuptalicium — Contrato</title></svelte:head>

{#if loading}
	<Card><p>Carregando contrato…</p></Card>
{:else if error && !contract}
	<Card
		><div class="stack">
			<p class="error">{error}</p>
			<Button href="/contracts" variant="ghost">Voltar</Button>
		</div></Card
	>
{:else if contract}
	<div class="stack-lg">
		<section class="stack compact">
			<a class="back" href={resolve('/contracts')}>← Contratos</a>
			<div class="row heading">
				<h1>{contract.title || 'Contrato sem título'}</h1>
				<span class="pill">{statusLabels[contract.status]}</span>
			</div>
			<p class="muted">Criado em {formatDate(contract.issuedAt)}</p>
		</section>

		{#if error}<div class="message error surface">{error}</div>{/if}
		{#if success}<div class="message success surface">{success}</div>{/if}

		<Card>
			<div class="stack">
				<div class="row heading">
					<h2>Participantes e condições</h2>
					{#if contract.status === 'DRAFT' && isSpouse() && !editingDetails}<Button
							variant="ghost"
							onClick={beginDetailsEdit}>Editar</Button
						>{/if}
				</div>
				{#if editingDetails}
					<Input label="Título" bind:value={title} />
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
						/><Input
							label="Taxa A (%)"
							bind:value={feeA}
							type="number"
							min={0}
							max={100}
							step={0.01}
						/><UserPicker
							label="Árbitro B"
							bind:value={arbitratorB}
							accessToken={session?.accessToken || ''}
							excludePublicKeys={excludedKeys(arbitratorB)}
							required
						/><Input
							label="Taxa B (%)"
							bind:value={feeB}
							type="number"
							min={0}
							max={100}
							step={0.01}
						/><UserPicker
							label="Árbitro neutro"
							bind:value={neutral}
							accessToken={session?.accessToken || ''}
							excludePublicKeys={excludedKeys(neutral)}
						/><Input
							label="Taxa neutra (%)"
							bind:value={feeNeutral}
							type="number"
							min={0}
							max={100}
							step={0.01}
						/>
					</div>
					<Input label="Prazo" bind:value={expiresAt} type="datetime-local" />
					<div class="row">
						<Button disabled={busy} onClick={saveDetails}>Salvar</Button><Button
							variant="ghost"
							onClick={() => (editingDetails = false)}>Descartar</Button
						>
					</div>
				{:else}
					<div class="participants">
						{#each contract.participants as person (person.id)}
							<div class="participant">
								<div>
									<strong>{roleLabels[person.role]}</strong>
									<p class="mono identity">{formatIdentity(person)}</p>
								</div>
								<span class:accepted={person.accepted} class="acceptance"
									>{person.accepted ? 'Aceito' : 'Pendente'}</span
								>
							</div>
						{/each}
					</div>
					<div class="fees">
						<span>Árbitro A: {contract.feePercArbitratorA}%</span><span
							>Árbitro B: {contract.feePercArbitratorB}%</span
						>{#if contract.feePercArbitratorNeutral !== null}<span
								>Neutro: {contract.feePercArbitratorNeutral}%</span
							>{/if}<span>Plataforma: {contract.platformFeePerc}%</span>
					</div>
					<p class="muted">Prazo para aceite: {formatDate(contract.expiresAt)}</p>
				{/if}
				<details>
					<summary>Integridade do contrato</summary>
					<p class="mono hash">{contract.payloadHash}</p>
				</details>
			</div>
		</Card>

		<section class="stack">
			<div class="row heading">
				<h2>Cláusulas</h2>
				<span class="muted">{contract.clauses.length} item(ns)</span>
			</div>
			{#each contract.clauses as clause, index (clause.id)}
				<Card>
					<div class="stack">
						<div class="row heading">
							<div>
								<span class="pill">{clause.kind === 'RULE' ? 'Regra' : 'Conceito'}</span>
								<h3 class="clause-title">{index + 1}. {clause.title}</h3>
							</div>
							{#if contract.status === 'DRAFT' && isSpouse()}<div class="row">
									<button class="text-button" onclick={() => editClause(clause)}>Editar</button
									><button class="text-button" onclick={() => removeClause(clause.id)}
										>Remover</button
									>
								</div>{/if}
						</div>
						<p>{clause.description}</p>
						{#each clause.penalties as penalty (penalty.id)}<div class="penalty surface-gray">
								<div>
									<strong
										>{penalty.type === 'PERCENTAGE'
											? `${penalty.value}%`
											: `${penalty.value} sats`}</strong
									>
									<p>{penalty.description}</p>
									{#if penalty.condition}<small>Condição: {penalty.condition}</small>{/if}
								</div>
								{#if contract.status === 'DRAFT' && isSpouse()}<div class="row">
										<button class="text-button" onclick={() => beginPenalty(clause.id, penalty)}
											>Editar</button
										><button
											class="text-button"
											onclick={() => removePenalty(clause.id, penalty.id)}>Remover</button
										>
									</div>{/if}
							</div>{/each}
						{#if clause.kind === 'RULE' && contract.status === 'DRAFT' && isSpouse() && penaltyClauseId !== clause.id}<Button
								variant="ghost"
								onClick={() => beginPenalty(clause.id)}>Adicionar penalidade</Button
							>{/if}
					</div>
				</Card>
			{/each}
			{#if contract.status === 'DRAFT' && isSpouse()}
				<Card
					><div class="stack">
						<h3>{editingClauseId ? 'Editar cláusula' : 'Nova cláusula'}</h3>
						<Input label="Título" bind:value={clauseTitle} /><label class="field"
							><span class="label">Tipo</span><select bind:value={clauseKind}
								><option value="CONCEPT">Conceito</option><option value="RULE">Regra</option
								></select
							></label
						><Input label="Descrição" bind:value={clauseDescription} textarea />
						<div class="row">
							<Button disabled={busy} onClick={saveClause}
								>{editingClauseId ? 'Atualizar' : 'Adicionar'}</Button
							>{#if editingClauseId}<Button variant="ghost" onClick={resetClauseForm}
									>Cancelar edição</Button
								>{/if}
						</div>
					</div></Card
				>
			{/if}
		</section>

		{#if penaltyClauseId}
			<Card
				><div class="stack">
					<h3>{editingPenaltyId ? 'Editar penalidade' : 'Nova penalidade'}</h3>
					<label class="field"
						><span class="label">Tipo</span><select bind:value={penaltyType}
							><option value="PERCENTAGE">Percentual</option><option value="FIXED_AMOUNT"
								>Valor fixo em sats</option
							></select
						></label
					><Input
						label="Valor"
						bind:value={penaltyValue}
						type="number"
						min={1}
						max={penaltyType === 'PERCENTAGE' ? 100 : undefined}
						step={1}
					/><Input label="Condição (opcional)" bind:value={penaltyCondition} /><Input
						label="Descrição"
						bind:value={penaltyDescription}
						textarea
					/>
					<div class="row">
						<Button disabled={busy} onClick={savePenalty}>Salvar</Button><Button
							variant="ghost"
							onClick={resetPenaltyForm}>Cancelar</Button
						>
					</div>
				</div></Card
			>
		{/if}

		<Card>
			<div class="stack">
				<h2>Ações</h2>
				{#if contract.status === 'DRAFT' && isSpouse()}<p>
						Confira participantes, taxas e cláusulas antes de enviar. Após o envio, o conteúdo fica
						congelado.
					</p>
					<div class="row">
						<Button disabled={busy || contract.clauses.length === 0} onClick={submitForAcceptance}
							>Enviar para aceite</Button
						><Button variant="ghost" disabled={busy} onClick={cancel}>Cancelar contrato</Button>
					</div>
				{:else if contract.status === 'PENDING_ACCEPTANCE'}
					{#if me()?.accepted}<p>
							Seu aceite já foi registrado. Ainda faltam {contract.participants.filter(
								(person) => !person.accepted
							).length} participante(s).
						</p>{:else}<p>
							Assine o hash atual usando sua extensão NIP-07. A assinatura será enviada apenas à
							API.
						</p>
						<Button disabled={busy} onClick={accept}
							>{busy ? 'Aguardando assinatura…' : 'Aceitar com Nostr'}</Button
						>{/if}
					{#if isSpouse()}<Button variant="ghost" disabled={busy} onClick={cancel}
							>Cancelar contrato</Button
						>{/if}
				{:else if contract.status === 'ACTIVE'}<p>
						Todos os aceites obrigatórios foram registrados e o contrato está ativo.
					</p>
				{:else}<p>Este contrato não possui ações disponíveis em sua situação atual.</p>{/if}
			</div>
		</Card>
	</div>
{/if}

<style>
	.compact {
		gap: 0.35rem;
	}
	.heading {
		justify-content: space-between;
		align-items: start;
	}
	.back,
	.text-button {
		color: var(--rose-text);
	}
	.message {
		padding: 1rem;
	}
	.error {
		color: var(--rose-text);
	}
	.success {
		color: #386641;
		border-color: rgba(56, 102, 65, 0.3);
	}
	.participants {
		display: grid;
		gap: 0.75rem;
	}
	.participant,
	.penalty {
		display: flex;
		justify-content: space-between;
		align-items: start;
		gap: 1rem;
		padding: 0.85rem 0;
		border-bottom: 1px solid var(--border-gray);
	}
	.identity,
	.hash {
		overflow-wrap: anywhere;
	}
	.identity {
		color: var(--gray-500);
	}
	.acceptance {
		color: var(--gray-500);
	}
	.acceptance.accepted {
		color: #386641;
	}
	.fees {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		color: var(--gray-500);
	}
	details summary {
		cursor: pointer;
	}
	.hash {
		margin-top: 0.75rem;
	}
	.clause-title {
		margin-top: 0.65rem;
	}
	.penalty {
		padding: 0.85rem;
		border: 0;
		border-radius: 10px;
	}
	.text-button {
		border: 0;
		background: transparent;
		padding: 0;
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
</style>
