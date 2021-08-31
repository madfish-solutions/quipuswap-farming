import { Utils } from "./helpers/Utils";
import { QFarm, QFarmUtils } from "./helpers/QFarm";
import { Burner } from "./helpers/Burner";
import { ProxyMinter } from "./helpers/ProxyMinter";
import { BakerRegistry } from "./helpers/BakerRegistry";
import { zeroAddress } from "./helpers/Utils";

import { SetFeeParams, NewFarmParams } from "./types/QFarm";

import { rejects, ok, strictEqual } from "assert";

import { alice, bob } from "../scripts/sandbox/accounts";

import { qFarmStorage } from "../storage/QFarm";
import { burnerStorage } from "../storage/Burner";
import { proxyMinterStorage } from "../storage/ProxyMinter";
import { bakerRegistryStorage } from "../storage/BakerRegistry";

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
      ok(err.message === "Not-admin");

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
      ok(err.message === "Not-pending-admin");

      return true;
    });
  });

  it("should confirm new admin by pending admin", async () => {
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
      ok(err.message === "Not-admin");

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
      ok(err.message === "Not-admin");

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
      ok(err.message === "Not-admin");

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
        ok(err.message === "Not-admin");

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

  it("should fail if not admin is trying to add new farm", async () => {
    const newFarmParams: NewFarmParams = await QFarmUtils.getMockNewFarmParams(
      utils
    );

    await utils.setProvider(alice.sk);
    await rejects(qFarm.addNewFarm(newFarmParams), (err: Error) => {
      ok(err.message === "Not-admin");

      return true;
    });
  });

  it("should add new farm by admin and set all farm's fields correctly", async () => {
    let newFarmParams: NewFarmParams = await QFarmUtils.getMockNewFarmParams(
      utils
    );

    newFarmParams.fees.harvest_fee = 10;
    newFarmParams.fees.withdrawal_fee = 15;
    newFarmParams.timelock = 20;
    newFarmParams.alloc_point = 50;

    await utils.setProvider(bob.sk);
    await qFarm.addNewFarm(newFarmParams);
    await qFarm.updateStorage({ farms: [0] });

    strictEqual(
      +qFarm.storage.storage.total_alloc_point,
      newFarmParams.alloc_point
    );
    strictEqual(+qFarm.storage.storage.farms_count, 1);

    strictEqual(
      +qFarm.storage.storage.farms[0].fees.harvest_fee,
      newFarmParams.fees.harvest_fee
    );
    strictEqual(
      +qFarm.storage.storage.farms[0].fees.withdrawal_fee,
      newFarmParams.fees.withdrawal_fee
    );
    strictEqual(
      Date.parse(qFarm.storage.storage.farms[0].upd),
      +newFarmParams.start_time * 1000
    );
    strictEqual(
      qFarm.storage.storage.farms[0].stake_params.staked_token.token,
      newFarmParams.stake_params.staked_token.token
    );
    strictEqual(
      +qFarm.storage.storage.farms[0].stake_params.staked_token.id,
      newFarmParams.stake_params.staked_token.id
    );
    strictEqual(
      qFarm.storage.storage.farms[0].stake_params.staked_token.is_fa2,
      newFarmParams.stake_params.staked_token.is_fa2
    );
    strictEqual(
      qFarm.storage.storage.farms[0].stake_params.is_lp_staked_token,
      newFarmParams.stake_params.is_lp_staked_token
    );
    strictEqual(
      qFarm.storage.storage.farms[0].stake_params.token.token,
      newFarmParams.stake_params.token.token
    );
    strictEqual(
      +qFarm.storage.storage.farms[0].stake_params.token.id,
      newFarmParams.stake_params.token.id
    );
    strictEqual(
      qFarm.storage.storage.farms[0].stake_params.token.is_fa2,
      newFarmParams.stake_params.token.is_fa2
    );
    strictEqual(
      qFarm.storage.storage.farms[0].stake_params.qs_pool,
      newFarmParams.stake_params.qs_pool
    );
    strictEqual(qFarm.storage.storage.farms[0].reward_token.token, zeroAddress);
    strictEqual(+qFarm.storage.storage.farms[0].reward_token.id, 0);
    strictEqual(qFarm.storage.storage.farms[0].reward_token.is_fa2, true);
    strictEqual(
      +qFarm.storage.storage.farms[0].timelock,
      newFarmParams.timelock
    );
    strictEqual(qFarm.storage.storage.farms[0].current_delegated, zeroAddress);
    strictEqual(qFarm.storage.storage.farms[0].current_candidate, zeroAddress);
    strictEqual(
      +qFarm.storage.storage.farms[0].alloc_point,
      newFarmParams.alloc_point
    );
    strictEqual(+qFarm.storage.storage.farms[0].rps, 0);
    strictEqual(+qFarm.storage.storage.farms[0].staked, 0);
    strictEqual(
      Date.parse(qFarm.storage.storage.farms[0].start_time),
      +newFarmParams.start_time * 1000
    );
    strictEqual(+qFarm.storage.storage.farms[0].fid, 0);
    strictEqual(+qFarm.storage.storage.farms[0].total_votes, 0);
  });

  it("should fail if not admin is trying to set fees", async () => {
    const fees: SetFeeParams[] = [
      { fid: 0, fees: { harvest_fee: 15, withdrawal_fee: 10 } },
    ];

    await utils.setProvider(alice.sk);
    await rejects(qFarm.setFees(fees), (err: Error) => {
      ok(err.message === "Not-admin");

      return true;
    });
  });

  it("should fail if one farm from list of farms not found", async () => {
    const fees: SetFeeParams[] = [
      { fid: 0, fees: { harvest_fee: 15, withdrawal_fee: 10 } },
      { fid: 666, fees: { harvest_fee: 15, withdrawal_fee: 10 } },
    ];

    await utils.setProvider(bob.sk);
    await rejects(qFarm.setFees(fees), (err: Error) => {
      ok(err.message === "QFarm/farm-not-set");

      return true;
    });
  });

  it("should set/update fees for one farm", async () => {
    const fees: SetFeeParams[] = [
      { fid: 0, fees: { harvest_fee: 1, withdrawal_fee: 5 } },
    ];

    await qFarm.setFees(fees);
    await qFarm.updateStorage({ farms: [0] });

    strictEqual(
      +qFarm.storage.storage.farms[0].fees.harvest_fee,
      fees[0].fees.harvest_fee
    );
    strictEqual(
      +qFarm.storage.storage.farms[0].fees.withdrawal_fee,
      fees[0].fees.withdrawal_fee
    );
  });

  it("should set/update fees for group of farms", async () => {
    const fees: SetFeeParams[] = [
      { fid: 0, fees: { harvest_fee: 1, withdrawal_fee: 5 } },
      { fid: 1, fees: { harvest_fee: 5, withdrawal_fee: 25 } },
      { fid: 2, fees: { harvest_fee: 3, withdrawal_fee: 3 } },
    ];

    await qFarm.addNewFarm(await QFarmUtils.getMockNewFarmParams(utils));
    await qFarm.addNewFarm(await QFarmUtils.getMockNewFarmParams(utils));
    await qFarm.setFees(fees);
    await qFarm.updateStorage({ farms: [0, 1, 2] });

    for (let i = 0; i < fees.length; ++i) {
      strictEqual(
        +qFarm.storage.storage.farms[i].fees.harvest_fee,
        fees[i].fees.harvest_fee
      );
      strictEqual(
        +qFarm.storage.storage.farms[i].fees.withdrawal_fee,
        fees[i].fees.withdrawal_fee
      );
    }
  });
});
