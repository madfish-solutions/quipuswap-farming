import { FA12 } from "./helpers/FA12";
import { FA2 } from "./helpers/FA2";
import { Utils, zeroAddress } from "./helpers/Utils";
import { TFarm, TFarmUtils } from "./helpers/TFarm";
import { Burner } from "./helpers/Burner";
import { BakerRegistry } from "./helpers/BakerRegistry";
import { QSFA12Factory } from "./helpers/QSFA12Factory";
import { QSFA2Factory } from "./helpers/QSFA2Factory";

import { UpdateOperatorParam } from "./types/FA2";
import { NewFarmParams } from "./types/TFarm";
import { DepositParams, HarvestParams } from "./types/Common";
import { QSFA12Dex } from "./helpers/QSFA12Dex";
import { QSFA2Dex } from "./helpers/QSFA2Dex";

import {
  WalletOperationBatch,
  WalletOperation,
  OpKind,
} from "@taquito/taquito";

import { ok } from "assert";

import { BigNumber } from "bignumber.js";

import { alice } from "../scripts/sandbox/accounts";

import { fa12Storage } from "../storage/test/FA12";
import { fa2Storage } from "../storage/test/FA2";
import { tFarmStorage } from "../storage/TFarm";
import { burnerStorage } from "../storage/Burner";
import { bakerRegistryStorage } from "../storage/BakerRegistry";
import { qsFA12FactoryStorage } from "../storage/test/QSFA12Factory";
import { qsFA2FactoryStorage } from "../storage/test/QSFA2Factory";
import { UserFA12Info } from "./types/FA12";
import { confirmOperation } from "scripts/confirmation";

