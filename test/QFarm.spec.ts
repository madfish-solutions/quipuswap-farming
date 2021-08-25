const { Utils } = require("./helpers/Utils.ts");
const { QFarm } = require("./helpers/QFarm.ts");

const { rejects, ok, strictEqual } = require("assert");

const { alice, bob } = require("../scripts/sandbox/accounts");

const qFarmStorage = require("../storage/QFarm");

const zeroAddress = "tz1ZZZZZZZZZZZZZZZZZZZZZZZZZZZZNkiRg";

describe("QFarm tests", async () => {
  var utils;
  var qFarm;

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

    qFarm = await QFarm.originate(utils.tezos, qFarmStorage);

    await qFarm.setLambdas();
  });

  it("should fail if not admin is trying to setup new pending admin", async () => {
    await utils.setProvider(bob.sk);
    await rejects(qFarm.setAdmin(bob.pkh), (err) => {
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
    await rejects(qFarm.confirmAdmin(), (err) => {
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
    await rejects(qFarm.setRewardPerSecond(newRPS), (err) => {
      ok(err.message == "Not-admin");

      return true;
    });
  });

  it("should change reward per second", async () => {
    const newRPS: number = 100;

    await utils.setProvider(bob.sk);
    await qFarm.setRewardPerSecond(newRPS);
    await qFarm.updateStorage();

    strictEqual(qFarm.storage.storage.qsgov_per_second.toNumber(), newRPS);
  });
});
