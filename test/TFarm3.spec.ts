import { FA12 } from "./helpers/FA12";
import { FA2 } from "./helpers/FA2";
import { Utils, zeroAddress } from "./helpers/Utils";
import { TFarm, TFarmUtils } from "./helpers/TFarm";
import { Burner } from "./helpers/Burner";
import { BakerRegistry } from "./helpers/BakerRegistry";
import { DexCore } from "./helpers/DexCore";

import {
  WithdrawParams,
  DepositParams,
  UserInfoType,
  WithdrawData,
  WithdrawFarmDepoParams,
} from "./types/Common";
import { NewFarmParams, Farm } from "./types/TFarm";
import { UserFA12Info } from "./types/FA12";
import { TransferParam, UpdateOperatorParam } from "./types/FA2";

import { ok, strictEqual } from "assert";

import { BigNumber } from "bignumber.js";

import { alice, bob, carol } from "../scripts/sandbox/accounts";

import { fa12Storage } from "../storage/test/FA12";
import { fa2Storage } from "../storage/test/FA2";
import { tFarmStorage } from "../storage/TFarm";
import { burnerStorage } from "../storage/Burner";
import { bakerRegistryStorage } from "../storage/BakerRegistry";
import { dexCoreStorage } from "storage/test/DexCore";

