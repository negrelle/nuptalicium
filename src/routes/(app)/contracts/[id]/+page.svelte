<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		acceptContract,
		cancelContract,
		createClause,
		deleteClause,
		getContract,
		getMultisig,
		initializeMultisig,
		registerFunding,
		refreshFunding,
		submitContract,
		updateClause,
		updateContract,
		updateContractRule,
		type ClauseKind,
		type Contract,
		type ContractClause,
		type ContractParticipant,
		type BitcoinWallet,
		type ParticipantRole
	} from '$lib/api/contracts';
	import { getRuleSchema, previewRule } from '$lib/api/rules';
	import { createContractWallet, createPolicyDocument } from '$lib/bitcoin';
	import type { UserSearchResult } from '$lib/api/users';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import ContractStatusBadge from '$lib/components/ContractStatusBadge.svelte';
	import Input from '$lib/components/Input.svelte';
	import RuleBuilder from '$lib/components/RuleBuilder.svelte';
	import RulePreview from '$lib/components/RulePreview.svelte';
	import UserPicker from '$lib/components/UserPicker.svelte';
	import { formatDateTime } from '$lib/date';
	import { cloneRule, type ContractRulePayload, type RuleSchema } from '$lib/contract-rules';
	import { pubkeyToNpub, signContractAcceptance } from '$lib/nostr';
	import { authStore } from '$lib/stores/auth';
	import type { AuthSession } from '$lib/types';
	import { faAngleLeft, faChevronDown } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { onMount } from 'svelte';
	import { networks } from 'bitcoinjs-lib';

	let { data }: { data: { contractId: string } } = $props();
	const roleLabels: Record<ParticipantRole, string> = {
		SPOUSE_A: 'Cônjuge A',
		SPOUSE_B: 'Cônjuge B',
		ARBITRATOR_A: 'Árbitro A',
		ARBITRATOR_B: 'Árbitro B',
		ARBITRATOR_NEUTRAL: 'Árbitro neutro'
	};

	let session = $state<AuthSession | null>(null);
	let contract = $state<Contract | null>(null);
	let wallet = $state<BitcoinWallet | null>(null);
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
	let editingRuleClauseId = $state('');
	let ruleValue = $state<ContractRulePayload | null>(null);
	let ruleSchema = $state<RuleSchema | null>(null);
	let rulePreview = $state<string | null>(null);
	let previewingRule = $state(false);
	let fundingTxid = $state('');
	let fundingVout = $state(0);

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
			wallet = await getMultisig(currentSession.accessToken, data.contractId).catch(() => null);
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

	async function beginRuleEdit(clause: ContractClause) {
		if (!session || !clause.rule) return;
		error = '';
		try {
			ruleSchema ??= await getRuleSchema(session.accessToken);
			ruleValue = cloneRule({
				dslVersion: clause.rule.dslVersion,
				definition: clause.rule.definition
			});
			editingRuleClauseId = clause.id;
			rulePreview = clause.description;
		} catch (caught) {
			error = messageOf(caught, 'Não foi possível abrir o editor da regra.');
		}
	}

	async function previewEditedRule() {
		if (!session || !contract || !ruleValue || !editingRuleClauseId) return;
		const clause = contract.clauses.find((item) => item.id === editingRuleClauseId);
		if (!clause) return;
		previewingRule = true;
		try {
			const preview = await previewRule(session.accessToken, clause.title, ruleValue);
			rulePreview = preview.description;
			if (!preview.valid) error = preview.errors.map((item) => item.message).join(' ');
		} catch (caught) {
			error = messageOf(caught, 'Não foi possível gerar a prévia.');
		} finally {
			previewingRule = false;
		}
	}

	async function saveRule() {
		if (!session || !contract || !ruleValue || !editingRuleClauseId) return;
		await perform(async () => {
			await updateContractRule(session!.accessToken, contract!.id, editingRuleClauseId, ruleValue!);
			editingRuleClauseId = '';
			ruleValue = null;
			rulePreview = null;
			await refresh();
			success = 'Regra atualizada.';
		});
	}

	async function removeClause(clauseId: string) {
		if (!confirm('Remover esta cláusula?')) return;
		await perform(async () => {
			await deleteClause(session!.accessToken, contract!.id, clauseId);
			await refresh();
			success = 'Cláusula removida.';
		});
	}

	async function submitForAcceptance() {
		if (!confirm('Enviar o contrato para aceite? O conteúdo não poderá mais ser editado.')) return;
		await perform(async () => {
			const { generated, policy } = await generateExpectedPolicy();
			wallet = await initializeMultisig(session!.accessToken, contract!.id, {
				network: 'testnet4',
				address: generated.multisigAddress,
				scriptPubKey: generated.multisigScriptHex,
				policyHash: policy.policyHash,
				policyDocument: policy.policyDocument,
				arbitratorsQuorum: 2
			});
			contract = await submitContract(session!.accessToken, contract!.id);
			success = 'Contrato enviado para aceite.';
		});
	}

	async function addFundingTransaction() {
		if (!contract || !session) return;
		await perform(async () => {
			wallet = await registerFunding(
				session!.accessToken,
				contract!.id,
				fundingTxid.trim(),
				fundingVout
			);
			fundingTxid = '';
			contract = await getContract(session!.accessToken, contract!.id);
			success = 'Depósito localizado no Bitcoin Core.';
		});
	}

	async function updateFunding() {
		if (!contract || !session) return;
		await perform(async () => {
			wallet = await refreshFunding(session!.accessToken, contract!.id);
			contract = await getContract(session!.accessToken, contract!.id);
			success = 'Confirmações atualizadas.';
		});
	}

	async function accept() {
		await perform(async () => {
			if (!wallet) throw new Error('A política Bitcoin do contrato não foi encontrada.');
			const { generated, policy } = await generateExpectedPolicy();
			if (
				generated.multisigAddress !== wallet.address ||
				generated.multisigScriptHex !== wallet.scriptPubKey ||
				policy.policyHash !== wallet.policyHash
			) {
				throw new Error('A política Bitcoin não corresponde aos participantes deste contrato.');
			}
			const event = await signContractAcceptance(contract!.id, contract!.payloadHash);
			contract = await acceptContract(session!.accessToken, contract!.id, event);
			success = 'Seu aceite foi registrado.';
		});
	}

	async function generateExpectedPolicy() {
		const spouseKeys = [participant('SPOUSE_A')!.publicKey, participant('SPOUSE_B')!.publicKey] as [
			string,
			string
		];
		const arbitratorKeys = [
			participant('ARBITRATOR_A')!.publicKey,
			participant('ARBITRATOR_B')!.publicKey,
			participant('ARBITRATOR_NEUTRAL')?.publicKey
		].filter((key): key is string => Boolean(key));
		const generated = createContractWallet(spouseKeys, arbitratorKeys, 2, networks.testnet);
		return { generated, policy: await createPolicyDocument(spouseKeys, arbitratorKeys, generated) };
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
			<a class="back" href={resolve('/contracts')}>
				<FontAwesomeIcon icon={faAngleLeft} />
				<span>Contratos</span>
			</a>
			<div class="row heading">
				<h1>{contract.title || 'Contrato sem título'}</h1>
				<ContractStatusBadge status={contract.status} />
			</div>
			<p class="muted">Criado em {formatDateTime(contract.issuedAt, 'Data indisponível')}</p>
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
									<p class="technical identity">{formatIdentity(person)}</p>
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
					<p class="muted">Prazo para aceite: {formatDateTime(contract.expiresAt)}</p>
				{/if}
				<details>
					<summary>
						<span>Integridade do contrato</span>
						<span class="summary-icon" aria-hidden="true">
							<FontAwesomeIcon icon={faChevronDown} />
						</span>
					</summary>
					<p class="technical hash">{contract.payloadHash}</p>
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
									{#if clause.kind === 'CONCEPT'}<button
											class="text-button"
											onclick={() => editClause(clause)}>Editar</button
										>{/if}
									{#if clause.rule}<button
											class="text-button"
											onclick={() => void beginRuleEdit(clause)}>Editar regra</button
										>{/if}
									<button class="text-button" onclick={() => removeClause(clause.id)}
										>Remover</button
									>
								</div>{/if}
						</div>
						<p>{clause.description}</p>
						{#if clause.rule}
							<div class="rule-summary surface-gray">
								<span><strong>Condições:</strong> {clause.rule.definition.conditions.length}</span>
								<span>
									<strong>Efeito:</strong>
									{clause.rule.definition.effect.amount.value}{clause.rule.definition.effect.amount
										.type === 'PERCENTAGE'
										? '%'
										: ' sats'}
								</span>
							</div>
						{/if}
					</div>
				</Card>
			{/each}
			{#if editingRuleClauseId && ruleValue && ruleSchema}
				<Card>
					<div class="stack">
						<h3>Editar regra estruturada</h3>
						<RuleBuilder bind:value={ruleValue} schema={ruleSchema} />
						<Button variant="secondary" disabled={previewingRule} onClick={previewEditedRule}
							>Gerar prévia</Button
						>
						<RulePreview description={rulePreview} loading={previewingRule} />
						<div class="row">
							<Button disabled={busy} onClick={saveRule}>Salvar regra</Button>
							<Button
								variant="ghost"
								onClick={() => {
									editingRuleClauseId = '';
									ruleValue = null;
									rulePreview = null;
								}}>Cancelar</Button
							>
						</div>
					</div>
				</Card>
			{/if}
			{#if contract.status === 'DRAFT' && isSpouse()}
				<Card
					><div class="stack">
						<h3>{editingClauseId ? 'Editar cláusula' : 'Nova cláusula'}</h3>
						<Input label="Título" bind:value={clauseTitle} />
						<input type="hidden" bind:value={clauseKind} />
						<Input label="Descrição do conceito" bind:value={clauseDescription} textarea />
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

		{#if wallet}
			<Card>
				<div class="stack">
					<div class="row heading">
						<h2>Garantia Bitcoin</h2>
						<span class="pill">Testnet4 · {wallet.status}</span>
					</div>
					<p class="muted">Endereço Taproot compartilhado</p>
					<p class="technical hash">{wallet.address}</p>
					<p>
						<strong>{wallet.confirmedBalanceSats.toLocaleString('pt-BR')} sats</strong> confirmados
					</p>
					<p class="muted">
						Um depósito fica disponível após {wallet.requiredConfirmations} confirmações.
					</p>
					{#if !wallet.platformFeeAddress && wallet.platformFeePercent > 0}
						<p class="message error surface">
							O endereço da taxa da plataforma ainda não foi configurado. Não crie um depósito antes
							de definir <span class="technical">PLATFORM_FEE_ADDRESS</span> na API.
						</p>
					{/if}
					{#if contract.status === 'AWAITING_FUNDING' || contract.status === 'ACTIVE'}
						<div class="grid-2">
							<Input label="TXID do depósito" bind:value={fundingTxid} />
							<Input
								label="Índice do output (vout)"
								bind:value={fundingVout}
								type="number"
								min={0}
							/>
						</div>
						<div class="row">
							<Button disabled={busy || fundingTxid.length !== 64} onClick={addFundingTransaction}
								>Registrar depósito</Button
							>
							<Button variant="ghost" disabled={busy} onClick={updateFunding}
								>Atualizar confirmações</Button
							>
						</div>
					{/if}
					{#each wallet.fundingTransactions as transaction (`${transaction.txid}:${transaction.vout}`)}
						<div class="participant">
							<div>
								<strong>{transaction.amountSats.toLocaleString('pt-BR')} sats</strong>
								<p class="technical identity">{transaction.txid}:{transaction.vout}</p>
							</div>
							<span class="acceptance" class:accepted={transaction.status === 'CONFIRMED'}
								>{transaction.confirmations}/{wallet.requiredConfirmations}</span
							>
						</div>
					{/each}
				</div>
			</Card>
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
				{:else if contract.status === 'AWAITING_FUNDING'}<p>
						Todos aceitaram. O contrato será ativado após o primeiro depósito atingir três
						confirmações.
					</p>
				{:else if contract.status === 'ACTIVE'}<p>
						Todos os aceites obrigatórios foram registrados e o contrato está ativo.
					</p>
					{#if isSpouse()}<Button href={`/contracts/${contract.id}/dispute`}
							>Abrir decisão econômica</Button
						>{/if}
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
	.back {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		width: fit-content;
		font-weight: 600;
	}
	.back :global(svg) {
		width: 0.65rem;
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
	.participant {
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
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.35rem 0;
		cursor: pointer;
		font-weight: 600;
		list-style: none;
	}
	details summary::-webkit-details-marker {
		display: none;
	}
	.summary-icon {
		display: inline-flex;
		width: 0.8rem;
		color: var(--gray-500);
		transition: transform 160ms ease;
	}
	details[open] .summary-icon {
		transform: rotate(180deg);
	}
	.hash {
		margin-top: 0.75rem;
	}
	.clause-title {
		margin-top: 0.65rem;
	}
	.rule-summary {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1.5rem;
		padding: 0.85rem;
	}
</style>
