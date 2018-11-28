import * as thisUtils from './utils'
import * as ow from '../ow'
import * as utils from '../utils'
import { BigNumber } from 'bignumber.js'
import { config, getConfig } from '../config'

const destAddress = 'Ad2UfBK3XZtZdwzawD7c6NCAduvqT65xs1'

jest.setTimeout(30 * 1000)

beforeAll(() => {
	config('test')
})

afterAll(() => {
	ow.getClient().close()
})

describe('test of test utils', () => {

	it('Test address convert', () => {
		const mainBase58 = 'AKGMA1JNKSKD1MjpMCLJ38WQNTHVfjobbZ'
		const mainHex = '264afcc852f8d25d2e0bfb38f2d5fe31da6de70d'

		let addr = utils.base58ToAddr(mainBase58)
		let hex = utils.addrToContractHex(addr)
		expect(hex).toEqual(mainHex)
		let base58 = utils.addrToBase58(addr)
		expect(base58).toEqual(mainBase58)

		addr = utils.contractHexToAddr(mainHex)
		hex = utils.addrToContractHex(addr)
		expect(hex).toEqual(mainHex)
		base58 = utils.addrToBase58(addr)
		expect(base58).toEqual(mainBase58)

		hex = utils.base58ToContractHex(mainBase58)
		expect(hex).toEqual(mainHex)

		base58 = utils.contractHexToBase58(mainHex)
		expect(base58).toEqual(mainBase58)
	})

	/* it('ensure account have enough assets', async () => {

		const conf = getConfig()
		const gasPrice = new BigNumber(conf.ontology.gasPrice)
		const gasLimit = new BigNumber(conf.ontology.gasLimit)
		const gasRequired = gasPrice.multipliedBy(gasLimit)

		const beSure = await thisUtils.ensureAssetsOfAccount(
			destAddress,
			{
				ont: '41',
				ong: gasRequired.multipliedBy(1.2).toString()
			}
		)
		expect(beSure).toBeTruthy()

		await thisUtils.wait(12 * 1000)

		const r = await ow.getClient().getBalance(utils.base58ToAddr(destAddress))
		expect(r.Error).toEqual(0)

		const ont = new BigNumber(r.Result.ont)
		expect(ont.isGreaterThanOrEqualTo(30)).toBeTruthy()

		const ong = new BigNumber(r.Result.ong)
		expect(ong.isGreaterThanOrEqualTo(gasRequired))

	}) */
})
