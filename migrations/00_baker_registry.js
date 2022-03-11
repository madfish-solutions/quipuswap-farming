const { migrate } = require("../scripts/helpers");

const { bakerRegistryStorage } = require("../storage/BakerRegistry");

module.exports = async (tezos, network) => {
  const bakerRegistryAddress = await migrate(
    tezos,
    "baker_registry",
    bakerRegistryStorage,
    network
  );

  console.log(`BakerRegistry: ${bakerRegistryAddress}`);
};
