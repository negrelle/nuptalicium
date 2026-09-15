<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Input from '$lib/components/Input.svelte';
	import QRCode from '$lib/components/QRCode.svelte';
	import StepIndicator from '$lib/components/StepIndicator.svelte';
	import { createContractWallet } from '$lib/bitcoin';
	import { buildContractRecord, generateContractDocument, sha256Hex } from '$lib/contract';
	import { fetchAddressBalance } from '$lib/mempool';
	import { npubToPubkey, signAndPublishEvent, makeContractTags } from '$lib/nostr';
	import { upsertContract } from '$lib/stores/contract';
	import { identityStore } from '$lib/stores/identity';
	import type { WizardState } from '$lib/stores/wizard';
	import { setPublishedArtifact, setPublishingState, wizardStore } from '$lib/stores/wizard';
	import type { ContractArtifact, ContractDraft, Identity } from '$lib/types';
	import { onMount } from 'svelte';
	import { networks } from 'bitcoinjs-lib';

	const stepLabels = [
		'Partes',
		'Árbitros',
		'Colateral',
		'Duração',
		'Dissolução',
		'Cláusulas',
		'Revisão'
	];

	let wizard = $state<WizardState>({
		step: 0,
		draft: {
			version: 1 as const,
			contract_title: '',
			npub_a: '',
			npub_b: '',
			arbitrator_a: '',
			arbitrator_b: '',
			arbitrator_neutral: '',
			has_initial_collateral: false,
			collateral_sats_a: 0,
			collateral_sats_b: 0,
			has_periodic_contributions: false,
			frequency: 'monthly',
			contribution_sats_a: 0,
			contribution_sats_b: 0,
			grace_days: 7,
			duration_type: 'indefinite',
			duration_years: 0,
			has_deadmans_switch: false,
			timeout_days: 7,
			heir_address_a: '',
			heir_address_b: '',
			unilateral_dissolution_allowed: false,
			notice_days: 7,
			penalty_sats: 0,
			fidelity_clause: false,
			proof_standard: '',
			custom_clauses: []
		} as ContractDraft,
		contractArtifact: null as ContractArtifact | null,
		publishError: '',
		publishing: false
	});

	let identity = $state<Identity | null>(null);
	let reviewDocument = $state('');
	let reviewHash = $state('');
	let draftContent = $state('');
	let publishMessage = $state('');

	onMount(() => {
		const unsubIdentity = identityStore.subscribe((value) => {
			identity = value;
			if (value?.npub && !wizard.draft.npub_a) {
				wizard.draft.npub_a = value.npub;
				commitWizard();
			}
		});

		const unsubWizard = wizardStore.subscribe((value) => {
			wizard = value;
		});

		return () => {
			unsubIdentity();
			unsubWizard();
		};
	});

	function commitWizard() {
		wizardStore.set(JSON.parse(JSON.stringify(wizard)));
	}

	function nextStep() {
		if (wizard.step < stepLabels.length - 1) {
			wizard.step += 1;
			commitWizard();
		}
	}

	function previousStep() {
		if (wizard.step > 0) {
			wizard.step -= 1;
			commitWizard();
		}
	}

	function addClause() {
		wizard.draft.custom_clauses = [
			...wizard.draft.custom_clauses,
			{ title: '', description: '', proof_standard: '' }
		];
		commitWizard();
	}

	function removeClause(index: number) {
		wizard.draft.custom_clauses = wizard.draft.custom_clauses.filter(
			(_, clauseIndex) => clauseIndex !== index
		);
		commitWizard();
	}

	async function prepareReview() {
		draftContent = JSON.stringify(wizard.draft);
		reviewHash = await sha256Hex(draftContent);
		reviewDocument = generateContractDocument(wizard.draft);
	}

	async function publishContract() {
		wizard.publishError = '';
		wizard.publishing = true;
		commitWizard();

		try {
			const canonicalJson = JSON.stringify(wizard.draft);
			const hashHex = await sha256Hex(canonicalJson);
			const parties = [npubToPubkey(wizard.draft.npub_a), npubToPubkey(wizard.draft.npub_b)] as [
				string,
				string
			];
			const arbitrators = [
				npubToPubkey(wizard.draft.arbitrator_a),
				npubToPubkey(wizard.draft.arbitrator_b),
				npubToPubkey(wizard.draft.arbitrator_neutral)
			] as [string, string, string];
			const wallet = createContractWallet(parties, arbitrators, 2, networks.bitcoin);
			const signed = await signAndPublishEvent(
				canonicalJson,
				30000,
				makeContractTags(wizard.draft, hashHex),
				identity?.relayUrl
			);
			const balanceSats = await fetchAddressBalance(wallet.multisigAddress);

			const artifact: ContractArtifact = {
				eventId: signed.id,
				contractHash: hashHex,
				multisigAddress: wallet.multisigAddress,
				multisigRedeemHex: wallet.multisigRedeemHex,
				multisigScriptHex: wallet.multisigScriptHex,
				partyAddresses: wallet.partyAddresses,
				balanceSats,
				status: 'active'
			};

			setPublishedArtifact(artifact);
			upsertContract(buildContractRecord(artifact, wizard.draft, wizard.draft.npub_b));
			publishMessage = 'Contrato publicado com sucesso.';
			await prepareReview();
			wizard.step = 6;
			commitWizard();
		} catch (caught) {
			wizard.publishError =
				caught instanceof Error ? caught.message : 'Não foi possível publicar o contrato.';
			setPublishingState(false, wizard.publishError);
			commitWizard();
			return;
		}

		setPublishingState(false);
		commitWizard();
	}

	function onFieldChange() {
		commitWizard();
	}

	$effect(() => {
		void prepareReview();
	});
