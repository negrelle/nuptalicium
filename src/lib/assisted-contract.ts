import type { ContractRulePayload } from './contract-rules';

export type AgreementTopicId =
	| 'PROPERTY'
	| 'SEPARATION'
	| 'MARITAL_OBLIGATIONS'
	| 'CHILDREN'
	| 'SUCCESSION'
	| 'OTHER';

export type AnswerValue = boolean | number | string;
export type AgreementAnswers = Record<string, AnswerValue>;
export type QuestionType = 'BOOLEAN' | 'SINGLE_CHOICE' | 'NUMBER' | 'PERCENTAGE' | 'TEXT';

export interface AgreementQuestion {
	id: string;
	topicId: AgreementTopicId;
	label: string;
	explanation?: string;
	type: QuestionType;
	defaultValue: AnswerValue;
	options?: Array<{ value: string; label: string }>;
	minimum?: number;
	maximum?: number;
	required?: boolean;
	visibleWhen?: { questionId: string; equals: AnswerValue };
}

export interface AgreementTopic {
	id: AgreementTopicId;
	title: string;
	description: string;
	legalNotice?: string;
	questions: AgreementQuestion[];
}

export interface GeneratedAgreementClause {
	key: string;
	topicId: AgreementTopicId;
	title: string;
	kind: 'RULE' | 'CONCEPT';
	description: string;
	rule: ContractRulePayload | null;
	legalNotice?: string;
}

const abandonmentQuestions: AgreementQuestion[] = [
	{
		id: 'abandonment_compensation',
		topicId: 'SEPARATION',
		label: 'Desejam prever compensação econômica se houver abandono reconhecido pelos árbitros?',
		explanation:
			'A consequência só pode ser aplicada após uma decisão arbitral e depende de garantia disponível.',
		type: 'BOOLEAN',
		defaultValue: false
	},
	{
		id: 'abandonment_days',
		topicId: 'SEPARATION',
		label: 'Após quantos dias o abandono poderá ser considerado?',
		type: 'NUMBER',
		defaultValue: 90,
		minimum: 1,
		maximum: 36500,
		required: true,
		visibleWhen: { questionId: 'abandonment_compensation', equals: true }
	},
	{
		id: 'abandonment_percentage',
		topicId: 'SEPARATION',
		label: 'Qual percentual da garantia da parte responsável poderá ser transferido?',
		type: 'PERCENTAGE',
		defaultValue: 20,
		minimum: 0.01,
		maximum: 100,
		required: true,
		visibleWhen: { questionId: 'abandonment_compensation', equals: true }
	}
];

