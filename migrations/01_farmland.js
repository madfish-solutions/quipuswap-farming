const { execSync } = require("child_process");

const { TezosToolkit } = require("@taquito/taquito");
const { InMemorySigner } = require("@taquito/signer");

const { migrate, getLigo } = require("../scripts/helpers");
const { confirmOperation } = require("../scripts/confirmation");

const { alice, dev } = require("../scripts/sandbox/accounts");

const farmlandStorage = require("../storage/Farmland");
const farmlandFunctions = require("../storage/FarmlandFunctions");

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

  farmlandStorage.storage.qsgov.token = zeroAddress;
  farmlandStorage.storage.qsgov.id = "0";
  farmlandStorage.storage.admin = deployer;
  farmlandStorage.storage.pending_admin = zeroAddress;
  farmlandStorage.storage.burner = zeroAddress;
  farmlandStorage.storage.proxy_minter = zeroAddress;

  const farmlandAddress = await migrate(tezos, "farmland", farmlandStorage);

  console.log(`Farmland: ${farmlandAddress}`);

  const ligo = getLigo(true);

  for (farmlandFunction of farmlandFunctions) {
    const stdout = execSync(
      `${ligo} compile-parameter --michelson-format=json $PWD/contracts/main/farmland.ligo main 'Setup_func(record index=${farmlandFunction.index}n; func=${farmlandFunction.name}; end)'`,
      { maxBuffer: 1024 * 500 }
    );
    const operation = await tezos.contract.transfer({
      to: farmlandAddress,
      amount: 0,
      parameter: {
        entrypoint: "setup_func",
        value: JSON.parse(stdout.toString()).args[0],
      },
    });

    await confirmOperation(tezos, operation.hash);
  }
};
