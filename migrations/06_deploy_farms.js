const QFarm = require("../build/q_farm.json");
const TFarm = require("../build/t_farm.json");

const { MichelsonMap, TezosToolkit } = require("@taquito/taquito");
const { InMemorySigner } = require("@taquito/signer");

const { QFarmUtils } = require("../test/helpers/QFarm");
const { Utils } = require("../test/helpers/Utils");

const { confirmOperation } = require("../scripts/confirmation");

const { alice, dev } = require("../scripts/sandbox/accounts");

const env = require("../env");

module.exports = async (tezos) => {
  const secretKey = env.network === "development" ? alice.sk : dev.sk;
  const utils = new Utils();
  const feePrecision = 2;
  const precision = 18;

  tezos = new TezosToolkit(tezos.rpc.url);

  tezos.setProvider({
    config: {
      confirmationPollingTimeoutSecond: env.confirmationPollingTimeoutSecond,
    },
    signer: await InMemorySigner.fromSecretKey(secretKey),
  });

  await utils.init(secretKey);

  let newFarmParams = await QFarmUtils.getMockNewFarmParams(utils);

  newFarmParams.fees.harvest_fee = 10 * feePrecision;
  newFarmParams.fees.withdrawal_fee = 15 * feePrecision;
  newFarmParams.fees.burn_reward = 23 * feePrecision;
  newFarmParams.stake_params.staked_token = {
    fA2: {
      token: "KT1DgpR6mXkbgyF3SdduyimNRy9GSR9TgRqp",
      id: 0,
    },
  };
  newFarmParams.reward_per_second = 100 * precision;
  newFarmParams.timelock = 0;
  newFarmParams.token_info = MichelsonMap.fromLiteral({
    name: Buffer.from("HELLO").toString("hex"),
    symbol: Buffer.from("WORLD").toString("hex"),
    decimals: Buffer.from("2021").toString("hex"),
  });

  const qFarm = await tezos.contract.at(
    QFarm["networks"][env.network]["q_farm"]
  );
  const tFarm = await tezos.contract.at(
    TFarm["networks"][env.network]["t_farm"]
  );
  let operation = await qFarm.methods
    .add_new_farm(...Utils.destructObj(newFarmParams))
    .send();

  await confirmOperation(tezos, operation.hash);

  operation = await qFarm.methods
    .add_new_farm(...Utils.destructObj(newFarmParams))
    .send();

  await confirmOperation(tezos, operation.hash);

  operation = await qFarm.methods
    .add_new_farm(...Utils.destructObj(newFarmParams))
    .send();

  await confirmOperation(tezos, operation.hash);
};
