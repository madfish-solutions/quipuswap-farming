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

import {
  WithdrawParams,
  DepositParams,
  UserInfoType,
  WithdrawData,
  WithdrawFarmDepoParams,
} from "./types/Common";
import { NewFarmParams, Farm } from "./types/QFarm";
import { UserFA12Info } from "./types/FA12";
import { TransferParam, UpdateOperatorParam } from "./types/FA2";

import { ok, strictEqual } from "assert";

import { BigNumber } from "bignumber.js";

import { alice, bob, carol } from "../scripts/sandbox/accounts";

import { fa12Storage } from "../storage/test/FA12";
import { fa2Storage } from "../storage/test/FA2";
import { qFarmStorage } from "../storage/QFarm";
import { burnerStorage } from "../storage/Burner";
import { proxyMinterStorage } from "../storage/ProxyMinter";
import { bakerRegistryStorage } from "../storage/BakerRegistry";
import { qsFA12FactoryStorage } from "../storage/test/QSFA12Factory";
import { qsFA2FactoryStorage } from "../storage/test/QSFA2Factory";

describe("QFarm tests (section 2)", async () => {
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

  var precision = 10 ** 18;
  var feePrecision = 10 ** 16;

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk, true);

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

    await qsGov.setMinters([
      { minter: proxyMinter.contract.address, share: 100000000 },
    ]);

    qFarmStorage.storage.qsgov.token = qsGov.contract.address;
    qFarmStorage.storage.qsgov.id = 0;
    qFarmStorage.storage.qsgov_lp = qsGovLP.contract.address;
    qFarmStorage.storage.admin = alice.pkh;
    qFarmStorage.storage.pending_admin = zeroAddress;
    qFarmStorage.storage.burner = burner.contract.address;
    qFarmStorage.storage.proxy_minter = proxyMinter.contract.address;
    qFarmStorage.storage.baker_registry = bakerRegistry.contract.address;
    qFarmStorage.storage.farms_count = 0;

    qFarm = await QFarm.originate(utils.tezos, qFarmStorage);

    await qFarm.setLambdas();
    await proxyMinter.addMinter(qFarm.contract.address, true);
  });

  it("should vote for bob, bob must become first current delegated", async () => {
    let newFarmParams: NewFarmParams = await QFarmUtils.getMockNewFarmParams(
      utils
    );

    newFarmParams.fees.harvest_fee = 6 * feePrecision;
    newFarmParams.fees.withdrawal_fee = 10 * feePrecision;
    newFarmParams.fees.burn_reward = 12 * feePrecision;
    newFarmParams.stake_params.staked_token = { fA12: fa12LP.contract.address };
    newFarmParams.stake_params.is_v1_lp = true;
    newFarmParams.stake_params.qs_pool = fa12LP.contract.address;
    newFarmParams.reward_per_second = 100 * precision;
    newFarmParams.timelock = 5; // 5 seconds

    await qFarm.addNewFarm(newFarmParams);

    const depositParams: DepositParams = {
      fid: 0,
      amt: 100,
      referrer: bob.pkh,
      rewards_receiver: alice.pkh,
      candidate: bob.pkh,
    };

    await fa12LP.updateStorage({
      ledger: [alice.pkh],
    });

    const initialTokenAliceRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[alice.pkh];

    await fa12LP.approve(qFarm.contract.address, depositParams.amt);
    await qFarm.deposit(depositParams);
    await qFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      candidates: [[depositParams.fid, alice.pkh]],
      votes: [[depositParams.fid, bob.pkh]],
      farms: [depositParams.fid],
    });
    await fa12LP.updateStorage({
      ledger: [alice.pkh, qFarm.contract.address],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const finalFarmAliceCandidate: string =
      qFarm.storage.storage.candidates[`${depositParams.fid},${alice.pkh}`];
    const finalFarmBobVotes: number =
      qFarm.storage.storage.votes[`${depositParams.fid},${bob.pkh}`];
    const finalTokenAliceRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[alice.pkh];
    const finalTokenFarmRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[qFarm.contract.address];

    strictEqual(finalFarm.current_delegated, depositParams.candidate);
    strictEqual(finalFarm.next_candidate, zeroAddress);
    strictEqual(+finalFarmAliceRecord.prev_staked, depositParams.amt);
    strictEqual(finalFarmAliceCandidate, depositParams.candidate);
    strictEqual(+finalFarmBobVotes, depositParams.amt);

    ok(
      new BigNumber(finalTokenAliceRecord.balance).isEqualTo(
        new BigNumber(initialTokenAliceRecord.balance).minus(depositParams.amt)
      )
    );
    ok(new BigNumber(finalTokenFarmRecord.balance).isEqualTo(0));
    ok(
      new BigNumber(finalTokenFarmRecord.frozen_balance).isEqualTo(
        depositParams.amt
      )
    );
  });

  it("should vote for alice, alice must became next candidate", async () => {
    const depositParams: DepositParams = {
      fid: 0,
      amt: 99,
      referrer: bob.pkh,
      rewards_receiver: carol.pkh,
      candidate: alice.pkh,
    };

    await fa12LP.transfer(alice.pkh, carol.pkh, 1000);
    await fa12LP.transfer(alice.pkh, bob.pkh, 1000);
    await fa12LP.updateStorage({
      ledger: [carol.pkh, qFarm.contract.address],
    });

    const initialTokenCarolRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[carol.pkh];
    const initialTokenFarmRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[qFarm.contract.address];

    await utils.setProvider(carol.sk);
    await fa12LP.approve(qFarm.contract.address, depositParams.amt);
    await qFarm.deposit(depositParams);
    await qFarm.updateStorage({
      users_info: [[depositParams.fid, carol.pkh]],
      candidates: [[depositParams.fid, carol.pkh]],
      votes: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await fa12LP.updateStorage({
      ledger: [carol.pkh, qFarm.contract.address],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const finalFarmCarolRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${carol.pkh}`];
    const finalFarmCarolCandidate: string =
      qFarm.storage.storage.candidates[`${depositParams.fid},${carol.pkh}`];
    const finalFarmAliceVotes: number =
      qFarm.storage.storage.votes[`${depositParams.fid},${alice.pkh}`];
    const finalTokenCarolRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[carol.pkh];
    const finalTokenFarmRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[qFarm.contract.address];

    strictEqual(finalFarm.current_delegated, bob.pkh);
    strictEqual(finalFarm.next_candidate, depositParams.candidate);
    strictEqual(+finalFarmCarolRecord.prev_staked, depositParams.amt);
    strictEqual(finalFarmCarolCandidate, depositParams.candidate);
    strictEqual(+finalFarmAliceVotes, depositParams.amt);

    ok(
      new BigNumber(finalTokenCarolRecord.balance).isEqualTo(
        new BigNumber(initialTokenCarolRecord.balance).minus(depositParams.amt)
      )
    );
    ok(new BigNumber(finalTokenFarmRecord.balance).isEqualTo(0));
    ok(
      new BigNumber(finalTokenFarmRecord.frozen_balance).isEqualTo(
        new BigNumber(initialTokenFarmRecord.frozen_balance).plus(
          depositParams.amt
        )
      )
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

    await qFarm.updateStorage({
      users_info: [[depositParams.fid, carol.pkh]],
      votes: [[depositParams.fid, alice.pkh]],
    });
    await fa12LP.updateStorage({
      ledger: [carol.pkh, qFarm.contract.address],
    });

    const initialFarmCarolRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${carol.pkh}`];
    const initialFarmAliceVotes: number =
      qFarm.storage.storage.votes[`${depositParams.fid},${alice.pkh}`];
    const initialTokenCarolRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[carol.pkh];
    const initialTokenFarmRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[qFarm.contract.address];

    await fa12LP.approve(qFarm.contract.address, depositParams.amt);
    await qFarm.deposit(depositParams);
    await qFarm.updateStorage({
      users_info: [[depositParams.fid, carol.pkh]],
      candidates: [[depositParams.fid, carol.pkh]],
      votes: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await fa12LP.updateStorage({
      ledger: [carol.pkh, qFarm.contract.address],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const finalFarmCarolRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${carol.pkh}`];
    const finalFarmCarolCandidate: string =
      qFarm.storage.storage.candidates[`${depositParams.fid},${carol.pkh}`];
    const finalFarmAliceVotes: number =
      qFarm.storage.storage.votes[`${depositParams.fid},${alice.pkh}`];
    const finalTokenCarolRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[carol.pkh];
    const finalTokenFarmRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[qFarm.contract.address];

    strictEqual(finalFarm.current_delegated, bob.pkh);
    strictEqual(finalFarm.next_candidate, depositParams.candidate);
    strictEqual(
      +finalFarmCarolRecord.prev_staked,
      +initialFarmCarolRecord.prev_staked + depositParams.amt
    );
    strictEqual(finalFarmCarolCandidate, depositParams.candidate);
    strictEqual(
      +finalFarmAliceVotes,
      +initialFarmAliceVotes + depositParams.amt
    );

    ok(
      new BigNumber(finalTokenCarolRecord.balance).isEqualTo(
        new BigNumber(initialTokenCarolRecord.balance).minus(depositParams.amt)
      )
    );
    ok(new BigNumber(finalTokenFarmRecord.balance).isEqualTo(0));
    ok(
      new BigNumber(finalTokenFarmRecord.frozen_balance).isEqualTo(
        new BigNumber(initialTokenFarmRecord.frozen_balance).plus(
          depositParams.amt
        )
      )
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

    await qFarm.updateStorage({
      users_info: [[depositParams.fid, carol.pkh]],
      votes: [[depositParams.fid, alice.pkh]],
    });
    await fa12LP.updateStorage({
      ledger: [carol.pkh, qFarm.contract.address],
    });

    const initialFarmCarolRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${carol.pkh}`];
    const initialFarmAliceVotes: number =
      qFarm.storage.storage.votes[`${depositParams.fid},${alice.pkh}`];
    const initialTokenCarolRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[carol.pkh];
    const initialTokenFarmRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[qFarm.contract.address];

    await fa12LP.approve(qFarm.contract.address, depositParams.amt);
    await qFarm.deposit(depositParams);
    await qFarm.updateStorage({
      users_info: [[depositParams.fid, carol.pkh]],
      candidates: [[depositParams.fid, carol.pkh]],
      votes: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await fa12LP.updateStorage({
      ledger: [carol.pkh, qFarm.contract.address],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const finalFarmCarolRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${carol.pkh}`];
    const finalFarmCarolCandidate: string =
      qFarm.storage.storage.candidates[`${depositParams.fid},${carol.pkh}`];
    const finalFarmAliceVotes: number =
      qFarm.storage.storage.votes[`${depositParams.fid},${alice.pkh}`];
    const finalTokenCarolRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[carol.pkh];
    const finalTokenFarmRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[qFarm.contract.address];

    strictEqual(finalFarm.current_delegated, depositParams.candidate);
    strictEqual(finalFarm.next_candidate, bob.pkh);
    strictEqual(
      +finalFarmCarolRecord.prev_staked,
      +initialFarmCarolRecord.prev_staked + depositParams.amt
    );
    strictEqual(finalFarmCarolCandidate, depositParams.candidate);
    strictEqual(
      +finalFarmAliceVotes,
      +initialFarmAliceVotes + depositParams.amt
    );

    ok(
      new BigNumber(finalTokenCarolRecord.balance).isEqualTo(
        new BigNumber(initialTokenCarolRecord.balance).minus(depositParams.amt)
      )
    );
    ok(new BigNumber(finalTokenFarmRecord.balance).isEqualTo(0));
    ok(
      new BigNumber(finalTokenFarmRecord.frozen_balance).isEqualTo(
        new BigNumber(initialTokenFarmRecord.frozen_balance).plus(
          depositParams.amt
        )
      )
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

    await qFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      votes: [[depositParams.fid, bob.pkh]],
      farms: [depositParams.fid],
    });
    await fa12LP.updateStorage({
      ledger: [alice.pkh, qFarm.contract.address],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const initialFarmBobVotes: number =
      qFarm.storage.storage.votes[`${depositParams.fid},${bob.pkh}`];
    const initialTokenAliceRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[alice.pkh];
    const initialTokenFarmRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[qFarm.contract.address];

    await utils.setProvider(alice.sk);
    await fa12LP.approve(qFarm.contract.address, depositParams.amt);
    await qFarm.deposit(depositParams);
    await qFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      candidates: [[depositParams.fid, alice.pkh]],
      votes: [[depositParams.fid, bob.pkh]],
      farms: [depositParams.fid],
    });
    await fa12LP.updateStorage({
      ledger: [alice.pkh, qFarm.contract.address],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const finalFarmAliceCandidate: string =
      qFarm.storage.storage.candidates[`${depositParams.fid},${alice.pkh}`];
    const finalFarmBobVotes: number =
      qFarm.storage.storage.votes[`${depositParams.fid},${bob.pkh}`];
    const finalTokenAliceRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[alice.pkh];
    const finalTokenFarmRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[qFarm.contract.address];

    strictEqual(finalFarm.current_delegated, depositParams.candidate);
    strictEqual(finalFarm.next_candidate, initialFarm.current_delegated);
    strictEqual(
      +finalFarmAliceRecord.prev_staked,
      +initialFarmAliceRecord.prev_staked + depositParams.amt
    );
    strictEqual(finalFarmAliceCandidate, depositParams.candidate);
    strictEqual(+finalFarmBobVotes, +initialFarmBobVotes + depositParams.amt);

    ok(
      new BigNumber(finalTokenAliceRecord.balance).isEqualTo(
        new BigNumber(initialTokenAliceRecord.balance).minus(depositParams.amt)
      )
    );
    ok(new BigNumber(finalTokenFarmRecord.balance).isEqualTo(0));
    ok(
      new BigNumber(finalTokenFarmRecord.frozen_balance).isEqualTo(
        new BigNumber(initialTokenFarmRecord.frozen_balance).plus(
          depositParams.amt
        )
      )
    );
  });

  it("should revote for bob, alice must become current delegated", async () => {
    const withdrawParams: WithdrawParams = {
      fid: 0,
      amt: 50,
      receiver: alice.pkh,
      rewards_receiver: alice.pkh,
    };

    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, alice.pkh]],
      votes: [
        [withdrawParams.fid, alice.pkh],
        [withdrawParams.fid, bob.pkh],
      ],
      farms: [withdrawParams.fid],
    });
    await fa12LP.updateStorage({
      ledger: [alice.pkh, qFarm.contract.address],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const initialFarmAliceVotes: number =
      qFarm.storage.storage.votes[`${withdrawParams.fid},${alice.pkh}`];
    const initialFarmBobVotes: number =
      qFarm.storage.storage.votes[`${withdrawParams.fid},${bob.pkh}`];
    const initialTokenAliceRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[alice.pkh];
    const initialTokenFarmRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[qFarm.contract.address];

    await qFarm.withdraw(withdrawParams);
    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, alice.pkh]],
      candidates: [[withdrawParams.fid, alice.pkh]],
      votes: [
        [withdrawParams.fid, alice.pkh],
        [withdrawParams.fid, bob.pkh],
      ],
      farms: [withdrawParams.fid],
    });
    await fa12LP.updateStorage({
      ledger: [alice.pkh, qFarm.contract.address],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const finalFarmAliceCandidate: string =
      qFarm.storage.storage.candidates[`${withdrawParams.fid},${alice.pkh}`];
    const finalFarmAliceVotes: number =
      qFarm.storage.storage.votes[`${withdrawParams.fid},${alice.pkh}`];
    const finalFarmBobVotes: number =
      qFarm.storage.storage.votes[`${withdrawParams.fid},${bob.pkh}`];
    const finalTokenAliceRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[alice.pkh];
    const finalTokenFarmRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[qFarm.contract.address];
    const res: WithdrawData = QFarmUtils.getWithdrawData(
      initialFarm,
      withdrawParams.amt,
      precision
    );

    strictEqual(finalFarm.current_delegated, initialFarm.next_candidate);
    strictEqual(finalFarm.next_candidate, initialFarm.current_delegated);
    strictEqual(
      +finalFarmAliceRecord.prev_staked,
      +initialFarmAliceRecord.prev_staked - withdrawParams.amt
    );
    strictEqual(finalFarmAliceCandidate, bob.pkh);
    strictEqual(+finalFarmBobVotes, +initialFarmBobVotes - withdrawParams.amt);
    strictEqual(
      +finalFarmAliceVotes,
      +initialFarmAliceVotes + res.wirthdrawCommission.toNumber()
    );

    ok(
      new BigNumber(finalTokenAliceRecord.balance).isEqualTo(
        new BigNumber(initialTokenAliceRecord.balance)
          .plus(withdrawParams.amt)
          .minus(res.wirthdrawCommission)
      )
    );
    ok(new BigNumber(finalTokenFarmRecord.balance).isEqualTo(0));
    ok(
      new BigNumber(finalTokenFarmRecord.frozen_balance).isEqualTo(
        new BigNumber(initialTokenFarmRecord.frozen_balance).minus(
          res.actualUserWithdraw
        )
      )
    );
  });

  it("should revote for alice, bob must become current delegated", async () => {
    const withdrawParams: WithdrawParams = {
      fid: 0,
      amt: 200,
      receiver: carol.pkh,
      rewards_receiver: carol.pkh,
    };

    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, carol.pkh]],
      votes: [
        [withdrawParams.fid, alice.pkh],
        [withdrawParams.fid, bob.pkh],
      ],
      farms: [withdrawParams.fid],
    });
    await fa12LP.updateStorage({
      ledger: [carol.pkh, qFarm.contract.address],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const initialFarmCarolRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${carol.pkh}`];
    const initialFarmAliceVotes: number =
      qFarm.storage.storage.votes[`${withdrawParams.fid},${alice.pkh}`];
    const initialFarmBobVotes: number =
      qFarm.storage.storage.votes[`${withdrawParams.fid},${bob.pkh}`];
    const initialTokenCarolRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[carol.pkh];
    const initialTokenFarmRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[qFarm.contract.address];

    await utils.setProvider(carol.sk);
    await qFarm.withdraw(withdrawParams);
    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, carol.pkh]],
      candidates: [[withdrawParams.fid, carol.pkh]],
      votes: [
        [withdrawParams.fid, alice.pkh],
        [withdrawParams.fid, bob.pkh],
      ],
      farms: [withdrawParams.fid],
    });
    await fa12LP.updateStorage({
      ledger: [carol.pkh, qFarm.contract.address],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const finalFarmCarolRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${carol.pkh}`];
    const finalFarmCarolCandidate: string =
      qFarm.storage.storage.candidates[`${withdrawParams.fid},${carol.pkh}`];
    const finalFarmAliceVotes: number =
      qFarm.storage.storage.votes[`${withdrawParams.fid},${alice.pkh}`];
    const finalFarmBobVotes: number =
      qFarm.storage.storage.votes[`${withdrawParams.fid},${bob.pkh}`];
    const finalTokenCarolRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[carol.pkh];
    const finalTokenFarmRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[qFarm.contract.address];
    const res: WithdrawData = QFarmUtils.getWithdrawData(
      initialFarm,
      withdrawParams.amt,
      precision
    );

    strictEqual(finalFarm.current_delegated, bob.pkh);
    strictEqual(finalFarm.next_candidate, alice.pkh);
    strictEqual(
      +finalFarmCarolRecord.prev_staked,
      +initialFarmCarolRecord.prev_staked - withdrawParams.amt
    );
    strictEqual(finalFarmCarolCandidate, undefined);
    strictEqual(
      +finalFarmAliceVotes,
      +initialFarmAliceVotes -
        withdrawParams.amt +
        res.wirthdrawCommission.toNumber()
    );
    strictEqual(+finalFarmBobVotes, +initialFarmBobVotes);

    ok(
      new BigNumber(finalTokenCarolRecord.balance).isEqualTo(
        new BigNumber(initialTokenCarolRecord.balance)
          .plus(withdrawParams.amt)
          .minus(res.wirthdrawCommission)
      )
    );
    ok(new BigNumber(finalTokenFarmRecord.balance).isEqualTo(0));
    ok(
      new BigNumber(finalTokenFarmRecord.frozen_balance).isEqualTo(
        new BigNumber(initialTokenFarmRecord.frozen_balance).minus(
          res.actualUserWithdraw
        )
      )
    );
  });

  it("should withdraw farm deposit and revote for bob, bob must remain current delegated", async () => {
    const withdrawParams: WithdrawFarmDepoParams = {
      fid: 0,
      amt: 25,
    };

    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, qFarm.contract.address]],
      votes: [
        [withdrawParams.fid, alice.pkh],
        [withdrawParams.fid, bob.pkh],
      ],
    });
    await fa12LP.updateStorage({
      ledger: [alice.pkh, qFarm.contract.address],
    });

    const initialFarmFarmRecord: UserInfoType =
      qFarm.storage.storage.users_info[
        `${withdrawParams.fid},${qFarm.contract.address}`
      ];
    const initialFarmAliceVotes: number =
      qFarm.storage.storage.votes[`${withdrawParams.fid},${alice.pkh}`];
    const initialFarmBobVotes: number =
      qFarm.storage.storage.votes[`${withdrawParams.fid},${bob.pkh}`];
    const initialTokenAliceRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[alice.pkh];
    const initialTokenFarmRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[qFarm.contract.address];

    await utils.setProvider(alice.sk);
    await qFarm.withdrawFarmDepo(withdrawParams);
    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, qFarm.contract.address]],
      candidates: [[withdrawParams.fid, qFarm.contract.address]],
      votes: [
        [withdrawParams.fid, alice.pkh],
        [withdrawParams.fid, bob.pkh],
      ],
      farms: [withdrawParams.fid],
    });
    await fa12LP.updateStorage({
      ledger: [alice.pkh, qFarm.contract.address],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const finalFarmFarmRecord: UserInfoType =
      qFarm.storage.storage.users_info[
        `${withdrawParams.fid},${qFarm.contract.address}`
      ];
    const finalFarmFarmCandidate: string =
      qFarm.storage.storage.candidates[
        `${withdrawParams.fid},${qFarm.contract.address}`
      ];
    const finalFarmAliceVotes: number =
      qFarm.storage.storage.votes[`${withdrawParams.fid},${alice.pkh}`];
    const finalFarmBobVotes: number =
      qFarm.storage.storage.votes[`${withdrawParams.fid},${bob.pkh}`];
    const finalTokenAliceRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[alice.pkh];
    const finalTokenFarmRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[qFarm.contract.address];

    strictEqual(finalFarm.current_delegated, bob.pkh);
    strictEqual(finalFarm.next_candidate, alice.pkh);
    strictEqual(
      +finalFarmFarmRecord.prev_staked,
      +initialFarmFarmRecord.prev_staked - withdrawParams.amt
    );
    strictEqual(finalFarmFarmCandidate, undefined);
    strictEqual(+finalFarmBobVotes, +initialFarmBobVotes);
    strictEqual(
      +finalFarmAliceVotes,
      +initialFarmAliceVotes - withdrawParams.amt
    );

    ok(
      new BigNumber(finalTokenAliceRecord.balance).isEqualTo(
        new BigNumber(initialTokenAliceRecord.balance).plus(withdrawParams.amt)
      )
    );
    ok(new BigNumber(finalTokenFarmRecord.balance).isEqualTo(0));
    ok(
      new BigNumber(finalTokenFarmRecord.frozen_balance).isEqualTo(
        new BigNumber(initialTokenFarmRecord.frozen_balance).minus(
          withdrawParams.amt
        )
      )
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
    await qFarm.updateStorage({
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
      qFarm.storage.storage.users_info[`${fid},${alice.pkh}`];
    const initialFarmCarolRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${fid},${carol.pkh}`];
    const initialFarmAliceVotes: number =
      qFarm.storage.storage.votes[`${fid},${alice.pkh}`];
    const initialFarmBobVotes: number =
      qFarm.storage.storage.votes[`${fid},${bob.pkh}`];

    await utils.setProvider(alice.sk);
    await qFarm.transfer([transferParams]);
    await qFarm.updateStorage({
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

    const finalFarm: Farm = qFarm.storage.storage.farms[fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${fid},${alice.pkh}`];
    const finalFarmCarolRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${fid},${carol.pkh}`];
    const finalFarmAliceCandidate: string =
      qFarm.storage.storage.candidates[`${fid},${alice.pkh}`];
    const finalFarmCarolCandidate: string =
      qFarm.storage.storage.candidates[`${fid},${carol.pkh}`];
    const finalFarmAliceVotes: number =
      qFarm.storage.storage.votes[`${fid},${alice.pkh}`];
    const finalFarmBobVotes: number =
      qFarm.storage.storage.votes[`${fid},${bob.pkh}`];

    strictEqual(finalFarm.current_delegated, bob.pkh);
    strictEqual(finalFarm.next_candidate, alice.pkh);
    strictEqual(
      +finalFarmAliceRecord.prev_staked,
      +initialFarmAliceRecord.prev_staked - amt
    );
    strictEqual(
      +finalFarmCarolRecord.prev_staked,
      +initialFarmCarolRecord.prev_staked + amt
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
    await fa12LP.approve(qFarm.contract.address, depositParams.amt);
    await qFarm.deposit(depositParams);
    await utils.bakeBlocks(5);
    await qFarm.updateStorage({
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
      qFarm.storage.storage.users_info[`${fid},${alice.pkh}`];
    const initialFarmBobRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${fid},${bob.pkh}`];
    const initialFarmCarolRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${fid},${carol.pkh}`];
    const initialFarmAliceVotes: number =
      qFarm.storage.storage.votes[`${fid},${alice.pkh}`];
    const initialFarmBobVotes: number =
      qFarm.storage.storage.votes[`${fid},${bob.pkh}`];

    await qFarm.transfer([transferParams]);
    await qFarm.updateStorage({
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

    const finalFarm: Farm = qFarm.storage.storage.farms[fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${fid},${alice.pkh}`];
    const finalFarmBobRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${fid},${bob.pkh}`];
    const finalFarmCarolRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${fid},${carol.pkh}`];
    const finalFarmAliceCandidate: string =
      qFarm.storage.storage.candidates[`${fid},${alice.pkh}`];
    const finalFarmBobCandidate: string =
      qFarm.storage.storage.candidates[`${fid},${bob.pkh}`];
    const finalFarmCarolCandidate: string =
      qFarm.storage.storage.candidates[`${fid},${carol.pkh}`];
    const finalFarmAliceVotes: number =
      qFarm.storage.storage.votes[`${fid},${alice.pkh}`];
    const finalFarmBobVotes: number =
      qFarm.storage.storage.votes[`${fid},${bob.pkh}`];

    strictEqual(finalFarm.current_delegated, depositParams.candidate);
    strictEqual(finalFarm.next_candidate, bob.pkh);
    strictEqual(
      +finalFarmAliceRecord.prev_staked,
      +initialFarmAliceRecord.prev_staked
    );
    strictEqual(
      +finalFarmBobRecord.prev_staked,
      +initialFarmBobRecord.prev_staked - transferAmt
    );
    strictEqual(
      +finalFarmCarolRecord.prev_staked,
      +initialFarmCarolRecord.prev_staked + transferAmt
    );
    strictEqual(finalFarmCarolCandidate, bob.pkh);
    strictEqual(finalFarmBobCandidate, alice.pkh);
    strictEqual(finalFarmAliceCandidate, bob.pkh);
    strictEqual(+finalFarmAliceVotes, +initialFarmAliceVotes - transferAmt);
    strictEqual(+finalFarmBobVotes, +initialFarmBobVotes + transferAmt);
  });
});
