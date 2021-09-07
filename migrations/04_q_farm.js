const BakerRegistry = require("../build/baker_registry.json");
const ProxyMinter = require("../build/proxy_minter.json");
const Burner = require("../build/burner.json");

const { execSync } = require("child_process");

const { TezosToolkit } = require("@taquito/taquito");
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

  const zeroAddress = "tz1ZZZZZZZZZZZZZZZZZZZZZZZZZZZZNkiRg";

  qFarmStorage.storage.qsgov.token = zeroAddress;
  qFarmStorage.storage.qsgov.id = 0;
  qFarmStorage.storage.qsgov.is_fa2 = true;
  qFarmStorage.storage.qsgov_lp.token = zeroAddress;
  qFarmStorage.storage.qsgov_lp.id = 0;
  qFarmStorage.storage.qsgov_lp.is_fa2 = true;
  qFarmStorage.storage.admin = deployer;
  qFarmStorage.storage.pending_admin = zeroAddress;
  qFarmStorage.storage.burner = Burner["networks"][env.network]["burner"];
  qFarmStorage.storage.proxy_minter =
    ProxyMinter["networks"][env.network]["proxy_minter"];
  qFarmStorage.storage.baker_registry =
    BakerRegistry["networks"][env.network]["baker_registry"];

  const qFarmAddress = await migrate(tezos, "q_farm", qFarmStorage);

  console.log(`QFarm: ${qFarmAddress}`);

  const ligo = getLigo(true);

  for (qFarmFunction of qFarmFunctions) {
    const stdout = execSync(
      `${ligo} compile-parameter --michelson-format=json $PWD/contracts/main/q_farm.ligo main 'Setup_func(record index=${qFarmFunction.index}n; func=${qFarmFunction.name}; end)'`,
      { maxBuffer: 1024 * 500 }
    );
    const operation = await tezos.contract.transfer({
      to: qFarmAddress,
      amount: 0,
      parameter: {
        entrypoint: "setup_func",
        value: JSON.parse(stdout.toString()).args[0],
      },
    });

    await confirmOperation(tezos, operation.hash);

    console.log(
      qFarmFunction.index +
        1 +
        ". " +
        qFarmFunction.name +
        " successfully installed."
    );
  }

  const proxyMinter = await tezos.contract.at(
    ProxyMinter["networks"][env.network]["proxy_minter"]
  );
  const operation = await proxyMinter.methods
    .register_farm(qFarmAddress, true)
    .send();

  await confirmOperation(tezos, operation.hash);
};
