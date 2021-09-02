import { FA12 } from "./helpers/FA12";
import { FA2 } from "./helpers/FA2";
import { Utils, zeroAddress } from "./helpers/Utils";
import { QFarm, QFarmUtils } from "./helpers/QFarm";
import { Burner } from "./helpers/Burner";
import { ProxyMinter } from "./helpers/ProxyMinter";
import { BakerRegistry } from "./helpers/BakerRegistry";
import { QSFA12Factory } from "./helpers/QSFA12Factory";
import { QSFA2Factory } from "./helpers/QSFA2Factory";

import {
  SetFeeParams,
  NewFarmParams,
  SetAllocPointParams,
} from "./types/QFarm";

import { rejects, ok, strictEqual } from "assert";

import { alice, bob } from "../scripts/sandbox/accounts";

import { fa12Storage } from "../storage/test/FA12";
import { fa2Storage } from "../storage/test/FA2";
import { qFarmStorage } from "../storage/QFarm";
import { burnerStorage } from "../storage/Burner";
import { proxyMinterStorage } from "../storage/ProxyMinter";
import { bakerRegistryStorage } from "../storage/BakerRegistry";
import { qsFA12FactoryStorage } from "../storage/test/QSFA12Factory";
import { qsFA2FactoryStorage } from "../storage/test/QSFA2Factory";

describe("QFarm tests", async () => {
  var fa12: FA12;
  var fa2: FA2;
  var utils: Utils;
  var qFarm: QFarm;
  var burner: Burner;
  var proxyMinter: ProxyMinter;
  var bakerRegistry: BakerRegistry;
  var qsFA12Factory: QSFA12Factory;
  var qsFA2Factory: QSFA2Factory;

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk);

    fa12 = await FA12.originate(utils.tezos, fa12Storage);
    fa2 = await FA2.originate(utils.tezos, fa2Storage);
    qsFA12Factory = await QSFA12Factory.originate(
      utils.tezos,
      qsFA12FactoryStorage
    );
    qsFA2Factory = await QSFA2Factory.originate(
      utils.tezos,
      qsFA2FactoryStorage
    );

    burnerStorage.qsgov_lp = zeroAddress;
    burnerStorage.qsgov.token = fa2.contract.address;
    burnerStorage.qsgov.id = 0;
    burnerStorage.qsgov.is_fa2 = true;

    proxyMinterStorage.qsgov.token = fa2.contract.address;
    proxyMinterStorage.qsgov.id = 0;
    proxyMinterStorage.qsgov.is_fa2 = true;
    proxyMinterStorage.admin = alice.pkh;
    proxyMinterStorage.pending_admin = zeroAddress;

    burner = await Burner.originate(utils.tezos, burnerStorage);
    proxyMinter = await ProxyMinter.originate(utils.tezos, proxyMinterStorage);
    bakerRegistry = await BakerRegistry.originate(
      utils.tezos,
      bakerRegistryStorage
    );

    qFarmStorage.storage.qsgov.token = fa2.contract.address;
    qFarmStorage.storage.qsgov.id = 0;
    qFarmStorage.storage.qsgov.is_fa2 = true;
    qFarmStorage.storage.qsgov_pool = zeroAddress;
    qFarmStorage.storage.admin = alice.pkh;
    qFarmStorage.storage.pending_admin = zeroAddress;
    qFarmStorage.storage.burner = burner.contract.address;
    qFarmStorage.storage.proxy_minter = proxyMinter.contract.address;
    qFarmStorage.storage.baker_registry = bakerRegistry.contract.address;

    qFarm = await QFarm.originate(utils.tezos, qFarmStorage);

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

  it("should fail if not admin is trying to set allocation points", async () => {
    const allocPoints: SetAllocPointParams[] = [{ fid: 0, alloc_point: 15 }];

    await utils.setProvider(alice.sk);
    await rejects(qFarm.setAllocPoints(allocPoints), (err: Error) => {
      ok(err.message === "Not-admin");

      return true;
    });
  });

  it("should fail if one farm from list of farms not found", async () => {
    const allocPoints: SetAllocPointParams[] = [{ fid: 0, alloc_point: 15 }];

    await utils.setProvider(bob.sk);
    await rejects(qFarm.setAllocPoints(allocPoints), (err: Error) => {
      ok(err.message === "QFarm/farm-not-set");

      return true;
    });
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
    newFarmParams.stake_params.staked_token.token = fa12.contract.address;
    newFarmParams.timelock = 20;
    newFarmParams.alloc_point = 50;

    await utils.setProvider(bob.sk);
    await qFarm.addNewFarm(newFarmParams);
    await qFarm.updateStorage({ farms: [0] });

    strictEqual(+qFarm.storage.storage.total_alloc_point, 0);
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
    strictEqual(
      qFarm.storage.storage.farms[0].reward_token.token,
      fa2.contract.address
    );
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
    strictEqual(+qFarm.storage.storage.farms[0].fid, 0);
    strictEqual(+qFarm.storage.storage.farms[0].total_votes, 0);

    ok(
      Date.parse(qFarm.storage.storage.farms[0].upd) >=
        +newFarmParams.start_time * 1000
    );
    ok(
      Date.parse(qFarm.storage.storage.farms[0].start_time) >=
        +newFarmParams.start_time * 1000
    );
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

  it("should fail if farm not started yet", async () => {
    const allocPoints: SetAllocPointParams[] = [{ fid: 3, alloc_point: 15 }];
    let newFarmParams: NewFarmParams = await QFarmUtils.getMockNewFarmParams(
      utils
    );

    newFarmParams.start_time = String(+newFarmParams.start_time + 60000);

    await qFarm.addNewFarm(newFarmParams);
    await rejects(qFarm.setAllocPoints(allocPoints), (err: Error) => {
      ok(err.message === "QFarm/not-started-yet");

      return true;
    });
  });

  it("should set/update allocation point for one farm", async () => {
    const allocPoints: SetAllocPointParams[] = [{ fid: 0, alloc_point: 15 }];

    await qFarm.setAllocPoints(allocPoints);
    await qFarm.updateStorage({ farms: [0] });

    strictEqual(+qFarm.storage.storage.total_alloc_point, 15);

    strictEqual(+qFarm.storage.storage.farms[0].alloc_point, 15);
    strictEqual(qFarm.storage.storage.farms[0].allocated, true);
  });

  it("should set/update allocation points for group of farms", async () => {
    const allocPoints: SetAllocPointParams[] = [
      { fid: 0, alloc_point: 35 },
      { fid: 1, alloc_point: 5 },
      { fid: 2, alloc_point: 45 },
    ];

    await qFarm.setAllocPoints(allocPoints);
    await qFarm.updateStorage({ farms: [0, 1, 2] });

    strictEqual(
      +qFarm.storage.storage.total_alloc_point,
      allocPoints.reduce((acc, curr) => acc + curr.alloc_point, 0)
    );

    for (let i = 0; i < allocPoints.length; ++i) {
      strictEqual(
        +qFarm.storage.storage.farms[i].alloc_point,
        allocPoints[i].alloc_point
      );
      strictEqual(qFarm.storage.storage.farms[i].allocated, true);
    }
  });
});