describe("TFarm tests (section 3)", async () => {
  var fa12: FA12;
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
    await fa12.approve(dexCore.contract.address, 10000);
    await dexCore.launchExchange(
      {
        pair: {
          token_a: {
            fa12: fa12.contract.address,
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
      token_to_id: [fa12.contract.address, 1],
    });

    burnerStorage.qsgov_lp = dexCore.contract.address;
    burnerStorage.qsgov.token = qsGov.contract.address;
    burnerStorage.qsgov.id = 0;

    burner = await Burner.originate(utils.tezos, burnerStorage);

    tFarmStorage.storage.qsgov.token = qsGov.contract.address;
    tFarmStorage.storage.qsgov.id = 0;
    tFarmStorage.storage.qsgov_lp = dexCore.contract.address;
    tFarmStorage.storage.admin = alice.pkh;
    tFarmStorage.storage.pending_admin = zeroAddress;
    tFarmStorage.storage.burner = burner.contract.address;
    tFarmStorage.storage.baker_registry = bakerRegistry.contract.address;
    tFarmStorage.storage.farms_count = 0;

    tFarm = await TFarm.originate(utils.tezos, tFarmStorage);

    await tFarm.setLambdas();
  });

  it("should vote for bob, bob must become first current delegated", async () => {
    let newFarmParams: NewFarmParams = await TFarmUtils.getMockNewFarmParams(
      utils,
    );

    newFarmParams.fees.harvest_fee = 6 * feePrecision;
    newFarmParams.fees.withdrawal_fee = 10 * feePrecision;
    newFarmParams.stake_params.staked_token = {
      fA2: { token: dexCore.contract.address, id: 1 },
    };
    newFarmParams.stake_params.is_v2_lp = true;
    newFarmParams.reward_token = { fA12: fa12.contract.address };
    newFarmParams.reward_per_second = 100 * precision;
    newFarmParams.timelock = 5; // 5 seconds

    const lifetime: number = 600; // 10 minutes
    const rewAmount: number =
      (lifetime * newFarmParams.reward_per_second) / precision;

    await fa12.approve(tFarm.contract.address, rewAmount);

    newFarmParams.start_time = String(
      Date.parse((await utils.tezos.rpc.getBlockHeader()).timestamp) / 1000 + 1,
    );
    newFarmParams.end_time = String(
      Date.parse((await utils.tezos.rpc.getBlockHeader()).timestamp) / 1000 +
        lifetime +
        1,
    );

    await tFarm.addNewFarm(newFarmParams);

    const depositParams: DepositParams = {
      fid: 0,
      amt: 100,
      referrer: bob.pkh,
      rewards_receiver: alice.pkh,
      candidate: bob.pkh,
    };

    await dexCore.updateStorage({
      ledger: [[alice.pkh, 1]],
    });

    const initialTokenAliceBalance: number =
      dexCore.storage.storage.ledger[`${alice.pkh},1`] === undefined
        ? 0
        : dexCore.storage.storage.ledger[`${alice.pkh},1`];

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
    await tFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      candidates: [[depositParams.fid, alice.pkh]],
      votes: [[depositParams.fid, bob.pkh]],
      farms: [depositParams.fid],
    });
    await dexCore.updateStorage({
      ledger: [
        [alice.pkh, 1],
        [tFarm.contract.address, 1],
      ],
    });

    const finalFarm: Farm = tFarm.storage.storage.farms[depositParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const finalFarmAliceCandidate: string =
      tFarm.storage.storage.candidates[`${depositParams.fid},${alice.pkh}`];
    const finalFarmBobVotes: number =
      tFarm.storage.storage.votes[`${depositParams.fid},${bob.pkh}`];
    const finalTokenAliceBalance: number =
      dexCore.storage.storage.ledger[`${alice.pkh},1`];
    const finalTokenFarmBalance: number =
      dexCore.storage.storage.ledger[`${tFarm.contract.address},1`];

    strictEqual(finalFarm.current_delegated, depositParams.candidate);
    strictEqual(finalFarm.next_candidate, zeroAddress);
    strictEqual(+finalFarmAliceRecord.prev_staked, depositParams.amt);
    strictEqual(finalFarmAliceCandidate, depositParams.candidate);
    strictEqual(+finalFarmBobVotes, depositParams.amt);

    ok(
      new BigNumber(finalTokenAliceBalance).isEqualTo(
        new BigNumber(initialTokenAliceBalance).minus(depositParams.amt),
      ),
    );
    ok(new BigNumber(finalTokenFarmBalance).isEqualTo(depositParams.amt));
  });

  it("should vote for alice, alice must became next candidate", async () => {
    const depositParams: DepositParams = {
      fid: 0,
      amt: 99,
      referrer: bob.pkh,
      rewards_receiver: carol.pkh,
      candidate: alice.pkh,
    };

    await dexCore.transfer([
      {
        from_: alice.pkh,
        txs: [{ to_: carol.pkh, amount: 1000, token_id: 1 }],
      },
    ]);
    await dexCore.transfer([
      {
        from_: alice.pkh,
        txs: [{ to_: bob.pkh, amount: 1000, token_id: 1 }],
      },
    ]);
    await dexCore.updateStorage({
      ledger: [
        [alice.pkh, 1],
        [tFarm.contract.address, 1],
        [bob.pkh, 1],
        [carol.pkh, 1],
      ],
    });
    const initialTokenCarolBalance: number =
      dexCore.storage.storage.ledger[`${carol.pkh},1`];
    const initialTokenFarmBalance: number =
      dexCore.storage.storage.ledger[`${tFarm.contract.address},1`];

    await utils.setProvider(carol.sk);
    await dexCore.updateOperators([
      {
        add_operator: {
          owner: carol.pkh,
          operator: tFarm.contract.address,
          token_id: 1,
        },
      },
    ]);
    await tFarm.deposit(depositParams);
    await tFarm.updateStorage({
      users_info: [[depositParams.fid, carol.pkh]],
      candidates: [[depositParams.fid, carol.pkh]],
      votes: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await dexCore.updateStorage({
      ledger: [
        [tFarm.contract.address, 1],
        [carol.pkh, 1],
      ],
    });

    const finalFarm: Farm = tFarm.storage.storage.farms[depositParams.fid];
    const finalFarmCarolRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${depositParams.fid},${carol.pkh}`];
    const finalFarmCarolCandidate: string =
      tFarm.storage.storage.candidates[`${depositParams.fid},${carol.pkh}`];
    const finalFarmAliceVotes: number =
      tFarm.storage.storage.votes[`${depositParams.fid},${alice.pkh}`];
    const finalTokenCarolBalance: number =
      dexCore.storage.storage.ledger[`${carol.pkh},1`];
    const finalTokenFarmBalance: number =
      dexCore.storage.storage.ledger[`${tFarm.contract.address},1`];

    strictEqual(finalFarm.current_delegated, bob.pkh);
    strictEqual(finalFarm.next_candidate, depositParams.candidate);
    strictEqual(+finalFarmCarolRecord.prev_staked, depositParams.amt);
    strictEqual(finalFarmCarolCandidate, depositParams.candidate);
    strictEqual(+finalFarmAliceVotes, depositParams.amt);

    ok(
      new BigNumber(finalTokenCarolBalance).isEqualTo(
        new BigNumber(initialTokenCarolBalance).minus(depositParams.amt),
      ),
    );
    ok(
      new BigNumber(finalTokenFarmBalance).isEqualTo(
        new BigNumber(initialTokenFarmBalance).plus(depositParams.amt),
      ),
    );
  });

  it("should vote for alice, alice must not become current delegated", async () => {
    const depositParams: DepositParams = {
      fid: 0,
      amt: 1,
      referrer: bob.pkh,
      rewards_receiver: carol.pkh,
      candidate: alice.pkh,
    };

    await tFarm.updateStorage({
      users_info: [[depositParams.fid, carol.pkh]],
      votes: [[depositParams.fid, alice.pkh]],
    });
    await dexCore.updateStorage({
      ledger: [
        [tFarm.contract.address, 1],
        [carol.pkh, 1],
      ],
    });

    const initialFarmCarolRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${depositParams.fid},${carol.pkh}`];
    const initialFarmAliceVotes: number =
      tFarm.storage.storage.votes[`${depositParams.fid},${alice.pkh}`];
    const initialTokenCarolBalance: number =
      dexCore.storage.storage.ledger[`${carol.pkh},1`];
    const initialTokenFarmBalance: number =
      dexCore.storage.storage.ledger[`${tFarm.contract.address},1`];

    await tFarm.deposit(depositParams);
    await tFarm.updateStorage({
      users_info: [[depositParams.fid, carol.pkh]],
      candidates: [[depositParams.fid, carol.pkh]],
      votes: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await dexCore.updateStorage({
      ledger: [
        [tFarm.contract.address, 1],
        [carol.pkh, 1],
      ],
    });

    const finalFarm: Farm = tFarm.storage.storage.farms[depositParams.fid];
    const finalFarmCarolRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${depositParams.fid},${carol.pkh}`];
    const finalFarmCarolCandidate: string =
      tFarm.storage.storage.candidates[`${depositParams.fid},${carol.pkh}`];
    const finalFarmAliceVotes: number =
      tFarm.storage.storage.votes[`${depositParams.fid},${alice.pkh}`];
    const finalTokenCarolBalance: number =
      dexCore.storage.storage.ledger[`${carol.pkh},1`];
    const finalTokenFarmBalance: number =
      dexCore.storage.storage.ledger[`${tFarm.contract.address},1`];

    strictEqual(finalFarm.current_delegated, bob.pkh);
    strictEqual(finalFarm.next_candidate, depositParams.candidate);
    strictEqual(
      +finalFarmCarolRecord.prev_staked,
      +initialFarmCarolRecord.prev_staked + depositParams.amt,
    );
    strictEqual(finalFarmCarolCandidate, depositParams.candidate);
    strictEqual(
      +finalFarmAliceVotes,
      +initialFarmAliceVotes + depositParams.amt,
    );

    ok(
      new BigNumber(finalTokenCarolBalance).isEqualTo(
        new BigNumber(initialTokenCarolBalance).minus(depositParams.amt),
      ),
    );
    ok(
      new BigNumber(finalTokenFarmBalance).isEqualTo(
        new BigNumber(initialTokenFarmBalance).plus(depositParams.amt),
      ),
    );
  });

  it("should vote for alice, alice must become current delegated", async () => {
    const depositParams: DepositParams = {
      fid: 0,
      amt: 100,
      referrer: bob.pkh,
      rewards_receiver: carol.pkh,
      candidate: alice.pkh,
    };

    await tFarm.updateStorage({
      users_info: [[depositParams.fid, carol.pkh]],
      votes: [[depositParams.fid, alice.pkh]],
    });
    await dexCore.updateStorage({
      ledger: [
        [tFarm.contract.address, 1],
        [carol.pkh, 1],
      ],
    });

    const initialFarmCarolRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${depositParams.fid},${carol.pkh}`];
    const initialFarmAliceVotes: number =
      tFarm.storage.storage.votes[`${depositParams.fid},${alice.pkh}`];
    const initialTokenCarolBalance: number =
      dexCore.storage.storage.ledger[`${carol.pkh},1`];
    const initialTokenFarmBalance: number =
      dexCore.storage.storage.ledger[`${tFarm.contract.address},1`];

    await tFarm.deposit(depositParams);
    await tFarm.updateStorage({
      users_info: [[depositParams.fid, carol.pkh]],
      candidates: [[depositParams.fid, carol.pkh]],
      votes: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await dexCore.updateStorage({
      ledger: [
        [tFarm.contract.address, 1],
        [carol.pkh, 1],
      ],
    });

    const finalFarm: Farm = tFarm.storage.storage.farms[depositParams.fid];
    const finalFarmCarolRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${depositParams.fid},${carol.pkh}`];
    const finalFarmCarolCandidate: string =
      tFarm.storage.storage.candidates[`${depositParams.fid},${carol.pkh}`];
    const finalFarmAliceVotes: number =
      tFarm.storage.storage.votes[`${depositParams.fid},${alice.pkh}`];
    const finalTokenCarolBalance: number =
      dexCore.storage.storage.ledger[`${carol.pkh},1`];
    const finalTokenFarmBalance: number =
      dexCore.storage.storage.ledger[`${tFarm.contract.address},1`];

    strictEqual(finalFarm.current_delegated, depositParams.candidate);
    strictEqual(finalFarm.next_candidate, bob.pkh);
    strictEqual(
      +finalFarmCarolRecord.prev_staked,
      +initialFarmCarolRecord.prev_staked + depositParams.amt,
    );
    strictEqual(finalFarmCarolCandidate, depositParams.candidate);
    strictEqual(
      +finalFarmAliceVotes,
      +initialFarmAliceVotes + depositParams.amt,
    );

    ok(
      new BigNumber(finalTokenCarolBalance).isEqualTo(
        new BigNumber(initialTokenCarolBalance).minus(depositParams.amt),
      ),
    );
    ok(
      new BigNumber(finalTokenFarmBalance).isEqualTo(
        new BigNumber(initialTokenFarmBalance).plus(depositParams.amt),
      ),
    );
  });

  it("should vote for bob, bob must become current delegated after alice", async () => {
    const depositParams: DepositParams = {
      fid: 0,
      amt: 101,
      referrer: bob.pkh,
      rewards_receiver: alice.pkh,
      candidate: bob.pkh,
    };

    await tFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      votes: [[depositParams.fid, bob.pkh]],
      farms: [depositParams.fid],
    });
    await dexCore.updateStorage({
      ledger: [
        [tFarm.contract.address, 1],
        [alice.pkh, 1],
      ],
    });

    const initialFarm: Farm = tFarm.storage.storage.farms[depositParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const initialFarmBobVotes: number =
      tFarm.storage.storage.votes[`${depositParams.fid},${bob.pkh}`];
    const initialTokenAliceBalance: number =
      dexCore.storage.storage.ledger[`${alice.pkh},1`] === undefined
        ? 0
        : dexCore.storage.storage.ledger[`${alice.pkh},1`];
    const initialTokenFarmBalance: number =
      dexCore.storage.storage.ledger[`${alice.pkh},1`];

    await utils.setProvider(alice.sk);

    await tFarm.deposit(depositParams);
    await tFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      candidates: [[depositParams.fid, alice.pkh]],
      votes: [[depositParams.fid, bob.pkh]],
      farms: [depositParams.fid],
    });
    await dexCore.updateStorage({
      ledger: [
        [tFarm.contract.address, 1],
        [alice.pkh, 1],
      ],
    });

    const finalFarm: Farm = tFarm.storage.storage.farms[depositParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const finalFarmAliceCandidate: string =
      tFarm.storage.storage.candidates[`${depositParams.fid},${alice.pkh}`];
    const finalFarmBobVotes: number =
      tFarm.storage.storage.votes[`${depositParams.fid},${bob.pkh}`];
    const finalTokenAliceBalance: number =
      dexCore.storage.storage.ledger[`${alice.pkh},1`];
    const finalTokenFarmBalance: number =
      dexCore.storage.storage.ledger[`${tFarm.contract.address},1`];

    strictEqual(finalFarm.current_delegated, depositParams.candidate);
    strictEqual(finalFarm.next_candidate, initialFarm.current_delegated);
    strictEqual(
      +finalFarmAliceRecord.prev_staked,
      +initialFarmAliceRecord.prev_staked + depositParams.amt,
    );
    strictEqual(finalFarmAliceCandidate, depositParams.candidate);
    strictEqual(+finalFarmBobVotes, +initialFarmBobVotes + depositParams.amt);

    ok(
      new BigNumber(finalTokenAliceBalance).isEqualTo(
        new BigNumber(initialTokenAliceBalance).minus(depositParams.amt),
      ),
    );
    ok(
      new BigNumber(finalTokenFarmBalance).isEqualTo(
        new BigNumber(initialTokenFarmBalance).plus(depositParams.amt),
      ),
    );
  });

  it("should revote for bob, alice must become current delegated", async () => {
    const withdrawParams: WithdrawParams = {
      fid: 0,
      amt: 50,
      receiver: alice.pkh,
      rewards_receiver: alice.pkh,
    };

    await tFarm.updateStorage({
      users_info: [[withdrawParams.fid, alice.pkh]],
      votes: [
        [withdrawParams.fid, alice.pkh],
        [withdrawParams.fid, bob.pkh],
      ],
      farms: [withdrawParams.fid],
    });
    await dexCore.updateStorage({
      ledger: [
        [tFarm.contract.address, 1],
        [alice.pkh, 1],
      ],
    });

    const initialFarm: Farm = tFarm.storage.storage.farms[withdrawParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const initialFarmAliceVotes: number =
      tFarm.storage.storage.votes[`${withdrawParams.fid},${alice.pkh}`];
    const initialFarmBobVotes: number =
      tFarm.storage.storage.votes[`${withdrawParams.fid},${bob.pkh}`];
    const initialTokenAliceBalance: number =
      dexCore.storage.storage.ledger[`${alice.pkh},1`];
    const initialTokenFarmBalance: number =
      dexCore.storage.storage.ledger[`${tFarm.contract.address},1`];

    await tFarm.withdraw(withdrawParams);
    await tFarm.updateStorage({
      users_info: [[withdrawParams.fid, alice.pkh]],
      candidates: [[withdrawParams.fid, alice.pkh]],
      votes: [
        [withdrawParams.fid, alice.pkh],
        [withdrawParams.fid, bob.pkh],
      ],
      farms: [withdrawParams.fid],
    });
    await dexCore.updateStorage({
      ledger: [
        [tFarm.contract.address, 1],
        [alice.pkh, 1],
      ],
    });

    const finalFarm: Farm = tFarm.storage.storage.farms[withdrawParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const finalFarmAliceCandidate: string =
      tFarm.storage.storage.candidates[`${withdrawParams.fid},${alice.pkh}`];
    const finalFarmAliceVotes: number =
      tFarm.storage.storage.votes[`${withdrawParams.fid},${alice.pkh}`];
    const finalFarmBobVotes: number =
      tFarm.storage.storage.votes[`${withdrawParams.fid},${bob.pkh}`];
    const finalTokenAliceBalance: number =
      dexCore.storage.storage.ledger[`${alice.pkh},1`];
    const finalTokenFarmBalance: number =
      dexCore.storage.storage.ledger[`${tFarm.contract.address},1`];
    const res: WithdrawData = TFarmUtils.getWithdrawData(
      initialFarm,
      withdrawParams.amt,
      precision,
    );

    strictEqual(finalFarm.current_delegated, initialFarm.next_candidate);
    strictEqual(finalFarm.next_candidate, initialFarm.current_delegated);
    strictEqual(
      +finalFarmAliceRecord.prev_staked,
      +initialFarmAliceRecord.prev_staked - withdrawParams.amt,
    );
    strictEqual(finalFarmAliceCandidate, bob.pkh);
    strictEqual(+finalFarmBobVotes, +initialFarmBobVotes - withdrawParams.amt);
    strictEqual(
      +finalFarmAliceVotes,
      +initialFarmAliceVotes + res.wirthdrawCommission.toNumber(),
    );

    ok(
      new BigNumber(finalTokenAliceBalance).isEqualTo(
        new BigNumber(initialTokenAliceBalance)
          .plus(withdrawParams.amt)
          .minus(res.wirthdrawCommission),
      ),
    );
    ok(
      new BigNumber(finalTokenFarmBalance).isEqualTo(
        new BigNumber(initialTokenFarmBalance).minus(res.actualUserWithdraw),
      ),
    );
  });

  it("should revote for alice, bob must become current delegated", async () => {
    const withdrawParams: WithdrawParams = {
      fid: 0,
      amt: 200,
      receiver: carol.pkh,
      rewards_receiver: carol.pkh,
    };

    await tFarm.updateStorage({
      users_info: [[withdrawParams.fid, carol.pkh]],
      votes: [
        [withdrawParams.fid, alice.pkh],
        [withdrawParams.fid, bob.pkh],
      ],
      farms: [withdrawParams.fid],
    });
    await dexCore.updateStorage({
      ledger: [
        [tFarm.contract.address, 1],
        [carol.pkh, 1],
      ],
    });
    const initialFarm: Farm = tFarm.storage.storage.farms[withdrawParams.fid];
    const initialFarmCarolRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${withdrawParams.fid},${carol.pkh}`];
    const initialFarmAliceVotes: number =
      tFarm.storage.storage.votes[`${withdrawParams.fid},${alice.pkh}`];
    const initialFarmBobVotes: number =
      tFarm.storage.storage.votes[`${withdrawParams.fid},${bob.pkh}`];
    const initialTokenCarolBalance: number =
      dexCore.storage.storage.ledger[`${carol.pkh},1`];
    const initialTokenFarmBalance: number =
      dexCore.storage.storage.ledger[`${tFarm.contract.address},1`];

    await utils.setProvider(carol.sk);
    await tFarm.withdraw(withdrawParams);
    await tFarm.updateStorage({
      users_info: [[withdrawParams.fid, carol.pkh]],
      candidates: [[withdrawParams.fid, carol.pkh]],
      votes: [
        [withdrawParams.fid, alice.pkh],
        [withdrawParams.fid, bob.pkh],
      ],
      farms: [withdrawParams.fid],
    });
    await dexCore.updateStorage({
      ledger: [
        [tFarm.contract.address, 1],
        [carol.pkh, 1],
      ],
    });

    const finalFarm: Farm = tFarm.storage.storage.farms[withdrawParams.fid];
    const finalFarmCarolRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${withdrawParams.fid},${carol.pkh}`];
    const finalFarmCarolCandidate: string =
      tFarm.storage.storage.candidates[`${withdrawParams.fid},${carol.pkh}`];
    const finalFarmAliceVotes: number =
      tFarm.storage.storage.votes[`${withdrawParams.fid},${alice.pkh}`];
    const finalFarmBobVotes: number =
      tFarm.storage.storage.votes[`${withdrawParams.fid},${bob.pkh}`];
    const finalTokenCarolBalance: number =
      dexCore.storage.storage.ledger[`${carol.pkh},1`];
    const finalTokenFarmBalance: number =
      dexCore.storage.storage.ledger[`${tFarm.contract.address},1`];
    const res: WithdrawData = TFarmUtils.getWithdrawData(
      initialFarm,
      withdrawParams.amt,
      precision,
    );

    strictEqual(finalFarm.current_delegated, bob.pkh);
    strictEqual(finalFarm.next_candidate, alice.pkh);
    strictEqual(
      +finalFarmCarolRecord.prev_staked,
      +initialFarmCarolRecord.prev_staked - withdrawParams.amt,
    );
    strictEqual(finalFarmCarolCandidate, undefined);
    strictEqual(
      +finalFarmAliceVotes,
      +initialFarmAliceVotes -
        withdrawParams.amt +
        res.wirthdrawCommission.toNumber(),
    );
    strictEqual(+finalFarmBobVotes, +initialFarmBobVotes);

    ok(
      new BigNumber(finalTokenCarolBalance).isEqualTo(
        new BigNumber(initialTokenCarolBalance)
          .plus(withdrawParams.amt)
          .minus(res.wirthdrawCommission),
      ),
    );
    ok(
      new BigNumber(finalTokenFarmBalance).isEqualTo(
        new BigNumber(initialTokenFarmBalance).minus(res.actualUserWithdraw),
      ),
    );
  });

  it("should withdraw farm deposit and revote for bob, bob must remain current delegated", async () => {
    const withdrawParams: WithdrawFarmDepoParams = {
      fid: 0,
      amt: 25,
    };

    await tFarm.updateStorage({
      users_info: [[withdrawParams.fid, tFarm.contract.address]],
      votes: [
        [withdrawParams.fid, alice.pkh],
        [withdrawParams.fid, bob.pkh],
      ],
    });
    await dexCore.updateStorage({
      ledger: [
        [tFarm.contract.address, 1],
        [alice.pkh, 1],
      ],
    });

    const initialFarmFarmRecord: UserInfoType =
      tFarm.storage.storage.users_info[
        `${withdrawParams.fid},${tFarm.contract.address}`
      ];
    const initialFarmAliceVotes: number =
      tFarm.storage.storage.votes[`${withdrawParams.fid},${alice.pkh}`];
    const initialFarmBobVotes: number =
      tFarm.storage.storage.votes[`${withdrawParams.fid},${bob.pkh}`];
    const initialTokenAliceBalance: number =
      dexCore.storage.storage.ledger[`${alice.pkh},1`];
    const initialTokenFarmBalance: number =
      dexCore.storage.storage.ledger[`${tFarm.contract.address},1`];

    await utils.setProvider(alice.sk);
    await tFarm.withdrawFarmDepo(withdrawParams);
    await tFarm.updateStorage({
      users_info: [[withdrawParams.fid, tFarm.contract.address]],
      candidates: [[withdrawParams.fid, tFarm.contract.address]],
      votes: [
        [withdrawParams.fid, alice.pkh],
        [withdrawParams.fid, bob.pkh],
      ],
      farms: [withdrawParams.fid],
    });
    await dexCore.updateStorage({
      ledger: [
        [tFarm.contract.address, 1],
        [alice.pkh, 1],
      ],
    });

    const finalFarm: Farm = tFarm.storage.storage.farms[withdrawParams.fid];
    const finalFarmFarmRecord: UserInfoType =
      tFarm.storage.storage.users_info[
        `${withdrawParams.fid},${tFarm.contract.address}`
      ];
    const finalFarmFarmCandidate: string =
      tFarm.storage.storage.candidates[
        `${withdrawParams.fid},${tFarm.contract.address}`
      ];
    const finalFarmAliceVotes: number =
      tFarm.storage.storage.votes[`${withdrawParams.fid},${alice.pkh}`];
    const finalFarmBobVotes: number =
      tFarm.storage.storage.votes[`${withdrawParams.fid},${bob.pkh}`];
    const finalTokenAliceBalance: number =
      dexCore.storage.storage.ledger[`${alice.pkh},1`];
    const finalTokenFarmBalance: number =
      dexCore.storage.storage.ledger[`${tFarm.contract.address},1`];

    strictEqual(finalFarm.current_delegated, bob.pkh);
    strictEqual(finalFarm.next_candidate, alice.pkh);
    strictEqual(
      +finalFarmFarmRecord.prev_staked,
      +initialFarmFarmRecord.prev_staked - withdrawParams.amt,
    );
    strictEqual(finalFarmFarmCandidate, undefined);
    strictEqual(+finalFarmBobVotes, +initialFarmBobVotes);
    strictEqual(
      +finalFarmAliceVotes,
      +initialFarmAliceVotes - withdrawParams.amt,
    );

    ok(
      new BigNumber(finalTokenAliceBalance).isEqualTo(
        new BigNumber(initialTokenAliceBalance).plus(withdrawParams.amt),
      ),
    );
    ok(
      new BigNumber(finalTokenFarmBalance).isEqualTo(
        new BigNumber(initialTokenFarmBalance).minus(withdrawParams.amt),
      ),
    );
  });

  it("should transfer staked tokens to carol, bob must remain current delegated", async () => {
    const fid: number = 0;
    const amt: number = 100;
    const transferParams: TransferParam = {
      from_: alice.pkh,
      txs: [{ to_: carol.pkh, token_id: fid, amount: amt }],
    };

    await utils.bakeBlocks(2);
    await tFarm.updateStorage({
      users_info: [
        [fid, alice.pkh],
        [fid, carol.pkh],
      ],
      votes: [
        [fid, alice.pkh],
        [fid, bob.pkh],
      ],
      farms: [fid],
    });

    const initialFarmAliceRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${fid},${alice.pkh}`];
    const initialFarmCarolRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${fid},${carol.pkh}`];
    const initialFarmAliceVotes: number =
      tFarm.storage.storage.votes[`${fid},${alice.pkh}`];
    const initialFarmBobVotes: number =
      tFarm.storage.storage.votes[`${fid},${bob.pkh}`];

    await utils.setProvider(alice.sk);
    await tFarm.transfer([transferParams]);
    await tFarm.updateStorage({
      users_info: [
        [fid, alice.pkh],
        [fid, carol.pkh],
      ],
      candidates: [
        [fid, alice.pkh],
        [fid, carol.pkh],
      ],
      votes: [
        [fid, alice.pkh],
        [fid, bob.pkh],
      ],
      farms: [fid],
    });

    const finalFarm: Farm = tFarm.storage.storage.farms[fid];
    const finalFarmAliceRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${fid},${alice.pkh}`];
    const finalFarmCarolRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${fid},${carol.pkh}`];
    const finalFarmAliceCandidate: string =
      tFarm.storage.storage.candidates[`${fid},${alice.pkh}`];
    const finalFarmCarolCandidate: string =
      tFarm.storage.storage.candidates[`${fid},${carol.pkh}`];
    const finalFarmAliceVotes: number =
      tFarm.storage.storage.votes[`${fid},${alice.pkh}`];
    const finalFarmBobVotes: number =
      tFarm.storage.storage.votes[`${fid},${bob.pkh}`];

    strictEqual(finalFarm.current_delegated, bob.pkh);
    strictEqual(finalFarm.next_candidate, alice.pkh);
    strictEqual(
      +finalFarmAliceRecord.prev_staked,
      +initialFarmAliceRecord.prev_staked - amt,
    );
    strictEqual(
      +finalFarmCarolRecord.prev_staked,
      +initialFarmCarolRecord.prev_staked + amt,
    );
    strictEqual(finalFarmCarolCandidate, bob.pkh);
    strictEqual(finalFarmAliceCandidate, bob.pkh);
    strictEqual(+finalFarmAliceVotes, +initialFarmAliceVotes);
    strictEqual(+finalFarmBobVotes, +initialFarmBobVotes);
  });

  it("should vote for alice and transfer staked tokens to carol, alice must become current delegated", async () => {
    const fid: number = 0;
    const depositAmt: number = 200;
    const transferAmt: number = 1;
    const depositParams: DepositParams = {
      fid: fid,
      amt: depositAmt,
      referrer: alice.pkh,
      rewards_receiver: bob.pkh,
      candidate: alice.pkh,
    };
    const transferParams: TransferParam = {
      from_: bob.pkh,
      txs: [{ to_: carol.pkh, token_id: fid, amount: transferAmt }],
    };

    await utils.setProvider(bob.sk);

    await dexCore.updateOperators([
      {
        add_operator: {
          owner: bob.pkh,
          operator: dexCore.contract.address,
          token_id: 1,
        },
      },
    ]);
    await tFarm.deposit(depositParams);
    await utils.bakeBlocks(5);
    await tFarm.updateStorage({
      users_info: [
        [fid, alice.pkh],
        [fid, bob.pkh],
        [fid, carol.pkh],
      ],
      votes: [
        [fid, alice.pkh],
        [fid, bob.pkh],
      ],
      farms: [fid],
    });

    const initialFarmAliceRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${fid},${alice.pkh}`];
    const initialFarmBobRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${fid},${bob.pkh}`];
    const initialFarmCarolRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${fid},${carol.pkh}`];
    const initialFarmAliceVotes: number =
      tFarm.storage.storage.votes[`${fid},${alice.pkh}`];
    const initialFarmBobVotes: number =
      tFarm.storage.storage.votes[`${fid},${bob.pkh}`];

    await tFarm.transfer([transferParams]);
    await tFarm.updateStorage({
      users_info: [
        [fid, alice.pkh],
        [fid, bob.pkh],
        [fid, carol.pkh],
      ],
      candidates: [
        [fid, alice.pkh],
        [fid, bob.pkh],
        [fid, carol.pkh],
      ],
      votes: [
        [fid, alice.pkh],
        [fid, bob.pkh],
      ],
      farms: [fid],
    });

    const finalFarm: Farm = tFarm.storage.storage.farms[fid];
    const finalFarmAliceRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${fid},${alice.pkh}`];
    const finalFarmBobRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${fid},${bob.pkh}`];
    const finalFarmCarolRecord: UserInfoType =
      tFarm.storage.storage.users_info[`${fid},${carol.pkh}`];
    const finalFarmAliceCandidate: string =
      tFarm.storage.storage.candidates[`${fid},${alice.pkh}`];
    const finalFarmBobCandidate: string =
      tFarm.storage.storage.candidates[`${fid},${bob.pkh}`];
    const finalFarmCarolCandidate: string =
      tFarm.storage.storage.candidates[`${fid},${carol.pkh}`];
    const finalFarmAliceVotes: number =
      tFarm.storage.storage.votes[`${fid},${alice.pkh}`];
    const finalFarmBobVotes: number =
      tFarm.storage.storage.votes[`${fid},${bob.pkh}`];

    strictEqual(finalFarm.current_delegated, depositParams.candidate);
    strictEqual(finalFarm.next_candidate, bob.pkh);
    strictEqual(
      +finalFarmAliceRecord.prev_staked,
      +initialFarmAliceRecord.prev_staked,
    );
    strictEqual(
      +finalFarmBobRecord.prev_staked,
      +initialFarmBobRecord.prev_staked - transferAmt,
    );
    strictEqual(
      +finalFarmCarolRecord.prev_staked,
      +initialFarmCarolRecord.prev_staked + transferAmt,
    );
    strictEqual(finalFarmCarolCandidate, bob.pkh);
    strictEqual(finalFarmBobCandidate, alice.pkh);
    strictEqual(finalFarmAliceCandidate, bob.pkh);
    strictEqual(+finalFarmAliceVotes, +initialFarmAliceVotes - transferAmt);
    strictEqual(+finalFarmBobVotes, +initialFarmBobVotes + transferAmt);
  });
});
