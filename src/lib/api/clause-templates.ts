import { apiRequest } from '$lib/api/client';
import type { ConditionUnit, RuleTrigger, RuleValidationError } from '$lib/contract-rules';

export type TemplateParameterType = 'INTEGER' | 'SATS' | 'PERCENTAGE';

export interface TemplateParameterDefinition {
	name: string;
	label: string;
	valueType: TemplateParameterType;
	required: boolean;
	defaultValue: number | null;
	minimum: number | null;
	maximum: number | null;
	unit: ConditionUnit | null;
}

export interface ClauseTemplateDefinition {
	parameters: TemplateParameterDefinition[];
	trigger: RuleTrigger;
	conditions: unknown[];
	effect: unknown;
}

export interface ClauseTemplate {
	id: string;
	authorId: string | null;
	source: 'SYSTEM' | 'COMMUNITY';
	dslVersion: '1';
	title: string;
	description: string;
	category: string | null;
	definition: ClauseTemplateDefinition;
	active: boolean;
	createdAt: string;
	updatedAt: string;
}

export function listClauseTemplates(accessToken: string) {
	return apiRequest<ClauseTemplate[]>('/clause-templates', {}, accessToken);
}

export function previewClauseTemplate(
	accessToken: string,
	templateId: string,
	title: string,
	parameters: Record<string, number>
) {
	return apiRequest<{ valid: boolean; description: string | null; errors: RuleValidationError[] }>(
		`/clause-templates/${templateId}/preview`,
		{ method: 'POST', body: JSON.stringify({ title: title || null, parameters }) },
		accessToken
	);
}
