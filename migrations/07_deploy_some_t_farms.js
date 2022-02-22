const { MichelsonMap, TezosToolkit } = require("@taquito/taquito");
const { InMemorySigner } = require("@taquito/signer");

const { TFarmUtils } = require("../test/helpers/TFarm");
const { Utils } = require("../test/helpers/Utils");

const { confirmOperation } = require("../scripts/confirmation");

const { dev } = require("../scripts/sandbox/accounts");

const env = require("../env");

module.exports = async (tezos) => {
  const secretKey = dev.sk;
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

  let newFarmParams = await TFarmUtils.getMockNewFarmParams(utils);

  newFarmParams.fees.harvest_fee = 10 * feePrecision;
  newFarmParams.fees.withdrawal_fee = 15 * feePrecision;
  newFarmParams.stake_params.staked_token = {
    fA2: {
      token: "KT1UF2uAyzVWbvL9GkcEKL8yBwbd9sYCnXbP",
      id: 0,
    },
  };
  newFarmParams.stake_params.qs_pool = "KT1RHSyszGjYjqWxSe3RShoAATm4BbqMSwtX";
  newFarmParams.reward_per_second = 10 * precision;
  newFarmParams.reward_token = {
    fA2: {
      token: "KT1A2E72tR1abahQgBNi9Lw3LqRDL5eGjjbU",
      id: 0,
    },
  };

  const lifetime = 8640000;

  newFarmParams.timelock = 0;
  newFarmParams.start_time = String(
    Date.parse((await utils.tezos.rpc.getBlockHeader()).timestamp) / 1000 + 1
  );
  newFarmParams.end_time = String(
    Date.parse((await utils.tezos.rpc.getBlockHeader()).timestamp) / 1000 +
      lifetime +
      1
  );
  newFarmParams.token_info = MichelsonMap.fromLiteral({
    name: Buffer.from("HELLO").toString("hex"),
    symbol: Buffer.from("WORLD").toString("hex"),
    decimals: Buffer.from("2021").toString("hex"),
  });

  const tFarm = await tezos.contract.at("KT1FeLt1D1Amnnjm31RoMzBoXMkn4bVX57y5");
  const updateOperatorParam = {
    add_operator: {
      owner: dev.pkh,
      operator: "KT1FeLt1D1Amnnjm31RoMzBoXMkn4bVX57y5",
      token_id: 0,
    },
  };
  const rewardToken = await tezos.contract.at(
    newFarmParams.reward_token.fA2.token
  );
  const stakedToken = await tezos.contract.at(
    newFarmParams.stake_params.staked_token.fA2.token
  );

  let operation = await rewardToken.methods
    .update_operators([updateOperatorParam])
    .send();

  await confirmOperation(tezos, operation.hash);

  operation = await stakedToken.methods
    .update_operators([updateOperatorParam])
    .send();

  await confirmOperation(tezos, operation.hash);

  for (let i = 0; i < 3; ++i) {
    operation = await tFarm.methods
      .add_new_farm(...Utils.destructObj(newFarmParams))
      .send();

    await confirmOperation(tezos, operation.hash);
  }
};
