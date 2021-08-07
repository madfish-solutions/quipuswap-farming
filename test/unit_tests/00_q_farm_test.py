import json

from os import path

from copy import deepcopy

from unittest import TestCase

from pytezos import ContractInterface, MichelsonRuntimeError

from .storage.q_farm_storage import initial_q_farm_storage

from .utils.users import alice
from .utils.helpers import formatError, compile_func, exec


class TestTempleTokenAdminActions(TestCase):
    @classmethod
    def setUpClass(cls):
        cls.q_farm = ContractInterface.from_file(
            path.join(path.dirname(__file__), 'contracts', 'q_farm.tz')
        )
        pwd = exec('pwd')[0:-1]

        with open(f'{pwd}/storage/json/QFarmFunctions.json', 'r') as file:
            functions = json.load(file)

        for function in functions:
            initial_q_farm_storage['q_farm_lambdas'][int(function['index'])] = compile_func(
                function['index'],
                function['name'],
            )

    def test_update_admin_should_fail(self):
        with self.assertRaises(MichelsonRuntimeError) as err:
            self.q_farm.set_admin(alice).interpret(
                storage=deepcopy(initial_q_farm_storage),
                sender=alice,
            )

        print(err.exception)
        self.assertEqual(formatError(err), 'Not-admin')
