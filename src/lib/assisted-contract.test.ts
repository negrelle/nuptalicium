import assert from 'node:assert/strict';
import test from 'node:test';
import {
	buildBaseDocument,
	defaultAgreementAnswers,
	generateAgreementClauses,
	validateAgreementAnswers,
	visibleQuestions
} from './assisted-contract.ts';

test('generates a DSL-compatible abandonment rule from answers', () => {
	const answers = {
		...defaultAgreementAnswers(),
		abandonment_compensation: true,
		abandonment_days: 120,
		abandonment_percentage: 25
	};
	const clauses = generateAgreementClauses(['SEPARATION'], answers);
	const rule = clauses.find((clause) => clause.key === 'separation.abandonment')?.rule;

	assert.equal(rule?.dslVersion, '1');
	assert.equal(rule?.definition.trigger.subject, 'ABANDONMENT');
	assert.deepEqual(rule?.definition.conditions[0], {
		field: 'DURATION',
		operator: 'GREATER_OR_EQUAL',
		value: 120,
		unit: 'DAY'
	});
	assert.equal(rule?.definition.effect.amount.value, 25);
});

test('omits the economic rule when compensation is disabled', () => {
	const clauses = generateAgreementClauses(['SEPARATION'], defaultAgreementAnswers());
	assert.equal(
		clauses.some((clause) => clause.kind === 'RULE'),
		false
	);
});

test('resolves conditional questions and validates percentages', () => {
	const defaults = defaultAgreementAnswers();
	assert.equal(
		visibleQuestions(['SEPARATION'], defaults).some(
			(question) => question.id === 'abandonment_days'
		),
		false
	);

	const answers = { ...defaults, abandonment_compensation: true, abandonment_percentage: 101 };
	assert.equal(
		visibleQuestions(['SEPARATION'], answers).some(
			(question) => question.id === 'abandonment_days'
		),
		true
	);
	assert.match(validateAgreementAnswers(['SEPARATION'], answers).abandonment_percentage, /máximo/);
});

test('generates textual clauses without inventing an executable rule', () => {
	const clauses = generateAgreementClauses(['CHILDREN'], {
		...defaultAgreementAnswers(),
		children_responsibilities: 'Decisões escolares serão conversadas em conjunto.'
	});
	assert.equal(clauses.length, 1);
	assert.equal(clauses[0].kind, 'CONCEPT');
	assert.equal(clauses[0].rule, null);
	assert.match(clauses[0].legalNotice ?? '', /melhor interesse/);
});

test('builds the structural document separately from negotiated clauses', () => {
	const sections = buildBaseDocument({
		title: 'Acordo de teste',
		spouseA: 'Ana',
		spouseB: 'Bruno',
		arbitrators: ['Carla', 'Daniel'],
		feePercent: 4,
		expiresAt: '31/12/2027',
		hasBitcoinPolicy: true
	});
	assert.equal(sections.length, 6);
	assert.match(sections.at(-1)?.text ?? '', /não substitui pacto antenupcial/);
});