export const AGREEMENT_TOPICS: AgreementTopic[] = [
	{
		id: 'PROPERTY',
		title: 'Patrimônio e bens',
		description: 'Registre como bens particulares e a administração do patrimônio serão tratados.',
		questions: [
			{
				id: 'private_property',
				topicId: 'PROPERTY',
				label: 'Quais bens vocês desejam reconhecer como particulares?',
				explanation: 'Descreva apenas o que ambos compreenderam e acordaram.',
				type: 'TEXT',
				defaultValue: ''
			},
			{
				id: 'property_management',
				topicId: 'PROPERTY',
				label: 'Como desejam administrar o patrimônio durante a relação?',
				type: 'SINGLE_CHOICE',
				defaultValue: 'INDEPENDENT',
				options: [
					{ value: 'INDEPENDENT', label: 'Cada pessoa administra seus próprios bens' },
					{ value: 'JOINT', label: 'Decisões patrimoniais relevantes serão conjuntas' },
					{ value: 'CUSTOM', label: 'Queremos descrever outro acordo' }
				]
			},
			{
				id: 'property_management_custom',
				topicId: 'PROPERTY',
				label: 'Descreva o acordo de administração patrimonial',
				type: 'TEXT',
				defaultValue: '',
				required: true,
				visibleWhen: { questionId: 'property_management', equals: 'CUSTOM' }
			}
		]
	},
	{
		id: 'SEPARATION',
		title: 'Separação',
		description:
			'Defina consequências privadas e procedimentos em caso de encerramento da relação.',
		questions: [
			...abandonmentQuestions,
			{
				id: 'separation_arrangements',
				topicId: 'SEPARATION',
				label: 'Há algum combinado adicional para uma eventual separação?',
				type: 'TEXT',
				defaultValue: ''
			}
		]
	},
	{
		id: 'MARITAL_OBLIGATIONS',
		title: 'Compromissos matrimoniais',
		description: 'Registre compromissos de convivência em linguagem clara.',
		questions: [
			{
				id: 'marital_commitments',
				topicId: 'MARITAL_OBLIGATIONS',
				label: 'Quais compromissos de convivência desejam registrar?',
				type: 'TEXT',
				defaultValue: ''
			},
			{
				id: 'repeated_breach_compensation',
				topicId: 'MARITAL_OBLIGATIONS',
				label:
					'Desejam vincular uma consequência econômica a violações repetidas desse compromisso?',
				explanation:
					'Os árbitros precisarão reconhecer cada ocorrência antes de qualquer consequência.',
				type: 'BOOLEAN',
				defaultValue: false
			},
			{
				id: 'breach_count',
				topicId: 'MARITAL_OBLIGATIONS',
				label: 'Quantas ocorrências reconhecidas serão necessárias?',
				type: 'NUMBER',
				defaultValue: 3,
				minimum: 1,
				maximum: 1000000,
				required: true,
				visibleWhen: { questionId: 'repeated_breach_compensation', equals: true }
			},
			{
				id: 'breach_percentage',
				topicId: 'MARITAL_OBLIGATIONS',
				label: 'Qual percentual da garantia poderá ser transferido?',
				type: 'PERCENTAGE',
				defaultValue: 10,
				minimum: 0.01,
				maximum: 100,
				required: true,
				visibleWhen: { questionId: 'repeated_breach_compensation', equals: true }
			}
		]
	},
	{
		id: 'CHILDREN',
		title: 'Filhos e responsabilidades',
		description:
			'Registre intenções e responsabilidades familiares sem apresentá-las como execução automática.',
		legalNotice:
			'Questões envolvendo filhos devem observar o melhor interesse da criança e podem exigir avaliação jurídica ou judicial.',
		questions: [
			{
				id: 'children_responsibilities',
				topicId: 'CHILDREN',
				label: 'Quais responsabilidades e intenções desejam registrar?',
				type: 'TEXT',
				defaultValue: ''
			}
		]
	},
	{
		id: 'SUCCESSION',
		title: 'Falecimento e sucessão',
		description:
			'Registre intenções para situações de falecimento, respeitando as limitações legais.',
		legalNotice:
			'Este acordo privado não substitui testamento, inventário ou regras sucessórias obrigatórias.',
		questions: [
			{
				id: 'succession_intentions',
				topicId: 'SUCCESSION',
				label: 'Quais intenções desejam deixar registradas?',
				type: 'TEXT',
				defaultValue: ''
			}
		]
	},
	{
		id: 'OTHER',
		title: 'Outros acordos personalizados',
		description: 'Inclua uma declaração que não se encaixa nos demais assuntos.',
		questions: [
			{
				id: 'other_agreements',
				topicId: 'OTHER',
				label: 'Descreva o acordo personalizado',
				type: 'TEXT',
				defaultValue: ''
			}
		]
	}
];

export function defaultAgreementAnswers(): AgreementAnswers {
	return Object.fromEntries(
		AGREEMENT_TOPICS.flatMap((topic) => topic.questions).map((question) => [
			question.id,
			question.defaultValue
		])
	);
}

