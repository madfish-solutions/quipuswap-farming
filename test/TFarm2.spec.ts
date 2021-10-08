import { FA12 } from "./helpers/FA12";
import { FA2 } from "./helpers/FA2";
import { Utils, zeroAddress } from "./helpers/Utils";
import { TFarm, TFarmUtils } from "./helpers/TFarm";

import { UpdateOperatorParam } from "./types/FA2";
import { Farm, FarmData, NewFarmParams } from "./types/TFarm";
import {
  WithdrawParams,
  DepositParams,
  HarvestParams,
  UserInfoType,
} from "./types/Common";

import {
  WalletOperationBatch,
  WalletOperation,
  OpKind,
} from "@taquito/taquito";

import { ok } from "assert";

import { BigNumber } from "bignumber.js";

import { alice } from "../scripts/sandbox/accounts";

import { confirmOperation } from "scripts/confirmation";

import { fa12Storage } from "../storage/test/FA12";
import { fa2Storage } from "../storage/test/FA2";
import { tFarmStorage } from "../storage/TFarm";
import { UserFA12Info } from "./types/FA12";

describe("TFarm tests (section 2)", async () => {
  var fa12: FA12;
  var qsGov: FA2;
  var utils: Utils;
  var tFarm: TFarm;

  var precision = 10 ** 18;
  var feePrecision = 10 ** 2;

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk, true);

    fa12 = await FA12.originate(utils.tezos, fa12Storage);
    qsGov = await FA2.originate(utils.tezos, fa2Storage);

    tFarmStorage.storage.qsgov.token = qsGov.contract.address;
    tFarmStorage.storage.qsgov.id = 0;
    tFarmStorage.storage.qsgov_lp = zeroAddress;
    tFarmStorage.storage.admin = alice.pkh;
    tFarmStorage.storage.pending_admin = zeroAddress;
    tFarmStorage.storage.burner = zeroAddress;
    tFarmStorage.storage.baker_registry = zeroAddress;
    tFarmStorage.storage.farms_count = 0;

    tFarm = await TFarm.originate(utils.tezos, tFarmStorage);

    await tFarm.setLambdas();
  });

  it("should add new farm, stake in the next block and withdraw all rewards (except the first block reward) after farms lifetime finishing (without timelock)", async () => {
    let newFarmParams: NewFarmParams = await TFarmUtils.getMockNewFarmParams(
      utils
    );

    newFarmParams.fees.harvest_fee = 10 * feePrecision;
    newFarmParams.fees.withdrawal_fee = 15 * feePrecision;
    newFarmParams.stake_params.staked_token = {
      fA2: { token: qsGov.contract.address, id: 0 },
    };
    newFarmParams.stake_params.qs_pool = zeroAddress;
    newFarmParams.reward_token = { fA12: fa12.contract.address };
    newFarmParams.timelock = 0;
    newFarmParams.reward_per_second = 100 * precision;

    const updateOperatorParam: UpdateOperatorParam = {
      add_operator: {
        owner: alice.pkh,
        operator: tFarm.contract.address,
        token_id: 0,
      },
    };
    const lifetime: number = 3; // 3 seconds
    const rewAmount: number =
      (lifetime * newFarmParams.reward_per_second) / precision;
    const harvestFeePercent: number = newFarmParams.fees.harvest_fee / 10000;
    const earnedPercent: number = 1 - harvestFeePercent;
    const correctRewTokensReminder: number = 100;

    await qsGov.updateOperators([updateOperatorParam]);
    await fa12.approve(tFarm.contract.address, rewAmount);

    newFarmParams.start_time = String(
      Date.parse((await utils.tezos.rpc.getBlockHeader()).timestamp) / 1000 + 1
    );
    newFarmParams.end_time = String(
      Date.parse((await utils.tezos.rpc.getBlockHeader()).timestamp) / 1000 +
        lifetime +
        1
    );

    await tFarm.addNewFarm(newFarmParams);
    await fa12.updateStorage({ ledger: [alice.pkh] });

    const initialRewTokAliceRecord: UserFA12Info =
      fa12.storage.ledger[alice.pkh];
    const depositParams: DepositParams = {
      fid: 0,
      amt: 100,
      referrer: undefined,
      rewards_receiver: alice.pkh,
      candidate: zeroAddress,
    };
    const harvestParams: HarvestParams = {
      fid: depositParams.fid,
      rewards_receiver: alice.pkh,
    };

    await tFarm.deposit(depositParams);
    await utils.bakeBlocks(lifetime);
    await tFarm.harvest(harvestParams);
    await fa12.updateStorage({
      ledger: [alice.pkh, tFarm.contract.address, zeroAddress],
    });

    const middleRewTokAliceRecord: UserFA12Info =
      fa12.storage.ledger[alice.pkh];
    const middleRewTokFarmRecord: UserFA12Info =
      fa12.storage.ledger[tFarm.contract.address];
    const middleRewTokZeroRecord: UserFA12Info =
      fa12.storage.ledger[zeroAddress];

    ok(
      new BigNumber(middleRewTokAliceRecord.balance).isEqualTo(
        new BigNumber(rewAmount)
          .minus(correctRewTokensReminder)
          .multipliedBy(earnedPercent)
          .plus(initialRewTokAliceRecord.balance)
      )
    );
    ok(
      new BigNumber(middleRewTokZeroRecord.balance).isEqualTo(
        new BigNumber(rewAmount)
          .minus(correctRewTokensReminder)
          .multipliedBy(harvestFeePercent)
      )
    );
    ok(
      new BigNumber(middleRewTokFarmRecord.balance).isEqualTo(
        new BigNumber(correctRewTokensReminder)
      )
    );

    await tFarm.harvest(harvestParams);
    await fa12.updateStorage({
      ledger: [alice.pkh, tFarm.contract.address, zeroAddress],
    });

    const finalRewTokAliceRecord: UserFA12Info = fa12.storage.ledger[alice.pkh];
    const finalRewTokFarmRecord: UserFA12Info =
      fa12.storage.ledger[tFarm.contract.address];
    const finalRewTokZeroRecord: UserFA12Info =
      fa12.storage.ledger[zeroAddress];

    ok(
      new BigNumber(finalRewTokAliceRecord.balance).isEqualTo(
        new BigNumber(middleRewTokAliceRecord.balance)
      )
    );
    ok(
      new BigNumber(finalRewTokZeroRecord.balance).isEqualTo(
        new BigNumber(middleRewTokZeroRecord.balance)
      )
    );
    ok(
      new BigNumber(finalRewTokFarmRecord.balance).isEqualTo(
        new BigNumber(middleRewTokFarmRecord.balance)
      )
    );
  });

  it("should add new farm and stake in batch, withdraw all rewards after farms lifetime finishing (without timelock)", async () => {
    let newFarmParams: NewFarmParams = await TFarmUtils.getMockNewFarmParams(
      utils
    );

    newFarmParams.fees.harvest_fee = 21 * feePrecision;
    newFarmParams.fees.withdrawal_fee = 16 * feePrecision;
    newFarmParams.stake_params.staked_token = {
      fA2: { token: qsGov.contract.address, id: 0 },
    };
    newFarmParams.stake_params.qs_pool = zeroAddress;
    newFarmParams.reward_token = { fA12: fa12.contract.address };
    newFarmParams.timelock = 0;
    newFarmParams.reward_per_second = 100 * precision;

    const lifetime: number = 3; // 3 seconds
    const rewAmount: number =
      (lifetime * newFarmParams.reward_per_second) / precision;
    const harvestFeePercent: number = newFarmParams.fees.harvest_fee / 10000;
    const earnedPercent: number = 1 - harvestFeePercent;

    await fa12.approve(tFarm.contract.address, rewAmount);

    newFarmParams.start_time = String(
      Date.parse((await utils.tezos.rpc.getBlockHeader()).timestamp) / 1000 + 1
    );
    newFarmParams.end_time = String(
      Date.parse((await utils.tezos.rpc.getBlockHeader()).timestamp) / 1000 +
        lifetime +
        1
    );

    const depositParams: DepositParams = {
      fid: 1,
      amt: 100,
      referrer: undefined,
      rewards_receiver: alice.pkh,
      candidate: zeroAddress,
    };
    const harvestParams: HarvestParams = {
      fid: depositParams.fid,
      rewards_receiver: alice.pkh,
    };
    const batch: WalletOperationBatch = await utils.tezos.wallet.batch([
      {
        kind: OpKind.TRANSACTION,
        ...tFarm.contract.methods
          .add_new_farm(...Utils.destructObj(newFarmParams))
          .toTransferParams(),
      },
      {
        kind: OpKind.TRANSACTION,
        ...tFarm.contract.methods
          .deposit(...Utils.destructObj(depositParams))
          .toTransferParams(),
      },
    ]);
    const operation: WalletOperation = await batch.send();

    await confirmOperation(utils.tezos, operation.opHash);
    await fa12.updateStorage({ ledger: [alice.pkh, zeroAddress] });

    const initialRewTokAliceRecord: UserFA12Info =
      fa12.storage.ledger[alice.pkh];
    const initialRewTokZeroRecord: UserFA12Info =
      fa12.storage.ledger[zeroAddress];

    await utils.bakeBlocks(lifetime);
    await tFarm.harvest(harvestParams);
    await fa12.updateStorage({
      ledger: [alice.pkh, tFarm.contract.address, zeroAddress],
    });

    const middleRewTokAliceRecord: UserFA12Info =
      fa12.storage.ledger[alice.pkh];
    const middleRewTokFarmRecord: UserFA12Info =
      fa12.storage.ledger[tFarm.contract.address];
    const middleRewTokZeroRecord: UserFA12Info =
      fa12.storage.ledger[zeroAddress];

    ok(
      new BigNumber(middleRewTokAliceRecord.balance).isEqualTo(
        new BigNumber(rewAmount)
          .multipliedBy(earnedPercent)
          .plus(initialRewTokAliceRecord.balance)
      )
    );
    ok(
      new BigNumber(middleRewTokZeroRecord.balance).isEqualTo(
        new BigNumber(rewAmount)
          .multipliedBy(harvestFeePercent)
          .plus(initialRewTokZeroRecord.balance)
      )
    );
    ok(
      new BigNumber(middleRewTokFarmRecord.balance).isEqualTo(
        new BigNumber(100) // from the previous test
      )
    );

    await tFarm.harvest(harvestParams);
    await fa12.updateStorage({
      ledger: [alice.pkh, tFarm.contract.address, zeroAddress],
    });

    const finalRewTokAliceRecord: UserFA12Info = fa12.storage.ledger[alice.pkh];
    const finalRewTokFarmRecord: UserFA12Info =
      fa12.storage.ledger[tFarm.contract.address];
    const finalRewTokZeroRecord: UserFA12Info =
      fa12.storage.ledger[zeroAddress];

    ok(
      new BigNumber(finalRewTokAliceRecord.balance).isEqualTo(
        new BigNumber(middleRewTokAliceRecord.balance)
      )
    );
    ok(
      new BigNumber(finalRewTokZeroRecord.balance).isEqualTo(
        new BigNumber(middleRewTokZeroRecord.balance)
      )
    );
    ok(
      new BigNumber(finalRewTokFarmRecord.balance).isEqualTo(
        new BigNumber(middleRewTokFarmRecord.balance)
      )
    );
  });

  it("should claim rewards in time of depositing after farms finishing when timelock is not finished", async () => {
    let newFarmParams: NewFarmParams = await TFarmUtils.getMockNewFarmParams(
      utils
    );

    newFarmParams.fees.harvest_fee = 20 * feePrecision;
    newFarmParams.fees.withdrawal_fee = 15 * feePrecision;
    newFarmParams.stake_params.staked_token = {
      fA2: { token: qsGov.contract.address, id: 0 },
    };
    newFarmParams.stake_params.qs_pool = zeroAddress;
    newFarmParams.reward_token = { fA12: fa12.contract.address };
    newFarmParams.timelock = 5;
    newFarmParams.reward_per_second = 100 * precision;

    const lifetime: number = 7; // 7 seconds
    const rewAmount: number =
      (lifetime * newFarmParams.reward_per_second) / precision;

    await fa12.approve(tFarm.contract.address, rewAmount);

    newFarmParams.start_time = String(
      Date.parse((await utils.tezos.rpc.getBlockHeader()).timestamp) / 1000 + 1
    );
    newFarmParams.end_time = String(
      Date.parse((await utils.tezos.rpc.getBlockHeader()).timestamp) / 1000 +
        lifetime +
        1
    );

    const depositParams: DepositParams = {
      fid: 2,
      amt: 100,
      referrer: undefined,
      rewards_receiver: alice.pkh,
      candidate: zeroAddress,
    };
    const batch: WalletOperationBatch = await utils.tezos.wallet.batch([
      {
        kind: OpKind.TRANSACTION,
        ...tFarm.contract.methods
          .add_new_farm(...Utils.destructObj(newFarmParams))
          .toTransferParams(),
      },
      {
        kind: OpKind.TRANSACTION,
        ...tFarm.contract.methods
          .deposit(...Utils.destructObj(depositParams))
          .toTransferParams(),
      },
    ]);
    const operation: WalletOperation = await batch.send();

    await confirmOperation(utils.tezos, operation.opHash);
    await utils.bakeBlocks(4);
    await tFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await fa12.updateStorage({
      ledger: [alice.pkh, tFarm.contract.address, zeroAddress],
    });

    const initialFarm: Farm = tFarm.storage.storage.farms[depositParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const initialRewTokAliceRecord: UserFA12Info =
      fa12.storage.ledger[alice.pkh];
    const initialRewTokFarmRecord: UserFA12Info =
      fa12.storage.ledger[tFarm.contract.address];
    const initialRewTokZeroRecord: UserFA12Info =
      fa12.storage.ledger[zeroAddress];

    await tFarm.deposit(depositParams);
    await tFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await fa12.updateStorage({
      ledger: [alice.pkh, tFarm.contract.address, zeroAddress],
    });

    const middleFarm: Farm = tFarm.storage.storage.farms[depositParams.fid];
    const middleFarmAliceRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const middleRewTokAliceRecord: UserFA12Info =
      fa12.storage.ledger[alice.pkh];
    const middleRewTokFarmRecord: UserFA12Info =
      fa12.storage.ledger[tFarm.contract.address];
    const middleRewTokZeroRecord: UserFA12Info =
      fa12.storage.ledger[zeroAddress];
    const middleRes: FarmData = TFarmUtils.getFarmData(
      initialFarm,
      middleFarm,
      initialFarmAliceRecord,
      middleFarmAliceRecord,
      precision,
      feePrecision
    );

    ok(
      new BigNumber(middleRewTokAliceRecord.balance).isEqualTo(
        new BigNumber(initialRewTokAliceRecord.balance).plus(
          middleRes.actualUserEarned
        )
      )
    );
    ok(
      new BigNumber(middleRewTokZeroRecord.balance).isEqualTo(
        new BigNumber(initialRewTokZeroRecord.balance).plus(
          middleRes.referralCommission
        )
      )
    );
    ok(
      new BigNumber(middleRewTokFarmRecord.balance).isEqualTo(
        new BigNumber(initialRewTokFarmRecord.balance)
          .minus(middleRes.actualUserEarned)
          .minus(middleRes.referralCommission)
      )
    );

    await utils.bakeBlocks(2);
    await tFarm.deposit(depositParams);
    await tFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await fa12.updateStorage({
      ledger: [alice.pkh, tFarm.contract.address, zeroAddress],
    });

    const finalFarm: Farm = tFarm.storage.storage.farms[depositParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const finalRewTokAliceRecord: UserFA12Info = fa12.storage.ledger[alice.pkh];
    const finalRewTokFarmRecord: UserFA12Info =
      fa12.storage.ledger[tFarm.contract.address];
    const finalRewTokZeroRecord: UserFA12Info =
      fa12.storage.ledger[zeroAddress];
    const finalRes: FarmData = TFarmUtils.getFarmData(
      middleFarm,
      finalFarm,
      middleFarmAliceRecord,
      finalFarmAliceRecord,
      precision,
      feePrecision
    );

    ok(
      new BigNumber(finalRewTokAliceRecord.balance).isEqualTo(
        new BigNumber(middleRewTokAliceRecord.balance).plus(
          finalRes.actualUserEarned
        )
      )
    );
    ok(
      new BigNumber(finalRewTokZeroRecord.balance).isEqualTo(
        new BigNumber(middleRewTokZeroRecord.balance).plus(
          finalRes.referralCommission
        )
      )
    );
    ok(
      new BigNumber(finalRewTokFarmRecord.balance).isEqualTo(
        new BigNumber(100) // from the previous tests
      )
    );
  });

  it("should claim rewards in time of withdrawing after farms finishing when timelock is not finished", async () => {
    let newFarmParams: NewFarmParams = await TFarmUtils.getMockNewFarmParams(
      utils
    );

    newFarmParams.fees.harvest_fee = 45 * feePrecision;
    newFarmParams.fees.withdrawal_fee = 21 * feePrecision;
    newFarmParams.stake_params.staked_token = {
      fA2: { token: qsGov.contract.address, id: 0 },
    };
    newFarmParams.stake_params.qs_pool = zeroAddress;
    newFarmParams.reward_token = { fA12: fa12.contract.address };
    newFarmParams.timelock = 5;
    newFarmParams.reward_per_second = 100 * precision;

    const lifetime: number = 7; // 7 seconds
    const rewAmount: number =
      (lifetime * newFarmParams.reward_per_second) / precision;

    await fa12.approve(tFarm.contract.address, rewAmount);

    newFarmParams.start_time = String(
      Date.parse((await utils.tezos.rpc.getBlockHeader()).timestamp) / 1000 + 1
    );
    newFarmParams.end_time = String(
      Date.parse((await utils.tezos.rpc.getBlockHeader()).timestamp) / 1000 +
        lifetime +
        1
    );

    await qsGov.updateStorage({
      account_info: [alice.pkh],
    });

    const initialTokAliceBalance: BigNumber = await qsGov.storage.account_info[
      alice.pkh
    ].balances.get("0");
    const depositParams: DepositParams = {
      fid: 3,
      amt: 100,
      referrer: undefined,
      rewards_receiver: alice.pkh,
      candidate: zeroAddress,
    };
    const batch: WalletOperationBatch = await utils.tezos.wallet.batch([
      {
        kind: OpKind.TRANSACTION,
        ...tFarm.contract.methods
          .add_new_farm(...Utils.destructObj(newFarmParams))
          .toTransferParams(),
      },
      {
        kind: OpKind.TRANSACTION,
        ...tFarm.contract.methods
          .deposit(...Utils.destructObj(depositParams))
          .toTransferParams(),
      },
    ]);
    const operation: WalletOperation = await batch.send();

    await confirmOperation(utils.tezos, operation.opHash);
    await utils.bakeBlocks(4);
    await tFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await fa12.updateStorage({
      ledger: [alice.pkh, tFarm.contract.address, zeroAddress],
    });

    const initialFarm: Farm = tFarm.storage.storage.farms[depositParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const initialRewTokAliceRecord: UserFA12Info =
      fa12.storage.ledger[alice.pkh];
    const initialRewTokFarmRecord: UserFA12Info =
      fa12.storage.ledger[tFarm.contract.address];
    const initialRewTokZeroRecord: UserFA12Info =
      fa12.storage.ledger[zeroAddress];

    await tFarm.deposit(depositParams);
    await tFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await fa12.updateStorage({
      ledger: [alice.pkh, tFarm.contract.address, zeroAddress],
    });

    const middleFarm: Farm = tFarm.storage.storage.farms[depositParams.fid];
    const middleFarmAliceRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const middleRewTokAliceRecord: UserFA12Info =
      fa12.storage.ledger[alice.pkh];
    const middleRewTokFarmRecord: UserFA12Info =
      fa12.storage.ledger[tFarm.contract.address];
    const middleRewTokZeroRecord: UserFA12Info =
      fa12.storage.ledger[zeroAddress];
    const middleRes: FarmData = TFarmUtils.getFarmData(
      initialFarm,
      middleFarm,
      initialFarmAliceRecord,
      middleFarmAliceRecord,
      precision,
      feePrecision
    );

    ok(
      new BigNumber(middleRewTokAliceRecord.balance).isEqualTo(
        new BigNumber(initialRewTokAliceRecord.balance).plus(
          middleRes.actualUserEarned
        )
      )
    );
    ok(
      new BigNumber(middleRewTokZeroRecord.balance).isEqualTo(
        new BigNumber(initialRewTokZeroRecord.balance).plus(
          middleRes.referralCommission
        )
      )
    );
    ok(
      new BigNumber(middleRewTokFarmRecord.balance).isEqualTo(
        new BigNumber(initialRewTokFarmRecord.balance)
          .minus(middleRes.actualUserEarned)
          .minus(middleRes.referralCommission)
      )
    );

    const withdrawParams: WithdrawParams = {
      fid: depositParams.fid,
      amt: 200,
      receiver: alice.pkh,
      rewards_receiver: alice.pkh,
    };

    await utils.bakeBlocks(2);
    await tFarm.withdraw(withdrawParams);
    await tFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await fa12.updateStorage({
      ledger: [alice.pkh, tFarm.contract.address, zeroAddress],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh],
    });

    const finalFarm: Farm = tFarm.storage.storage.farms[depositParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const finalRewTokAliceRecord: UserFA12Info = fa12.storage.ledger[alice.pkh];
    const finalRewTokFarmRecord: UserFA12Info =
      fa12.storage.ledger[tFarm.contract.address];
    const finalRewTokZeroRecord: UserFA12Info =
      fa12.storage.ledger[zeroAddress];
    const finalTokAliceBalance: BigNumber = await qsGov.storage.account_info[
      alice.pkh
    ].balances.get("0");
    const finalRes: FarmData = TFarmUtils.getFarmData(
      middleFarm,
      finalFarm,
      middleFarmAliceRecord,
      finalFarmAliceRecord,
      precision,
      feePrecision
    );

    ok(
      new BigNumber(finalRewTokAliceRecord.balance).isEqualTo(
        new BigNumber(middleRewTokAliceRecord.balance).plus(
          finalRes.actualUserEarned
        )
      )
    );
    ok(
      new BigNumber(finalRewTokZeroRecord.balance).isEqualTo(
        new BigNumber(middleRewTokZeroRecord.balance).plus(
          finalRes.referralCommission
        )
      )
    );
    ok(
      new BigNumber(finalRewTokFarmRecord.balance).isEqualTo(
        new BigNumber(100) // from the previous tests
      )
    );
    ok(finalTokAliceBalance.isEqualTo(initialTokAliceBalance));
  });

  it("should claim rewards in time of claiming after farms finishing when timelock is not finished", async () => {
    let newFarmParams: NewFarmParams = await TFarmUtils.getMockNewFarmParams(
      utils
    );

    newFarmParams.fees.harvest_fee = 31 * feePrecision;
    newFarmParams.fees.withdrawal_fee = 19 * feePrecision;
    newFarmParams.stake_params.staked_token = {
      fA2: { token: qsGov.contract.address, id: 0 },
    };
    newFarmParams.stake_params.qs_pool = zeroAddress;
    newFarmParams.reward_token = { fA12: fa12.contract.address };
    newFarmParams.timelock = 5;
    newFarmParams.reward_per_second = 100 * precision;

    const lifetime: number = 7; // 7 seconds
    const rewAmount: number =
      (lifetime * newFarmParams.reward_per_second) / precision;

    await fa12.approve(tFarm.contract.address, rewAmount);

    newFarmParams.start_time = String(
      Date.parse((await utils.tezos.rpc.getBlockHeader()).timestamp) / 1000 + 1
    );
    newFarmParams.end_time = String(
      Date.parse((await utils.tezos.rpc.getBlockHeader()).timestamp) / 1000 +
        lifetime +
        1
    );

    const depositParams: DepositParams = {
      fid: 4,
      amt: 100,
      referrer: undefined,
      rewards_receiver: alice.pkh,
      candidate: zeroAddress,
    };
    const batch: WalletOperationBatch = await utils.tezos.wallet.batch([
      {
        kind: OpKind.TRANSACTION,
        ...tFarm.contract.methods
          .add_new_farm(...Utils.destructObj(newFarmParams))
          .toTransferParams(),
      },
      {
        kind: OpKind.TRANSACTION,
        ...tFarm.contract.methods
          .deposit(...Utils.destructObj(depositParams))
          .toTransferParams(),
      },
    ]);
    const operation: WalletOperation = await batch.send();

    await confirmOperation(utils.tezos, operation.opHash);
    await utils.bakeBlocks(4);
    await tFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await fa12.updateStorage({
      ledger: [alice.pkh, tFarm.contract.address, zeroAddress],
    });

    const initialFarm: Farm = tFarm.storage.storage.farms[depositParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const initialRewTokAliceRecord: UserFA12Info =
      fa12.storage.ledger[alice.pkh];
    const initialRewTokFarmRecord: UserFA12Info =
      fa12.storage.ledger[tFarm.contract.address];
    const initialRewTokZeroRecord: UserFA12Info =
      fa12.storage.ledger[zeroAddress];

    await tFarm.deposit(depositParams);
    await tFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await fa12.updateStorage({
      ledger: [alice.pkh, tFarm.contract.address, zeroAddress],
    });

    const middleFarm: Farm = tFarm.storage.storage.farms[depositParams.fid];
    const middleFarmAliceRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const middleRewTokAliceRecord: UserFA12Info =
      fa12.storage.ledger[alice.pkh];
    const middleRewTokFarmRecord: UserFA12Info =
      fa12.storage.ledger[tFarm.contract.address];
    const middleRewTokZeroRecord: UserFA12Info =
      fa12.storage.ledger[zeroAddress];
    const middleRes: FarmData = TFarmUtils.getFarmData(
      initialFarm,
      middleFarm,
      initialFarmAliceRecord,
      middleFarmAliceRecord,
      precision,
      feePrecision
    );

    ok(
      new BigNumber(middleRewTokAliceRecord.balance).isEqualTo(
        new BigNumber(initialRewTokAliceRecord.balance).plus(
          middleRes.actualUserEarned
        )
      )
    );
    ok(
      new BigNumber(middleRewTokZeroRecord.balance).isEqualTo(
        new BigNumber(initialRewTokZeroRecord.balance).plus(
          middleRes.referralCommission
        )
      )
    );
    ok(
      new BigNumber(middleRewTokFarmRecord.balance).isEqualTo(
        new BigNumber(initialRewTokFarmRecord.balance)
          .minus(middleRes.actualUserEarned)
          .minus(middleRes.referralCommission)
      )
    );

    const harvestParams: HarvestParams = {
      fid: depositParams.fid,
      rewards_receiver: alice.pkh,
    };

    await utils.bakeBlocks(2);
    await tFarm.harvest(harvestParams);
    await tFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await fa12.updateStorage({
      ledger: [alice.pkh, tFarm.contract.address, zeroAddress],
    });

    const finalFarm: Farm = tFarm.storage.storage.farms[depositParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const finalRewTokAliceRecord: UserFA12Info = fa12.storage.ledger[alice.pkh];
    const finalRewTokFarmRecord: UserFA12Info =
      fa12.storage.ledger[tFarm.contract.address];
    const finalRewTokZeroRecord: UserFA12Info =
      fa12.storage.ledger[zeroAddress];
    const finalRes: FarmData = TFarmUtils.getFarmData(
      middleFarm,
      finalFarm,
      middleFarmAliceRecord,
      finalFarmAliceRecord,
      precision,
      feePrecision
    );

    ok(
      new BigNumber(finalRewTokAliceRecord.balance).isEqualTo(
        new BigNumber(middleRewTokAliceRecord.balance).plus(
          finalRes.actualUserEarned
        )
      )
    );
    ok(
      new BigNumber(finalRewTokZeroRecord.balance).isEqualTo(
        new BigNumber(middleRewTokZeroRecord.balance).plus(
          finalRes.referralCommission
        )
      )
    );
    ok(
      new BigNumber(finalRewTokFarmRecord.balance).isEqualTo(
        new BigNumber(100) // from the previous tests
      )
    );
  });
});
