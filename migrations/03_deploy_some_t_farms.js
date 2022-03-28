const { confirmOperation } = require("../scripts/confirmation");

const { dev } = require("../scripts/sandbox/accounts");

const { Utils } = require("../test/helpers/Utils");

const { ithacanetFarms } = require("../storage/NewFarms");

const TFarm = require("../build/t_farm.json");

module.exports = async (tezos, network) => {
  const tFarm = await tezos.contract.at(TFarm["networks"][network]["t_farm"]);
  const precision = 10 ** 18;
  let operation = null;

  for (const farm of ithacanetFarms) {
    if (farm.reward_token.fA2) {
      const updateOperatorParam = {
        add_operator: {
          owner: dev.pkh,
          operator: tFarm.address,
          token_id: 0,
        },
      };
      const rewardToken = await tezos.contract.at(farm.reward_token.fA2.token);

      operation = await rewardToken.methods
        .update_operators([updateOperatorParam])
        .send();

      await confirmOperation(tezos, operation.hash);
    } else {
      const rewardToken = await tezos.contract.at(farm.reward_token.fA12);
      const lifetime = +farm.end_time - +farm.start_time;
      const rewardsAmount = Math.ceil(
        (lifetime * farm.reward_per_second) / precision
      );

      operation = await rewardToken.methods
        .approve(tFarm.address, rewardsAmount)
        .send();

      await confirmOperation(tezos, operation.hash);
    }

    operation = await tFarm.methods
      .add_new_farm(...Utils.destructObj(farm))
      .send();

    await confirmOperation(tezos, operation.hash);
  }
};
