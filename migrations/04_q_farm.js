const BakerRegistry = require("../build/baker_registry.json");
const ProxyMinter = require("../build/proxy_minter.json");
const Burner = require("../build/burner.json");

const { TezosToolkit, OpKind } = require("@taquito/taquito");
const { InMemorySigner } = require("@taquito/signer");

const { migrate } = require("../scripts/helpers");
const { confirmOperation } = require("../scripts/confirmation");

const { alice, dev } = require("../scripts/sandbox/accounts");

const { qFarmStorage } = require("../storage/QFarm");
const qFarmFunctions = require("../build/lambdas/q_farm_lambdas.json");

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

  qFarmStorage.storage.qsgov.token = "KT1NfYbYTCRZsNPZ97VdLqSrwPdVupiqniFu";
  qFarmStorage.storage.qsgov.id = 0;
  qFarmStorage.storage.qsgov_lp = "KT1MsQZeAbLuNfhfWdiUsJT4tTDzxymkaxwo";
  qFarmStorage.storage.admin = deployer;
  qFarmStorage.storage.burner = Burner["networks"][env.network]["burner"];
  qFarmStorage.storage.proxy_minter =
    ProxyMinter["networks"][env.network]["proxy_minter"];
  qFarmStorage.storage.baker_registry =
    BakerRegistry["networks"][env.network]["baker_registry"];

  const qFarmAddress = await migrate(tezos, "q_farm", qFarmStorage);

  console.log(`QFarm: ${qFarmAddress}`);

  let params = [];

  for (qFarmFunction of qFarmFunctions) {
    params.push({
      kind: OpKind.TRANSACTION,
      to: qFarmAddress,
      amount: 0,
      parameter: {
        entrypoint: "setup_func",
        value: qFarmFunction,
      },
    });
  }

  const batch = tezos.wallet.batch(params);
  const operation = await batch.send();

  await confirmOperation(tezos, operation.opHash);

  const proxyMinter = await tezos.contract.at(
    ProxyMinter["networks"][env.network]["proxy_minter"]
  );
  const operation = await proxyMinter.methods
    .add_minter(qFarmAddress, true)
    .send();

  await confirmOperation(tezos, operation.hash);
};
