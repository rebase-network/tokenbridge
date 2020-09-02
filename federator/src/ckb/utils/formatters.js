// const base = 10e9

const shannonToCKBFormatter = (shannon) => {
	const delimiter = ','
	const showPositiveSign = false
	if (Number.isNaN(+shannon)) {
		console.warn('Shannon is not a valid number')
		return shannon
	}
	if (shannon === null) {
		return '0'
	}
	let sign = ''
	if (shannon.startsWith('-')) {
		sign = '-'
	} else if (showPositiveSign) {
		sign = '+'
	}
	const unsignedShannon = shannon.replace(/^-?0*/, '')
	let unsignedCKB = ''
	if (unsignedShannon.length <= 8) {
		unsignedCKB = `0.${unsignedShannon.padStart(8, '0')}`.replace(
			/\.?0+$/,
			''
		)
	} else {
		const decimal = `.${unsignedShannon.slice(-8)}`.replace(/\.?0+$/, '')
		const int = unsignedShannon.slice(0, -8).replace(/\^0+/, '')
		unsignedCKB = `${(
			int
				.split('')
				.reverse()
				.join('')
				.match(/\d{1,3}/g) || ['0']
		)
			.join(delimiter)
			.split('')
			.reverse()
			.join('')}${decimal}`
	}
	return +unsignedCKB === 0 ? '0' : `${sign}${unsignedCKB}`
}

const truncateAddress = (address) =>
	`${address.substr(0, 10)}...${address.substr(
		address.length - 10,
		address.length
	)}`

const truncateHash = (hashParma) =>
	`${hashParma.substr(0, 10)}...${hashParma.substr(
		hashParma.length - 10,
		hashParma.length
    )}`
    
module.exports = {
    shannonToCKBFormatter
}