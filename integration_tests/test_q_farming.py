from os.path import dirname, join
from unittest import TestCase
from decimal import Decimal

from datetime import timedelta
from pprint import pprint


import pytest
from helpers import *

from pytezos import ContractInterface, pytezos, MichelsonRuntimeError

from initial_storage import qfarm_lambdas

fa2_token = {
    "fA2" : {
        "token": "KT18amZmM5W7qDWVt2pH6uj7sCEd3kbzLrHT",
        "id": 0
    }
}

quipu_token = {
    "fA2" : {
        "token": "KT1AxaBxkFLCUi3f8rdDAAxBKHfzY8LfKDRA",
        "id": 0
    }
}

fees={
    "harvest_fee" : 50,
    "withdrawal_fee" : 50,
    "burn_reward" : 50
}

stake_params={
    "staked_token": fa2_token,
    "is_lp_staked_token": True,
    "qs_pool": "KT18fp5rcTW7mbWDmzFwjLDUhs5MeJmagDSZ"
}

class FarmTest(TestCase):
    @classmethod
    def setUpClass(self):
        self.maxDiff = None

        farm_code = open("./integration_tests/compiled/q_farm.tz", 'r').read()
        self.farm = ContractInterface.from_michelson(farm_code)

        storage_with_admin = self.farm.storage.dummy()
        storage_with_admin["q_farm_lambdas"] = qfarm_lambdas
        storage_with_admin["storage"]["admin"] = admin
        self.storage_with_admin = storage_with_admin


    def create_with_new_farm(self, patch = {}):
        chain = LocalChain(storage=self.storage_with_admin)
        params = dict(
            fees=fees,
            stake_params=stake_params,
            paused=False,
            reward_per_second=100 * PRECISION,
            timelock=0,
            start_time=0,
            token_info={"": ""}
        )
        for key, value in patch.items():
            params[key] = value

        res = chain.execute(self.farm.add_new_farm(**params), sender=admin)

        return chain

    def test_create_farm(self):
        chain = LocalChain(storage=self.storage_with_admin)
        res = chain.execute(self.farm.add_new_farm(
            fees={
                "harvest_fee" : 50,
                "withdrawal_fee" : 50,
                "burn_reward" : 50
            },
            stake_params={
                "staked_token": fa2_token,
                "is_lp_staked_token": True,
                "qs_pool": "KT18fp5rcTW7mbWDmzFwjLDUhs5MeJmagDSZ"
            },
            paused=False,
            reward_per_second=101010101010101010,
            timelock=0,
            start_time=1,
            token_info={"": ""}
        ), sender=admin)

        pprint(res.storage["storage"])

    def test_farm_create_deposit_withdraw(self):
        chain = self.create_with_new_farm()

        res = chain.execute(self.farm.deposit(0, 50, None, me, candidate))

        chain.advance_blocks(1)
    
        res = chain.execute(self.farm.harvest(0, me))

        mints = parse_mints(res)
        self.assertEqual(mints[0]["amount"], 30)
        self.assertEqual(mints[0]["destination"], burn_address)
        self.assertEqual(mints[1]["amount"], 5970)
        self.assertEqual(mints[1]["destination"], me)

        res = chain.execute(self.farm.withdraw(0, 50, me, me))

        transfers = parse_token_transfers(res)
        self.assertEqual(transfers[0]["amount"], 50)
        self.assertEqual(transfers[0]["destination"], me)


    def test_farm_decreasing_rps_dont_increase_rewards(self):
        chain = self.create_with_new_farm()

        res = chain.execute(self.farm.deposit(0, 50, None, me, candidate))

        chain.advance_blocks(1)
    
        res = chain.execute(self.farm.set_reward_per_second([{"fid": 0, "reward_per_second": 5 * PRECISION}]), sender=admin)

        chain.advance_blocks(1)
        res = chain.execute(self.farm.harvest(0, me))

        mints = parse_mints(res)
        self.assertEqual(mints[0]["amount"], 30 + 2)
        self.assertEqual(mints[0]["destination"], burn_address)
        self.assertEqual(mints[1]["amount"], 5970 + 298)
        self.assertEqual(mints[1]["destination"], me)

    def test_timelock_withdraw_burn(self):
        chain = LocalChain(storage=self.storage_with_admin)
        res = chain.execute(self.farm.add_new_farm(
            fees=fees,
            stake_params=stake_params,
            paused=False,
            reward_per_second=100 * PRECISION,
            timelock=120,
            start_time=0,
        ), sender=admin)

        res = chain.execute(self.farm.deposit(0, 50, None, me, candidate))

        chain.advance_blocks(1)
        
        res = chain.execute(self.farm.deposit(0, 1, None, me, candidate))
        mints = parse_mints(res)
        self.assertEqual(len(mints), 0)

        res = chain.execute(self.farm.withdraw(0, 50, me, me))

        mints = parse_mints(res)
        self.assertEqual(mints[0]["amount"], 6000)
        self.assertEqual(mints[0]["destination"], burn_address)

        transfers = parse_token_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["amount"], 50 - 1)
        self.assertEqual(transfers[0]["destination"], me)


    def test_fair_reward_distribution(self):
        chain = self.create_with_new_farm()

        res = chain.execute(self.farm.deposit(0, 50, None, alice, candidate), sender=alice)
        res = chain.execute(self.farm.deposit(0, 50, None, bob, candidate), sender=bob)
        res = chain.execute(self.farm.deposit(0, 50, None, julian, candidate), sender=julian)

        chain.advance_blocks(1)

        res = chain.execute(self.farm.harvest(0, alice), sender=alice)
        mints = parse_mints(res)
        self.assertEqual(mints[1]["amount"], 1990)
        self.assertEqual(mints[1]["destination"], alice)

        res = chain.execute(self.farm.harvest(0, bob), sender=bob)
        mints = parse_mints(res)
        self.assertEqual(mints[1]["amount"], 1990)
        self.assertEqual(mints[1]["destination"], bob)

        chain.advance_blocks(1)
        
        res = chain.execute(self.farm.harvest(0, julian), sender=julian)
        mints = parse_mints(res)
        self.assertEqual(mints[1]["amount"], 1990 * 2)
        self.assertEqual(mints[1]["destination"], julian)

        res = chain.execute(self.farm.harvest(0, alice), sender=alice)
        mints = parse_mints(res)
        self.assertEqual(mints[1]["amount"], 1990)
        self.assertEqual(mints[1]["destination"], alice)

    def test_reward_miniscule(self):
        chain = self.create_with_new_farm()

        res = chain.execute(self.farm.deposit(0, 100_000_000, None, alice, candidate), sender=alice)
        res = chain.execute(self.farm.deposit(0, 10_000, None, bob, candidate), sender=bob)
        res = chain.execute(self.farm.deposit(0, 1, None, julian, candidate), sender=julian)

        chain.advance_blocks(500)

        res = chain.execute(self.farm.harvest(0, alice), sender=alice)
        mints = parse_mints(res)
        self.assertEqual(mints[1]["amount"], 2_984_701)
        self.assertEqual(mints[1]["destination"], alice)

        res = chain.execute(self.farm.harvest(0, bob), sender=bob)
        mints = parse_mints(res)
        self.assertEqual(mints[1]["amount"], 297)
        self.assertEqual(mints[1]["destination"], bob)

        res = chain.execute(self.farm.harvest(0, julian), sender=julian)
        mints = parse_mints(res)
        self.assertEqual(mints, [])

    def test_earn_doesnt_affect_others(self):
        chain = self.create_with_new_farm()

        res = chain.execute(self.farm.deposit(0, 10_000, None, alice, candidate), sender=alice)
        res = chain.execute(self.farm.deposit(0, 100_000, None, bob, candidate), sender=bob)

        chain.advance_blocks(1)

        res = chain.execute(self.farm.harvest(0, alice), sender=alice)
        mints = parse_mints(res)

        # something was paid
        self.assertGreater(mints[0]["amount"], 0)

        storage_before = res.storage

        # try calling earn once again in the same block
        res = chain.execute(self.farm.harvest(0, alice), sender=alice)
        mints = parse_mints(res)

        self.assertEqual(res.storage, storage_before)

    def test_rewards_in_time(self):
        chain = self.create_with_new_farm()

        res = chain.execute(self.farm.deposit(0, 50, None, alice, candidate), sender=alice)
        res = chain.execute(self.farm.deposit(0, 50, None, bob, candidate), sender=bob)

        total_alice_rewards = 0
        total_fee = 0
        for i in range(10):
            chain.advance_blocks(1)
            res = chain.execute(self.farm.harvest(0, alice), sender=alice)
            mints = parse_mints(res)
            total_fee += mints[0]["amount"]
            total_alice_rewards += mints[1]["amount"]

        res = chain.execute(self.farm.harvest(0, bob), sender=bob)

        mints = parse_mints(res)
        bob_reward = mints[1]["amount"]

        self.assertEqual(total_alice_rewards, bob_reward)

    def test_farm_vote_when_join_quit(self):
        chain = self.create_with_new_farm()

        res = chain.execute(self.farm.deposit(0, 50, None, alice, candidate), sender=alice)

        votes = parse_votes(res)
        self.assertEqual(votes[0]["amount"], 50)

        res = chain.execute(self.farm.deposit(0, 50, None, bob, candidate), sender=bob)
        votes = parse_votes(res)
        self.assertEqual(votes[0]["amount"], 100)

        chain.advance_blocks(1)

        res = chain.execute(self.farm.withdraw(0, 40, alice, alice), sender=alice)
        votes = parse_votes(res)
        self.assertEqual(votes[0]["amount"], 60)

        res = chain.execute(self.farm.withdraw(0, 50, bob, bob), sender=bob)
        votes = parse_votes(res)
        self.assertEqual(votes[0]["amount"], 10)


    def test_farm_miniscule_withdrawal_fee(self):
        chain = self.create_with_new_farm({"timelock": 100})

        res = chain.execute(self.farm.deposit(0, 10_000, None, me, candidate))
        transfers = parse_token_transfers(res)
        self.assertEqual(transfers[0]["destination"], contract_self_address)

        res = chain.interpret(self.farm.withdraw(0, 1000, me, me))
        transfers = parse_token_transfers(res)
        self.assertEqual(transfers[0]["destination"], me)
        self.assertEqual(transfers[0]["amount"], 995)

        farm_stake = res.storage["storage"]["users_info"][(0, contract_self_address)]["staked"]
        self.assertEqual(farm_stake, 5)


        res = chain.interpret(self.farm.withdraw(0, 200, me, me))
        transfers = parse_token_transfers(res)
        self.assertEqual(transfers[0]["destination"], me)
        self.assertEqual(transfers[0]["amount"], 199)
        farm_stake = res.storage["storage"]["users_info"][(0, contract_self_address)]["staked"]
        self.assertEqual(farm_stake, 1)

        res = chain.interpret(self.farm.withdraw(0, 10, me, me))
        transfers = parse_token_transfers(res)
        self.assertEqual(transfers[0]["destination"], me)
        self.assertEqual(transfers[0]["amount"], 9)
        farm_stake = res.storage["storage"]["users_info"][(0, contract_self_address)]["staked"]
        self.assertEqual(farm_stake, 1)

        res = chain.interpret(self.farm.withdraw(0, 1, me, me))
        transfers = parse_token_transfers(res)
        self.assertEqual(transfers[0]["destination"], me)
        self.assertEqual(transfers[0]["amount"], 0)
        farm_stake = res.storage["storage"]["users_info"][(0, contract_self_address)]["staked"]
        self.assertEqual(farm_stake, 1)

    def test_farm_zero_join_and_quit(self):
        chain = self.create_with_new_farm()

        res = chain.execute(self.farm.deposit(0, 0, None, me, candidate))
        transfers = parse_token_transfers(res)
        self.assertEqual(len(transfers), 0)

        res = chain.execute(self.farm.withdraw(0, 0, me, me))
        transfers = parse_token_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["destination"], me)
        self.assertEqual(transfers[0]["amount"], 0)
