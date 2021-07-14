const Farmland = require("../build/farmland.json");

const { TezosToolkit } = require("@taquito/taquito");
const { InMemorySigner } = require("@taquito/signer");

const { migrate } = require("../scripts/helpers");

const { confirmOperation } = require("../scripts/confirmation");

const { alice, dev } = require("../scripts/sandbox/accounts");

const proxyMinterStorage = require("../storage/ProxyMinter");

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

  proxyMinterStorage.farms = [Farmland["networks"][env.network]["farmland"]];
  proxyMinterStorage.qsgov.token = zeroAddress;
  proxyMinterStorage.qsgov.id = "0";
  proxyMinterStorage.admin = deployer;
  proxyMinterStorage.pending_admin = zeroAddress;

  const proxyMinterAddress = await migrate(
    tezos,
    "proxy_minter",
    proxyMinterStorage
  );

  console.log(`ProxyMinter: ${proxyMinterAddress}`);

  const farmland = await tezos.contract.at(
    Farmland["networks"][env.network]["farmland"]
  );
  const operation = await farmland.methods
    .set_proxy_minter(proxyMinterAddress)
    .send();

  await confirmOperation(tezos, operation.hash);
};