</script>

<svelte:head>
	<title>Nupatalicium — Novo contrato</title>
</svelte:head>

<main class="stack-lg">
	<section class="stack">
		<div class="stack" style="gap: 0.75rem;">
			<p class="muted">Criar contrato</p>
			<h1>Wizard de 7 etapas</h1>
		</div>
		<StepIndicator steps={stepLabels} activeIndex={wizard.step} />
	</section>

	<Card>
		<div class="stack step-fade-enter">
			{#if wizard.step === 0}
				<div class="stack">
					<Input
						label="npub_a"
						bind:value={wizard.draft.npub_a}
						description="Preenchido automaticamente com a identidade conectada."
					/>
					<Input
						label="npub_b"
						bind:value={wizard.draft.npub_b}
						description="Formato esperado: npub1..."
					/>
					<Input
						label="Título do contrato"
						bind:value={wizard.draft.contract_title}
						description="Opcional."
					/>
				</div>
			{:else if wizard.step === 1}
				<div class="stack">
					<Input label="Árbitro de A" bind:value={wizard.draft.arbitrator_a} />
					<Input label="Árbitro de B" bind:value={wizard.draft.arbitrator_b} />
					<Input label="Árbitro neutro" bind:value={wizard.draft.arbitrator_neutral} />
				</div>
			{:else if wizard.step === 2}
				<div class="stack">
					<label class="field-toggle">
						<span class="label">Colateral inicial</span>
						<input
							type="checkbox"
							bind:checked={wizard.draft.has_initial_collateral}
							oninput={onFieldChange}
						/>
					</label>
					{#if wizard.draft.has_initial_collateral}
						<div class="grid-2">
							<Input
								label="Collateral sats A"
								type="number"
								bind:value={wizard.draft.collateral_sats_a}
							/>
							<Input
								label="Collateral sats B"
								type="number"
								bind:value={wizard.draft.collateral_sats_b}
							/>
						</div>
					{/if}

					<label class="field-toggle">
						<span class="label">Contribuições periódicas</span>
						<input
							type="checkbox"
							bind:checked={wizard.draft.has_periodic_contributions}
							oninput={onFieldChange}
						/>
					</label>
					{#if wizard.draft.has_periodic_contributions}
						<div class="stack">
							<div class="grid-2">
								<label class="field">
									<span class="label">Frequência</span>
									<select
										class="control"
										bind:value={wizard.draft.frequency}
										oninput={onFieldChange}
									>
										<option value="monthly">monthly</option>
										<option value="quarterly">quarterly</option>
										<option value="annual">annual</option>
									</select>
								</label>
								<Input
									label="Contribuição A"
									type="number"
									bind:value={wizard.draft.contribution_sats_a}
								/>
								<Input
									label="Contribuição B"
									type="number"
									bind:value={wizard.draft.contribution_sats_b}
								/>
								<Input label="Grace days" type="number" bind:value={wizard.draft.grace_days} />
							</div>
						</div>
					{/if}
				</div>
			{:else if wizard.step === 3}
				<div class="stack">
					<label class="field">
						<span class="label">Tipo de duração</span>
						<select class="control" bind:value={wizard.draft.duration_type} oninput={onFieldChange}>
							<option value="indefinite">indefinite</option>
							<option value="fixed">fixed</option>
						</select>
					</label>
					{#if wizard.draft.duration_type === 'fixed'}
						<Input label="Duração em anos" type="number" bind:value={wizard.draft.duration_years} />
					{/if}

					<label class="field-toggle">
						<span class="label">Dead man's switch</span>
						<input
							type="checkbox"
							bind:checked={wizard.draft.has_deadmans_switch}
							oninput={onFieldChange}
						/>
					</label>
					{#if wizard.draft.has_deadmans_switch}
						<div class="stack">
							<div class="grid-2">
								<Input label="Timeout days" type="number" bind:value={wizard.draft.timeout_days} />
								<Input
									label="Herdeiro A"
									bind:value={wizard.draft.heir_address_a}
									description="Endereço Bitcoin bc1..."
								/>
								<Input
									label="Herdeiro B"
									bind:value={wizard.draft.heir_address_b}
									description="Endereço Bitcoin bc1..."
								/>
							</div>
						</div>
					{/if}
				</div>
			{:else if wizard.step === 4}
				<div class="stack">
					<label class="field-toggle">
						<span class="label">Dissolução unilateral permitida</span>
						<input
							type="checkbox"
							bind:checked={wizard.draft.unilateral_dissolution_allowed}
							oninput={onFieldChange}
						/>
					</label>
					{#if wizard.draft.unilateral_dissolution_allowed}
						<div class="grid-2">
							<Input label="Aviso em dias" type="number" bind:value={wizard.draft.notice_days} />
							<Input
								label="Penalidade em sats"
								type="number"
								bind:value={wizard.draft.penalty_sats}
							/>
						</div>
					{/if}
				</div>
			{:else if wizard.step === 5}
				<div class="stack">
					<label class="field-toggle">
						<span class="label">Cláusula de fidelidade</span>
						<input
							type="checkbox"
							bind:checked={wizard.draft.fidelity_clause}
							oninput={onFieldChange}
						/>
					</label>
					{#if wizard.draft.fidelity_clause}
						<Input
							textarea
							label="Padrão de prova"
							bind:value={wizard.draft.proof_standard}
							rows={4}
						/>
					{/if}

					<div class="stack">
						<div class="row" style="justify-content: space-between;">
							<h3>Cláusulas personalizadas</h3>
							<Button variant="ghost" onClick={addClause}>Adicionar cláusula</Button>
						</div>

						{#each wizard.draft.custom_clauses as clause, index (clause)}
							<Card>
								<div class="stack">
									<Input label="Título" bind:value={clause.title} />
									<Input textarea label="Descrição" bind:value={clause.description} rows={3} />
									<Input
										textarea
										label="Padrão de prova"
										bind:value={clause.proof_standard}
										rows={3}
									/>
									<Button variant="ghost" onClick={() => removeClause(index)}>Remover</Button>
								</div>
							</Card>
						{/each}
					</div>
				</div>
			{:else}
				<div class="stack">
					<Card>
						<div class="stack">
							<h2>Documento do contrato</h2>
							<pre class="document">{reviewDocument}</pre>
						</div>
					</Card>

					<Card>
						<div class="stack">
							<h3>Hash SHA-256</h3>
							<p class="mono pill">{reviewHash}</p>
						</div>
					</Card>

					{#if wizard.contractArtifact}
						<Card>
							<div class="stack">
								<h3>Endereço multisig</h3>
								<p class="mono">{wizard.contractArtifact.multisigAddress}</p>
								<QRCode value={wizard.contractArtifact.multisigAddress} />
								<p class="muted">Saldo atual: {wizard.contractArtifact.balanceSats} sats</p>
								{#if publishMessage}
									<p>{publishMessage}</p>
								{/if}
							</div>
						</Card>
					{/if}

					{#if wizard.publishError}
						<Card><p>{wizard.publishError}</p></Card>
					{/if}
				</div>
			{/if}
		</div>
	</Card>

	<div class="row">
		<Button variant="ghost" onClick={previousStep} disabled={wizard.step === 0}>Voltar</Button>
		{#if wizard.step < 6}
			<Button onClick={nextStep}>Continuar</Button>
		{:else}
			<Button onClick={publishContract} disabled={wizard.publishing}>
				{wizard.publishing ? 'Publicando…' : 'Assinar e publicar'}
			</Button>
		{/if}
		<Button variant="ghost" href="/contracts">Ir para contratos</Button>
	</div>
</main>

<style>
	.field,
	.field-toggle {
		display: grid;
		gap: 0.4rem;
	}

	.field-toggle {
		align-items: center;
		grid-template-columns: 1fr auto;
		padding: 0.85rem 1rem;
		border-radius: 12px;
		border: 1px solid var(--border-gray);
		background: var(--gray-bg);
	}

	.field-toggle input {
		accent-color: var(--rose-400);
	}

	.label {
		color: var(--gray-500);
		font-size: 0.69rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.control {
		width: 100%;
		padding: 0.9rem 1rem;
		border-radius: 12px;
		border: 1px solid var(--border-gray);
		background: var(--gray-bg);
		color: var(--gray-900);
		outline: none;
	}

	.document {
		white-space: pre-wrap;
		font-family: var(--font-mono);
		font-size: 0.9rem;
		line-height: 1.7;
		margin: 0;
	}
</style>
