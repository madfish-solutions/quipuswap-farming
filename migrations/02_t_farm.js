const { OpKind, MichelsonMap } = require("@taquito/taquito");

const BakerRegistry = require("../build/baker_registry.json");
const Burner = require("../build/burner.json");

const { migrate } = require("../scripts/helpers");

const { confirmOperation } = require("../scripts/confirmation");

const { tFarmStorage } = require("../storage/TFarm");

const tFarmFunctions = require("../build/lambdas/t_farm_lambdas.json");

const env = require("../env");

module.exports = async (tezos, network) => {
  tFarmStorage.metadata = MichelsonMap.fromLiteral({
    "": Buffer.from("tezos-storage:quipuswap_farm", "ascii").toString("hex"),
    quipuswap_farm: Buffer.from(
      JSON.stringify({
        name: "QuipuSwap Farm",
        description:
          "The contract allows you to stake Tezos based tokens for rewards on QuipuSwap.",
        version: "v1.0.0",
        authors: ["Madfish.Solutions"],
        homepage: "https://quipuswap.com/",
        interfaces: ["TZIP-12", "TZIP-16"],
      }),
      "ascii"
    ).toString("hex"),
  });
  tFarmStorage.storage.qsgov = env.networks[network].qsgov;
  tFarmStorage.storage.qsgov_lp = env.networks[network].qsgov_lp;
  tFarmStorage.storage.admin = env.networks[network].admin;
  tFarmStorage.storage.burner = Burner["networks"][network]["burner"];
  tFarmStorage.storage.baker_registry =
    BakerRegistry["networks"][network]["baker_registry"];

  const tFarmAddress = await migrate(tezos, "t_farm", tFarmStorage, network);

  console.log(`TFarm: ${tFarmAddress}`);

  let batch1 = [];
  let batch2 = [];

  for (let i = 0; i < tFarmFunctions.length / 2; ++i) {
    batch1.push({
      kind: OpKind.TRANSACTION,
      to: tFarmAddress,
      amount: 0,
      parameter: {
        entrypoint: "setup_func",
        value: tFarmFunctions[i],
      },
    });
  }

  for (let i = tFarmFunctions.length / 2; i < tFarmFunctions.length; ++i) {
    batch2.push({
      kind: OpKind.TRANSACTION,
      to: tFarmAddress,
      amount: 0,
      parameter: {
        entrypoint: "setup_func",
        value: tFarmFunctions[i],
      },
    });
  }

  let batch = tezos.wallet.batch(batch1);
  let operation = await batch.send({
    fee: 1000000,
    gasLimit: 1040000,
    storageLimit: 20000,
  });

  await confirmOperation(tezos, operation.opHash);

  batch = tezos.wallet.batch(batch2);
  operation = await batch.send({
    fee: 1000000,
    gasLimit: 1040000,
    storageLimit: 20000,
  });

  await confirmOperation(tezos, operation.opHash);
};
