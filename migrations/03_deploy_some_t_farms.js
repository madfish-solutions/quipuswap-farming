const { MichelsonMap } = require("@taquito/taquito");
const TFarm = require("../build/t_farm.json");

const { TFarmUtils } = require("../test/helpers/TFarm");
const { Utils } = require("../test/helpers/Utils");
const { farms } = require("../storage/NewFarms");

const { confirmOperation } = require("../scripts/confirmation");

const { dev } = require("../scripts/sandbox/accounts");

const env = require("../env");

module.exports = async (tezos, network) => {
  const tFarm = await tezos.contract.at(TFarm["networks"][network]["t_farm"]);

  for (const farmParams of farms) {
    const updateOperatorParam = {
      add_operator: {
        owner: dev.pkh,
        operator: "KT1FeLt1D1Amnnjm31RoMzBoXMkn4bVX57y5",
        token_id: 0,
      },
    };

    const rewardToken = await tezos.contract.at(
      farmParams.reward_token.fA2.token
    );
    let operation = await rewardToken.methods
      .update_operators([updateOperatorParam])
      .send();

    await confirmOperation(tezos, operation.hash);

    operation = await tFarm.methods
      .add_new_farm(...Utils.destructObj(farmParams))
      .send();

    await confirmOperation(tezos, operation.hash);
  }
};
