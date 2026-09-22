const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
	day: '2-digit',
	month: '2-digit',
	year: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23'
});

export function formatDateTime(
	value: string | number | Date | null | undefined,
	fallback = 'Sem prazo'
) {
	if (value === null || value === undefined || value === '') return fallback;

	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return fallback;

	const parts = Object.fromEntries(
		dateTimeFormatter
			.formatToParts(date)
			.filter(({ type }) => type !== 'literal')
			.map(({ type, value: partValue }) => [type, partValue])
	);

	return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}