export function visibleQuestions(
	selectedTopics: AgreementTopicId[],
	answers: AgreementAnswers
): AgreementQuestion[] {
	return AGREEMENT_TOPICS.filter((topic) => selectedTopics.includes(topic.id))
		.flatMap((topic) => topic.questions)
		.filter(
			(question) =>
				!question.visibleWhen ||
				answers[question.visibleWhen.questionId] === question.visibleWhen.equals
		);
}

export function validateAgreementAnswers(
	selectedTopics: AgreementTopicId[],
	answers: AgreementAnswers
): Record<string, string> {
	const errors: Record<string, string> = {};
	for (const question of visibleQuestions(selectedTopics, answers)) {
		const value = answers[question.id];
		if (question.required && (value === '' || value === undefined)) {
			errors[question.id] = 'Este campo é obrigatório.';
			continue;
		}
		if (question.type === 'NUMBER' || question.type === 'PERCENTAGE') {
			const numeric = Number(value);
			if (!Number.isFinite(numeric)) errors[question.id] = 'Informe um número válido.';
			else if (question.minimum !== undefined && numeric < question.minimum)
				errors[question.id] = `O valor mínimo é ${question.minimum}.`;
			else if (question.maximum !== undefined && numeric > question.maximum)
				errors[question.id] = `O valor máximo é ${question.maximum}.`;
		}
	}
	return errors;
}

function concept(
	key: string,
	topicId: AgreementTopicId,
	title: string,
	description: string,
	legalNotice?: string
): GeneratedAgreementClause | null {
	const normalized = description.trim();
	return normalized
		? { key, topicId, title, kind: 'CONCEPT', description: normalized, rule: null, legalNotice }
		: null;
}

function compensationRule(
	key: string,
	topicId: AgreementTopicId,
	title: string,
	subject: 'ABANDONMENT' | 'CUSTOM_BREACH',
	field: 'DURATION' | 'OCCURRENCE_COUNT',
	unit: 'DAY' | 'COUNT',
	value: number,
	percentage: number
): GeneratedAgreementClause {
	return {
		key,
		topicId,
		title,
		kind: 'RULE',
		description: `Após decisão arbitral, ${percentage}% da garantia da parte responsável poderá ser transferida ao outro cônjuge quando houver ${value} ${unit === 'DAY' ? 'dia(s)' : 'ocorrência(s)'} reconhecido(s).`,
		rule: {
			dslVersion: '1',
			definition: {
				trigger: { type: 'ARBITRATION_DECISION', subject },
				conditions: [{ field, operator: 'GREATER_OR_EQUAL', value, unit }],
				effect: {
					type: 'TRANSFER_COLLATERAL',
					amount: { type: 'PERCENTAGE', value: percentage },
					from: 'OFFENDING_PARTY',
					to: 'OTHER_SPOUSE'
				}
			}
		}
	};
}

