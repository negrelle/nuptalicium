<script lang="ts">
	import {
		createDecision,
		broadcastDecision,
		getContract,
		getMultisig,
		listDecisions,
		listDecisionVotes,
		startDecisionSettlement,
		voteOnDecision,
		type BitcoinWallet,
		type Contract,
		type Decision,
		type DecisionVote
	} from '$lib/api/contracts';
	import {
		buildSignedDissolutionPsbt,
		createContractWallet,
		createNip07TaprootSigner,
		deriveTaprootAddressFromPubkey
	} from '$lib/bitcoin';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Input from '$lib/components/Input.svelte';
	import { fetchSpendRequests, publishSpendRequest, type SpendRequestPayload } from '$lib/nostr';
	import { authStore } from '$lib/stores/auth';
	import type { AuthSession } from '$lib/types';
	import { address, networks, Psbt } from 'bitcoinjs-lib';
	import { toXOnly } from 'bitcoinjs-lib/src/psbt/bip371';
	import { onMount } from 'svelte';

	let { data }: { data: { contractId: string } } = $props();
	let session = $state<AuthSession | null>(null);
	let contract = $state<Contract | null>(null);
	let wallet = $state<BitcoinWallet | null>(null);
	let decisions = $state<Decision[]>([]);
	let votes = $state<Record<string, DecisionVote[]>>({});
	let selectedClauseIds = $state<string[]>([]);
	let reason = $state('');
	let beneficiaryAddress = $state('');
	let rationale = $state('');
	let networkFeeSats = $state(500);
	let loading = $state(true);
	let busy = $state(false);
	let error = $state('');
	let success = $state('');

	onMount(() => {
		const unsubscribe = authStore.subscribe((value) => {
			session = value;
			if (value) void load();
		});
		return unsubscribe;
	});

	async function load() {
		if (!session) return;
		loading = true;
		try {
			[contract, wallet, decisions] = await Promise.all([
				getContract(session.accessToken, data.contractId),
				getMultisig(session.accessToken, data.contractId),
				listDecisions(session.accessToken, data.contractId)
			]);
			votes = Object.fromEntries(
				await Promise.all(
					decisions.map(async (decision) => [
						decision.id,
						await listDecisionVotes(session!.accessToken, decision.id)
					])
				)
			);
		} catch (caught) {
			error = message(caught);
		} finally {
			loading = false;
		}
	}

	function message(caught: unknown) {
		return caught instanceof Error ? caught.message : 'Não foi possível concluir a operação.';
	}

	function me() {
		return contract?.participants.find(
			(participant) => participant.publicKey.toLowerCase() === session?.user.publicKey.toLowerCase()
		);
	}

	function toggleClause(id: string) {
		selectedClauseIds = selectedClauseIds.includes(id)
			? selectedClauseIds.filter((item) => item !== id)
			: [...selectedClauseIds, id];
	}

	async function perform(action: () => Promise<void>) {
		if (busy) return;
		busy = true;
		error = '';
		success = '';
		try {
			await action();
		} catch (caught) {
			error = message(caught);
		} finally {
			busy = false;
		}
	}

	async function openDecision() {
		if (!session) return;
		await perform(async () => {
			await createDecision(session!.accessToken, data.contractId, {
				reason,
				beneficiaryAddress,
				clauseIds: selectedClauseIds
			});
			reason = '';
			selectedClauseIds = [];
			success = 'Decisão criada e enviada ao outro cônjuge.';
			await load();
		});
	}

	async function vote(decision: Decision, outcome: 'APPROVE' | 'REJECT') {
		if (!session) return;
		await perform(async () => {
			await voteOnDecision(session!.accessToken, decision.id, outcome, rationale);
			rationale = '';
			success = outcome === 'APPROVE' ? 'Aprovação registrada.' : 'Rejeição registrada.';
			await load();
		});
	}

	function feePercentFor(userId: string) {
		const role = contract!.participants.find((participant) => participant.id === userId)?.role;
		if (role === 'ARBITRATOR_A') return contract!.feePercArbitratorA;
		if (role === 'ARBITRATOR_B') return contract!.feePercArbitratorB;
		if (role === 'ARBITRATOR_NEUTRAL') return contract!.feePercArbitratorNeutral || 0;
		return 0;
	}

	async function publishSettlement(decision: Decision) {
		if (!session || !contract || !wallet) return;
		await perform(async () => {
			const spouseKeys = [
				contract!.participants.find((p) => p.role === 'SPOUSE_A')!.publicKey,
				contract!.participants.find((p) => p.role === 'SPOUSE_B')!.publicKey
			] as [string, string];
			const arbitratorKeys = contract!.participants
				.filter((p) => p.role.startsWith('ARBITRATOR'))
				.map((p) => p.publicKey);
			const contractWallet = createContractWallet(spouseKeys, arbitratorKeys, 2, networks.testnet);
			if (contractWallet.multisigAddress !== wallet!.address) {
				throw new Error('A política Taproot local não corresponde à política assinada.');
			}

			const decisionVotes = votes[decision.id] || [];
			const arbitrationVoters = decisionVotes
				.filter((vote) => vote.outcome === 'APPROVE')
				.map((vote) => contract!.participants.find((p) => p.id === vote.voterId))
				.filter((p) => p?.role.startsWith('ARBITRATOR'))
				.slice(0, 2);
			const requiredKeys =
				arbitrationVoters.length === 2
					? [session!.user.publicKey, ...arbitrationVoters.map((p) => p!.publicKey)]
					: spouseKeys;
			const requiredXOnly = new Set(requiredKeys.map((key) => key.toLowerCase()));
			const leaf = contractWallet.multisigScripts.find((candidate) => {
				const keys = candidate.combination.map((pair) => toXOnly(pair.publicKey).toString('hex'));
				return keys.length === requiredXOnly.size && keys.every((key) => requiredXOnly.has(key));
			});
			if (!leaf) throw new Error('Não foi encontrado um caminho Taproot para os signatários.');

			const gross = decision.totalPenaltySats;
			const outputs: { address: string; value: number }[] = [];
			let arbitratorFees = 0;
			for (const arbitrator of arbitrationVoters) {
				const fee = Math.floor((gross * feePercentFor(arbitrator!.id)) / 100);
				if (fee >= 330) {
					outputs.push({
						address: deriveTaprootAddressFromPubkey(arbitrator!.publicKey, networks.testnet),
						value: fee
					});
					arbitratorFees += fee;
				}
			}
			const beneficiaryValue = gross - arbitratorFees - networkFeeSats;
			if (beneficiaryValue < 330)
				throw new Error('O valor líquido da penalidade ficaria abaixo do dust.');
			outputs.unshift({ address: decision.beneficiaryAddress, value: beneficiaryValue });
			const change = wallet!.confirmedBalanceSats - gross;
			if (change >= 330) outputs.push({ address: wallet!.address, value: change });

			const signer = createNip07TaprootSigner(session!.user.publicKey);
			const psbt = await buildSignedDissolutionPsbt(
				contractWallet,
				leaf.leaf.output.toString('hex'),
				signer,
				networks.testnet,
				wallet!.fundingTransactions
					.filter((transaction) => transaction.status === 'CONFIRMED')
					.map((transaction) => ({
						txid: transaction.txid,
						vout: transaction.vout,
						value: transaction.amountSats
					})),
				outputs
			);
			const event = await publishSpendRequest({
				contractId: contract!.id,
				decisionId: decision.id,
				psbtHex: psbt.toHex(),
				redeemOutput: leaf.leaf.output.toString('hex'),
				policyHash: wallet!.policyHash,
				expiresAt: Math.floor(Date.now() / 1000) + 86400
			});
			await startDecisionSettlement(session!.accessToken, decision.id, event.id);
			success = 'PSBT assinada e publicada no Nostr para os demais signatários.';
			await load();
		});
	}

	async function continueSettlement(decision: Decision) {
		if (!session || !wallet) return;
		await perform(async () => {
			const events = await fetchSpendRequests(decision.id);
			const latest = events.sort((a, b) => b.created_at - a.created_at)[0];
			if (!latest) throw new Error('Nenhuma PSBT foi publicada para esta decisão.');
			const payload = JSON.parse(latest.content) as SpendRequestPayload;
			if (payload.policyHash !== wallet!.policyHash || payload.contractId !== data.contractId) {
				throw new Error('A PSBT não pertence à política assinada deste contrato.');
			}
			if (payload.expiresAt < Math.floor(Date.now() / 1000)) {
				throw new Error('A solicitação de assinatura expirou.');
			}
			const psbt = Psbt.fromHex(payload.psbtHex, { network: networks.testnet });
			const externalOutputTotal = psbt.txOutputs
				.filter((output) => {
					try {
						return address.fromOutputScript(output.script, networks.testnet) !== wallet!.address;
					} catch {
						return true;
					}
				})
				.reduce((total, output) => total + output.value, 0);
			if (externalOutputTotal > decision.totalPenaltySats) {
				throw new Error('A PSBT tenta movimentar mais que a penalidade aprovada.');
			}
			await psbt.signAllInputsAsync(createNip07TaprootSigner(session!.user.publicKey));
			let rawTransactionHex: string | null = null;
			try {
				psbt.finalizeAllInputs();
				rawTransactionHex = psbt.extractTransaction().toHex();
			} catch {
				// The PSBT remains valid and is relayed until the threshold is met.
			}
			if (rawTransactionHex) {
				const result = await broadcastDecision(
					session!.accessToken,
					decision.id,
					rawTransactionHex
				);
				success = `Transação transmitida: ${result.txid}`;
			} else {
				await publishSpendRequest({ ...payload, psbtHex: psbt.toHex() });
				success = 'Sua assinatura foi publicada; ainda faltam outros signatários.';
			}
			await load();
		});
	}
