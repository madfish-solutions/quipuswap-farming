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
    "harvest_fee" : int(0.005 * PRECISION),
    "withdrawal_fee" : int(0.005 * PRECISION),
}

stake_params={
    "staked_token": fa2_token,
    "is_v1_lp": True,
}

class TFarmTestEndTime(TestCase):
    @classmethod
    def setUpClass(cls):
        cls.maxDiff = None

        farm_code = open("./integration_tests/compiled/t_farm.tz", 'r').read()
        cls.farm = ContractInterface.from_michelson(farm_code)

        storage_with_admin = cls.farm.storage.dummy()
        storage_with_admin["t_farm_lambdas"] = tfarm_lambdas
        storage_with_admin["storage"]["admin"] = admin
        cls.storage_with_admin = storage_with_admin

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
        
    def test_tfarm_end_time_simple(self):
        chain = self.create_with_new_farm({"end_time": 120})

        res = chain.execute(self.farm.deposit(0, 50, None, me, candidate))
        transfers = parse_token_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["destination"], contract_self_address)
        self.assertEqual(transfers[0]["amount"], 50)

        res = chain.execute(self.farm.withdraw(0, 0, me, me))
        transfers = parse_token_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["destination"], me)
        self.assertEqual(transfers[0]["amount"], 0)

        # although we spent 15 blocks we are still getting 2 blocks worth of rewards
        chain.advance_blocks(15)
        res = chain.execute(self.farm.withdraw(0, 0, me, me))
        transfers = parse_token_transfers(res)
        self.assertEqual(len(transfers), 3)
        self.assertEqual(transfers[0]["amount"], 0)
        self.assertEqual(transfers[0]["destination"], me)
        self.assertEqual(transfers[0]["token_id"], stake_token_id)
        self.assertEqual(transfers[1]["amount"], 60)
        self.assertEqual(transfers[1]["destination"], burn_address)
        self.assertEqual(transfers[1]["token_id"], reward_token_id)
        self.assertEqual(transfers[2]["amount"], 11940)
        self.assertEqual(transfers[2]["destination"], me)
        self.assertEqual(transfers[2]["token_id"], reward_token_id)

        res = chain.execute(self.farm.deposit(0, 50, None, me, candidate))
        transfers = parse_token_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["destination"], contract_self_address)
        self.assertEqual(transfers[0]["amount"], 50)

        pprint(res.storage["storage"])

        res = chain.execute(self.farm.withdraw(0, 100, me, me))
        transfers = parse_token_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["amount"], 100)
        self.assertEqual(transfers[0]["destination"], me)

        # chain.advance_blocks(1)
        res = chain.execute(self.farm.harvest(0, me))
        transfers = parse_token_transfers(res)
        self.assertEqual(transfers, [])

    def test_tfarm_end_time_partial_harvest(self):
        chain = self.create_with_new_farm({"end_time": 120})

        res = chain.execute(self.farm.deposit(0, 1_000, None, me, candidate))
        transfers = parse_token_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["destination"], contract_self_address)
        self.assertEqual(transfers[0]["amount"], 1_000)

        chain.advance_blocks(1)
        res = chain.execute(self.farm.harvest(0, me))
        transfers = parse_token_transfers(res)
        self.assertEqual(transfers[0]["amount"], 30)
        self.assertEqual(transfers[1]["amount"], 5970)

        # we are still getting 2 blocks worth of rewards
        chain.advance_blocks(4)
        res = chain.execute(self.farm.harvest(0, me))
        transfers = parse_token_transfers(res)
        self.assertEqual(transfers[0]["amount"], 30)
        self.assertEqual(transfers[1]["amount"], 5970)

        chain.advance_blocks(1)
        res = chain.execute(self.farm.harvest(0, me))
        transfers = parse_token_transfers(res)
        self.assertEqual(transfers, [])


    def test_tfarm_end_time_partial_distribution(self):
        chain = self.create_with_new_farm({"end_time": 120})

        res = chain.execute(self.farm.deposit(0, 10, None, alice, candidate), sender=alice)

        chain.advance_blocks(1)
        res = chain.execute(self.farm.harvest(0, alice), sender=alice)
        transfers = parse_token_transfers(res)
        self.assertEqual(transfers[0]["amount"], 30)
        self.assertEqual(transfers[1]["amount"], 5970)

        res = chain.execute(self.farm.deposit(0, 10, None, bob, candidate), sender=bob)

        chain.advance_blocks(3)
        res = chain.execute(self.farm.harvest(0, alice), sender=alice)
        transfers = parse_token_transfers(res)
        self.assertEqual(transfers[0]["amount"], 15)
        self.assertEqual(transfers[1]["amount"], 2985)
        self.assertEqual(transfers[1]["destination"], alice)

        res = chain.execute(self.farm.harvest(0, bob), sender=bob)
        transfers = parse_token_transfers(res)
        self.assertEqual(transfers[0]["amount"], 15)
        self.assertEqual(transfers[1]["amount"], 2985)
        self.assertEqual(transfers[1]["destination"], bob)


    def test_tfarm_end_time_never_staked(self):
        chain = self.create_with_new_farm({"end_time": 120})
        chain.advance_blocks(2)

        res = chain.execute(self.farm.deposit(0, 10, None, me, candidate))

        res = chain.execute(self.farm.harvest(0, me))
        transfers = parse_token_transfers(res)
        self.assertEqual(transfers, [])

    def test_tfarm_end_time_late_stake(self):
        chain = self.create_with_new_farm({"end_time": 3 * 60})
        chain.advance_blocks(1)

        res = chain.execute(self.farm.deposit(0, 10, None, me, candidate))

        chain.advance_blocks(1)

        pprint(res.storage["storage"])

        res = chain.execute(self.farm.harvest(0, me))
        transfers = parse_token_transfers(res)
        self.assertEqual(transfers[1]["amount"], 5970)

        chain.advance_blocks(1)

        res = chain.execute(self.farm.harvest(0, me))
        transfers = parse_token_transfers(res)
        self.assertEqual(transfers[1]["amount"], 5970)

        chain.advance_blocks(1)

        res = chain.execute(self.farm.harvest(0, me))
        transfers = parse_token_transfers(res)
        self.assertEqual(transfers, [])