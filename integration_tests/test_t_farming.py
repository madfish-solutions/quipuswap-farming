from os.path import dirname, join
from unittest import TestCase
from decimal import Decimal

from datetime import timedelta
from pprint import pprint

import json

import pytest
from helpers import *

from pytezos import ContractInterface, pytezos, MichelsonRuntimeError

from initial_storage import tfarm_lambdas

reward_token_id = 7
stake_token_id = 0

fa2_token = {
    "fA2" : {
        "token": "KT18amZmM5W7qDWVt2pH6uj7sCEd3kbzLrHT",
        "id": stake_token_id
    }
}

reward_token = {
    "fA2" : {
        "token": "KT1XRPEPXbZK25r3Htzp2o1x7xdMMmfocKNW",
        "id": reward_token_id
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
}

stake_params={
    "staked_token": fa2_token,
    "is_lp_staked_token": True,
    "qs_pool": "KT18fp5rcTW7mbWDmzFwjLDUhs5MeJmagDSZ"
}

class TFarmTest(TestCase):
    @classmethod
    def setUpClass(self):
        self.maxDiff = None

        farm_code = open("./integration_tests/compiled/t_farm.tz", 'r').read()
        self.farm = ContractInterface.from_michelson(farm_code)

        storage_with_admin = self.farm.storage.dummy()
        storage_with_admin["t_farm_lambdas"] = tfarm_lambdas
        storage_with_admin["storage"]["admin"] = admin
        self.storage_with_admin = storage_with_admin

        # print(self.storage_with_admin)
        # with open("tfarm_storage.json", "w") as f:
        #     json.dump(self.storage_with_admin, f)


    def create_with_new_farm(self, patch = {}):
        chain = LocalChain(storage=self.storage_with_admin)
        params = dict(
            fees=fees,
            stake_params=stake_params,
            reward_token=reward_token,
            paused=False,
            reward_per_second=100 * PRECISION,
            timelock=0,
            start_time=0,
            end_time=60 * 60 * 24,
            token_info={"": ""}
        )
        for key, value in patch.items():
            params[key] = value

        res = chain.execute(self.farm.add_new_farm(**params), sender=admin)

        return chain

    def test_tfarm_init(self):
        chain = LocalChain(storage=self.storage_with_admin)
        res = chain.execute(self.farm.add_new_farm(
            fees=fees,
            stake_params=stake_params,
            reward_token=reward_token,
            paused=False,
            reward_per_second=100 * PRECISION,
            timelock=0,
            start_time=0,
            end_time=1,
            token_info={"": ""}
        ), sender=admin)

        pprint(res.storage["storage"])

    def test_tfarm_create_deposit_withdraw(self):
        chain = self.create_with_new_farm()

        res = chain.execute(self.farm.deposit(0, 50, None, me, candidate))
        transfers = parse_token_transfers(res)
        self.assertEqual(transfers[0]["amount"], 50)
        self.assertEqual(transfers[0]["destination"], contract_self_address)

        chain.advance_blocks(1)
    
        res = chain.execute(self.farm.harvest(0, me))

        transfers = parse_token_transfers(res)
        self.assertEqual(transfers[0]["amount"], 30)
        self.assertEqual(transfers[0]["destination"], burn_address)
        self.assertEqual(transfers[1]["amount"], 5970)
        self.assertEqual(transfers[1]["destination"], me)

        res = chain.execute(self.farm.withdraw(0, 50, me, me))

        transfers = parse_token_transfers(res)
        self.assertEqual(transfers[0]["amount"], 50)
        self.assertEqual(transfers[0]["destination"], me)


    def test_tfarm_timelock_withdraw_burn(self):
        chain = self.create_with_new_farm({"timelock" : 120, "end_time": 180})

        res = chain.execute(self.farm.deposit(0, 50, None, me, candidate))

        chain.advance_blocks(1)
        
        res = chain.execute(self.farm.deposit(0, 1, None, me, candidate))
        transfers = parse_token_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["amount"], 1)
        self.assertEqual(transfers[0]["destination"], contract_self_address)

        res = chain.execute(self.farm.withdraw(0, 50, me, me))

        transfers = parse_token_transfers(res)
        self.assertEqual(len(transfers), 2)
        self.assertEqual(transfers[0]["amount"], 49)
        self.assertEqual(transfers[0]["destination"], me)
        self.assertEqual(transfers[1]["amount"], 6000)
        self.assertEqual(transfers[1]["destination"], admin)

        chain.advance_blocks(1)

        res = chain.execute(self.farm.deposit(0, 7_777_777, None, me, candidate))

        transfers = parse_token_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["amount"], 7_777_777)
        self.assertEqual(transfers[0]["destination"], contract_self_address)

        res = chain.execute(self.farm.withdraw(0, 7_777_777, me, me))
        transfers = parse_token_transfers(res)
        self.assertEqual(len(transfers), 2)
        self.assertEqual(transfers[0]["amount"], 7_738_888)
        self.assertEqual(transfers[0]["destination"], me)
        self.assertEqual(transfers[1]["amount"], 3_000)
        self.assertEqual(transfers[1]["destination"], admin)


    def test_tfarm_fair_reward_distribution(self):
        chain = self.create_with_new_farm()

        res = chain.execute(self.farm.deposit(0, 50, None, alice, candidate), sender=alice)
        res = chain.execute(self.farm.deposit(0, 50, None, bob, candidate), sender=bob)
        res = chain.execute(self.farm.deposit(0, 50, None, julian, candidate), sender=julian)

        chain.advance_blocks(1)

        res = chain.execute(self.farm.harvest(0, alice), sender=alice)
        transfers = parse_token_transfers(res)
        self.assertEqual(transfers[1]["amount"], 1990)
        self.assertEqual(transfers[1]["destination"], alice)

        res = chain.execute(self.farm.harvest(0, bob), sender=bob)
        transfers = parse_token_transfers(res)
        self.assertEqual(transfers[1]["amount"], 1990)
        self.assertEqual(transfers[1]["destination"], bob)

        chain.advance_blocks(1)
        
        res = chain.execute(self.farm.harvest(0, julian), sender=julian)
        transfers = parse_token_transfers(res)
        self.assertEqual(transfers[1]["amount"], 1990 * 2)
        self.assertEqual(transfers[1]["destination"], julian)

        res = chain.execute(self.farm.harvest(0, alice), sender=alice)
        transfers = parse_token_transfers(res)
        self.assertEqual(transfers[1]["amount"], 1990)
        self.assertEqual(transfers[1]["destination"], alice)

    def test_tfarm_reward_miniscule(self):
        chain = self.create_with_new_farm()

        res = chain.execute(self.farm.deposit(0, 100_000_000, None, alice, candidate), sender=alice)
        res = chain.execute(self.farm.deposit(0, 10_000, None, bob, candidate), sender=bob)
        res = chain.execute(self.farm.deposit(0, 1, None, julian, candidate), sender=julian)

        chain.advance_blocks(500)

        res = chain.execute(self.farm.harvest(0, alice), sender=alice)
        transfers = parse_token_transfers(res)
        self.assertEqual(transfers[1]["amount"], 2_984_701)
        self.assertEqual(transfers[1]["destination"], alice)

        res = chain.execute(self.farm.harvest(0, bob), sender=bob)
        transfers = parse_token_transfers(res)
        self.assertEqual(transfers[1]["amount"], 297)
        self.assertEqual(transfers[1]["destination"], bob)

        res = chain.execute(self.farm.harvest(0, julian), sender=julian)
        transfers = parse_token_transfers(res)
        self.assertEqual(transfers, [])

    def test_tfarm_harvest_doesnt_affect_others(self):
        chain = self.create_with_new_farm()

        res = chain.execute(self.farm.deposit(0, 10_000, None, alice, candidate), sender=alice)
        res = chain.execute(self.farm.deposit(0, 100_000, None, bob, candidate), sender=bob)

        chain.advance_blocks(1)

        res = chain.execute(self.farm.harvest(0, alice), sender=alice)
        transfers = parse_token_transfers(res)

        # something was paid
        self.assertGreater(transfers[0]["amount"], 0)

        storage_before = res.storage

        # try calling harvest once again in the same block
        res = chain.execute(self.farm.harvest(0, alice), sender=alice)
        transfers = parse_token_transfers(res)

        self.assertEqual(res.storage, storage_before)

    def test_tfarm_rewards_in_time(self):
        chain = self.create_with_new_farm()

        res = chain.execute(self.farm.deposit(0, 50, None, alice, candidate), sender=alice)
        res = chain.execute(self.farm.deposit(0, 50, None, bob, candidate), sender=bob)

        total_alice_rewards = 0
        total_fee = 0
        for i in range(10):
            chain.advance_blocks(1)
            res = chain.execute(self.farm.harvest(0, alice), sender=alice)
            transfers = parse_token_transfers(res)
            total_fee += transfers[0]["amount"]
            total_alice_rewards += transfers[1]["amount"]

        res = chain.execute(self.farm.harvest(0, bob), sender=bob)

        transfers = parse_token_transfers(res)
        bob_reward = transfers[1]["amount"]

        self.assertEqual(total_alice_rewards, bob_reward)

    def test_tfarm_vote_when_join_quit(self):
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


    def test_tfarm_miniscule_withdrawal_fee(self):
        chain = self.create_with_new_farm({"timelock": 100, "end_time": 1_000})

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

    def test_tfarm_zero_join_and_quit(self):
        chain = self.create_with_new_farm()

        res = chain.execute(self.farm.deposit(0, 0, None, me, candidate))
        transfers = parse_token_transfers(res)
        self.assertEqual(len(transfers), 0)

        res = chain.execute(self.farm.withdraw(0, 0, me, me))
        transfers = parse_token_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["destination"], me)
        self.assertEqual(transfers[0]["amount"], 0)

    def test_tfarms_dont_affect_each_other(self):
        chain = self.create_with_new_farm()
        
        res = chain.execute(self.farm.add_new_farm(
            fees=fees,
            stake_params=stake_params,
            reward_token=reward_token,
            paused=False,
            reward_per_second=100 * PRECISION,
            timelock=0,
            start_time=0,
            end_time=240,
            token_info={"": ""}), sender=admin)

        res = chain.execute(self.farm.deposit(0, 50, None, alice, candidate), sender=alice)
        res = chain.execute(self.farm.deposit(1, 50, None, bob, candidate), sender=bob)

        farm0_before = res.storage["storage"]["farms"][0]
        chain.advance_blocks(1)
        res = chain.execute(self.farm.withdraw(1, 25, bob, bob), sender=bob)
        farm0_after = res.storage["storage"]["farms"][0]
        self.assertDictEqual(farm0_before, farm0_after)
        
        farm1_before = res.storage["storage"]["farms"][1]
        chain.advance_blocks(1)
        res = chain.execute(self.farm.harvest(0, alice), sender=alice)
        farm1_after = res.storage["storage"]["farms"][1]
        self.assertDictEqual(farm1_before, farm1_after)