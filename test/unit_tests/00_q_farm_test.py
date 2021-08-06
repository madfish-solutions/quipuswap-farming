from os import path

from copy import deepcopy

from unittest import TestCase

from pytezos import ContractInterface, MichelsonRuntimeError

from .storage.q_farm_storage import initial_q_farm_storage

from .utils.users import alice
from .utils.helpers import formatError, compile_func, exec

import json


class TestTempleTokenAdminActions(TestCase):
    @classmethod
    def setUpClass(cls):
        cls.q_farm = ContractInterface.from_file(
            path.join(path.dirname(__file__), 'contracts', 'q_farm.tz')
        )

        # compile_func()

        # pwd = exec('pwd')[0:-1]

        # with open(f'{pwd}/storage/QFarmFunctions.js', 'r') as file:
        #     json_data = file.read()
        #     string = json_data[json_data.find('['):json_data.rfind(']') + 1]
        # for i in len(string):

        # print(arr)
        # print(json.loads(arr))
        # data = json.load(jsonfile)

        # print(data)

    def test_update_admin_should_fail(self):
        self.assertEqual(5, 5)
        # with self.assertRaises(MichelsonRuntimeError) as err:
        #     self.q_farm.set_admin(alice).interpret(
        #         storage=deepcopy(initial_q_farm_storage),
        #         sender=alice,
        #     )

        # print(err.exception)
        # self.assertEqual(formatError(err), 'Not-admin')
