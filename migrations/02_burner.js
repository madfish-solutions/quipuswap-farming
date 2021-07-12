const Farmland = require("../build/farmland.json");

const { TezosToolkit } = require("@taquito/taquito");
const { InMemorySigner } = require("@taquito/signer");

const { migrate } = require("../scripts/helpers");

const { confirmOperation } = require("../scripts/confirmation");

const { alice, dev } = require("../scripts/sandbox/accounts");

const burnerStorage = require("../storage/Burner");

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

  const zeroAddress = "tz1ZZZZZZZZZZZZZZZZZZZZZZZZZZZZNkiRg";

  burnerStorage.pool = zeroAddress;
  burnerStorage.token = zeroAddress;

  const burnerAddress = await migrate(tezos, "burner", burnerStorage);

  console.log(`Burner: ${burnerAddress}`);

  const farmland = await tezos.contract.at(
    Farmland["networks"][env.network]["farmland"]
  );
  const operation = await farmland.methods.set_burner(burnerAddress).send();

  await confirmOperation(tezos, operation.hash);
};
