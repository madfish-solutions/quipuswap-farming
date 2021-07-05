const { execSync } = require("child_process");

const { TezosToolkit } = require("@taquito/taquito");
const { InMemorySigner } = require("@taquito/signer");

const { migrate, getLigo } = require("../scripts/helpers");
const { confirmOperation } = require("../scripts/confirmation");

const { alice, dev } = require("../scripts/sandbox/accounts");

const quipuChefStorage = require("../storage/QuipuChef");
const quipuChefFunctions = require("../storage/QuipuChefFunctions");

const env = require("../env");

module.exports = async (tezos) => {
  const secretKey = env.network === "development" ? alice.sk : dev.sk;

  tezos = new TezosToolkit(tezos.rpc.url);

  tezos.setProvider({
    config: {
      confirmationPollingTimeoutSecond: env.confirmationPollingTimeoutSecond,
    },
    signer: await InMemorySigner.fromSecretKey(secretKey),
  });

  const quipuChefAddress = await migrate(tezos, "quipu_chef", quipuChefStorage);

  console.log(`Quipu Chef: ${quipuChefAddress}`);

  const ligo = getLigo(true);

  for (quipuChefFunction of quipuChefFunctions) {
    const stdout = execSync(
      `${ligo} compile-parameter --michelson-format=json $PWD/contracts/main/quipu_chef.ligo main 'Set_quipu_chef_function(record index=${quipuChefFunction.index}n; func=${quipuChefFunction.name}; end)'`,
      { maxBuffer: 1024 * 500 }
    );
    const operation = await tezos.contract.transfer({
      to: quipuChefAddress,
      amount: 0,
      parameter: {
        entrypoint: "set_quipu_chef_function",
        value: JSON.parse(stdout.toString()).args[0],
      },
    });

    await confirmOperation(tezos, operation.hash);
  }
};
