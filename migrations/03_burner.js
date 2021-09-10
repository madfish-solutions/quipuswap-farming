const { TezosToolkit } = require("@taquito/taquito");
const { InMemorySigner } = require("@taquito/signer");

const { migrate } = require("../scripts/helpers");

const { alice, dev } = require("../scripts/sandbox/accounts");

const { burnerStorage } = require("../storage/Burner");

const { zeroAddress } = require("../test/helpers/Utils");

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

  burnerStorage.qsgov_lp = zeroAddress;
  burnerStorage.qsgov.token = zeroAddress;
  burnerStorage.qsgov.id = 0;

  const burnerAddress = await migrate(tezos, "burner", burnerStorage);

  console.log(`Burner: ${burnerAddress}`);
};
