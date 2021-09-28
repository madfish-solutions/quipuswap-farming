const BakerRegistry = require("../build/baker_registry.json");
const ProxyMinter = require("../build/proxy_minter.json");
const Burner = require("../build/burner.json");

const { execSync } = require("child_process");

const { TezosToolkit, OpKind } = require("@taquito/taquito");
const { InMemorySigner } = require("@taquito/signer");

const { migrate, getLigo } = require("../scripts/helpers");
const { confirmOperation } = require("../scripts/confirmation");

const { alice, dev } = require("../scripts/sandbox/accounts");

const { qFarmStorage } = require("../storage/QFarm");
const qFarmFunctions = require("../storage/json/QFarmFunctions.json");

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

  const ligo = getLigo(true);
  let params = [];

  for (qFarmFunction of qFarmFunctions) {
    const stdout = execSync(
      `${ligo} compile-parameter --michelson-format=json $PWD/contracts/main/q_farm.ligo main 'Setup_func(record index=${qFarmFunction.index}n; func=${qFarmFunction.name}; end)'`,
      { maxBuffer: 1024 * 500 }
    );

    params.push({
      kind: OpKind.TRANSACTION,
      to: qFarmAddress,
      amount: 0,
      parameter: {
        entrypoint: "setup_func",
        value: JSON.parse(stdout.toString()).args[0].args[0],
      },
    });

    console.log(
      qFarmFunction.index +
        1 +
        ". " +
        qFarmFunction.name +
        " successfully compiled."
    );
  }

  const batch = tezos.wallet.batch(params);
  const operation = await batch.send();

  await confirmOperation(tezos, operation.opHash);

  console.log("Lambdas setup finished");

  const proxyMinter = await tezos.contract.at(
    ProxyMinter["networks"][env.network]["proxy_minter"]
  );
  const operation = await proxyMinter.methods
    .add_minter(qFarmAddress, true)
    .send();

  await confirmOperation(tezos, operation.hash);
};
