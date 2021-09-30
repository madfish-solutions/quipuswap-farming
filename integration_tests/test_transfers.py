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

class TestTransfers(TestCase):
    @classmethod
    def setUpClass(cls):
        cls.maxDiff = None

        farm_code = open("./integration_tests/compiled/q_farm.tz", 'r').read()
        cls.farm = ContractInterface.from_michelson(farm_code)

        storage_with_admin = cls.farm.storage.dummy()
        storage_with_admin["q_farm_lambdas"] = qfarm_lambdas
        storage_with_admin["storage"]["admin"] = admin
        cls.storage_with_admin = storage_with_admin


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

    def test_basic_transfer(self):
        chain = self.create_with_new_farm()

        res = chain.execute(self.farm.deposit(0, 50, None, alice, candidate), sender=alice)

        transfer = self.farm.transfer(
            [{ "from_" : alice,
                "txs" : [{
                    "amount": 35,
                    "to_": bob,
                    "token_id": 0
                }]
            }])
        res = chain.execute(transfer, sender=alice)

        self.assertEqual(res.storage["storage"]["users_info"][(0,bob)]["staked"], 35)
        self.assertEqual(res.storage["storage"]["users_info"][(0,alice)]["staked"], 15)


    def test_self_transfer(self):
        chain = self.create_with_new_farm()
        res = chain.execute(self.farm.deposit(0, 100, None, alice, candidate), sender=alice)

        with self.assertRaises(MichelsonRuntimeError):
            transfer = self.farm.transfer(
                [{ "from_" : alice,
                    "txs" : [{
                        "amount": 40,
                        "to_": alice,
                        "token_id": 0
                    },
                    {
                        "amount": 60,
                        "to_": bob,
                        "token_id": 0
                    }]
                }])
            res = chain.execute(transfer, sender=alice)


    def test_transfer_wrong_token_id(self):
        chain = self.create_with_new_farm()
        res = chain.execute(self.farm.deposit(0, 100, None, alice, candidate), sender=alice)

        with self.assertRaises(MichelsonRuntimeError):
            transfer = self.farm.transfer(
                [{ "from_" : alice,
                    "txs" : [{
                        "amount": 40,
                        "to_": alice,
                        "token_id": 1
                    },
                ]
                }])
            res = chain.execute(transfer, sender=alice)

        with self.assertRaises(MichelsonRuntimeError):
            transfer = self.farm.transfer(
                [{ "from_" : alice,
                    "txs" : [{
                        "amount": 40,
                        "to_": alice,
                        "token_id": 0
                    },
                    {
                        "amount": 40,
                        "to_": bob,
                        "token_id": 1
                    }
                ]
                }])
            res = chain.execute(transfer, sender=alice)