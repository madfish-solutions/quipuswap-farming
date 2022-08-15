import { FA12 } from "./helpers/FA12";
import { FA2 } from "./helpers/FA2";
import { Utils, zeroAddress } from "./helpers/Utils";
import { TFarm, TFarmUtils } from "./helpers/TFarm";
import { Burner } from "./helpers/Burner";
import { BakerRegistry } from "./helpers/BakerRegistry";
import { QSFA12Factory } from "./helpers/QSFA12Factory";
import { QSFA2Factory } from "./helpers/QSFA2Factory";
import { QSFA12Dex } from "./helpers/QSFA12Dex";

import { WithdrawParams, DepositParams } from "./types/Common";
import { UpdateOperatorParam } from "./types/FA2";
import { NewFarmParams } from "./types/TFarm";

import { alice, bob } from "../scripts/sandbox/accounts";

import { fa12Storage } from "../storage/test/FA12";
import { fa2Storage } from "../storage/test/FA2";
import { tFarmStorage } from "../storage/TFarm";
import { burnerStorage } from "../storage/Burner";
import { bakerRegistryStorage } from "../storage/BakerRegistry";
import { qsFA12FactoryStorage } from "../storage/test/QSFA12Factory";
import { qsFA2FactoryStorage } from "../storage/test/QSFA2Factory";

describe("TFarm tests (section 4)", async () => {
  var fa12: FA12;
  var fa12LP: QSFA12Dex;
  var fa2: FA2;
  var qsGov: FA2;
  var utils: Utils;
  var tFarm: TFarm;
  var burner: Burner;
  var bakerRegistry: BakerRegistry;
  var qsFA12Factory: QSFA12Factory;
  var qsFA2Factory: QSFA2Factory;

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

    qsFA12FactoryStorage.baker_validator = bakerRegistry.contract.address;

    qsFA12Factory = await QSFA12Factory.originate(
      utils.tezos,
      qsFA12FactoryStorage,
    );

    qsFA2FactoryStorage.baker_validator = bakerRegistry.contract.address;

    qsFA2Factory = await QSFA2Factory.originate(
      utils.tezos,
      qsFA2FactoryStorage,
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

    await fa12.approve(qsFA12Factory.contract.address, 10000);
    await qsFA12Factory.launchExchange(fa12.contract.address, 10000, 10000);
    await qsFA12Factory.updateStorage({
      token_to_exchange: [fa12.contract.address],
    });

    const fa12LPAddress: string =
      qsFA12Factory.storage.token_to_exchange[fa12.contract.address];

    fa12LP = await QSFA12Dex.init(fa12LPAddress, utils.tezos);

    burnerStorage.qsgov_lp = qsGovLPAddress;
    burnerStorage.qsgov.token = qsGov.contract.address;
    burnerStorage.qsgov.id = 0;

    tFarmStorage.storage.qsgov.token = qsGov.contract.address;
    tFarmStorage.storage.qsgov.id = 0;
    tFarmStorage.storage.qsgov_lp = qsGovLPAddress;
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
    newFarmParams.stake_params.staked_token = { fA12: fa12LP.contract.address };
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

    await fa12LP.approve(tFarm.contract.address, depositParams.amt);
    await tFarm.deposit(depositParams);
    await tFarm.withdraw(withdrawParams);
  });
});
