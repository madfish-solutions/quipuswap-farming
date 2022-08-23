import { FA12 } from "./helpers/FA12";
import { FA2 } from "./helpers/FA2";
import { Utils, zeroAddress } from "./helpers/Utils";
import { TFarm, TFarmUtils } from "./helpers/TFarm";
import { Burner } from "./helpers/Burner";
import { BakerRegistry } from "./helpers/BakerRegistry";
import { DexCore } from "./helpers/DexCore";

import { WithdrawParams, DepositParams } from "./types/Common";
import { UpdateOperatorParam } from "./types/FA2";
import { NewFarmParams } from "./types/TFarm";

import { alice, bob } from "../scripts/sandbox/accounts";

import { fa12Storage } from "../storage/test/FA12";
import { fa2Storage } from "../storage/test/FA2";
import { tFarmStorage } from "../storage/TFarm";
import { burnerStorage } from "../storage/Burner";
import { bakerRegistryStorage } from "../storage/BakerRegistry";
import { dexCoreStorage } from "storage/test/DexCore";
import { BigNumber } from "bignumber.js";

describe("TFarm tests (section 4)", async () => {
  var fa12: FA12;
  var fa2: FA2;
  var qsGov: FA2;
  var utils: Utils;
  var tFarm: TFarm;
  var burner: Burner;
  var bakerRegistry: BakerRegistry;
  var dexCore: DexCore;

  var precision = 10 ** 18;
  var feePrecision = 10 ** 16;

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk, true);

    fa12 = await FA12.originate(utils.tezos, fa12Storage);
    fa2 = await FA2.originate(utils.tezos, fa2Storage);
    qsGov = await FA2.originate(utils.tezos, fa2Storage);

    bakerRegistry = await BakerRegistry.originate(
      utils.tezos,
      bakerRegistryStorage,
    );

    dexCoreStorage.storage.baker_registry = bakerRegistry.contract.address;
    dexCoreStorage.storage.admin = alice.pkh;
    dexCoreStorage.storage.collecting_period = new BigNumber(12);
    dexCore = await DexCore.originate(utils.tezos, dexCoreStorage);

    await dexCore.setLambdas();

    const updateOperatorParam: UpdateOperatorParam = {
      add_operator: {
        owner: alice.pkh,
        operator: dexCore.contract.address,
        token_id: 0,
      },
    };

    await qsGov.updateOperators([updateOperatorParam]);
    await dexCore.launchExchange(
      {
        pair: {
          token_a: {
            fa2: { token: qsGov.contract.address, id: 0 },
          },
          token_b: { tez: undefined },
        },
        token_a_in: new BigNumber(10000),
        token_b_in: new BigNumber(10000),
        shares_receiver: alice.pkh,
        candidate: alice.pkh,
        deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      },
      10000,
    );

    await dexCore.updateStorage({
      token_to_id: [[qsGov.contract.address, 0]],
    });

    await fa2.updateOperators([updateOperatorParam]);
    await dexCore.launchExchange(
      {
        pair: {
          token_a: {
            fa2: { token: fa2.contract.address, id: 0 },
          },
          token_b: { tez: undefined },
        },
        token_a_in: new BigNumber(10000),
        token_b_in: new BigNumber(10000),
        shares_receiver: alice.pkh,
        candidate: alice.pkh,
        deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      },
      10000,
    );

    await dexCore.updateStorage({
      token_to_id: [[fa2.contract.address, 1]],
    });

    burnerStorage.qsgov_lp = dexCore.contract.address;
    burnerStorage.qsgov.token = qsGov.contract.address;
    burnerStorage.qsgov.id = 0;

    tFarmStorage.storage.qsgov.token = qsGov.contract.address;
    tFarmStorage.storage.qsgov.id = 0;
    tFarmStorage.storage.qsgov_lp = dexCore.contract.address;
    tFarmStorage.storage.admin = alice.pkh;
    tFarmStorage.storage.pending_admin = zeroAddress;
    tFarmStorage.storage.burner = zeroAddress;
    tFarmStorage.storage.baker_registry = bakerRegistry.contract.address;
    tFarmStorage.storage.farms_count = 0;

    burner = await Burner.originate(utils.tezos, burnerStorage);
    tFarm = await TFarm.originate(utils.tezos, tFarmStorage);

    await tFarm.setLambdas();
    await tFarm.setBurner(burner.contract.address);

    let newFarmParams: NewFarmParams = await TFarmUtils.getMockNewFarmParams(
      utils,
    );
    const lifetime: number = 600; // 10 minutes

    newFarmParams.fees.harvest_fee = 30 * feePrecision;
    newFarmParams.fees.withdrawal_fee = 6 * feePrecision;
    newFarmParams.stake_params.staked_token = {
      fA2: { token: dexCore.contract.address, id: 1 },
    };
    newFarmParams.stake_params.is_v2_lp = true;
    newFarmParams.reward_per_second = 4 * precision;
    newFarmParams.timelock = 0;
    newFarmParams.reward_token = { fA12: fa12.contract.address };
    newFarmParams.end_time = String(
      Date.parse((await utils.tezos.rpc.getBlockHeader()).timestamp) / 1000 +
        lifetime,
    );

    const rewardsAmount: number =
      (lifetime * newFarmParams.reward_per_second) / precision;

    await fa12.approve(tFarm.contract.address, rewardsAmount);
    await tFarm.addNewFarm(newFarmParams);
  });

  it("should deposit and after that withdraw all LP FA1.2 token", async () => {
    const fid: number = 0;
    const amount: number = 100;
    const rewardsReceiver: string = alice.pkh;
    const depositParams: DepositParams = {
      fid: fid,
      amt: amount,
      referrer: undefined,
      rewards_receiver: rewardsReceiver,
      candidate: bob.pkh,
    };
    const withdrawParams: WithdrawParams = {
      fid: fid,
      amt: amount,
      receiver: alice.pkh,
      rewards_receiver: rewardsReceiver,
    };

    await dexCore.updateOperators([
      {
        add_operator: {
          owner: alice.pkh,
          operator: tFarm.contract.address,
          token_id: 1,
        },
      },
    ]);
    await tFarm.deposit(depositParams);
    await tFarm.withdraw(withdrawParams);
  });
});
