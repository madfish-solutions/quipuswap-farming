const { migrate } = require("../scripts/helpers");

const quipuChefStorage = require("../storage/QuipuChef");

module.exports = async (tezos) => {
  const contractAddress = await migrate(tezos, "QuipuChef", quipuChefStorage);

  console.log(`Quipu Chef: ${contractAddress}`);
};
