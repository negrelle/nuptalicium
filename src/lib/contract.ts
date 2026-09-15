import type {
	ContractArtifact,
	ContractDraft,
	ContractDocumentBundle,
	ContractRecord
} from '$lib/types';

function sortObject<T>(value: T): T {
	if (Array.isArray(value)) {
		return value.map((item) => sortObject(item)) as T;
	}

	if (value && typeof value === 'object') {
		const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
			a.localeCompare(b)
		);
		const sorted: Record<string, unknown> = {};

		for (const [key, item] of entries) {
			sorted[key] = sortObject(item);
		}

		return sorted as T;
	}

	return value;
}

export function stableContractJson(draft: ContractDraft) {
	return sortObject(draft);
}

export function contractJsonString(draft: ContractDraft) {
	return JSON.stringify(stableContractJson(draft));
}

export async function sha256Hex(value: string) {
	const bytes = new TextEncoder().encode(value);
	const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
	return Array.from(new Uint8Array(hashBuffer), (byte) => byte.toString(16).padStart(2, '0')).join(
		''
	);
}

export function generateContractDocument(draft: ContractDraft) {
	const lines: string[] = [];
	const title = draft.contract_title.trim() || 'Contrato nupcial privado';

	lines.push(`CONTRATO: ${title}`);
	lines.push('');
	lines.push('As partes');
	lines.push(`- Parte A: ${draft.npub_a}`);
	lines.push(`- Parte B: ${draft.npub_b}`);
	lines.push('');
	lines.push('Árbitros designados');
	lines.push(`- Árbitro de A: ${draft.arbitrator_a}`);
	lines.push(`- Árbitro de B: ${draft.arbitrator_b}`);
	lines.push(`- Árbitro neutro: ${draft.arbitrator_neutral}`);
	lines.push('');
	lines.push('Modelo financeiro');
	lines.push(
		draft.has_initial_collateral
			? `- Colateral inicial: ${draft.collateral_sats_a} sats de A e ${draft.collateral_sats_b} sats de B.`
			: '- Não há colateral inicial definido.'
	);
	lines.push(
		draft.has_periodic_contributions
			? `- Contribuições periódicas: ${draft.frequency}, ${draft.contribution_sats_a} sats de A e ${draft.contribution_sats_b} sats de B, carência de ${draft.grace_days} dias.`
			: '- Não há contribuições periódicas definidas.'
	);
	lines.push(
		draft.unilateral_dissolution_allowed
			? `- Dissolução unilateral permitida com aviso de ${draft.notice_days} dias e penalidade de ${draft.penalty_sats} sats.`
			: '- Dissolução unilateral não permitida.'
	);
	lines.push('');
	lines.push('Vigência');
	lines.push(
		draft.duration_type === 'fixed'
			? `- Vigência fixa de ${draft.duration_years} ano(s).`
			: '- Vigência por prazo indeterminado.'
	);
	lines.push(
		draft.has_deadmans_switch
			? `- Dead man's switch ativo com timeout de ${draft.timeout_days} dias e herdeiros ${draft.heir_address_a} / ${draft.heir_address_b}.`
			: "- Não há dead man's switch."
	);
	lines.push('');
	lines.push('Disposições especiais');
	lines.push(
		draft.fidelity_clause
			? `- Cláusula de fidelidade aplicável, prova padrão: ${draft.proof_standard}.`
			: '- Não há cláusula de fidelidade.'
	);

	for (const clause of draft.custom_clauses) {
		lines.push(`- ${clause.title}: ${clause.description} | prova: ${clause.proof_standard}`);
	}

	return lines.join('\n');
}

export function buildContractDocumentBundle(
	draft: ContractDraft,
	hashHex: string
): ContractDocumentBundle {
	return {
		document: generateContractDocument(draft),
		hashHex,
		json: stableContractJson(draft)
	};
}

export function buildContractRecord(
	artifact: ContractArtifact,
	draft: ContractDraft,
	counterparty: string
): ContractRecord {
	return {
		id: artifact.eventId,
		eventId: artifact.eventId,
		contractHash: artifact.contractHash,
		title: draft.contract_title.trim() || 'Contrato nupcial privado',
		counterparty,
		status: artifact.status,
		balanceSats: artifact.balanceSats,
		multisigAddress: artifact.multisigAddress,
		draft
	};
}
