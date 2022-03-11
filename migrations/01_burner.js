const { migrate } = require("../scripts/helpers");

const { burnerStorage } = require("../storage/Burner");

const env = require("../env");

module.exports = async (tezos, network) => {
  burnerStorage.qsgov = env.networks[network].qsgov;
  burnerStorage.qsgov_lp = env.networks[network].qsgov_lp;

  const burnerAddress = await migrate(tezos, "burner", burnerStorage, network);

  console.log(`Burner: ${burnerAddress}`);
};
