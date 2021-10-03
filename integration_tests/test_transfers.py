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

    def test_transfer_rewards(self):
        chain = self.create_with_new_farm()

        res = chain.execute(self.farm.deposit(0, 50_000, None, alice, candidate), sender=alice)
        res = chain.execute(self.farm.deposit(0, 50_000, None, bob, candidate), sender=bob)

        chain.advance_blocks(1)

        transfer = self.farm.transfer(
            [{ "from_" : alice,
                "txs" : [{
                    "amount": 50_000,
                    "to_": bob,
                    "token_id": 0
                }]
            }])
        res = chain.execute(transfer, sender=alice)

        mints = parse_mints(res)
        self.assertEqual(len(mints), 4)
        self.assertEqual(mints[1]["amount"], 2985)
        self.assertEqual(mints[3]["amount"], 2985)

        res = chain.execute(self.farm.harvest(0, alice), sender=alice)
        self.assertEqual(len(parse_mints(res)), 0)
        res = chain.execute(self.farm.harvest(0, bob), sender=bob)
        self.assertEqual(len(parse_mints(res)), 0)

        # next block transfer triggers rewards just fine
        chain.advance_blocks(1)
        transfer = self.farm.transfer(
            [{ "from_" : bob,
                "txs" : [{
                    "amount": 50_000,
                    "to_": alice,
                    "token_id": 0
                }]
            }])
        res = chain.execute(transfer, sender=bob)

        mints = parse_mints(res)
        self.assertEqual(len(mints), 2)
        self.assertEqual(mints[1]["amount"], 2985 * 2)
        self.assertEqual(mints[1]["destination"], bob)

        res = chain.execute(self.farm.harvest(0, alice), sender=alice)
        self.assertEqual(len(parse_mints(res)), 0)
        res = chain.execute(self.farm.harvest(0, bob), sender=bob)
        self.assertEqual(len(parse_mints(res)), 0)

    def test_multi_transfer_rewards(self):
        chain = self.create_with_new_farm()

        res = chain.execute(self.farm.deposit(0, 50_000, None, alice, candidate), sender=alice)
        res = chain.execute(self.farm.deposit(0, 50_000, None, bob, candidate), sender=bob)
        res = chain.execute(self.farm.deposit(0, 50_000, None, carol, candidate), sender=carol)

        chain.advance_blocks(1)

        transfer = self.farm.transfer(
            [{ "from_" : alice,
                "txs" : [{
                    "amount": 10_000,
                    "to_": bob,
                    "token_id": 0
                },
                {
                    "amount": 10_000,
                    "to_": bob,
                    "token_id": 0
                }]
            }])
        res = chain.execute(transfer, sender=alice)

        mints = parse_mints(res)
        self.assertEqual(len(mints), 4)
        self.assertEqual(mints[1]["amount"], 1990)
        self.assertEqual(mints[3]["amount"], 1990)

        transfer = self.farm.transfer(
            [{ "from_" : bob,
                "txs" : [{
                    "amount": 10_000,
                    "to_": carol,
                    "token_id": 0
                }]
            }])
        res = chain.execute(transfer, sender=bob)
        mints = parse_mints(res)
        self.assertEqual(len(mints), 2)
        self.assertEqual(mints[1]["amount"], 1990)

        transfer = self.farm.transfer(
            [{ "from_" : carol,
                "txs" : [{
                    "amount": 10_000,
                    "to_": alice,
                    "token_id": 0
                }]
            }])
        res = chain.execute(transfer, sender=carol)
        mints = parse_mints(res)
        self.assertEqual(len(mints), 0)


    def test_zero_transfer_rewards(self):
        chain = self.create_with_new_farm()

        res = chain.execute(self.farm.deposit(0, 50_000, None, alice, candidate), sender=alice)
        res = chain.execute(self.farm.deposit(0, 50_000, None, bob, candidate), sender=bob)
        res = chain.execute(self.farm.deposit(0, 40, dave, carol, candidate), sender=carol)

        chain.advance_blocks(1)

        transfer = self.farm.transfer(
            [{ "from_" : alice,
                "txs" : [{
                    "amount": 0,
                    "to_": bob,
                    "token_id": 0
                }]
            }])
        res = chain.execute(transfer, sender=alice)
        mints = parse_mints(res)
        self.assertEqual(len(mints), 4)


        transfer = self.farm.transfer(
            [{ "from_" : carol,
                "txs" : [{
                    "amount": 0,
                    "to_": dave,
                    "token_id": 0
                },
                {
                    "amount": 0,
                    "to_": dave,
                    "token_id": 0
                }]
            }])
        res = chain.execute(transfer, sender=carol)
        mints = parse_mints(res)
        # self.assertEqual(len(mints), 0)


        # self.assertEqual(len(mints), 4)
        # self.assertEqual(mints[1]["amount"], 2985)
        # self.assertEqual(mints[3]["amount"], 2985)

        # res = chain.execute(self.farm.harvest(0, alice), sender=alice)
        # self.assertEqual(len(parse_mints(res)), 0)
        # res = chain.execute(self.farm.harvest(0, bob), sender=bob)
        # self.assertEqual(len(parse_mints(res)), 0)

        # # next block transfer triggers rewards just fine
        # chain.advance_blocks(1)
        # transfer = self.farm.transfer(
        #     [{ "from_" : bob,
        #         "txs" : [{
        #             "amount": 50_000,
        #             "to_": alice,
        #             "token_id": 0
        #         }]
        #     }])
        # res = chain.execute(transfer, sender=bob)

        # mints = parse_mints(res)
        # self.assertEqual(len(mints), 2)
        # self.assertEqual(mints[1]["amount"], 2985 * 2)
        # self.assertEqual(mints[1]["destination"], bob)

        # res = chain.execute(self.farm.harvest(0, alice), sender=alice)
        # self.assertEqual(len(parse_mints(res)), 0)
        # res = chain.execute(self.farm.harvest(0, bob), sender=bob)
        # self.assertEqual(len(parse_mints(res)), 0)

    
    def test_transfer_votes(self):
        chain = self.create_with_new_farm()

        res = chain.execute(self.farm.deposit(0, 50, None, alice, carol), sender=alice)
        votes = parse_votes(res)
        self.assertEqual(votes[0]["delegate"], carol)
        self.assertEqual(votes[0]["amount"], 50)

        res = chain.execute(self.farm.deposit(0, 60, None, bob, dave), sender=bob)
        votes = parse_votes(res)
        self.assertEqual(votes[0]["delegate"], dave)
        self.assertEqual(votes[0]["amount"], 110)

        transfer = self.farm.transfer(
            [{ "from_" : alice,
                "txs" : [{
                    "amount": 20,
                    "to_": julian,
                    "token_id": 0
                }]
            }])
        res = chain.execute(transfer, sender=alice)
        
        res = chain.execute(self.farm.deposit(0, 1, None, julian, carol), sender=julian)
        votes = parse_votes(res)
        self.assertEqual(votes[0]["delegate"], carol)
        self.assertNotEqual(votes[0]["amount"], 111)
