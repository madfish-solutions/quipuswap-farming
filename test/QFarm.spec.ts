import { Utils } from "./helpers/Utils";
import { QFarm } from "./helpers/QFarm";
import { Burner } from "./helpers/Burner";

import { rejects, ok, strictEqual } from "assert";

import { alice, bob } from "../scripts/sandbox/accounts";

import { qFarmStorage } from "../storage/QFarm";
import { burnerStorage } from "../storage/Burner";

const zeroAddress: string = "tz1ZZZZZZZZZZZZZZZZZZZZZZZZZZZZNkiRg";

describe("QFarm tests", async () => {
  var utils: Utils;
  var qFarm: QFarm;
  var burner: Burner;

  before("setup", async () => {
    utils = new Utils();

    await utils.init();

    qFarmStorage.storage.qsgov.token = zeroAddress;
    qFarmStorage.storage.qsgov_pool = zeroAddress;
    qFarmStorage.storage.admin = alice.pkh;
    qFarmStorage.storage.pending_admin = zeroAddress;
    qFarmStorage.storage.burner = zeroAddress;
    qFarmStorage.storage.proxy_minter = zeroAddress;
    qFarmStorage.storage.baker_registry = zeroAddress;

    burnerStorage.qsgov_lp = zeroAddress;
    burnerStorage.qsgov.token = zeroAddress;

    qFarm = await QFarm.originate(utils.tezos, qFarmStorage);
    // burner = await Burner.originate(utils.tezos, burnerStorage);

    // console.log(burner.contract.address);

    await qFarm.setLambdas();
  });

  it("should fail if not admin is trying to setup new pending admin", async () => {
    await utils.setProvider(bob.sk);
    await rejects(qFarm.setAdmin(bob.pkh), (err: Error) => {
      ok(err.message == "Not-admin");

      return true;
    });
  });

  it("should setup new pending admin", async () => {
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

  it("should change reward per second", async () => {
    const newRPS: number = 100;

    await utils.setProvider(bob.sk);
    await qFarm.setRewardPerSecond(newRPS);
    await qFarm.updateStorage();

    strictEqual(+qFarm.storage.storage.qsgov_per_second, newRPS);
  });
});
