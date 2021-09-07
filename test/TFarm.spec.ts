import { FA12 } from "./helpers/FA12";
import { FA2 } from "./helpers/FA2";
import { Utils, zeroAddress } from "./helpers/Utils";
import { TFarm } from "./helpers/TFarm";
import { Burner } from "./helpers/Burner";
import { BakerRegistry } from "./helpers/BakerRegistry";
import { QSFA12Factory } from "./helpers/QSFA12Factory";
import { QSFA2Factory } from "./helpers/QSFA2Factory";

import { UpdateOperatorParam } from "./types/FA2";

import { ok, rejects, strictEqual } from "assert";

import { alice, bob } from "../scripts/sandbox/accounts";

import { fa12Storage } from "../storage/test/FA12";
import { fa2Storage } from "../storage/test/FA2";
import { tFarmStorage } from "../storage/TFarm";
import { burnerStorage } from "../storage/Burner";
import { bakerRegistryStorage } from "../storage/BakerRegistry";
import { qsFA12FactoryStorage } from "../storage/test/QSFA12Factory";
import { qsFA2FactoryStorage } from "../storage/test/QSFA2Factory";

describe("TFarm tests", async () => {
  var fa12: FA12;
  var qsGov: FA2;
  var utils: Utils;
  var tFarm: TFarm;
  var burner: Burner;
  var bakerRegistry: BakerRegistry;
  var qsFA12Factory: QSFA12Factory;
  var qsFA2Factory: QSFA2Factory;

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk);

    fa12 = await FA12.originate(utils.tezos, fa12Storage);
    qsGov = await FA2.originate(utils.tezos, fa2Storage);
    qsFA12Factory = await QSFA12Factory.originate(
      utils.tezos,
      qsFA12FactoryStorage
    );
    qsFA2Factory = await QSFA2Factory.originate(
      utils.tezos,
      qsFA2FactoryStorage
    );

    await qsFA12Factory.setDexAndTokenLambdas();
    await qsFA2Factory.setDexAndTokenLambdas();

    const updateOperatorParam: UpdateOperatorParam = {
      add_operator: {
        owner: alice.pkh,
        operator: qsFA2Factory.contract.address,
        token_id: 0,
      },
    };

    await qsGov.updateOperators([updateOperatorParam]);
    await qsFA2Factory.launchExchange(qsGov.contract.address, 0, 10000, 10000);
    await qsFA2Factory.updateStorage({
      token_to_exchange: [[qsGov.contract.address, 0]],
    });

    const qsgov_lp = await qsFA2Factory.storage.token_to_exchange[
      `${qsGov.contract.address},${0}`
    ];

    burnerStorage.qsgov_lp.token = qsgov_lp;
    burnerStorage.qsgov_lp.id = 0;
    burnerStorage.qsgov_lp.is_fa2 = true;
    burnerStorage.qsgov.token = qsGov.contract.address;
    burnerStorage.qsgov.id = 0;
    burnerStorage.qsgov.is_fa2 = true;

    burner = await Burner.originate(utils.tezos, burnerStorage);
    bakerRegistry = await BakerRegistry.originate(
      utils.tezos,
      bakerRegistryStorage
    );

    tFarmStorage.storage.qsgov.token = qsGov.contract.address;
    tFarmStorage.storage.qsgov.id = 0;
    tFarmStorage.storage.qsgov.is_fa2 = true;
    tFarmStorage.storage.qsgov_lp.token = qsgov_lp;
    tFarmStorage.storage.qsgov_lp.id = 0;
    tFarmStorage.storage.qsgov_lp.is_fa2 = true;
    tFarmStorage.storage.admin = alice.pkh;
    tFarmStorage.storage.pending_admin = zeroAddress;
    tFarmStorage.storage.burner = zeroAddress;
    tFarmStorage.storage.baker_registry = zeroAddress;
    tFarmStorage.storage.farms_count = 0;

    tFarm = await TFarm.originate(utils.tezos, tFarmStorage);

    await tFarm.setLambdas();
  });

  it("should fail if not admin is trying to setup new pending admin", async () => {
    await utils.setProvider(bob.sk);
    await rejects(tFarm.setAdmin(bob.pkh), (err: Error) => {
      ok(err.message === "Not-admin");

      return true;
    });
  });

  it("should setup new pending admin by admin", async () => {
    await utils.setProvider(alice.sk);
    await tFarm.setAdmin(bob.pkh);
    await tFarm.updateStorage();

    strictEqual(tFarm.storage.storage.admin, alice.pkh);
    strictEqual(tFarm.storage.storage.pending_admin, bob.pkh);
  });

  it("should fail if not pending admin is trying to confirm new admin", async () => {
    await rejects(tFarm.confirmAdmin(), (err: Error) => {
      ok(err.message === "Not-pending-admin");

      return true;
    });
  });

  it("should confirm new admin by pending admin", async () => {
    await utils.setProvider(bob.sk);
    await tFarm.confirmAdmin();
    await tFarm.updateStorage();

    strictEqual(tFarm.storage.storage.admin, bob.pkh);
    strictEqual(tFarm.storage.storage.pending_admin, zeroAddress);
  });

  it("should fail if not admin is trying to set burner", async () => {
    const burnerAddress: string = burner.contract.address;

    await utils.setProvider(alice.sk);
    await rejects(tFarm.setBurner(burnerAddress), (err: Error) => {
      ok(err.message === "Not-admin");

      return true;
    });
  });

  it("should change burner by admin", async () => {
    const burnerAddress: string = burner.contract.address;

    await utils.setProvider(bob.sk);
    await tFarm.updateStorage();

    strictEqual(tFarm.storage.storage.burner, zeroAddress);

    await tFarm.setBurner(burnerAddress);
    await tFarm.updateStorage();

    strictEqual(tFarm.storage.storage.burner, burnerAddress);
  });

  it("should fail if not admin is trying to set baker registry", async () => {
    const bakerRegistryAddress: string = bakerRegistry.contract.address;

    await utils.setProvider(alice.sk);
    await rejects(
      tFarm.setBakerRegistry(bakerRegistryAddress),
      (err: Error) => {
        ok(err.message === "Not-admin");

        return true;
      }
    );
  });

  it("should change baker registry by admin", async () => {
    const bakerRegistryAddress: string = bakerRegistry.contract.address;

    await utils.setProvider(bob.sk);
    await tFarm.updateStorage();

    strictEqual(tFarm.storage.storage.baker_registry, zeroAddress);

    await tFarm.setBakerRegistry(bakerRegistryAddress);
    await tFarm.updateStorage();

    strictEqual(tFarm.storage.storage.baker_registry, bakerRegistryAddress);
  });
});
