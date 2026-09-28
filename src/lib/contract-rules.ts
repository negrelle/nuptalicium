export type TriggerType = 'ARBITRATION_DECISION';
export type RuleSubject = 'ABANDONMENT' | 'CUSTOM_BREACH';
export type ConditionField = 'DURATION' | 'OCCURRENCE_COUNT';
export type ConditionUnit = 'DAY' | 'COUNT';
export type RuleOperator =
	| 'EQUAL'
	| 'NOT_EQUAL'
	| 'GREATER_THAN'
	| 'GREATER_OR_EQUAL'
	| 'LESS_THAN'
	| 'LESS_OR_EQUAL';
export type EffectType = 'TRANSFER_COLLATERAL';
export type AmountType = 'SATS' | 'PERCENTAGE';
export type PartyReference = 'SPOUSE_A' | 'SPOUSE_B' | 'OFFENDING_PARTY' | 'OTHER_SPOUSE';
export type SpouseRole = 'SPOUSE_A' | 'SPOUSE_B';

export interface RuleTrigger {
	type: TriggerType;
	subject: RuleSubject;
}

export interface RuleCondition {
	field: ConditionField;
	operator: RuleOperator;
	value: number;
	unit: ConditionUnit;
}

export interface RuleAmount {
	type: AmountType;
	value: number;
}

export interface RuleEffect {
	type: EffectType;
	amount: RuleAmount;
	from: PartyReference;
	to: PartyReference;
}

export interface ContractRuleDefinition {
	trigger: RuleTrigger;
	conditions: RuleCondition[];
	effect: RuleEffect;
}

export interface ContractRulePayload {
	dslVersion: '1';
	definition: ContractRuleDefinition;
}

export interface ContractRule extends ContractRulePayload {
	id: string;
	sourceTemplateId: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface RuleFact {
	value: number;
	unit: ConditionUnit;
}

export type DecisionFacts = Partial<Record<ConditionField, RuleFact>>;

export interface RuleValidationError {
	path: string;
	code: string;
	message: string;
	clauseId: string | null;
	conditionIndex: number | null;
	field: ConditionField | null;
	operator: RuleOperator | null;
	expected: unknown;
	actual: unknown;
}

export interface RuleSchema {
	dslVersion: '1';
	triggers: Array<{
		value: TriggerType;
		label: string;
		subjects: Array<{
			value: RuleSubject;
			label: string;
			fields: Array<{
				value: ConditionField;
				label: string;
				valueType: 'INTEGER';
				units: ConditionUnit[];
				operators: RuleOperator[];
			}>;
		}>;
	}>;
	effects: Array<{
		value: EffectType;
		label: string;
		amountTypes: AmountType[];
		allowedPartyPairs: Array<{ from: PartyReference; to: PartyReference }>;
	}>;
}

export const DEFAULT_RULE: ContractRulePayload = {
	dslVersion: '1',
	definition: {
		trigger: { type: 'ARBITRATION_DECISION', subject: 'ABANDONMENT' },
		conditions: [{ field: 'DURATION', operator: 'GREATER_OR_EQUAL', value: 90, unit: 'DAY' }],
		effect: {
			type: 'TRANSFER_COLLATERAL',
			amount: { type: 'PERCENTAGE', value: 20 },
			from: 'OFFENDING_PARTY',
			to: 'OTHER_SPOUSE'
		}
	}
};

export function cloneRule(rule: ContractRulePayload = DEFAULT_RULE): ContractRulePayload {
	return structuredClone(rule);
}
