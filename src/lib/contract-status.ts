import type { ContractStatus } from '$lib/api/contracts';

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
	DRAFT: 'Rascunho',
	PENDING_ACCEPTANCE: 'Aguardando aceite',
	AWAITING_FUNDING: 'Aguardando depósito',
	ACTIVE: 'Ativo',
	CLOSED: 'Encerrado',
	CANCELLED: 'Cancelado',
	EXPIRED: 'Expirado'
};
