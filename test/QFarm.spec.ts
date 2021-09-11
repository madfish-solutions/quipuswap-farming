import { FA12 } from "./helpers/FA12";
import { FA2 } from "./helpers/FA2";
import { Utils, zeroAddress } from "./helpers/Utils";
import { QFarm, QFarmUtils } from "./helpers/QFarm";
import { Burner } from "./helpers/Burner";
import { ProxyMinter } from "./helpers/ProxyMinter";
import { BakerRegistry } from "./helpers/BakerRegistry";
import { QSFA12Factory } from "./helpers/QSFA12Factory";
import { QSFA2Factory } from "./helpers/QSFA2Factory";
import { QSFA12Dex } from "./helpers/QSFA12Dex";
import { QSFA2Dex } from "./helpers/QSFA2Dex";

import { PauseFarmParam, SetFeeParams } from "./types/Common";
import {
  DepositParams,
  NewFarmParams,
  UserInfoType,
  Farm,
  RPS,
} from "./types/QFarm";
import { UserInfo } from "./types/FA12";
import { UpdateOperatorParam } from "./types/FA2";

import { rejects, ok, strictEqual } from "assert";

import { alice, bob, carol } from "../scripts/sandbox/accounts";

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
  var fa12LP: QSFA12Dex;
  var qsGov: FA2;
  var qsGovLP: QSFA2Dex;
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
    qsGov = await FA2.originate(utils.tezos, fa2Storage);

    bakerRegistry = await BakerRegistry.originate(
      utils.tezos,
      bakerRegistryStorage
    );

    qsFA12FactoryStorage.baker_validator = bakerRegistry.contract.address;

    qsFA12Factory = await QSFA12Factory.originate(
      utils.tezos,
      qsFA12FactoryStorage
    );

    qsFA2FactoryStorage.baker_validator = bakerRegistry.contract.address;

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

    const qsGovLPAddress: string =
      qsFA2Factory.storage.token_to_exchange[`${qsGov.contract.address},${0}`];

    await fa12.approve(qsFA12Factory.contract.address, 10000);
    await qsFA12Factory.launchExchange(fa12.contract.address, 10000, 10000);
    await qsFA12Factory.updateStorage({
      token_to_exchange: [fa12.contract.address],
    });

    const fa12LPAddress: string =
      qsFA12Factory.storage.token_to_exchange[fa12.contract.address];

    fa12LP = await QSFA12Dex.init(fa12LPAddress, utils.tezos);
    qsGovLP = await QSFA2Dex.init(qsGovLPAddress, utils.tezos);

    burnerStorage.qsgov_lp = qsGovLP.contract.address;
    burnerStorage.qsgov.token = qsGov.contract.address;
    burnerStorage.qsgov.id = 0;

    proxyMinterStorage.qsgov.token = qsGov.contract.address;
    proxyMinterStorage.qsgov.id = 0;
    proxyMinterStorage.admin = alice.pkh;
    proxyMinterStorage.pending_admin = zeroAddress;

    burner = await Burner.originate(utils.tezos, burnerStorage);
    proxyMinter = await ProxyMinter.originate(utils.tezos, proxyMinterStorage);

    qFarmStorage.storage.qsgov.token = qsGov.contract.address;
    qFarmStorage.storage.qsgov.id = 0;
    qFarmStorage.storage.qsgov_lp = qsGovLP.contract.address;
    qFarmStorage.storage.admin = alice.pkh;
    qFarmStorage.storage.pending_admin = zeroAddress;
    qFarmStorage.storage.burner = zeroAddress;
    qFarmStorage.storage.proxy_minter = zeroAddress;
    qFarmStorage.storage.baker_registry = zeroAddress;
    qFarmStorage.storage.farms_count = 0;

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

  it("should fail if not admin is trying to set reward per second", async () => {
    const params: RPS[] = [{ fid: 0, rps: 100 }];

    await utils.setProvider(alice.sk);
    await rejects(qFarm.setRewardPerSecond(params), (err: Error) => {
      ok(err.message === "Not-admin");

      return true;
    });
  });

  it("should fail if one farm from list of farms not found", async () => {
    const params: RPS[] = [{ fid: 0, rps: 100 }];

    await utils.setProvider(bob.sk);
    await rejects(qFarm.setRewardPerSecond(params), (err: Error) => {
      ok(err.message === "QFarm/farm-not-set");

      return true;
    });
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
    await qFarm.updateStorage();

    strictEqual(qFarm.storage.storage.burner, zeroAddress);

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
    await qFarm.updateStorage();

    strictEqual(qFarm.storage.storage.proxy_minter, zeroAddress);

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
    await qFarm.updateStorage();

    strictEqual(qFarm.storage.storage.baker_registry, zeroAddress);

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
    newFarmParams.stake_params.staked_token = { fA12: fa12.contract.address };
    newFarmParams.stake_params.qs_pool = fa12LP.contract.address;
    newFarmParams.qsgov_per_second = 100;
    newFarmParams.timelock = 20;

    await utils.setProvider(bob.sk);
    await qFarm.addNewFarm(newFarmParams);
    await qFarm.updateStorage({ farms: [0] });

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
      qFarm.storage.storage.farms[0].stake_params.staked_token.fA12,
      newFarmParams.stake_params.staked_token.fA12
    );
    strictEqual(
      qFarm.storage.storage.farms[0].stake_params.is_lp_staked_token,
      newFarmParams.stake_params.is_lp_staked_token
    );
    strictEqual(
      qFarm.storage.storage.farms[0].stake_params.token.fA12,
      newFarmParams.stake_params.token.fA12
    );
    strictEqual(
      qFarm.storage.storage.farms[0].stake_params.qs_pool,
      newFarmParams.stake_params.qs_pool
    );
    strictEqual(
      qFarm.storage.storage.farms[0].reward_token.token,
      qsGov.contract.address
    );
    strictEqual(+qFarm.storage.storage.farms[0].reward_token.id, 0);
    strictEqual(
      +qFarm.storage.storage.farms[0].timelock,
      newFarmParams.timelock
    );
    strictEqual(qFarm.storage.storage.farms[0].current_delegated, zeroAddress);
    strictEqual(qFarm.storage.storage.farms[0].current_candidate, zeroAddress);
    strictEqual(qFarm.storage.storage.farms[0].paused, newFarmParams.paused);
    strictEqual(
      +qFarm.storage.storage.farms[0].qsgov_per_second,
      newFarmParams.qsgov_per_second
    );
    strictEqual(+qFarm.storage.storage.farms[0].rps, 0);
    strictEqual(+qFarm.storage.storage.farms[0].staked, 0);
    strictEqual(+qFarm.storage.storage.farms[0].fid, 0);

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
      { fid: 0, fees: { harvest_fee: 16, withdrawal_fee: 21 } },
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

  it("should fail if not admin is trying to pause farm", async () => {
    const pauseFarmParams: PauseFarmParam[] = [{ fid: 0, pause: true }];

    await utils.setProvider(alice.sk);
    await rejects(qFarm.pauseFarms(pauseFarmParams), (err: Error) => {
      ok(err.message === "Not-admin");

      return true;
    });
  });

  it("should fail if one farm from list of farms not found", async () => {
    const pauseFarmParams: PauseFarmParam[] = [{ fid: 666, pause: true }];

    await utils.setProvider(bob.sk);
    await rejects(qFarm.pauseFarms(pauseFarmParams), (err: Error) => {
      ok(err.message === "QFarm/farm-not-set");

      return true;
    });
  });

  it("should pause one farm", async () => {
    const pauseFarmParams: PauseFarmParam[] = [{ fid: 0, pause: true }];

    await qFarm.pauseFarms(pauseFarmParams);
    await qFarm.updateStorage({ farms: [0] });

    strictEqual(
      qFarm.storage.storage.farms[0].paused,
      pauseFarmParams[0].pause
    );
  });

  it("should unpause one farm", async () => {
    const pauseFarmParams: PauseFarmParam[] = [{ fid: 0, pause: false }];

    await qFarm.pauseFarms(pauseFarmParams);
    await qFarm.updateStorage({ farms: [0] });

    strictEqual(
      qFarm.storage.storage.farms[0].paused,
      pauseFarmParams[0].pause
    );
  });

  it("should pause group of farms", async () => {
    const pauseFarmParams: PauseFarmParam[] = [
      { fid: 0, pause: true },
      { fid: 1, pause: true },
      { fid: 2, pause: true },
    ];

    await qFarm.pauseFarms(pauseFarmParams);
    await qFarm.updateStorage({ farms: [0, 1, 2] });

    for (let pauseFarmParam of pauseFarmParams) {
      strictEqual(
        qFarm.storage.storage.farms[pauseFarmParam.fid].paused,
        pauseFarmParam.pause
      );
    }
  });

  it("should unpause group of farms", async () => {
    const pauseFarmParams: PauseFarmParam[] = [
      { fid: 0, pause: false },
      { fid: 2, pause: false },
    ];

    await qFarm.pauseFarms(pauseFarmParams);
    await qFarm.updateStorage({ farms: [0, 2] });

    for (let pauseFarmParam of pauseFarmParams) {
      strictEqual(
        qFarm.storage.storage.farms[pauseFarmParam.fid].paused,
        pauseFarmParam.pause
      );
    }
  });

  it("should pause/unpause group of farms", async () => {
    const pauseFarmParams: PauseFarmParam[] = [
      { fid: 1, pause: false },
      { fid: 2, pause: true },
    ];

    await qFarm.pauseFarms(pauseFarmParams);
    await qFarm.updateStorage({ farms: [0, 1, 2] });

    for (let pauseFarmParam of pauseFarmParams) {
      strictEqual(
        qFarm.storage.storage.farms[pauseFarmParam.fid].paused,
        pauseFarmParam.pause
      );
    }
  });

  it("should set reward per second for one farm", async () => {
    const params: RPS[] = [{ fid: 0, rps: 100 }];

    await qFarm.setRewardPerSecond(params);
    await qFarm.updateStorage({ farms: [0] });

    strictEqual(
      +qFarm.storage.storage.farms[0].qsgov_per_second,
      params[0].rps
    );
  });

  it("should set reward per second for group of farms", async () => {
    const params: RPS[] = [
      { fid: 0, rps: 100 },
      { fid: 1, rps: 50 },
      { fid: 2, rps: 250 },
    ];

    await qFarm.setRewardPerSecond(params);
    await qFarm.updateStorage({ farms: [0, 1, 2] });

    for (let i = 0; i < params.length; ++i) {
      strictEqual(
        +qFarm.storage.storage.farms[params[0].fid].qsgov_per_second,
        params[0].rps
      );
    }
  });

  it("should fail if farm not found", async () => {
    const depositParams: DepositParams = {
      fid: 666,
      amt: 0,
      referrer: zeroAddress,
      rewards_receiver: zeroAddress,
      candidate: zeroAddress,
    };

    await rejects(qFarm.deposit(depositParams), (err: Error) => {
      ok(err.message === "QFarm/farm-not-set");

      return true;
    });
  });

  it("should fail if farm is paused", async () => {
    let newFarmParams: NewFarmParams = await QFarmUtils.getMockNewFarmParams(
      utils
    );

    newFarmParams.paused = true;

    await qFarm.addNewFarm(newFarmParams);

    const depositParams: DepositParams = {
      fid: 3,
      amt: 0,
      referrer: zeroAddress,
      rewards_receiver: zeroAddress,
      candidate: zeroAddress,
    };

    await rejects(qFarm.deposit(depositParams), (err: Error) => {
      ok(err.message === "QFarm/farm-is-paused");

      return true;
    });
  });

  it("should fail if user is trying to refer himself", async () => {
    const depositParams: DepositParams = {
      fid: 0,
      amt: 0,
      referrer: alice.pkh,
      rewards_receiver: zeroAddress,
      candidate: zeroAddress,
    };

    await utils.setProvider(alice.sk);
    await rejects(qFarm.deposit(depositParams), (err: Error) => {
      ok(err.message === "QFarm/can-not-refer-yourself");

      return true;
    });
  });

  it("should set/update referrer", async () => {
    const depositParams: DepositParams = {
      fid: 0,
      amt: 100,
      referrer: bob.pkh,
      rewards_receiver: zeroAddress,
      candidate: zeroAddress,
    };

    await qFarm.updateStorage({ referrers: [alice.pkh] });

    strictEqual(qFarm.storage.storage.referrers[alice.pkh], undefined);

    await fa12.approve(qFarm.contract.address, depositParams.amt);
    await qFarm.deposit(depositParams);
    await qFarm.updateStorage({ referrers: [alice.pkh] });

    strictEqual(
      qFarm.storage.storage.referrers[alice.pkh],
      depositParams.referrer
    );
  });

  it("should not set/update referrer if referrer param not passed", async () => {
    const depositParams: DepositParams = {
      fid: 0,
      amt: 100,
      referrer: undefined,
      rewards_receiver: zeroAddress,
      candidate: zeroAddress,
    };

    await qFarm.updateStorage({ referrers: [alice.pkh] });

    strictEqual(qFarm.storage.storage.referrers[alice.pkh], bob.pkh);

    await fa12.approve(qFarm.contract.address, depositParams.amt);
    await qFarm.deposit(depositParams);
    await qFarm.updateStorage({ referrers: [alice.pkh] });

    strictEqual(qFarm.storage.storage.referrers[alice.pkh], bob.pkh);
  });

  it("should deposit single FA1.2 token", async () => {
    const depositParams: DepositParams = {
      fid: 0,
      amt: 1000,
      referrer: undefined,
      rewards_receiver: carol.pkh,
      candidate: zeroAddress,
    };

    await qFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await fa12.updateStorage({
      ledger: [qFarm.contract.address, alice.pkh],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const initialTokenAliceRecord: UserInfo = fa12.storage.ledger[alice.pkh];
    const initialTokenFarmRecord: UserInfo =
      fa12.storage.ledger[qFarm.contract.address];

    await fa12.approve(qFarm.contract.address, depositParams.amt);
    await qFarm.deposit(depositParams);
    await qFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [0],
    });
    await fa12.updateStorage({
      ledger: [qFarm.contract.address, alice.pkh],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const finalTokenAliceRecord: UserInfo = fa12.storage.ledger[alice.pkh];
    const finalTokenFarmRecord: UserInfo =
      fa12.storage.ledger[qFarm.contract.address];

    strictEqual(+finalFarm.staked, +initialFarm.staked + depositParams.amt);
    strictEqual(
      +finalFarmAliceRecord.staked,
      +initialFarmAliceRecord.staked + depositParams.amt
    );
    strictEqual(
      +finalTokenAliceRecord.balance,
      +initialTokenAliceRecord.balance - depositParams.amt
    );
    strictEqual(
      +finalTokenFarmRecord.balance,
      +initialTokenFarmRecord.balance + depositParams.amt
    );

    ok(finalFarmAliceRecord.last_staked > initialFarmAliceRecord.last_staked);
  });

  it("should deposit LP FA1.2 token", async () => {
    let newFarmParams: NewFarmParams = await QFarmUtils.getMockNewFarmParams(
      utils
    );

    newFarmParams.fees.harvest_fee = 5;
    newFarmParams.fees.withdrawal_fee = 5;
    newFarmParams.stake_params.staked_token = { fA12: fa12LP.contract.address };
    newFarmParams.stake_params.is_lp_staked_token = true;
    newFarmParams.stake_params.token = { fA12: fa12.contract.address };
    newFarmParams.stake_params.qs_pool = fa12LP.contract.address;
    newFarmParams.timelock = 0;

    await utils.setProvider(bob.sk);
    await qFarm.addNewFarm(newFarmParams);

    const depositParams: DepositParams = {
      fid: 4,
      amt: 100,
      referrer: undefined,
      rewards_receiver: carol.pkh,
      candidate: bob.pkh,
    };

    await utils.setProvider(alice.sk);
    await qFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await fa12LP.updateStorage({
      ledger: [qFarm.contract.address, alice.pkh],
    });

    const initialTokenAliceRecord: UserInfo =
      fa12LP.storage.storage.ledger[alice.pkh];

    await fa12LP.approve(qFarm.contract.address, depositParams.amt);
    await qFarm.deposit(depositParams);
    await qFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await fa12LP.updateStorage({
      ledger: [qFarm.contract.address, alice.pkh],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const finalTokenAliceRecord: UserInfo =
      fa12LP.storage.storage.ledger[alice.pkh];
    const finalTokenFarmRecord: UserInfo =
      fa12LP.storage.storage.ledger[qFarm.contract.address];

    strictEqual(+finalFarm.staked, depositParams.amt);
    strictEqual(+finalFarmAliceRecord.staked, depositParams.amt);
    strictEqual(
      +finalTokenAliceRecord.balance,
      +initialTokenAliceRecord.balance - depositParams.amt
    );
    strictEqual(+finalTokenFarmRecord.balance, 0);
    strictEqual(+finalTokenFarmRecord.frozen_balance, depositParams.amt);
  });
});
