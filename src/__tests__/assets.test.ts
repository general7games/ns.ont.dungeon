import * as assets from '../assets'
import * as ow from '../ow'
import * as testUtils from './utils'
import * as ont from 'ontology-ts-sdk'
import * as err from '../errors'
import { BigNumber } from 'bignumber.js'
import { config } from '../config'
import { watchFile } from 'fs';

const destAddress = 'Ad2UfBK3XZtZdwzawD7c6NCAduvqT65xs1'

jest.setTimeout(10*1000)

beforeAll(() => {
	config('test')
})


describe('assets test', () => {

	it('transfer ont', async () => {
		const mainAccout = testUtils.getMainAccountOfTestNode()
		expect(mainAccout).not.toBeNull()

		if (mainAccout) {
			let r = await ow.getClient().getBalance(mainAccout.address())
			expect(r.Error).toEqual(0)
			const ontAmount = new BigNumber(r.Result.ont)
			expect(ontAmount.isGreaterThan(1)).toBeTruthy()

			r = await ow.getClient().getBalance(new ont.Crypto.Address(destAddress))
			expect(r.Error).toEqual(0)
			const destOntAmount = new BigNumber(r.Result.ont)

			const transfered = await assets.transfer('ONT', '1', mainAccout, '123456789', destAddress)
			expect(transfered).toEqual(err.SUCCESS)

			await testUtils.wait(8000)

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
			let r = await ow.getClient().getBalance(mainAccout.address())
			expect(r.Error).toEqual(0)
			const ongAmount = new BigNumber(r.Result.ong)
			expect(ongAmount.isGreaterThan(1)).toBeTruthy()

			r = await ow.getClient().getBalance(new ont.Crypto.Address(destAddress))
			expect(r.Error).toEqual(0)
			const destOngAmount = new BigNumber(r.Result.ong)

			const transfered = await assets.transfer('ONG', '1', mainAccout, '123456789', destAddress)
			expect(transfered).toEqual(err.SUCCESS)

			await testUtils.wait(8000)

			r = await ow.getClient().getBalance(new ont.Crypto.Address(destAddress))
			expect(r.Error).toEqual(0)
			const destOngAmountAfterTransfered = new BigNumber(r.Result.ong)
			expect(destOngAmountAfterTransfered.minus(destOngAmount).isEqualTo(1)).toBeTruthy()
		}
	})



})