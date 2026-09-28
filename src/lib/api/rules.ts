import { apiRequest } from '$lib/api/client';
import type { ContractRulePayload, RuleSchema, RuleValidationError } from '$lib/contract-rules';

export function getRuleSchema(accessToken: string) {
	return apiRequest<RuleSchema>('/rule-schema', {}, accessToken);
}

export function validateRule(accessToken: string, rule: ContractRulePayload) {
	return apiRequest<{ valid: boolean; errors: RuleValidationError[] }>(
		'/rules/validate',
		{ method: 'POST', body: JSON.stringify(rule) },
		accessToken
	);
}

export function previewRule(accessToken: string, title: string, rule: ContractRulePayload) {
	return apiRequest<{ valid: boolean; description: string | null; errors: RuleValidationError[] }>(
		'/rules/preview',
		{ method: 'POST', body: JSON.stringify({ title, rule }) },
		accessToken
	);
}
