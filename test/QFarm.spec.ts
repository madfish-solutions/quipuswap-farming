import { Utils } from "./helpers/Utils";
import { QFarm } from "./helpers/QFarm";
import { Burner } from "./helpers/Burner";
import { ProxyMinter } from "./helpers/ProxyMinter";
import { BakerRegistry } from "./helpers/BakerRegistry";

import { rejects, ok, strictEqual } from "assert";

import { alice, bob } from "../scripts/sandbox/accounts";

import { qFarmStorage } from "../storage/QFarm";
import { burnerStorage } from "../storage/Burner";
import { proxyMinterStorage } from "../storage/ProxyMinter";
import { bakerRegistryStorage } from "../storage/BakerRegistry";

const zeroAddress: string = "tz1ZZZZZZZZZZZZZZZZZZZZZZZZZZZZNkiRg";

describe("QFarm tests", async () => {
  var utils: Utils;
  var qFarm: QFarm;
  var burner: Burner;
  var proxyMinter: ProxyMinter;
  var bakerRegistry: BakerRegistry;

  before("setup", async () => {
    utils = new Utils();

    await utils.init();

    qFarmStorage.storage.qsgov.token = zeroAddress;
    qFarmStorage.storage.qsgov.id = 0;
    qFarmStorage.storage.qsgov.is_fa2 = true;
    qFarmStorage.storage.qsgov_pool = zeroAddress;
    qFarmStorage.storage.admin = alice.pkh;
    qFarmStorage.storage.pending_admin = zeroAddress;
    qFarmStorage.storage.burner = zeroAddress;
    qFarmStorage.storage.proxy_minter = zeroAddress;
    qFarmStorage.storage.baker_registry = zeroAddress;

    burnerStorage.qsgov_lp = zeroAddress;
    burnerStorage.qsgov.token = zeroAddress;
    burnerStorage.qsgov.id = 0;
    burnerStorage.qsgov.is_fa2 = true;

    proxyMinterStorage.qsgov.token = zeroAddress;
    proxyMinterStorage.qsgov.id = 0;
    proxyMinterStorage.qsgov.is_fa2 = true;
    proxyMinterStorage.admin = alice.pkh;
    proxyMinterStorage.pending_admin = zeroAddress;

    qFarm = await QFarm.originate(utils.tezos, qFarmStorage);
    burner = await Burner.originate(utils.tezos, burnerStorage);
    proxyMinter = await ProxyMinter.originate(utils.tezos, proxyMinterStorage);
    bakerRegistry = await BakerRegistry.originate(
      utils.tezos,
      bakerRegistryStorage
    );

    await qFarm.setLambdas();
  });

  it("should fail if not admin is trying to setup new pending admin", async () => {
    await utils.setProvider(bob.sk);
    await rejects(qFarm.setAdmin(bob.pkh), (err: Error) => {
      ok(err.message == "Not-admin");

      return true;
    });
  });

  it("should setup new pending admin by admin", async () => {
    await utils.setProvider(alice.sk);
    await qFarm.setAdmin(bob.pkh);
    await qFarm.updateStorage();

    strictEqual(qFarm.storage.storage.admin, alice.pkh);
    strictEqual(qFarm.storage.storage.pending_admin, bob.pkh);
  });

  it("should fail if not pending admin is trying to confirm new admin", async () => {
    await rejects(qFarm.confirmAdmin(), (err: Error) => {
      ok(err.message == "Not-pending-admin");

      return true;
    });
  });

  it("should confirm new admin", async () => {
    await utils.setProvider(bob.sk);
    await qFarm.confirmAdmin();
    await qFarm.updateStorage();

    strictEqual(qFarm.storage.storage.admin, bob.pkh);
    strictEqual(qFarm.storage.storage.pending_admin, zeroAddress);
  });

  it("should fail if not admin is trying to set reward per second", async () => {
    const newRPS: number = 100;

    await utils.setProvider(alice.sk);
    await rejects(qFarm.setRewardPerSecond(newRPS), (err: Error) => {
      ok(err.message == "Not-admin");

      return true;
    });
  });

  it("should change reward per second by admin", async () => {
    const newRPS: number = 100;

    await utils.setProvider(bob.sk);
    await qFarm.setRewardPerSecond(newRPS);
    await qFarm.updateStorage();

    strictEqual(+qFarm.storage.storage.qsgov_per_second, newRPS);
  });

  it("should fail if not admin is trying to set burner", async () => {
    const burnerAddress: string = burner.contract.address;

    await utils.setProvider(alice.sk);
    await rejects(qFarm.setBurner(burnerAddress), (err: Error) => {
      ok(err.message == "Not-admin");

      return true;
    });
  });

  it("should change burner by admin", async () => {
    const burnerAddress: string = burner.contract.address;

    await utils.setProvider(bob.sk);
    await qFarm.setBurner(burnerAddress);
    await qFarm.updateStorage();

    strictEqual(qFarm.storage.storage.burner, burnerAddress);
  });

  it("should fail if not admin is trying to set proxy minter", async () => {
    const proxyMinterAddress: string = proxyMinter.contract.address;

    await utils.setProvider(alice.sk);
    await rejects(qFarm.setProxyMinter(proxyMinterAddress), (err: Error) => {
      ok(err.message == "Not-admin");

      return true;
    });
  });

  it("should change proxy minter by admin", async () => {
    const proxyMinterAddress: string = proxyMinter.contract.address;

    await utils.setProvider(bob.sk);
    await qFarm.setProxyMinter(proxyMinterAddress);
    await qFarm.updateStorage();

    strictEqual(qFarm.storage.storage.proxy_minter, proxyMinterAddress);
  });

  it("should fail if not admin is trying to set baker registry", async () => {
    const bakerRegistryAddress: string = bakerRegistry.contract.address;

    await utils.setProvider(alice.sk);
    await rejects(
      qFarm.setBakerRegistry(bakerRegistryAddress),
      (err: Error) => {
        ok(err.message == "Not-admin");

        return true;
      }
    );
  });

  it("should change baker registry by admin", async () => {
    const bakerRegistryAddress: string = bakerRegistry.contract.address;

    await utils.setProvider(bob.sk);
    await qFarm.setBakerRegistry(bakerRegistryAddress);
    await qFarm.updateStorage();

    strictEqual(qFarm.storage.storage.baker_registry, bakerRegistryAddress);
  });
});