export function generateAgreementClauses(
	selectedTopics: AgreementTopicId[],
	answers: AgreementAnswers
): GeneratedAgreementClause[] {
	if (Object.keys(validateAgreementAnswers(selectedTopics, answers)).length) return [];
	const clauses: Array<GeneratedAgreementClause | null> = [];
	if (selectedTopics.includes('PROPERTY')) {
		clauses.push(
			concept(
				'property.private',
				'PROPERTY',
				'Patrimônio particular',
				String(answers.private_property ?? '')
			)
		);
		const management = String(answers.property_management ?? 'INDEPENDENT');
		const managementText =
			management === 'JOINT'
				? 'As partes concordam em tomar conjuntamente as decisões patrimoniais relevantes.'
				: management === 'CUSTOM'
					? String(answers.property_management_custom ?? '')
					: 'Cada parte permanecerá responsável pela administração de seus próprios bens.';
		clauses.push(
			concept('property.management', 'PROPERTY', 'Administração patrimonial', managementText)
		);
	}
	if (selectedTopics.includes('SEPARATION')) {
		if (answers.abandonment_compensation === true) {
			clauses.push(
				compensationRule(
					'separation.abandonment',
					'SEPARATION',
					'Compensação econômica por abandono',
					'ABANDONMENT',
					'DURATION',
					'DAY',
					Number(answers.abandonment_days),
					Number(answers.abandonment_percentage)
				)
			);
		}
		clauses.push(
			concept(
				'separation.arrangements',
				'SEPARATION',
				'Acordos em caso de separação',
				String(answers.separation_arrangements ?? '')
			)
		);
	}
	if (selectedTopics.includes('MARITAL_OBLIGATIONS')) {
		clauses.push(
			concept(
				'marital.commitments',
				'MARITAL_OBLIGATIONS',
				'Compromissos de convivência',
				String(answers.marital_commitments ?? '')
			)
		);
		if (answers.repeated_breach_compensation === true) {
			clauses.push(
				compensationRule(
					'marital.repeated-breach',
					'MARITAL_OBLIGATIONS',
					'Consequência por descumprimento reiterado',
					'CUSTOM_BREACH',
					'OCCURRENCE_COUNT',
					'COUNT',
					Number(answers.breach_count),
					Number(answers.breach_percentage)
				)
			);
		}
	}
	const children = AGREEMENT_TOPICS.find((topic) => topic.id === 'CHILDREN');
	const succession = AGREEMENT_TOPICS.find((topic) => topic.id === 'SUCCESSION');
	if (selectedTopics.includes('CHILDREN'))
		clauses.push(
			concept(
				'children.responsibilities',
				'CHILDREN',
				'Responsabilidades relacionadas aos filhos',
				String(answers.children_responsibilities ?? ''),
				children?.legalNotice
			)
		);
	if (selectedTopics.includes('SUCCESSION'))
		clauses.push(
			concept(
				'succession.intentions',
				'SUCCESSION',
				'Intenções em caso de falecimento',
				String(answers.succession_intentions ?? ''),
				succession?.legalNotice
			)
		);
	if (selectedTopics.includes('OTHER'))
		clauses.push(
			concept('other.agreements', 'OTHER', 'Outros acordos', String(answers.other_agreements ?? ''))
		);
	return clauses.filter((clause): clause is GeneratedAgreementClause => clause !== null);
}

export interface BaseDocumentInput {
	title: string;
	spouseA: string;
	spouseB: string;
	arbitrators: string[];
	feePercent: number;
	expiresAt: string;
	hasBitcoinPolicy: boolean;
}

export function buildBaseDocument(input: BaseDocumentInput) {
	return [
		{
			title: 'Partes e objeto',
			text: `${input.spouseA} e ${input.spouseB} registram, no acordo “${input.title}”, entendimentos privados sobre sua relação e eventuais consequências econômicas.`
		},
		{
			title: 'Consentimento e aceite',
			text: 'O acordo depende do aceite expresso dos participantes indicados e pode ser revisto antes da submissão.'
		},
		{
			title: 'Arbitragem',
			text: `As decisões previstas serão avaliadas pelos árbitros ${input.arbitrators.join(', ')}. As taxas informadas somam ${input.feePercent}%.`
		},
		{
			title: 'Garantias econômicas',
			text: input.hasBitcoinPolicy
				? 'Existe uma política Bitcoin vinculada ao contrato. Transferências dependem de garantia disponível, dos fatos reconhecidos e do procedimento de arbitragem.'
				: 'A política Bitcoin ainda precisa ser inicializada antes da submissão.'
		},
		{
			title: 'Vigência e encerramento',
			text: `A proposta poderá ser aceita até ${input.expiresAt}. O encerramento seguirá os estados e procedimentos do contrato.`
		},
		{
			title: 'Limitações',
			text: 'Este é um instrumento privado. Ele não substitui pacto antenupcial, testamento ou orientação jurídica, e a execução em Bitcoin não produz automaticamente efeitos jurídicos.'
		}
	];
}
