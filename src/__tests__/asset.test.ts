import * as asset from '../asset'
import * as ow from '../ow'
import * as testUtils from './utils'
import * as ont from 'ontology-ts-sdk'
import * as err from '../errors'
import { BigNumber } from 'bignumber.js'
import { config } from '../config'

const destAddress = 'Ad2UfBK3XZtZdwzawD7c6NCAduvqT65xs1'

jest.setTimeout(20 * 1000)

beforeAll(() => {
	config('test')
})

afterAll(() => {
	ow.getClient().close()
})

describe('assets test', () => {

	it('transfer ont', async () => {
		const mainAccout = testUtils.getMainAccountOfTestNode()
		expect(mainAccout).not.toBeNull()

		if (mainAccout) {
			let r = await ow.getClient().getBalance(mainAccout.address)
			expect(r.Error).toEqual(0)
			const ontAmount = new BigNumber(r.Result.ont)
			expect(ontAmount.isGreaterThan(1)).toBeTruthy()

			r = await ow.getClient().getBalance(new ont.Crypto.Address(destAddress))
			expect(r.Error).toEqual(0)
			const destOntAmount = new BigNumber(r.Result.ont)

			const transfered = await asset.transfer('ONT', '1', mainAccout, destAddress)
			expect(transfered).toEqual(err.SUCCESS)

			await testUtils.wait(5000)

			r = await ow.getClient().getBalance(new ont.Crypto.Address(destAddress))
			expect(r.Error).toEqual(0)
			const destOntAmountAfterTransfered = new BigNumber(r.Result.ont)
			expect(destOntAmountAfterTransfered.minus(destOntAmount).isEqualTo(1)).toBeTruthy()

		}
	})

	it('transfer ong', async () => {
		const mainAccout = testUtils.getMainAccountOfTestNode()
		expect(mainAccout).not.toBeNull()

		if (mainAccout) {
			let r = await ow.getClient().getBalance(mainAccout.address)
			expect(r.Error).toEqual(0)
			const ongAmount = new BigNumber(r.Result.ong)
			expect(ongAmount.isGreaterThan(1)).toBeTruthy()

			r = await ow.getClient().getBalance(new ont.Crypto.Address(destAddress))
			expect(r.Error).toEqual(0)
			const destOngAmount = new BigNumber(r.Result.ong)

			const transfered = await asset.transfer('ONG', '1', mainAccout, destAddress)
			expect(transfered).toEqual(err.SUCCESS)

			await testUtils.wait(5000)

			r = await ow.getClient().getBalance(new ont.Crypto.Address(destAddress))
			expect(r.Error).toEqual(0)
			const destOngAmountAfterTransfered = new BigNumber(r.Result.ong)
			expect(destOngAmountAfterTransfered.minus(destOngAmount).isEqualTo(1)).toBeTruthy()
		}
	})

})
