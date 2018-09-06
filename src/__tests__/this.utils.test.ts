import * as thisUtils from './utils'
import * as ow from '../ow'
import * as utils from '../utils'
import { BigNumber } from 'bignumber.js'
import { config, getConfig } from '../config'


const destAddress = 'Ad2UfBK3XZtZdwzawD7c6NCAduvqT65xs1'

jest.setTimeout(15*1000)

beforeAll(() => {
	config('test')
})


describe('test of test utils', () => {

	it('ensure account have enough assets', async () => {

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

		await thisUtils.wait(12*1000)

		const r = await ow.getClient().getBalance(utils.base58ToAddr(destAddress))
		expect(r.Error).toEqual(0)

		const ont = new BigNumber(r.Result.ont)
		expect(ont.isGreaterThanOrEqualTo(30)).toBeTruthy()

		const ong = new BigNumber(r.Result.ong)
		expect(ong.isGreaterThanOrEqualTo(gasRequired))

	})
})
