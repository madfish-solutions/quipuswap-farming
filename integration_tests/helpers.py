from os import urandom
from pytezos import pytezos
from pytezos.crypto.encoding import base58_encode
from pytezos.michelson.micheline import micheline_value_to_python_object

PRECISION = pow(10, 18)

TOKEN_ADDRESS = "KT1VHd7ysjnvxEzwtjBAmYAmasvVCfPpSkiG"

alice = "tz1iA1iceA1iceA1iceA1iceA1ice9ydjsaW"
bob = "tz1iBobBobBobBobBobBobBobBobBodTWLCX"

carol = "tz1iCaro1Caro1Caro1Caro1Caro1CbMUKN1"
dave = "tz1iDaveDaveDaveDaveDaveDaveDatFC4So"

julian = "tz1iJu1ianJu1ianJu1ianJu1ianJtvTftP8"

admin = "tz1TfRXkAxbQ2BFqKV2dF4kE17yZ5BmJqSAP"

candidate = "tz1XXPVLyQqsMVaQKnPWvD4q6nVwgwXUG4Fp"

# the same as Pytezos' `contract.context.get_self_address()`
contract_self_address = 'KT1BEqzn5Wx8uJrZNvuS9DVHmLvG9td3fDLi'

# the same as Pytezos' `contract.context.get_sender()`. The default Tezos.sender
me = "tz1Ke2h7sDdakHJQh8WX4Z372du1KChsksyU"

referral_system = "KT1AxaBxkFLCUi3f8rdDAAxBKHfzY8LfKDRA"

burn_address = "tz1ZZZZZZZZZZZZZZZZZZZZZZZZZZZZNkiRg"

def get_balance(res, address):
    return res.storage["ledger"][address]["balance"] 

def get_frozen_balance(res, address):
    return res.storage["ledger"][address]["frozenBalance"] 


def parse_mints(res):
    mints = []
    for op in res.operations:
        if op["kind"] == "transaction":
            if op["parameters"]["entrypoint"] == "mint_tokens":
                mint = parse_mint_list(op)
                mints += mint
    return mints

def parse_tez_transfer(op):
    dest = op["destination"]
    amount = int(op["amount"])
    source = op["source"]
    return {"type": "tez", "destination": dest, "amount": amount, "source": source}

def parse_as_fa12(value):
    args = value["args"]

    return {
        "type": "token",
        "amount": int(args[2]["int"]),
        "destination": args[1]["string"]
    }

def parse_as_fa2(values):
    result = []
    value = values[0]
    transfers = value["args"][1]
    for transfer in transfers:
        args = transfer["args"]

        amount = args[-1]["int"]
        amount = int(amount)

        token_id = args[1]["int"]
        token_id = int(token_id)

        dest = args[0]["string"]

        result.append({
            "type": "token",
            "token_id": token_id,
            "destination": dest,
            "amount": amount,
        })

    return result

def parse_token_transfers(res):
    token_transfers = []
    for op in res.operations:
        if op["kind"] == "transaction":
            entrypoint = op["parameters"]["entrypoint"]
            if entrypoint == "transfer":
                txs = parse_token_transfer(op)
                token_transfers += txs
    return token_transfers

def parse_token_transfer(op):
    transfers = []
    value = op["parameters"]["value"]
    if not isinstance(value, list):
        transfer = parse_as_fa12(value)
        transfers.append(transfer)
    else:
        transfers += parse_as_fa2(value)

    for transfer in transfers:
        transfer["token_address"] = op["destination"]

    return transfers

def parse_mint_list(op):
    list = []
    values = op["parameters"]["value"]
    for value in values:
        args = value["args"]
        dest = args[0]["string"]
        amount = int(args[1]["int"])
        list.append({
            "type": "mint",
            "amount": amount,
            "destination": dest,
            "token_address": "fa12_dummy",
        })
    return list

# be warned it can't handle two of the same entrypoints
def parse_calls(res):
    calls = {}
    for op in res.operations:
        transfer = op["parameters"]
        name = transfer["entrypoint"]
        args = micheline_value_to_python_object(transfer["value"])
        calls[name] = args
    return calls

def parse_delegations(res):
    delegates = []
    for op in res.operations:
        if op["kind"] == "delegation":
            delegates.append(op["delegate"])
    return delegates

def parse_votes(res):
    result = []

    for op in res.operations:
        if op["kind"] == "transaction":
            entrypoint = op["parameters"]["entrypoint"]
            if entrypoint == "use":
                tx = parse_vote(op)
                result.append(tx)

    return result

