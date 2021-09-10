import { FA12 } from "./helpers/FA12";
import { FA2 } from "./helpers/FA2";
import { Utils, zeroAddress } from "./helpers/Utils";
import { TFarm, TFarmUtils } from "./helpers/TFarm";
import { Burner } from "./helpers/Burner";
import { BakerRegistry } from "./helpers/BakerRegistry";
import { QSFA12Factory } from "./helpers/QSFA12Factory";
import { QSFA2Factory } from "./helpers/QSFA2Factory";

import { UpdateOperatorParam } from "./types/FA2";
import { NewFarmParams, PauseFarmParam } from "./types/TFarm";
import { SetFeeParams } from "./types/Common";

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

    burnerStorage.qsgov_lp = qsgov_lp;
    burnerStorage.qsgov.token = qsGov.contract.address;
    burnerStorage.qsgov.id = 0;

    burner = await Burner.originate(utils.tezos, burnerStorage);
    bakerRegistry = await BakerRegistry.originate(
      utils.tezos,
      bakerRegistryStorage
    );

    tFarmStorage.storage.qsgov.token = qsGov.contract.address;
    tFarmStorage.storage.qsgov.id = 0;
    tFarmStorage.storage.qsgov_lp = qsgov_lp;
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

  it("should fail if not admin is trying to add new farm", async () => {
    const newFarmParams: NewFarmParams = await TFarmUtils.getMockNewFarmParams(
      utils
    );

    await utils.setProvider(alice.sk);
    await rejects(tFarm.addNewFarm(newFarmParams), (err: Error) => {
      ok(err.message === "Not-admin");

      return true;
    });
  });

  it("should fail if end time is less or equal to start time", async () => {
    const newFarmParams: NewFarmParams = await TFarmUtils.getMockNewFarmParams(
      utils
    );

    await utils.setProvider(bob.sk);
    await rejects(tFarm.addNewFarm(newFarmParams), (err: Error) => {
      ok(err.message === "TFarm/wrong-end-time");

      return true;
    });
  });

  it("should add new farm by admin and set all farm's fields correctly", async () => {
    let newFarmParams: NewFarmParams = await TFarmUtils.getMockNewFarmParams(
      utils
    );
    const lifetime: number = 10; // 10 seconds

    newFarmParams.fees.harvest_fee = 10;
    newFarmParams.fees.withdrawal_fee = 15;
    newFarmParams.stake_params.staked_token = {
      fA2: { token: qsGov.contract.address, id: 0 },
    };
    newFarmParams.reward_token = { fA12: fa12.contract.address };
    newFarmParams.timelock = 20;
    newFarmParams.end_time = String(
      Date.parse((await utils.tezos.rpc.getBlockHeader()).timestamp) / 1000 +
        lifetime
    );
    newFarmParams.reward_per_second = 100;

    await fa12.approve(
      tFarm.contract.address,
      lifetime * newFarmParams.reward_per_second
    );
    await tFarm.addNewFarm(newFarmParams);
    await tFarm.updateStorage({ farms: [0] });

    strictEqual(+tFarm.storage.storage.farms_count, 1);

    strictEqual(
      +tFarm.storage.storage.farms[0].fees.harvest_fee,
      newFarmParams.fees.harvest_fee
    );
    strictEqual(
      +tFarm.storage.storage.farms[0].fees.withdrawal_fee,
      newFarmParams.fees.withdrawal_fee
    );
    strictEqual(
      tFarm.storage.storage.farms[0].stake_params.staked_token.fA2.token,
      newFarmParams.stake_params.staked_token.fA2.token
    );
    strictEqual(
      +tFarm.storage.storage.farms[0].stake_params.staked_token.fA2.id,
      newFarmParams.stake_params.staked_token.fA2.id
    );
    strictEqual(
      tFarm.storage.storage.farms[0].stake_params.is_lp_staked_token,
      newFarmParams.stake_params.is_lp_staked_token
    );
    strictEqual(
      tFarm.storage.storage.farms[0].stake_params.token.fA12,
      newFarmParams.stake_params.token.fA12
    );
    strictEqual(
      tFarm.storage.storage.farms[0].stake_params.qs_pool,
      newFarmParams.stake_params.qs_pool
    );
    strictEqual(
      tFarm.storage.storage.farms[0].reward_token.fA12,
      newFarmParams.reward_token.fA12
    );
    strictEqual(
      +tFarm.storage.storage.farms[0].timelock,
      newFarmParams.timelock
    );
    strictEqual(tFarm.storage.storage.farms[0].current_delegated, zeroAddress);
    strictEqual(tFarm.storage.storage.farms[0].current_candidate, zeroAddress);
    strictEqual(tFarm.storage.storage.farms[0].paused, newFarmParams.paused);
    strictEqual(
      +tFarm.storage.storage.farms[0].reward_per_second,
      newFarmParams.reward_per_second
    );
    strictEqual(+tFarm.storage.storage.farms[0].rps, 0);
    strictEqual(+tFarm.storage.storage.farms[0].staked, 0);
    strictEqual(+tFarm.storage.storage.farms[0].fid, 0);
    strictEqual(+tFarm.storage.storage.farms[0].total_votes, 0);

    ok(
      Date.parse(tFarm.storage.storage.farms[0].upd) >=
        +newFarmParams.start_time * 1000
    );
    ok(
      Date.parse(tFarm.storage.storage.farms[0].start_time) >=
        +newFarmParams.start_time * 1000
    );
    ok(
      Date.parse(tFarm.storage.storage.farms[0].end_time) >
        +newFarmParams.start_time * 1000
    );
  });

  it("should transfer correct amount of FA1.2 tokens to the contract as the rewards for users", async () => {
    let newFarmParams: NewFarmParams = await TFarmUtils.getMockNewFarmParams(
      utils
    );
    const lifetime: number = 120; // 2 minutes

    newFarmParams.reward_token = { fA12: fa12.contract.address };
    newFarmParams.end_time = String(
      Date.parse((await utils.tezos.rpc.getBlockHeader()).timestamp) / 1000 +
        lifetime
    );
    newFarmParams.reward_per_second = 100;

    await fa12.updateStorage({ ledger: [tFarm.contract.address, bob.pkh] });

    const bobInitialBalance: number = +fa12.storage.ledger[bob.pkh].balance;
    const rewardsAmount: number = lifetime * newFarmParams.reward_per_second;

    await fa12.approve(tFarm.contract.address, rewardsAmount);
    await tFarm.addNewFarm(newFarmParams);
    await fa12.updateStorage({ ledger: [tFarm.contract.address, bob.pkh] });

    strictEqual(
      +fa12.storage.ledger[bob.pkh].balance,
      bobInitialBalance - rewardsAmount
    );
    strictEqual(
      +fa12.storage.ledger[tFarm.contract.address].balance,
      rewardsAmount + 1000 // 1000 from previous test
    );
  });

  it("should transfer correct amount of FA2 tokens to the contract as the rewards for users", async () => {
    let newFarmParams: NewFarmParams = await TFarmUtils.getMockNewFarmParams(
      utils
    );
    const lifetime: number = 300; // 5 minutes

    newFarmParams.reward_token = {
      fA2: { token: qsGov.contract.address, id: 0 },
    };
    newFarmParams.end_time = String(
      Date.parse((await utils.tezos.rpc.getBlockHeader()).timestamp) / 1000 +
        lifetime
    );
    newFarmParams.reward_per_second = 200;

    await qsGov.updateStorage({ account_info: [bob.pkh] });

    const bobInitialBalance: number = +(await qsGov.storage.account_info[
      bob.pkh
    ].balances.get(String(newFarmParams.reward_token.fA2.id)));
    const rewardsAmount: number = lifetime * newFarmParams.reward_per_second;
    const updateOperatorParam: UpdateOperatorParam = {
      add_operator: {
        owner: bob.pkh,
        operator: tFarm.contract.address,
        token_id: newFarmParams.reward_token.fA2.id,
      },
    };

    await qsGov.updateOperators([updateOperatorParam]);
    await tFarm.addNewFarm(newFarmParams);
    await qsGov.updateStorage({
      account_info: [tFarm.contract.address, bob.pkh],
    });

    strictEqual(
      +(await qsGov.storage.account_info[bob.pkh].balances.get(
        String(newFarmParams.reward_token.fA2.id)
      )),
      bobInitialBalance - rewardsAmount
    );
    strictEqual(
      +(await qsGov.storage.account_info[tFarm.contract.address].balances.get(
        String(newFarmParams.reward_token.fA2.id)
      )),
      rewardsAmount
    );
  });

  it("should fail if not admin is trying to set fees", async () => {
    const fees: SetFeeParams[] = [
      { fid: 0, fees: { harvest_fee: 15, withdrawal_fee: 10 } },
    ];

    await utils.setProvider(alice.sk);
    await rejects(tFarm.setFees(fees), (err: Error) => {
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
    await rejects(tFarm.setFees(fees), (err: Error) => {
      ok(err.message === "TFarm/farm-not-set");

      return true;
    });
  });

  it("should set/update fees for one farm", async () => {
    const fees: SetFeeParams[] = [
      { fid: 0, fees: { harvest_fee: 1, withdrawal_fee: 5 } },
    ];

    await tFarm.setFees(fees);
    await tFarm.updateStorage({ farms: [0] });

    strictEqual(
      +tFarm.storage.storage.farms[0].fees.harvest_fee,
      fees[0].fees.harvest_fee
    );
    strictEqual(
      +tFarm.storage.storage.farms[0].fees.withdrawal_fee,
      fees[0].fees.withdrawal_fee
    );
  });

  it("should set/update fees for group of farms", async () => {
    const fees: SetFeeParams[] = [
      { fid: 0, fees: { harvest_fee: 16, withdrawal_fee: 21 } },
      { fid: 1, fees: { harvest_fee: 5, withdrawal_fee: 25 } },
      { fid: 2, fees: { harvest_fee: 3, withdrawal_fee: 3 } },
    ];

    await tFarm.setFees(fees);
    await tFarm.updateStorage({ farms: [0, 1, 2] });

    for (let i = 0; i < fees.length; ++i) {
      strictEqual(
        +tFarm.storage.storage.farms[i].fees.harvest_fee,
        fees[i].fees.harvest_fee
      );
      strictEqual(
        +tFarm.storage.storage.farms[i].fees.withdrawal_fee,
        fees[i].fees.withdrawal_fee
      );
    }
  });

  it("should fail if not admin is trying to pause farm", async () => {
    const pauseFarmParams: PauseFarmParam[] = [{ fid: 0, pause: true }];

    await utils.setProvider(alice.sk);
    await rejects(tFarm.pauseFarms(pauseFarmParams), (err: Error) => {
      ok(err.message === "Not-admin");

      return true;
    });
  });

  it("should fail if one farm from list of farms not found", async () => {
    const pauseFarmParams: PauseFarmParam[] = [{ fid: 666, pause: true }];

    await utils.setProvider(bob.sk);
    await rejects(tFarm.pauseFarms(pauseFarmParams), (err: Error) => {
      ok(err.message === "TFarm/farm-not-set");

      return true;
    });
  });

  it("should pause one farm", async () => {
    const pauseFarmParams: PauseFarmParam[] = [{ fid: 0, pause: true }];

    await tFarm.pauseFarms(pauseFarmParams);
    await tFarm.updateStorage({ farms: [0] });

    strictEqual(
      tFarm.storage.storage.farms[0].paused,
      pauseFarmParams[0].pause
    );
  });

  it("should unpause one farm", async () => {
    const pauseFarmParams: PauseFarmParam[] = [{ fid: 0, pause: false }];

    await tFarm.pauseFarms(pauseFarmParams);
    await tFarm.updateStorage({ farms: [0] });

    strictEqual(
      tFarm.storage.storage.farms[0].paused,
      pauseFarmParams[0].pause
    );
  });

  it("should pause group of farms", async () => {
    const pauseFarmParams: PauseFarmParam[] = [
      { fid: 0, pause: true },
      { fid: 1, pause: true },
      { fid: 2, pause: true },
    ];

    await tFarm.pauseFarms(pauseFarmParams);
    await tFarm.updateStorage({ farms: [0, 1, 2] });

    for (let pauseFarmParam of pauseFarmParams) {
      strictEqual(
        tFarm.storage.storage.farms[pauseFarmParam.fid].paused,
        pauseFarmParam.pause
      );
    }
  });

  it("should unpause group of farms", async () => {
    const pauseFarmParams: PauseFarmParam[] = [
      { fid: 0, pause: false },
      { fid: 2, pause: false },
    ];

    await tFarm.pauseFarms(pauseFarmParams);
    await tFarm.updateStorage({ farms: [0, 2] });

    for (let pauseFarmParam of pauseFarmParams) {
      strictEqual(
        tFarm.storage.storage.farms[pauseFarmParam.fid].paused,
        pauseFarmParam.pause
      );
    }
  });

  it("should pause/unpause group of farms", async () => {
    const pauseFarmParams: PauseFarmParam[] = [
      { fid: 0, pause: true },
      { fid: 1, pause: false },
      { fid: 2, pause: true },
    ];

    await tFarm.pauseFarms(pauseFarmParams);
    await tFarm.updateStorage({ farms: [0, 1, 2] });

    for (let pauseFarmParam of pauseFarmParams) {
      strictEqual(
        tFarm.storage.storage.farms[pauseFarmParam.fid].paused,
        pauseFarmParam.pause
      );
    }
  });
});
