import json
import glob
from os.path import dirname, join, basename
from pytezos.michelson.format import micheline_to_michelson

def storage_with_lambdas(full_storage_without_lambdas):
    internal_storage = full_storage_without_lambdas["storage"]
    return full_dex_storage(internal_storage)

def full_dex_storage(internal_storage):
    full_storage = initial_full_storage
    full_storage["storage"] = internal_storage
    return full_storage

def load_qfarm_lambdas():
    qfarm_lambdas = {}
    lambdas = glob.glob("./integration_tests/compiled/lambdas/qfarm/*.json")
    for filepath in lambdas:
        lambda_string = open(filepath, 'r').read()
        micheline = json.loads(lambda_string)
        
        # HACK to extract the function from parameter
        # e.g. `initialize_exchange` part from `SetDexFunction(initialize_exchange, 0n)`
        # their amount might be the value to tinker with if you get cryptic storage errors like `expected list got dict` and such
        lambda_code = micheline["args"][0]["args"][0]["args"][1]

        michelson_code = micheline_to_michelson(lambda_code)

        filename = basename(filepath)
        index = filename.split("-")[0]

        qfarm_lambdas[int(index)] = michelson_code

        # left here in case it is necessary to do the same by entrypoint
        # dex.setDexFunction(michelson_code, int(index)).interpret

    return qfarm_lambdas

def load_tfarm_lambdas():
    tfarm_lambdas = {}
    lambdas = glob.glob("./integration_tests/compiled/lambdas/tfarm/*.json")
    for filepath in lambdas:
        lambda_string = open(filepath, 'r').read()
        micheline = json.loads(lambda_string)
        
        # HACK to extract the function from parameter
        # e.g. `initialize_exchange` part from `SetTokenFunction(initialize_exchange, 0n)`
        # their amount might be the value to tinker with if you get cryptic storage errors like `expected list got dict` and such
        lambda_code = micheline["args"]

        michelson_code = micheline_to_michelson(lambda_code)

        filename = basename(filepath)
        index = filename.split("-")[0]

        tfarm_lambdas[int(index)] = michelson_code

        # left here in case it is necessary to do the same by entrypoint
        # dex.setDexFunction(michelson_code, int(index)).interpret

    return tfarm_lambdas

qfarm_lambdas = load_qfarm_lambdas()
tfarm_lambdas = load_tfarm_lambdas()

initial_full_storage = {
    'qfarm_lambdas': qfarm_lambdas,
    'storage': None
}

initial_tfarm_storage = {
    'tfarm_lambdas': tfarm_lambdas,
    "storage": None
}