def parse_vote(op):
    args = op["parameters"]["value"]["args"]
    while "args" in args[0]:
        args = args[0]["args"]

    res = {
        "type": "vote",
        "delegate": args[0]["string"],
        "amount": int(args[1]["int"])
    }
    
    return res

def parse_ops(res):
    result = []

    for op in res.operations:
        if op["kind"] == "transaction":
            entrypoint = op["parameters"]["entrypoint"]
            if entrypoint == "default":
                tx = parse_tez_transfer(op)
                result.append(tx)
            elif entrypoint == "mint":
                continue
                mint = parse_mint_list(op)
                result += mint
            elif entrypoint == "transfer":
                txs = parse_token_transfer(op)
                result += txs
            elif entrypoint == "use":
                tx = parse_vote(op)
                result.append(tx)

    return result


# calculates shares balance
def calc_total_balance(res, address):
    ledger = res.storage["storage"]["ledger"][address]
    return ledger["balance"] + ledger["frozen_balance"]


def generate_random_address() -> str:
    return base58_encode(urandom(20), b"tz1").decode()

def wrap_fa2_token(address, id):
    return {
        "fa2": {
            "address": address,
            "token_id": id
        }
    }

def wrap_fa12_token(address, id):
    return {
        "fa12": {
            "address": address,
        }
    }

# returns amount
def parse_transfers(res):
    ops = parse_ops(res)
    token_txs = [op["amount"] for op in ops if op["type"] == "token"]
    tez_txs = [op["amount"] for op in ops if op["type"] == "tez"]
    tez_amount = None if not tez_txs else tez_txs[0]
    token_amount = None if not token_txs else token_txs[0]
    return (tez_amount, token_amount)

def calc_out_per_hundred(chain, dex):
    res = chain.interpret(
        dex.tokenToTezPayment(amount=100, min_out=1, receiver=alice), amount=0
    )
    ops = parse_ops(res)
    tez_out = ops[0]["amount"]

    res = chain.interpret(dex.tezToTokenPayment(min_out=1, receiver=alice), amount=100)
    ops = parse_ops(res)
    token_out = ops[0]["amount"]

    return (tez_out, token_out)


def get_percentage_diff(previous, current):
    try:
        percentage = abs(previous - current) / max(previous, current) * 100
    except ZeroDivisionError:
        percentage = float("inf")
    return percentage


def operator_add(owner, operator, token_id=0):
    return {
        "add_operator": {"owner": owner, "operator": operator, "token_id": token_id}
    }

def get_map_without_none(map):
    return {key: value for key,value in map.items() if value != None}

def none_sets_to_lists(full_storage):
    if "storage" in full_storage:
        internal = full_storage["storage"]
        internal["candidates"] = get_map_without_none(internal["candidates"])

    return full_storage

class LocalChain:
    def __init__(self, storage=None):
        self.storage = storage

        self.balance = 0
        self.now = 0
        self.payouts = {}
        self.contract_balances = {}

    def execute(self, call, amount=0, sender=None, source=None):
        new_balance = self.balance + amount
        res = call.interpret(
            amount=amount,
            storage=self.storage,
            balance=new_balance,
            now=self.now,
            sender=sender,
            source=source,
        )
        self.balance = new_balance
        self.storage = none_sets_to_lists(res.storage)

        # calculate total xtz payouts from contract
        ops = parse_ops(res)
        for op in ops:
            if op["type"] == "tez":
                dest = op["destination"]
                amount = op["amount"]
                self.payouts[dest] = self.payouts.get(dest, 0) + amount

                # reduce contract balance in case it has sent something
                if op["source"] == contract_self_address:
                    self.balance -= op["amount"]
                    
            elif op["type"] == "token":
                dest = op["destination"]
                amount = op["amount"]
                address = op["token_address"]
                if address not in self.contract_balances:
                    self.contract_balances[address] = {}
                contract_balance = self.contract_balances[address]
                if dest not in contract_balance:
                    contract_balance[dest] = 0
                contract_balance[dest] += amount
                # TODO source funds removal

        return res

    # just interpret, don't store anything
    def interpret(self, call, amount=0, sender=None, source=None):
        res = call.interpret(
            amount=amount,
            storage=self.storage,
            balance=self.balance,
            now=self.now,
            sender=sender,
            source=source
        )
        return res

    def advance_blocks(self, count=1):
        self.now += count * 60