</script>

<svelte:head><title>Nuptalicium — Decisões</title></svelte:head>

<main class="stack-lg">
	{#if loading}
		<Card><p>Carregando decisões…</p></Card>
	{:else if contract && wallet}
		<section class="stack compact">
			<p class="muted">Enforcement econômico</p>
			<h1>{contract.title}</h1>
			<p>
				Saldo-base disponível: <strong
					>{wallet.confirmedBalanceSats.toLocaleString('pt-BR')} sats</strong
				>
			</p>
		</section>
		{#if error}<p class="message error surface">{error}</p>{/if}
		{#if success}<p class="message success surface">{success}</p>{/if}

		{#if me()?.role.startsWith('SPOUSE') && !decisions.some( (decision) => ['AWAITING_SPOUSE', 'ARBITRATION', 'APPROVED', 'SETTLING'].includes(decision.status) )}
			<Card
				><div class="stack">
					<h2>Abrir decisão</h2>
					<p class="muted">
						Selecione as cláusulas violadas. As penalidades serão calculadas sobre o saldo
						confirmado atual.
					</p>
					{#each contract.clauses.filter((clause) => clause.penalties.length > 0) as clause (clause.id)}
						<label class="clause"
							><input
								type="checkbox"
								checked={selectedClauseIds.includes(clause.id)}
								onchange={() => toggleClause(clause.id)}
							/><span
								><strong>{clause.title}</strong><small
									>{clause.penalties
										.map((penalty) =>
											penalty.type === 'PERCENTAGE' ? `${penalty.value}%` : `${penalty.value} sats`
										)
										.join(' + ')}</small
								></span
							></label
						>
					{/each}
					<Input label="Motivo e evidências" bind:value={reason} textarea />
					<Input label="Endereço Testnet4 beneficiário" bind:value={beneficiaryAddress} />
					<Button
						disabled={busy ||
							!reason.trim() ||
							!beneficiaryAddress.trim() ||
							selectedClauseIds.length === 0}
						onClick={openDecision}>Criar decisão</Button
					>
				</div></Card
			>
		{/if}

		{#each decisions as decision (decision.id)}
			<Card
				><div class="stack">
					<div class="row heading">
						<h2>Decisão</h2>
						<span class="pill">{decision.status}</span>
					</div>
					<p>{decision.reason}</p>
					<p>
						<strong>{decision.totalPenaltySats.toLocaleString('pt-BR')} sats</strong> sobre base de {decision.calculationBaseSats.toLocaleString(
							'pt-BR'
						)} sats
					</p>
					{#each decision.clauses as clause (clause.id)}<p class="muted">
							Cláusula: {contract.clauses.find((item) => item.id === clause.clauseId)?.title} — {clause.calculatedPenaltySats.toLocaleString(
								'pt-BR'
							)} sats
						</p>{/each}
					{#each votes[decision.id] || [] as item (item.id)}<p class="muted">
							{contract.participants.find((p) => p.id === item.voterId)?.displayName ||
								item.voterId}: {item.outcome}
						</p>{/each}
					{#if decision.userId !== me()?.id && ((decision.status === 'AWAITING_SPOUSE' && me()?.role.startsWith('SPOUSE')) || (decision.status === 'ARBITRATION' && me()?.role.startsWith('ARBITRATOR')))}
						<Input label="Justificativa" bind:value={rationale} textarea />
						<div class="row">
							<Button disabled={busy} onClick={() => vote(decision, 'APPROVE')}>Aprovar</Button
							><Button disabled={busy} variant="ghost" onClick={() => vote(decision, 'REJECT')}
								>Rejeitar</Button
							>
						</div>
					{/if}
					{#if decision.status === 'APPROVED' && decision.userId === me()?.id}
						<Input
							label="Mining fee (sats)"
							bind:value={networkFeeSats}
							type="number"
							min={1}
						/><Button disabled={busy} onClick={() => publishSettlement(decision)}
							>Assinar e publicar PSBT</Button
						>
					{/if}
					{#if decision.status === 'SETTLING' && decision.result === null}
						<Button disabled={busy} onClick={() => continueSettlement(decision)}
							>Buscar e coassinar PSBT</Button
						>
					{/if}
				</div></Card
			>
		{/each}
		<Button variant="ghost" href={`/contracts/${data.contractId}`}>Voltar ao contrato</Button>
	{/if}
</main>

<style>
	.compact {
		gap: 0.35rem;
	}
	.heading {
		justify-content: space-between;
	}
	.error {
		color: var(--rose-text);
	}
	.success {
		color: #386641;
	}
	.clause {
		display: flex;
		gap: 0.75rem;
		align-items: start;
		padding: 0.75rem;
		border: 1px solid var(--border-gray);
		border-radius: 12px;
	}
	.clause span {
		display: grid;
		gap: 0.25rem;
	}
</style>
