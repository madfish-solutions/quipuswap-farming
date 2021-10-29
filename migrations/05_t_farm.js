const BakerRegistry = require("../build/baker_registry.json");
const Burner = require("../build/burner.json");

const { TezosToolkit, OpKind } = require("@taquito/taquito");
const { InMemorySigner } = require("@taquito/signer");

const { migrate } = require("../scripts/helpers");
const { confirmOperation } = require("../scripts/confirmation");

const { alice, dev } = require("../scripts/sandbox/accounts");

const { tFarmStorage } = require("../storage/TFarm");
const tFarmFunctions = require("../build/lambdas/t_farm_lambdas.json");

const env = require("../env");

module.exports = async (tezos) => {
  const secretKey = env.network === "development" ? alice.sk : dev.sk;
  const deployer = env.network === "development" ? alice.pkh : dev.pkh;

  tezos = new TezosToolkit(tezos.rpc.url);

  tezos.setProvider({
    config: {
      confirmationPollingTimeoutSecond: env.confirmationPollingTimeoutSecond,
    },
    signer: await InMemorySigner.fromSecretKey(secretKey),
  });

  tFarmStorage.storage.qsgov.token = "KT1NfYbYTCRZsNPZ97VdLqSrwPdVupiqniFu";
  tFarmStorage.storage.qsgov.id = 0;
  tFarmStorage.storage.qsgov_lp = "KT1NfYbYTCRZsNPZ97VdLqSrwPdVupiqniFu";
  tFarmStorage.storage.admin = deployer;
  tFarmStorage.storage.burner = Burner["networks"][env.network]["burner"];
  tFarmStorage.storage.baker_registry =
    BakerRegistry["networks"][env.network]["baker_registry"];

  const tFarmAddress = await migrate(tezos, "t_farm", tFarmStorage);
  const tFarm = await tezos.contract.at(tFarmAddress);

  console.log(`TFarm: ${tFarmAddress}`);

  let batch1 = [];
  let batch2 = [];

  for (let i = 0; i < tFarmFunctions.length / 2; ++i) {
    batch1.push({
      kind: OpKind.TRANSACTION,
      ...tFarm.methods.setup_func(i, tFarmFunctions[i]).toTransferParams(),
    });
  }

  for (let i = tFarmFunctions.length / 2; i < tFarmFunctions.length; ++i) {
    batch2.push({
      kind: OpKind.TRANSACTION,
      ...tFarm.methods.setup_func(i, tFarmFunctions[i]).toTransferParams(),
    });
  }

  let batch = tezos.wallet.batch(batch1);
  let operation = await batch.send();

  await confirmOperation(tezos, operation.opHash);

  batch = tezos.wallet.batch(batch2);
  operation = await batch.send();

  await confirmOperation(tezos, operation.opHash);
};