describe("TFarm tests (section 2)", async () => {
  var fa12: FA12;
  var fa12LP: QSFA12Dex;
  var fa2: FA2;
  var fa2LP: QSFA2Dex;
  var qsGov: FA2;
  var qsGovLP: QSFA2Dex;
  var utils: Utils;
  var tFarm: TFarm;
  var burner: Burner;
  var bakerRegistry: BakerRegistry;
  var qsFA12Factory: QSFA12Factory;
  var qsFA2Factory: QSFA2Factory;

  var precision = 10 ** 18;
  var feePrecision = 10 ** 2;

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk, true);

    fa12 = await FA12.originate(utils.tezos, fa12Storage);
    fa2 = await FA2.originate(utils.tezos, fa2Storage);
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

    const qsGovLPAddress = await qsFA2Factory.storage.token_to_exchange[
      `${qsGov.contract.address},${0}`
    ];

    await fa2.updateOperators([updateOperatorParam]);
    await qsFA2Factory.launchExchange(fa2.contract.address, 0, 10000, 10000);
    await qsFA2Factory.updateStorage({
      token_to_exchange: [[fa2.contract.address, 0]],
    });

    const fa2LPAddress: string =
      qsFA2Factory.storage.token_to_exchange[`${fa2.contract.address},${0}`];

    await fa12.approve(qsFA12Factory.contract.address, 10000);
    await qsFA12Factory.launchExchange(fa12.contract.address, 10000, 10000);
    await qsFA12Factory.updateStorage({
      token_to_exchange: [fa12.contract.address],
    });

    const fa12LPAddress: string =
      qsFA12Factory.storage.token_to_exchange[fa12.contract.address];

    fa12LP = await QSFA12Dex.init(fa12LPAddress, utils.tezos);
    fa2LP = await QSFA2Dex.init(fa2LPAddress, utils.tezos);
    qsGovLP = await QSFA2Dex.init(qsGovLPAddress, utils.tezos);

    burnerStorage.qsgov_lp = qsGovLPAddress;
    burnerStorage.qsgov.token = qsGov.contract.address;
    burnerStorage.qsgov.id = 0;

    tFarmStorage.storage.qsgov.token = qsGov.contract.address;
    tFarmStorage.storage.qsgov.id = 0;
    tFarmStorage.storage.qsgov_lp = qsGovLPAddress;
    tFarmStorage.storage.admin = alice.pkh;
    tFarmStorage.storage.pending_admin = zeroAddress;
    tFarmStorage.storage.burner = zeroAddress;
    tFarmStorage.storage.baker_registry = zeroAddress;
    tFarmStorage.storage.farms_count = 0;

    burner = await Burner.originate(utils.tezos, burnerStorage);
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
    newFarmParams.stake_params.qs_pool = qsGovLP.contract.address;
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
    newFarmParams.stake_params.qs_pool = qsGovLP.contract.address;
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

  // it("should claim rewards in time of depositing after farms finishing when timelock is not finished", async () => {
  //   let newFarmParams: NewFarmParams = await TFarmUtils.getMockNewFarmParams(
  //     utils
  //   );

  //   newFarmParams.fees.harvest_fee = 21 * feePrecision;
  //   newFarmParams.fees.withdrawal_fee = 16 * feePrecision;
  //   newFarmParams.stake_params.staked_token = {
  //     fA2: { token: qsGov.contract.address, id: 0 },
  //   };
  //   newFarmParams.stake_params.qs_pool = qsGovLP.contract.address;
  //   newFarmParams.reward_token = { fA12: fa12.contract.address };
  //   newFarmParams.timelock = 4;
  //   newFarmParams.reward_per_second = 100 * precision;

  //   const lifetime: number = 5; // 3 seconds
  //   const rewAmount: number =
  //     (lifetime * newFarmParams.reward_per_second) / precision;
  //   const harvestFeePercent: number = newFarmParams.fees.harvest_fee / 10000;
  //   const earnedPercent: number = 1 - harvestFeePercent;

  //   await fa12.approve(tFarm.contract.address, rewAmount);

  //   newFarmParams.start_time = String(
  //     Date.parse((await utils.tezos.rpc.getBlockHeader()).timestamp) / 1000 + 1
  //   );
  //   newFarmParams.end_time = String(
  //     Date.parse((await utils.tezos.rpc.getBlockHeader()).timestamp) / 1000 +
  //       lifetime +
  //       1
  //   );

  //   const depositParams: DepositParams = {
  //     fid: 2,
  //     amt: 100,
  //     referrer: undefined,
  //     rewards_receiver: alice.pkh,
  //     candidate: zeroAddress,
  //   };
  //   const harvestParams: HarvestParams = {
  //     fid: depositParams.fid,
  //     rewards_receiver: alice.pkh,
  //   };
  //   const batch: WalletOperationBatch = await utils.tezos.wallet.batch([
  //     {
  //       kind: OpKind.TRANSACTION,
  //       ...tFarm.contract.methods
  //         .add_new_farm(...Utils.destructObj(newFarmParams))
  //         .toTransferParams(),
  //     },
  //     {
  //       kind: OpKind.TRANSACTION,
  //       ...tFarm.contract.methods
  //         .deposit(...Utils.destructObj(depositParams))
  //         .toTransferParams(),
  //     },
  //   ]);
  //   const operation: WalletOperation = await batch.send();

  //   await confirmOperation(utils.tezos, operation.opHash);
  //   await fa12.updateStorage({ ledger: [alice.pkh, zeroAddress] });

  //   const initialRewTokAliceRecord: UserFA12Info =
  //     fa12.storage.ledger[alice.pkh];
  //   const initialRewTokZeroRecord: UserFA12Info =
  //     fa12.storage.ledger[zeroAddress];

  //   await utils.bakeBlocks(lifetime);
  //   await tFarm.harvest(harvestParams);
  //   await fa12.updateStorage({
  //     ledger: [alice.pkh, tFarm.contract.address, zeroAddress],
  //   });

  //   const middleRewTokAliceRecord: UserFA12Info =
  //     fa12.storage.ledger[alice.pkh];
  //   const middleRewTokFarmRecord: UserFA12Info =
  //     fa12.storage.ledger[tFarm.contract.address];
  //   const middleRewTokZeroRecord: UserFA12Info =
  //     fa12.storage.ledger[zeroAddress];

  //   ok(
  //     new BigNumber(middleRewTokAliceRecord.balance).isEqualTo(
  //       new BigNumber(rewAmount)
  //         .multipliedBy(earnedPercent)
  //         .plus(initialRewTokAliceRecord.balance)
  //     )
  //   );
  //   ok(
  //     new BigNumber(middleRewTokZeroRecord.balance).isEqualTo(
  //       new BigNumber(rewAmount)
  //         .multipliedBy(harvestFeePercent)
  //         .plus(initialRewTokZeroRecord.balance)
  //     )
  //   );
  //   ok(
  //     new BigNumber(middleRewTokFarmRecord.balance).isEqualTo(
  //       new BigNumber(100) // from the previous test
  //     )
  //   );

  //   await tFarm.harvest(harvestParams);
  //   await fa12.updateStorage({
  //     ledger: [alice.pkh, tFarm.contract.address, zeroAddress],
  //   });

  //   const finalRewTokAliceRecord: UserFA12Info = fa12.storage.ledger[alice.pkh];
  //   const finalRewTokFarmRecord: UserFA12Info =
  //     fa12.storage.ledger[tFarm.contract.address];
  //   const finalRewTokZeroRecord: UserFA12Info =
  //     fa12.storage.ledger[zeroAddress];

  //   ok(
  //     new BigNumber(finalRewTokAliceRecord.balance).isEqualTo(
  //       new BigNumber(middleRewTokAliceRecord.balance)
  //     )
  //   );
  //   ok(
  //     new BigNumber(finalRewTokZeroRecord.balance).isEqualTo(
  //       new BigNumber(middleRewTokZeroRecord.balance)
  //     )
  //   );
  //   ok(
  //     new BigNumber(finalRewTokFarmRecord.balance).isEqualTo(
  //       new BigNumber(middleRewTokFarmRecord.balance)
  //     )
  //   );
  // });
});
