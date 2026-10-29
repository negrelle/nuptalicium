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
		copyPublishedClauseToContract,
		listMyPublishedClauses,
		listPublishedClauses,
		type PublishedClause
	} from '$lib/api/published-clauses';
	import {
		createClause,
		createClauseFromTemplate,
		createContract,
		createCustomRuleClause,
		deleteClause,
		getContractDiagnostics,
		initializeMultisig,
		submitContract,
		updateContract,
		type BitcoinWallet,
		type Contract,
		type ContractClause,
		type ContractDiagnostics,
		type ContractPayload
	} from '$lib/api/contracts';
	import { getRuleSchema, previewRule, validateRule } from '$lib/api/rules';
	import type { UserSearchResult } from '$lib/api/users';
	import { createContractWallet, createPolicyDocument } from '$lib/bitcoin';
	import Button from '$lib/components/Button.svelte';
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
		partyReferenceLabel,
		type ContractRulePayload,
		type RuleSchema
	} from '$lib/contract-rules';
	import { formatDateTime } from '$lib/date';
	import { authStore } from '$lib/stores/auth';
	import { showValidationToast } from '$lib/stores/toast';
	import type { AuthSession } from '$lib/types';
	import {
		AGREEMENT_TOPICS,
		buildBaseDocument,
		defaultAgreementAnswers,
		generateAgreementClauses,
		validateAgreementAnswers,
		visibleQuestions,
		type AgreementAnswers,
		type AgreementTopicId
	} from '$lib/assisted-contract';
	import { onMount } from 'svelte';

	type ClauseMode = 'LIBRARY' | 'TEMPLATE' | 'CUSTOM' | 'CONCEPT';

	const steps = [
		'Título',
		'Cônjuge',
		'Arbitragem',
		'Prazo',
		'Assuntos',
		'Acordos',
		'Adicionais',
		'Revisão'
	];
	let session = $state<AuthSession | null>(null);
	let step = $state(0);
	let arbitrationStep = $state(0);
	let contract = $state<Contract | null>(null);
	let wallet = $state<BitcoinWallet | null>(null);
	let schema = $state<RuleSchema | null>(null);
	let templates = $state<ClauseTemplate[]>([]);
	let libraryItems = $state<PublishedClause[]>([]);
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
	let selectedLibraryId = $state('');
	let templateValues = $state<Record<string, number>>({});
	let previewDescription = $state<string | null>(null);
	let previewing = $state(false);
	let selectedTopics = $state<AgreementTopicId[]>([]);
	let agreementAnswers = $state<AgreementAnswers>(defaultAgreementAnswers());
	let answerErrors = $state<Record<string, string>>({});
	let generatedClauseIds = $state<Record<string, string>>({});
	let persistedAnswersSignature = $state('');
	let serverDiagnostics = $state<ContractDiagnostics | null>(null);

	let selectedTemplate = $derived(templates.find((item) => item.id === selectedTemplateId) ?? null);
	let selectedLibraryItem = $derived(
		libraryItems.find((item) => item.id === selectedLibraryId) ?? null
	);
	let selectedTopicDefinitions = $derived(
		AGREEMENT_TOPICS.filter((topic) => selectedTopics.includes(topic.id))
	);
	let activeQuestions = $derived(visibleQuestions(selectedTopics, agreementAnswers));
	let generatedClauses = $derived(generateAgreementClauses(selectedTopics, agreementAnswers));
	let baseDocument = $derived(
		buildBaseDocument({
			title: title.trim() || 'Acordo matrimonial',
			spouseA: session?.user.displayName || 'Cônjuge A',
			spouseB: userName(spouseB),
			arbitrators: [
				userName(arbitratorA),
				userName(arbitratorB),
				...(neutral ? [userName(neutral)] : [])
			],
			feePercent: feeA + feeB + (neutral ? feeNeutral : 0),
			expiresAt: formatDateTime(expiresAt),
			hasBitcoinPolicy: Boolean(wallet)
		})
	);

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
			const [loadedSchema, loadedTemplates, marketplace, mine] = await Promise.all([
				getRuleSchema(activeSession.accessToken),
				listClauseTemplates(activeSession.accessToken),
				listPublishedClauses(activeSession.accessToken, { size: 100 }),
				listMyPublishedClauses(activeSession.accessToken, 0, 100)
			]);
			schema = loadedSchema;
			templates = loadedTemplates;
			libraryItems = Array.from(
				new Map(
					[...mine.content, ...marketplace.content]
						.filter((item) => item.status === 'PUBLISHED')
						.map((item) => [item.id, item])
				).values()
			);
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

	function continueFromTitle() {
		error = '';
		if (!title.trim()) {
			showValidationToast('Dê um título ao contrato para continuar.');
			return;
		}
		step = 1;
	}

	function continueFromSpouse() {
		error = '';
		if (!session) {
			showValidationToast('Sua sessão não está disponível. Entre novamente.');
			return;
		}
		if (!spouseB) {
			showValidationToast('Selecione o outro cônjuge para continuar.');
			return;
		}
		if (spouseB.publicKey.toLowerCase() === session.user.publicKey.toLowerCase()) {
			showValidationToast('O outro cônjuge precisa ser uma pessoa diferente de você.');
			return;
		}
		arbitrationStep = 0;
		step = 2;
	}

	function validFee(fee: number) {
		return Number.isFinite(fee) && fee >= 0 && fee <= 100;
	}

	function continueFromArbitratorA() {
		error = '';
		if (!arbitratorA) {
			showValidationToast('Selecione o primeiro árbitro para continuar.');
			return;
		}
		if (!validFee(feeA)) {
			showValidationToast('A taxa do primeiro árbitro deve estar entre 0% e 100%.');
			return;
		}
		arbitrationStep = 1;
	}

	function continueFromArbitratorB() {
		error = '';
		if (!arbitratorB) {
			showValidationToast('Selecione o segundo árbitro para continuar.');
			return;
		}
		if (!validFee(feeB)) {
			showValidationToast('A taxa do segundo árbitro deve estar entre 0% e 100%.');
			return;
		}
		if (feeA + feeB > 100) {
			showValidationToast('A soma das taxas dos árbitros não pode ultrapassar 100%.');
			return;
		}
		arbitrationStep = 2;
	}

	function validateArbitrators() {
		if (!session) {
			showValidationToast('Sua sessão não está disponível. Entre novamente.');
			return false;
		}
		if (!spouseB) {
			showValidationToast('Selecione o outro cônjuge antes de configurar a arbitragem.');
			return false;
		}
		if (!arbitratorA || !arbitratorB) {
			showValidationToast('Selecione os dois árbitros obrigatórios.');
			return false;
		}
		const keys = [
			session.user.publicKey,
			spouseB.publicKey,
			arbitratorA.publicKey,
			arbitratorB.publicKey
		];
		if (neutral) keys.push(neutral.publicKey);
		if (new Set(keys.map((key) => key.toLowerCase())).size !== keys.length) {
			showValidationToast('Cada participante precisa usar uma chave Nostr diferente.');
			return false;
		}
		if (!neutral) feeNeutral = 0;
		if ([feeA, feeB, feeNeutral].some((fee) => fee < 0 || fee > 100)) {
			showValidationToast('Cada taxa deve estar entre 0% e 100%.');
			return false;
		}
		if (feeA + feeB + feeNeutral > 100) {
			showValidationToast('A soma das taxas dos árbitros não pode ultrapassar 100%.');
			return false;
		}
		return true;
	}

	function continueFromNeutralArbitrator() {
		error = '';
		if (validateArbitrators()) step = 3;
	}

	function contractPayload(): ContractPayload | null {
		if (!title.trim()) {
			showValidationToast('Dê um título ao contrato para continuar.');
			return null;
		}
		if (!validateArbitrators()) return null;
		if (!expiresAt) {
			showValidationToast('Defina a data máxima para aceite.');
			return null;
		}
		const acceptanceDeadline = new Date(expiresAt);
		if (Number.isNaN(acceptanceDeadline.getTime()) || acceptanceDeadline <= new Date()) {
			showValidationToast('A data máxima para aceite precisa estar no futuro.');
			return null;
		}
		return {
			title: title.trim(),
			spouseBPublicKey: spouseB!.publicKey,
			arbitratorAPublicKey: arbitratorA!.publicKey,
			arbitratorBPublicKey: arbitratorB!.publicKey,
			arbitratorNeutralPublicKey: neutral?.publicKey || null,
			feePercArbitratorA: feeA,
			feePercArbitratorB: feeB,
			feePercArbitratorNeutral: neutral ? feeNeutral : null,
			expiresAt: acceptanceDeadline.toISOString()
		};
	}

	async function saveContractSetup() {
		if (!session || saving) return;
		error = '';
		saving = true;
		try {
			const payload = contractPayload();
			if (!payload) return;
			const savedContract = contract
				? await updateContract(session.accessToken, contract.id, payload)
				: await createContract(session.accessToken, payload);
			contract = savedContract;
			await initializePolicyFor(savedContract);
			step = 4;
		} catch (caught) {
			error = message(caught, 'Não foi possível preparar o contrato. Tente novamente.');
		} finally {
			saving = false;
		}
	}

	function toggleTopic(topicId: AgreementTopicId) {
		selectedTopics = selectedTopics.includes(topicId)
			? selectedTopics.filter((id) => id !== topicId)
			: [...selectedTopics, topicId];
	}

	function setAnswer(questionId: string, value: boolean | number | string) {
		agreementAnswers = { ...agreementAnswers, [questionId]: value };
		if (answerErrors[questionId]) {
			const { [questionId]: _removed, ...remaining } = answerErrors;
			answerErrors = remaining;
		}
	}

	function continueFromTopics() {
		if (!selectedTopics.length) {
			showValidationToast('Selecione pelo menos um assunto para continuar.');
			return;
		}
		step = 5;
	}

	async function confirmAssistedClauses() {
		if (!session || !contract || saving) return;
		answerErrors = validateAgreementAnswers(selectedTopics, agreementAnswers);
		if (Object.keys(answerErrors).length) {
			showValidationToast('Revise as respostas destacadas antes de continuar.');
			return;
		}
		const signature = JSON.stringify({ selectedTopics, agreementAnswers });
		if (signature === persistedAnswersSignature) {
			step = 6;
			return;
		}
		saving = true;
		error = '';
		try {
			const validations = await Promise.all(
				generatedClauses
					.filter((clause) => clause.rule)
					.map((clause) => validateRule(session!.accessToken, clause.rule!))
			);
			const invalid = validations.flatMap((result) => result.errors);
			if (invalid.length) throw new Error(invalid.map((item) => item.message).join(' '));

			for (const clauseId of Object.values(generatedClauseIds)) {
				await deleteClause(session.accessToken, contract.id, clauseId);
			}
			const preserved = contract.clauses.filter(
				(clause) => !Object.values(generatedClauseIds).includes(clause.id)
			);
			const added: ContractClause[] = [];
			const nextIds: Record<string, string> = {};
			for (const generated of generatedClauses) {
				const position: number = preserved.length + added.length;
				const clause: ContractClause = generated.rule
					? await createCustomRuleClause(session.accessToken, contract.id, {
							title: generated.title,
							position,
							rule: generated.rule
						})
					: await createClause(session.accessToken, contract.id, {
							title: generated.title,
							kind: 'CONCEPT',
							description: generated.description,
							position
						});
				added.push(clause);
				nextIds[generated.key] = clause.id;
			}
			contract = { ...contract, clauses: [...preserved, ...added] };
			generatedClauseIds = nextIds;
			persistedAnswersSignature = signature;
			step = 6;
		} catch (caught) {
			error = message(caught, 'Não foi possível incluir os acordos no contrato.');
		} finally {
			saving = false;
		}
	}

	function reviewDiagnostics() {
		if (serverDiagnostics) {
			const legalNotices = selectedTopicDefinitions
				.filter((topic) => topic.legalNotice)
				.map((topic) => ({ severity: 'INFO' as const, message: topic.legalNotice! }));
			return [
				...serverDiagnostics.diagnostics.map((item) => ({
					severity: item.severity,
					message: item.message
				})),
				...legalNotices
			];
		}
		const diagnostics: Array<{ severity: 'ERROR' | 'WARNING' | 'INFO'; message: string }> = [];
		if (!contract?.clauses.length)
			diagnostics.push({
				severity: 'ERROR',
				message: 'Inclua ao menos uma cláusula antes da submissão.'
			});
		if (!wallet)
			diagnostics.push({
				severity: 'ERROR',
				message: 'A política Bitcoin ainda não foi inicializada.'
			});
		if (feeA + feeB + (neutral ? feeNeutral : 0) > 100)
			diagnostics.push({
				severity: 'ERROR',
				message: 'A soma das taxas de arbitragem excede 100%.'
			});
		const economicRules = contract?.clauses.filter((clause) => clause.rule) ?? [];
		if (economicRules.length > 1)
			diagnostics.push({
				severity: 'WARNING',
				message:
					'Há mais de uma consequência econômica. Revise como elas podem interagir com a garantia disponível.'
			});
		for (const topic of selectedTopicDefinitions) {
			if (topic.legalNotice) diagnostics.push({ severity: 'INFO', message: topic.legalNotice });
		}
		diagnostics.push({
			severity: 'INFO',
			message: 'Esta verificação é técnica e informativa; não constitui análise jurídica completa.'
		});
		return diagnostics;
	}

	async function openReview() {
		if (!session || !contract || saving) return;
		if (!contract.clauses.length) {
			showValidationToast('Inclua ao menos uma cláusula.');
			return;
		}
		saving = true;
		error = '';
		try {
			serverDiagnostics = await getContractDiagnostics(session.accessToken, contract.id);
			step = 7;
		} catch (caught) {
			error = message(caught, 'Não foi possível verificar o contrato.');
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
			if (!result.valid) showValidationToast(result.errors.map((item) => item.message).join(' '));
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
			if (clauseMode === 'LIBRARY') {
				if (!selectedLibraryItem) {
					showValidationToast('Escolha uma cláusula da biblioteca.');
					return;
				}
				clause = await copyPublishedClauseToContract(
					session.accessToken,
					contract.id,
					selectedLibraryItem.id,
					position
				);
			} else if (clauseMode === 'TEMPLATE') {
				if (!selectedTemplate) {
					showValidationToast('Escolha um modelo de cláusula.');
					return;
				}
				clause = await createClauseFromTemplate(session.accessToken, contract.id, {
					templateId: selectedTemplate.id,
					title: clauseTitle.trim() || null,
					position,
					parameters: templateValues
				});
			} else if (clauseMode === 'CUSTOM') {
				if (!clauseTitle.trim()) {
					showValidationToast('Informe o título da regra.');
					return;
				}
				clause = await createCustomRuleClause(session.accessToken, contract.id, {
					title: clauseTitle.trim(),
					position,
					rule: customRule
				});
			} else {
				if (!clauseTitle.trim() || !conceptDescription.trim()) {
					showValidationToast('Informe o título e a descrição do conceito.');
					return;
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
			selectedLibraryId = '';
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

	async function initializePolicyFor(savedContract: Contract) {
		if (!session || !spouseB || !arbitratorA || !arbitratorB) {
			throw new Error(
				'Os participantes necessários para a política Bitcoin não estão disponíveis.'
			);
		}
		if (wallet) return wallet;
		const spouses: [string, string] = [session.user.publicKey, spouseB.publicKey];
		const arbitrators = [arbitratorA.publicKey, arbitratorB.publicKey];
		if (neutral) arbitrators.push(neutral.publicKey);
		const generated = createContractWallet(spouses, arbitrators, 2, networks.testnet);
		const policy = await createPolicyDocument(spouses, arbitrators, generated);
		wallet = await initializeMultisig(session.accessToken, savedContract.id, {
			network: 'testnet4',
			address: generated.multisigAddress,
			scriptPubKey: generated.multisigScriptHex,
			policyHash: policy.policyHash,
			policyDocument: policy.policyDocument,
			arbitratorsQuorum: 2
		});
		return wallet;
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

<div class="wizard-page stack-lg">
	<StepIndicator {steps} activeIndex={step} />

	{#if error}<div class="error surface" role="alert">{error}</div>{/if}
	{#if contract && step >= 4}
		<p class="draft-note muted">Rascunho salvo automaticamente: {contract.id}</p>
	{/if}

	{#if step === 0}
		<div class="focus-stage">
			<Card padding="large">
				<form
					class="focus-step"
					onsubmit={(event) => {
						event.preventDefault();
						continueFromTitle();
					}}
				>
					<div class="step-copy">
						<span class="step-number">01</span>
						<h2>Como vocês vão chamar este acordo?</h2>
						<p>Escolha um nome fácil de reconhecer. Ele aparecerá na lista de contratos.</p>
					</div>
					<div class="hero-control">
						<Input
							label="Título do contrato"
							bind:value={title}
							placeholder="Ex.: Acordo de Ana e Bruno"
							required
						/>
					</div>
					<div class="row focus-actions">
						<Button href="/contracts" variant="ghost" size="large">Cancelar</Button>
						<Button type="submit" size="large" disabled={!title.trim()}>Continuar</Button>
					</div>
				</form>
			</Card>
		</div>
	{:else if step === 1}
		<div class="focus-stage">
			<Card padding="large">
				<form
					class="focus-step"
					onsubmit={(event) => {
						event.preventDefault();
						continueFromSpouse();
					}}
				>
					<div class="step-copy">
						<span class="step-number">02</span>
						<h2>Quem é o outro cônjuge?</h2>
						<p>Pesquise pelo nome ou cole o npub da pessoa que participará do contrato com você.</p>
					</div>
					<div class="hero-control">
						<UserPicker
							label="Cônjuge"
							bind:value={spouseB}
							accessToken={session?.accessToken || ''}
							excludePublicKeys={excludedKeys(spouseB)}
							description="A pessoa precisa ter uma conta ativa no Nuptalicium."
							required
						/>
					</div>
					<div class="row focus-actions">
						<Button variant="ghost" size="large" onClick={() => (step = 0)}>Voltar</Button>
						<Button type="submit" size="large" disabled={!spouseB}>Continuar</Button>
					</div>
				</form>
			</Card>
		</div>
	{:else if step === 2}
		<div class="focus-stage">
			<Card padding="large">
				{#if arbitrationStep === 0}
					<form
						class="focus-step"
						onsubmit={(event) => {
							event.preventDefault();
							continueFromArbitratorA();
						}}
					>
						<div class="step-copy">
							<span class="arbitration-progress">Arbitragem · 1 de 3</span>
							<h2>Quem será o primeiro árbitro?</h2>
							<p>Escolha a pessoa e informe a taxa que ela receberá pela arbitragem.</p>
						</div>
						<div class="arbitrator-control surface-gray">
							<UserPicker
								label="Primeiro árbitro"
								bind:value={arbitratorA}
								accessToken={session?.accessToken || ''}
								excludePublicKeys={excludedKeys(arbitratorA)}
								required
							/>
							<Input
								label="Taxa do primeiro árbitro (%)"
								bind:value={feeA}
								type="number"
								min={0}
								max={100}
								step={0.01}
								required
							/>
						</div>
						<p class="fee-total">
							Taxas dos árbitros: <strong>{feeA + feeB + (neutral ? feeNeutral : 0)}%</strong> de 100%
						</p>
						<div class="row focus-actions">
							<Button variant="ghost" size="large" onClick={() => (step = 1)}>Voltar</Button>
							<Button type="submit" size="large" disabled={!arbitratorA}>Continuar</Button>
						</div>
					</form>
				{:else if arbitrationStep === 1}
					<form
						class="focus-step"
						onsubmit={(event) => {
							event.preventDefault();
							continueFromArbitratorB();
						}}
					>
						<div class="step-copy">
							<span class="arbitration-progress">Arbitragem · 2 de 3</span>
							<h2>Quem será o segundo árbitro?</h2>
							<p>Escolha uma pessoa diferente e defina a taxa correspondente.</p>
						</div>
						<div class="arbitrator-control surface-gray">
							<UserPicker
								label="Segundo árbitro"
								bind:value={arbitratorB}
								accessToken={session?.accessToken || ''}
								excludePublicKeys={excludedKeys(arbitratorB)}
								required
							/>
							<Input
								label="Taxa do segundo árbitro (%)"
								bind:value={feeB}
								type="number"
								min={0}
								max={100}
								step={0.01}
								required
							/>
						</div>
						<p class="fee-total">
							Taxas dos árbitros: <strong>{feeA + feeB + (neutral ? feeNeutral : 0)}%</strong> de 100%
						</p>
						<div class="row focus-actions">
							<Button variant="ghost" size="large" onClick={() => (arbitrationStep = 0)}
								>Voltar</Button
							>
							<Button type="submit" size="large" disabled={!arbitratorB}>Continuar</Button>
						</div>
					</form>
				{:else}
					<form
						class="focus-step"
						onsubmit={(event) => {
							event.preventDefault();
							continueFromNeutralArbitrator();
						}}
					>
						<div class="step-copy">
							<span class="arbitration-progress">Arbitragem · 3 de 3</span>
							<h2>Deseja adicionar um árbitro neutro?</h2>
							<p>
								Esta terceira pessoa é opcional. Você pode adicioná-la ou seguir sem árbitro neutro.
							</p>
						</div>
						<div class="arbitrator-control optional surface-gray">
							<UserPicker
								label="Árbitro neutro (opcional)"
								bind:value={neutral}
								accessToken={session?.accessToken || ''}
								excludePublicKeys={excludedKeys(neutral)}
							/>
							{#if neutral}
								<Input
									label="Taxa do árbitro neutro (%)"
									bind:value={feeNeutral}
									type="number"
									min={0}
									max={100}
									step={0.01}
								/>
							{:else}
								<p class="optional-help">Nenhum árbitro neutro será incluído.</p>
							{/if}
						</div>
						<p class="fee-total">
							Taxas dos árbitros: <strong>{feeA + feeB + (neutral ? feeNeutral : 0)}%</strong> de 100%
						</p>
						<div class="row focus-actions">
							<Button variant="ghost" size="large" onClick={() => (arbitrationStep = 1)}
								>Voltar</Button
							>
							<Button type="submit" size="large"
								>{neutral ? 'Continuar' : 'Continuar sem neutro'}</Button
							>
						</div>
					</form>
				{/if}
			</Card>
		</div>
	{:else if step === 3}
		<div class="focus-stage">
			<Card padding="large">
				<form
					class="focus-step"
					onsubmit={(event) => {
						event.preventDefault();
						void saveContractSetup();
					}}
				>
					<div class="step-copy">
						<span class="step-number">04</span>
						<h2>Até quando o contrato pode ser aceito?</h2>
						<p>
							Depois desta data, participantes que ainda não aceitaram precisarão de um novo
							convite.
						</p>
					</div>
					<div class="hero-control">
						<Input
							label="Data máxima para aceite"
							bind:value={expiresAt}
							type="datetime-local"
							description="Escolha uma data e um horário no futuro."
							required
						/>
					</div>
					<div class="automatic-policy surface-gray">
						<span aria-hidden="true">✓</span>
						<div>
							<strong>Política Bitcoin automática</strong>
							<p>
								Ao continuar, a política será criada com os participantes escolhidos. Você não
								precisa configurar nada.
							</p>
						</div>
					</div>
					<div class="row focus-actions">
						<Button
							variant="ghost"
							size="large"
							disabled={saving}
							onClick={() => {
								arbitrationStep = 2;
								step = 2;
							}}>Voltar</Button
						><Button type="submit" size="large" disabled={saving || !expiresAt}
							>{saving ? 'Preparando contrato…' : 'Criar contrato e continuar'}</Button
						>
					</div>
				</form>
			</Card>
		</div>
	{:else if step === 4}
		<div class="content-stage stack-lg">
			<div class="section-heading stack compact">
				<span class="step-number">05</span>
				<h2>Sobre o que vocês querem conversar?</h2>
				<p class="muted">
					Escolha os assuntos que farão parte do acordo. Você poderá revisar tudo antes de incluir.
				</p>
			</div>
			<div class="topic-grid">
				{#each AGREEMENT_TOPICS as topic (topic.id)}
					<button
						type="button"
						class="topic-card surface"
						class:selected={selectedTopics.includes(topic.id)}
						onclick={() => toggleTopic(topic.id)}
						aria-pressed={selectedTopics.includes(topic.id)}
					>
						<span class="topic-check" aria-hidden="true"
							>{selectedTopics.includes(topic.id) ? '✓' : '+'}</span
						>
						<strong>{topic.title}</strong>
						<small>{topic.description}</small>
					</button>
				{/each}
			</div>
			<div class="row actions">
				<Button variant="ghost" onClick={() => (step = 3)}>Voltar</Button>
				<Button onClick={continueFromTopics}
					>Continuar com {selectedTopics.length} assunto(s)</Button
				>
			</div>
		</div>
	{:else if step === 5}
		<div class="content-stage stack-lg">
			<div class="section-heading stack compact">
				<span class="step-number">06</span>
				<h2>Transforme decisões em acordos claros</h2>
				<p class="muted">
					Responda apenas ao que fizer sentido. Nenhuma consequência econômica é automática.
				</p>
			</div>
			{#each selectedTopicDefinitions as topic (topic.id)}
				<Card padding="large">
					<div class="stack-lg questionnaire">
						<div class="stack compact">
							<h3>{topic.title}</h3>
							<p class="muted">{topic.description}</p>
							{#if topic.legalNotice}<p class="legal-notice">{topic.legalNotice}</p>{/if}
						</div>
						{#each activeQuestions.filter((question) => question.topicId === topic.id) as question (question.id)}
							<label class="question-field">
								<span class="label">{question.label}</span>
								{#if question.explanation}<small class="muted">{question.explanation}</small>{/if}
								{#if question.type === 'BOOLEAN'}
									<span class="choice-row">
										<input
											type="checkbox"
											checked={agreementAnswers[question.id] === true}
											onchange={(event) => setAnswer(question.id, event.currentTarget.checked)}
										/>
										Sim, incluir esta previsão
									</span>
								{:else if question.type === 'SINGLE_CHOICE'}
									<select
										value={String(agreementAnswers[question.id] ?? '')}
										onchange={(event) => setAnswer(question.id, event.currentTarget.value)}
									>
										{#each question.options ?? [] as option (option.value)}
											<option value={option.value}>{option.label}</option>
										{/each}
									</select>
								{:else if question.type === 'TEXT'}
									<textarea
										rows="4"
										value={String(agreementAnswers[question.id] ?? '')}
										oninput={(event) => setAnswer(question.id, event.currentTarget.value)}
									></textarea>
								{:else}
									<input
										type="number"
										min={question.minimum}
										max={question.maximum}
										step={question.type === 'PERCENTAGE' ? 0.01 : 1}
										value={Number(agreementAnswers[question.id] ?? 0)}
										oninput={(event) => setAnswer(question.id, event.currentTarget.valueAsNumber)}
									/>
								{/if}
								{#if answerErrors[question.id]}<small class="field-error"
										>{answerErrors[question.id]}</small
									>{/if}
							</label>
						{/each}
					</div>
				</Card>
			{/each}

			<Card padding="large">
				<div class="stack">
					<h3>Prévia dos acordos</h3>
					{#if generatedClauses.length === 0}
						<p class="muted">
							As respostas atuais ainda não produzem cláusulas. Você pode continuar e usar as opções
							avançadas.
						</p>
					{:else}
						{#each generatedClauses as clause (clause.key)}
							<div class="generated-preview surface-gray">
								<span class:financial={clause.kind === 'RULE'}
									>{clause.kind === 'RULE' ? 'Consequência econômica' : 'Acordo textual'}</span
								>
								<strong>{clause.title}</strong>
								<p>{clause.description}</p>
								{#if clause.legalNotice}<small>{clause.legalNotice}</small>{/if}
							</div>
						{/each}
					{/if}
				</div>
			</Card>
			<div class="row actions">
				<Button variant="ghost" disabled={saving} onClick={() => (step = 4)}>Voltar</Button>
				<Button disabled={saving} onClick={confirmAssistedClauses}
					>{saving ? 'Incluindo acordos…' : 'Confirmar e continuar'}</Button
				>
			</div>
		</div>
	{:else if step === 6}
		<div class="stack-lg content-stage">
			<div class="section-heading stack compact">
				<span class="step-number">07</span>
				<h2>Deseja adicionar algo mais?</h2>
				<p class="muted">A biblioteca, os modelos e o editor avançado continuam disponíveis.</p>
			</div>
			<Card padding="large">
				<div class="stack">
					<h3>Adicionar cláusula</h3>
					<div class="mode-tabs" role="tablist" aria-label="Tipo da cláusula">
						{#each [['LIBRARY', 'Biblioteca'], ['TEMPLATE', 'Usar modelo'], ['CUSTOM', 'Criar regra'], ['CONCEPT', 'Conceito']] as option (option[0])}
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
					{:else if clauseMode === 'LIBRARY'}
						<label class="field">
							<span class="label">Cláusula publicada</span>
							<select bind:value={selectedLibraryId}>
								<option value="">Escolha uma cláusula</option>
								{#each libraryItems as item (item.id)}
									<option value={item.id}
										>{item.title} · {item.type === 'RULE'
											? 'Regra'
											: 'Conceito'}{item.visibility === 'PRIVATE' ? ' · Privada' : ''}</option
									>
								{/each}
							</select>
						</label>
						{#if selectedLibraryItem}<p class="muted">
								{selectedLibraryItem.summary ||
									selectedLibraryItem.generatedDescription ||
									selectedLibraryItem.conceptText}
							</p>{/if}
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
			<div class="row actions clause-actions">
				<Button disabled={saving} onClick={openReview}
					>{saving ? 'Verificando…' : 'Revisar contrato'}</Button
				>
				<Button variant="ghost" disabled={saving} onClick={() => (step = 5)}
					>Voltar aos acordos</Button
				>
			</div>
		</div>
	{:else}
		<div class="content-stage review-stage">
			<div class="section-heading stack compact">
				<span class="step-number">08</span>
				<h2>Confira tudo antes de enviar</h2>
				<p class="muted">
					Esta é a última etapa. Verifique participantes, taxas, prazo e cláusulas.
				</p>
			</div>
			<Card padding="large">
				<div class="stack-lg">
					<h3 class="review-title">{contract?.title || 'Contrato sem título'}</h3>
					<div class="review-grid">
						<span>Cláusulas</span><strong>{contract?.clauses.length ?? 0}</strong>
						<span>Taxas dos árbitros</span><strong
							>{feeA + feeB + (neutral ? feeNeutral : 0)}%</strong
						>
						<span>Prazo</span><strong>{formatDateTime(expiresAt)}</strong>
						<span>Rede Bitcoin</span><strong>Testnet4</strong>
						<span>Política Bitcoin</span><strong>Inicializada automaticamente</strong>
						<span>Hash da política</span><strong class="technical policy-hash"
							>{wallet?.policyHash}</strong
						>
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
					<h3>Assuntos abordados</h3>
					<div class="topic-summary">
						{#each selectedTopicDefinitions as topic (topic.id)}<span>{topic.title}</span>{/each}
					</div>
					<div class="divider"></div>
					<h3>Documento-base</h3>
					<p class="muted">
						Informações estruturais derivadas do contrato, separadas dos acordos negociados.
					</p>
					<div class="base-document">
						{#each baseDocument as section (section.title)}
							<section>
								<strong>{section.title}</strong>
								<p>{section.text}</p>
							</section>
						{/each}
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
										: ' sats'} · {partyReferenceLabel(clause.rule.definition.effect.from)} →
									{partyReferenceLabel(clause.rule.definition.effect.to)}
								</small>
							{/if}
						</div>
					{/each}
					<div class="divider"></div>
					<h3>Verificação de completude e coerência</h3>
					<div class="diagnostics">
						{#each reviewDiagnostics() as diagnostic}
							<div
								class="diagnostic"
								class:error-item={diagnostic.severity === 'ERROR'}
								class:warning-item={diagnostic.severity === 'WARNING'}
							>
								<strong
									>{diagnostic.severity === 'ERROR'
										? 'Erro'
										: diagnostic.severity === 'WARNING'
											? 'Atenção'
											: 'Informação'}</strong
								>
								<span>{diagnostic.message}</span>
							</div>
						{/each}
					</div>
					<p>
						Ao enviar, cláusulas e política Bitcoin ficam congeladas no conteúdo que todos os
						participantes assinarão.
					</p>
					<div class="row actions review-actions">
						<Button
							disabled={saving ||
								!wallet ||
								reviewDiagnostics().some((item) => item.severity === 'ERROR')}
							onClick={finish}>{saving ? 'Enviando…' : 'Enviar para aceite'}</Button
						><Button variant="ghost" disabled={saving} onClick={() => (step = 6)}>Voltar</Button>
					</div>
				</div>
			</Card>
		</div>
	{/if}
</div>

<style>
	.wizard-page {
		width: 100%;
		max-width: 78rem;
		margin: 0 auto;
		padding-bottom: 3rem;
	}
	.compact {
		gap: 0.35rem;
	}
	.error {
		width: min(100%, 58rem);
		margin: 0 auto;
		padding: 1rem;
		color: var(--rose-text);
		border-color: var(--rose-300);
	}
	.draft-note {
		text-align: center;
		font-size: 0.82rem;
		overflow-wrap: anywhere;
	}
	.focus-stage {
		width: min(100%, 54rem);
		margin: clamp(1rem, 4vh, 3rem) auto 0;
	}
	.focus-step {
		display: grid;
		gap: clamp(1.75rem, 4vw, 3rem);
		min-height: min(34rem, 66vh);
		align-content: center;
	}
	.step-copy {
		display: grid;
		justify-items: center;
		gap: 0.85rem;
		max-width: 47rem;
		margin: 0 auto;
		text-align: center;
	}
	.step-copy h2,
	.section-heading h2 {
		font-size: clamp(1.75rem, 4vw, 2.75rem);
		line-height: 1.08;
	}
	.step-copy p {
		max-width: 42rem;
		color: var(--gray-600);
		font-size: 1.05rem;
		line-height: 1.65;
	}
	.step-number {
		display: inline-grid;
		place-items: center;
		width: 3.25rem;
		height: 3.25rem;
		border-radius: 50%;
		background: var(--rose-100);
		color: var(--rose-text);
		font-size: 0.9rem;
		font-weight: 800;
		letter-spacing: 0.05em;
	}
	.hero-control {
		width: min(100%, 39rem);
		margin: 0 auto;
	}
	.hero-control :global(.control) {
		min-height: 4rem;
		font-size: 1.08rem;
	}
	.focus-actions {
		justify-content: space-between;
		width: min(100%, 43rem);
		margin: 0 auto;
	}
	.arbitration-progress {
		padding: 0.4rem 0.75rem;
		border-radius: var(--radius-sm);
		background: var(--rose-100);
		color: var(--rose-text);
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.arbitrator-control {
		display: grid;
		gap: 1.15rem;
		width: min(100%, 39rem);
		margin: 0 auto;
		padding: 1.25rem;
		border: 1px solid var(--border-gray);
		border-radius: var(--radius-lg);
	}
	.arbitrator-control.optional {
		border-style: dashed;
	}
	.optional-help {
		color: var(--gray-600);
		font-size: 0.9rem;
		line-height: 1.5;
	}
	.fee-total {
		margin: 0;
		text-align: center;
		color: var(--gray-600);
	}
	.automatic-policy {
		display: flex;
		align-items: flex-start;
		gap: 0.9rem;
		width: min(100%, 39rem);
		margin: 0 auto;
		padding: 1rem;
	}
	.automatic-policy > span {
		display: grid;
		place-items: center;
		flex: 0 0 auto;
		width: 1.7rem;
		height: 1.7rem;
		border-radius: 50%;
		background: var(--rose-400);
		color: white;
		font-weight: 800;
	}
	.automatic-policy p {
		margin-top: 0.25rem;
		color: var(--gray-600);
		font-size: 0.9rem;
		line-height: 1.45;
	}
	.content-stage {
		width: min(100%, 66rem);
		margin: clamp(1rem, 4vh, 2.5rem) auto 0;
	}
	.section-heading {
		align-items: center;
		margin-bottom: 1.25rem;
		text-align: center;
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
	.clause-actions,
	.review-actions {
		align-items: center;
	}
	.review-stage {
		display: grid;
		gap: 1rem;
	}
	.review-title {
		font-size: clamp(1.35rem, 3vw, 2rem);
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
	.topic-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}
	.topic-card {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.35rem 0.85rem;
		align-items: start;
		padding: 1.25rem;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}
	.topic-card.selected {
		border-color: var(--rose-400);
		box-shadow: 0 0 0 2px var(--rose-100);
	}
	.topic-card strong,
	.topic-card small {
		grid-column: 2;
	}
	.topic-card small {
		color: var(--gray-600);
		line-height: 1.5;
	}
	.topic-check {
		display: grid;
		grid-row: 1 / span 2;
		place-items: center;
		width: 1.8rem;
		height: 1.8rem;
		border-radius: 50%;
		background: var(--rose-100);
		color: var(--rose-text);
		font-weight: 800;
	}
	.questionnaire h3 {
		font-size: 1.35rem;
	}
	.question-field {
		display: grid;
		gap: 0.5rem;
	}
	.question-field input[type='number'],
	.question-field select,
	.question-field textarea {
		width: 100%;
		padding: 0.8rem;
		border: 1px solid var(--border-gray);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: inherit;
		font: inherit;
	}
	.choice-row {
		display: flex;
		gap: 0.65rem;
		align-items: center;
		padding: 0.8rem;
		border-radius: var(--radius-sm);
		background: var(--surface-muted);
	}
	.legal-notice,
	.field-error {
		color: var(--rose-text);
	}
	.generated-preview {
		display: grid;
		gap: 0.45rem;
		padding: 1rem;
	}
	.generated-preview > span {
		width: fit-content;
		padding: 0.25rem 0.55rem;
		border-radius: 999px;
		background: var(--gray-100);
		font-size: 0.72rem;
		font-weight: 800;
		text-transform: uppercase;
	}
	.generated-preview > span.financial {
		background: var(--rose-100);
		color: var(--rose-text);
	}
	.topic-summary {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.topic-summary span {
		padding: 0.4rem 0.7rem;
		border-radius: 999px;
		background: var(--gray-100);
		font-size: 0.85rem;
	}
	.base-document,
	.diagnostics {
		display: grid;
		gap: 0.75rem;
	}
	.base-document section,
	.diagnostic {
		padding: 1rem;
		border-left: 3px solid var(--gray-300);
		background: var(--surface-muted);
	}
	.base-document p {
		margin: 0.35rem 0 0;
		line-height: 1.55;
	}
	.diagnostic {
		display: grid;
		gap: 0.25rem;
	}
	.diagnostic.error-item {
		border-color: var(--rose-500);
	}
	.diagnostic.warning-item {
		border-color: #d49b24;
	}
	@media (max-width: 900px) {
		.focus-step {
			min-height: auto;
		}
	}
	@media (max-width: 640px) {
		.topic-grid {
			grid-template-columns: 1fr;
		}
		.focus-stage {
			margin-top: 0.5rem;
		}
		.focus-actions {
			align-items: stretch;
			flex-direction: column-reverse;
		}
		.mode-tabs,
		.actions {
			align-items: stretch;
			flex-direction: column;
		}
		.review-grid {
			grid-template-columns: 1fr;
			gap: 0.25rem;
		}
		.review-grid strong {
			margin-bottom: 0.75rem;
		}
	}
</style>
