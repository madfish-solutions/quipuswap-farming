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
  WithdrawFarmDepoParams,
  UpdTokMetaParams,
  PauseFarmParam,
  WithdrawParams,
  DepositParams,
  HarvestParams,
  BanBakerParam,
  WithdrawData,
  UserInfoType,
  IsV1LP,
} from "./types/Common";
import {
  NewRewardPerSecond,
  NewFarmParams,
  SetFeeParams,
  FarmData,
  Farm,
} from "./types/QFarm";
import { UserFA12Info } from "./types/FA12";
import {
  UpdateOperatorParam,
  TransferParam,
  UserFA2LPInfo,
  UserFA2Info,
} from "./types/FA2";

import { MichelsonMap } from "@taquito/michelson-encoder";
import {
  OriginationOperation,
  TransactionOperation,
  VIEW_LAMBDA,
  Contract,
} from "@taquito/taquito";

import { rejects, ok, strictEqual } from "assert";

import { BigNumber } from "bignumber.js";

import { alice, bob, carol, dev } from "../scripts/sandbox/accounts";

import { confirmOperation } from "../scripts/confirmation";

import { fa12Storage } from "../storage/test/FA12";
import { fa2Storage } from "../storage/test/FA2";
import { qFarmStorage } from "../storage/QFarm";
import { burnerStorage } from "../storage/Burner";
import { proxyMinterStorage } from "../storage/ProxyMinter";
import { bakerRegistryStorage } from "../storage/BakerRegistry";
import { qsFA12FactoryStorage } from "../storage/test/QSFA12Factory";
import { qsFA2FactoryStorage } from "../storage/test/QSFA2Factory";

describe("QFarm tests (section 1)", async () => {
  var fa12: FA12;
  var fa12LP: QSFA12Dex;
  var fa2: FA2;
  var fa2LP: QSFA2Dex;
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

    const qsGovLPAddress: string =
      qsFA2Factory.storage.token_to_exchange[`${qsGov.contract.address},${0}`];

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
    qFarmStorage.storage.burner = zeroAddress;
    qFarmStorage.storage.proxy_minter = zeroAddress;
    qFarmStorage.storage.baker_registry = zeroAddress;
    qFarmStorage.storage.farms_count = 0;

    qFarm = await QFarm.originate(utils.tezos, qFarmStorage);

    await qFarm.setLambdas();
    await proxyMinter.addMinter(qFarm.contract.address, true);

    const transferOperation: TransactionOperation =
      await utils.tezos.contract.transfer({
        to: carol.pkh,
        amount: 50_000_000,
        mutez: true,
      });

    await confirmOperation(utils.tezos, transferOperation.hash);
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
    const params: NewRewardPerSecond[] = [
      { fid: 0, reward_per_second: 100 * precision },
    ];

    await utils.setProvider(alice.sk);
    await rejects(qFarm.setRewardPerSecond(params), (err: Error) => {
      ok(err.message === "Not-admin");

      return true;
    });
  });

  it("should fail if one farm from list of farms not found", async () => {
    const params: NewRewardPerSecond[] = [
      { fid: 0, reward_per_second: 100 * precision },
    ];

    await utils.setProvider(bob.sk);
    await rejects(qFarm.setRewardPerSecond(params), (err: Error) => {
      ok(err.message === "QSystem/farm-not-set");

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

  it("should fail if not admin is trying to set `is_v1_lp`", async () => {
    const params: IsV1LP = {
      fid: 0,
      is_v1_lp: true,
    };

    await utils.setProvider(alice.sk);
    await rejects(qFarm.setIsV1LP(params), (err: Error) => {
      ok(err.message === "Not-admin");

      return true;
    });
  });

  it("should fail if farm not found", async () => {
    const params: IsV1LP = {
      fid: 666,
      is_v1_lp: true,
    };

    await utils.setProvider(bob.sk);
    await rejects(qFarm.setIsV1LP(params), (err: Error) => {
      ok(err.message === "QSystem/farm-not-set");

      return true;
    });
  });

  it("should fail if not admin is trying to ban baker", async () => {
    const banParams: BanBakerParam[] = [{ baker: alice.pkh, period: 60 }];

    await utils.setProvider(alice.sk);
    await rejects(qFarm.banBakers(banParams), (err: Error) => {
      ok(err.message === "Not-admin");

      return true;
    });
  });

  it("should ban one baker", async () => {
    const banParams: BanBakerParam[] = [{ baker: alice.pkh, period: 60 }];

    await utils.setProvider(bob.sk);
    await qFarm.banBakers(banParams);
    await qFarm.updateStorage({ banned_bakers: [alice.pkh] });

    strictEqual(
      +qFarm.storage.storage.banned_bakers[alice.pkh].period,
      banParams[0].period
    );

    ok(
      Date.parse(qFarm.storage.storage.banned_bakers[alice.pkh].start) <=
        Date.parse((await utils.tezos.rpc.getBlockHeader()).timestamp)
    );
  });

  it("should unban one baker", async () => {
    const banParams: BanBakerParam[] = [{ baker: alice.pkh, period: 0 }];

    await qFarm.banBakers(banParams);
    await qFarm.updateStorage({ banned_bakers: [alice.pkh] });

    strictEqual(+qFarm.storage.storage.banned_bakers[alice.pkh].period, 0);

    ok(
      Date.parse(qFarm.storage.storage.banned_bakers[alice.pkh].start) <=
        Date.parse((await utils.tezos.rpc.getBlockHeader()).timestamp)
    );
  });

  it("should ban group of bakers", async () => {
    const banParams: BanBakerParam[] = [
      { baker: alice.pkh, period: 120 },
      { baker: bob.pkh, period: 60 },
    ];

    await qFarm.banBakers(banParams);
    await qFarm.updateStorage({ banned_bakers: [alice.pkh, bob.pkh] });

    for (let i = 0; i < banParams.length; ++i) {
      strictEqual(
        +qFarm.storage.storage.banned_bakers[banParams[i].baker].period,
        banParams[i].period
      );

      ok(
        Date.parse(
          qFarm.storage.storage.banned_bakers[banParams[i].baker].start
        ) <= Date.parse((await utils.tezos.rpc.getBlockHeader()).timestamp)
      );
    }
  });

  it("should unban group of bakers", async () => {
    const banParams: BanBakerParam[] = [
      { baker: alice.pkh, period: 0 },
      { baker: bob.pkh, period: 0 },
    ];

    await qFarm.banBakers(banParams);
    await qFarm.updateStorage({ banned_bakers: [alice.pkh, bob.pkh] });

    for (let i = 0; i < banParams.length; ++i) {
      strictEqual(
        +qFarm.storage.storage.banned_bakers[banParams[i].baker].period,
        0
      );

      ok(
        Date.parse(
          qFarm.storage.storage.banned_bakers[banParams[i].baker].start
        ) <= Date.parse((await utils.tezos.rpc.getBlockHeader()).timestamp)
      );
    }
  });

  it("should ban/unban group of bakers", async () => {
    const banParams: BanBakerParam[] = [
      { baker: alice.pkh, period: 5 },
      { baker: bob.pkh, period: 5 },
      { baker: carol.pkh, period: 120 },
      { baker: alice.pkh, period: 0 },
    ];

    await qFarm.banBakers(banParams);
    await qFarm.updateStorage({
      banned_bakers: [alice.pkh, bob.pkh, carol.pkh],
    });

    for (let i = 1; i < banParams.length - 1; ++i) {
      strictEqual(
        +qFarm.storage.storage.banned_bakers[banParams[i].baker].period,
        banParams[i].period
      );

      ok(
        Date.parse(
          qFarm.storage.storage.banned_bakers[banParams[i].baker].start
        ) <= Date.parse((await utils.tezos.rpc.getBlockHeader()).timestamp)
      );
    }

    strictEqual(+qFarm.storage.storage.banned_bakers[alice.pkh].period, 0);

    ok(
      Date.parse(qFarm.storage.storage.banned_bakers[alice.pkh].start) <=
        Date.parse((await utils.tezos.rpc.getBlockHeader()).timestamp)
    );
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

  it("should transfer received TEZ to the burner, swap for QUIPU and burn them (1)", async () => {
    await qsGov.updateStorage({
      account_info: [zeroAddress],
    });

    const initialQsGovZeroRecord: UserFA2Info =
      qsGov.storage.account_info[zeroAddress];
    const initialBalance: number =
      initialQsGovZeroRecord === undefined
        ? 0
        : +(await initialQsGovZeroRecord.balances.get("0"));
    const operation = await utils.tezos.contract.transfer({
      to: qFarm.contract.address,
      amount: 500,
      mutez: true,
    });

    await confirmOperation(utils.tezos, operation.hash);
    await qsGov.updateStorage({
      account_info: [zeroAddress],
    });

    const finalQsGovZeroRecord: UserFA2Info =
      qsGov.storage.account_info[zeroAddress];

    ok(+(await finalQsGovZeroRecord.balances.get("0")) > initialBalance);
  });

  it("should transfer received TEZ to the burner, swap for QUIPU and burn them (2)", async () => {
    await qsGov.updateStorage({
      account_info: [zeroAddress],
    });

    const initialQsGovZeroRecord: UserFA2Info =
      qsGov.storage.account_info[zeroAddress];

    await qFarm.default(1000);
    await qsGov.updateStorage({
      account_info: [zeroAddress],
    });

    const finalQsGovZeroRecord: UserFA2Info =
      qsGov.storage.account_info[zeroAddress];

    ok(
      +(await finalQsGovZeroRecord.balances.get("0")) >
        +(await initialQsGovZeroRecord.balances.get("0"))
    );
  });

  it("should add new farm by admin and set all farm's fields correctly", async () => {
    let newFarmParams: NewFarmParams = await QFarmUtils.getMockNewFarmParams(
      utils
    );

    newFarmParams.fees.harvest_fee = 10 * feePrecision;
    newFarmParams.fees.withdrawal_fee = 15 * feePrecision;
    newFarmParams.fees.burn_reward = 23 * feePrecision;
    newFarmParams.stake_params.staked_token = { fA12: fa12.contract.address };
    newFarmParams.reward_per_second = 100 * precision;
    newFarmParams.timelock = 10;
    newFarmParams.token_info = MichelsonMap.fromLiteral({
      name: Buffer.from("HELLO").toString("hex"),
      symbol: Buffer.from("WORLD").toString("hex"),
      decimals: Buffer.from("2021").toString("hex"),
    });

    await utils.setProvider(bob.sk);
    await qFarm.addNewFarm(newFarmParams);
    await qFarm.updateStorage({ farms: [0], token_metadata: [0] });

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
      +qFarm.storage.storage.farms[0].fees.burn_reward,
      newFarmParams.fees.burn_reward
    );
    strictEqual(
      qFarm.storage.storage.farms[0].stake_params.staked_token.fA12,
      newFarmParams.stake_params.staked_token.fA12
    );
    strictEqual(
      qFarm.storage.storage.farms[0].stake_params.is_v1_lp,
      newFarmParams.stake_params.is_v1_lp
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
    strictEqual(qFarm.storage.storage.farms[0].next_candidate, zeroAddress);
    strictEqual(qFarm.storage.storage.farms[0].paused, newFarmParams.paused);
    strictEqual(
      +qFarm.storage.storage.farms[0].reward_per_second,
      newFarmParams.reward_per_second
    );
    strictEqual(+qFarm.storage.storage.farms[0].reward_per_share, 0);
    strictEqual(+qFarm.storage.storage.farms[0].staked, 0);
    strictEqual(+qFarm.storage.storage.farms[0].claimed, 0);
    strictEqual(+qFarm.storage.storage.farms[0].fid, 0);
    strictEqual(
      Buffer.from(
        await qFarm.storage.storage.token_metadata[0].token_info.get("name"),
        "hex"
      ).toString(),
      "HELLO"
    );
    strictEqual(
      Buffer.from(
        await qFarm.storage.storage.token_metadata[0].token_info.get("symbol"),
        "hex"
      ).toString(),
      "WORLD"
    );
    strictEqual(
      Buffer.from(
        await qFarm.storage.storage.token_metadata[0].token_info.get(
          "decimals"
        ),
        "hex"
      ).toString(),
      "2021"
    );

    ok(
      Date.parse(qFarm.storage.storage.farms[0].upd) >=
        +newFarmParams.start_time * 1000
    );
    ok(
      Date.parse(qFarm.storage.storage.farms[0].start_time) >=
        +newFarmParams.start_time * 1000
    );
  });

  it("should change `is_v1_lp` by admin", async () => {
    let params: IsV1LP = {
      fid: 0,
      is_v1_lp: true,
    };

    await qFarm.setIsV1LP(params);
    await qFarm.updateStorage({
      farms: [0],
    });

    strictEqual(
      qFarm.storage.storage.farms[0].stake_params.is_v1_lp,
      params.is_v1_lp
    );

    params.is_v1_lp = false;

    await qFarm.setIsV1LP(params);
  });

  it("should fail if not admit is trying to update token metadata", async () => {
    const params: UpdTokMetaParams = {
      token_id: 0,
      token_info: [{ key: "A", value: Buffer.from("B").toString("hex") }],
    };

    await utils.setProvider(alice.sk);
    await rejects(qFarm.updateTokenMetadata(params), (err: Error) => {
      ok(err.message === "Not-admin");

      return true;
    });
  });

  it("should fail if farm not found", async () => {
    const params: UpdTokMetaParams = {
      token_id: 666,
      token_info: [{ key: "A", value: Buffer.from("B").toString("hex") }],
    };

    await utils.setProvider(bob.sk);
    await rejects(qFarm.updateTokenMetadata(params), (err: Error) => {
      ok(err.message === "QSystem/farm-not-set");

      return true;
    });
  });

  it("should update token metadata", async () => {
    const params: UpdTokMetaParams = {
      token_id: 0,
      token_info: [
        { key: "A", value: Buffer.from("B").toString("hex") },
        { key: "name", value: Buffer.from("TEST").toString("hex") },
        { key: "decimals", value: Buffer.from("8").toString("hex") },
      ],
    };

    await qFarm.updateTokenMetadata(params);
    await qFarm.updateStorage({ token_metadata: [0] });

    strictEqual(
      Buffer.from(
        await qFarm.storage.storage.token_metadata[0].token_info.get("A"),
        "hex"
      ).toString(),
      "B"
    );
    strictEqual(
      Buffer.from(
        await qFarm.storage.storage.token_metadata[0].token_info.get("name"),
        "hex"
      ).toString(),
      "TEST"
    );
    strictEqual(
      Buffer.from(
        await qFarm.storage.storage.token_metadata[0].token_info.get("symbol"),
        "hex"
      ).toString(),
      "WORLD"
    );
    strictEqual(
      Buffer.from(
        await qFarm.storage.storage.token_metadata[0].token_info.get(
          "decimals"
        ),
        "hex"
      ).toString(),
      "8"
    );
  });

  it("should fail if farm not found", async () => {
    const params: TransferParam[] = [
      {
        from_: alice.pkh,
        txs: [{ to_: bob.pkh, token_id: 666, amount: 0 }],
      },
    ];

    await rejects(qFarm.transfer(params), (err: Error) => {
      ok(err.message === "QSystem/farm-not-set");

      return true;
    });
  });

  it("should fail if transfer destination address is equal to contract address", async () => {
    const params: TransferParam[] = [
      {
        from_: alice.pkh,
        txs: [{ to_: qFarm.contract.address, token_id: 0, amount: 0 }],
      },
    ];

    await rejects(qFarm.transfer(params), (err: Error) => {
      ok(err.message === "FA2_ILLEGAL_TRANSFER");

      return true;
    });
  });

  it("should fail if not operator is trying to transfer tokens", async () => {
    const params: TransferParam[] = [
      {
        from_: alice.pkh,
        txs: [{ to_: bob.pkh, token_id: 0, amount: 0 }],
      },
    ];

    await rejects(qFarm.transfer(params), (err: Error) => {
      ok(err.message === "FA2_NOT_OPERATOR");

      return true;
    });
  });

  it("should fail if insufficient balance", async () => {
    const params: TransferParam[] = [
      {
        from_: alice.pkh,
        txs: [{ to_: bob.pkh, token_id: 0, amount: 100_000_000 }],
      },
    ];

    await utils.setProvider(alice.sk);
    await rejects(qFarm.transfer(params), (err: Error) => {
      ok(err.message === "FA2_INSUFFICIENT_BALANCE");

      return true;
    });
  });

  it("should fail if one transaction from a group fails", async () => {
    const params: TransferParam[] = [
      {
        from_: alice.pkh,
        txs: [
          { to_: bob.pkh, token_id: 0, amount: 10 },
          { to_: carol.pkh, token_id: 0, amount: 10 },
        ],
      },
      {
        from_: bob.pkh,
        txs: [{ to_: bob.pkh, token_id: 0, amount: 100 }],
      },
    ];

    await rejects(qFarm.transfer(params), (err: Error) => {
      ok(err.message === "FA2_INSUFFICIENT_BALANCE");

      return true;
    });
  });

  it("should fail if not owner is trying to add operator", async () => {
    const params: UpdateOperatorParam[] = [
      {
        add_operator: {
          owner: bob.pkh,
          operator: qFarm.contract.address,
          token_id: 0,
        },
      },
    ];

    await rejects(qFarm.updateOperators(params), (err: Error) => {
      ok(err.message === "FA2_NOT_OWNER");

      return true;
    });
  });

  it("should fail if not owner is trying to remove operator", async () => {
    const params: UpdateOperatorParam[] = [
      {
        remove_operator: {
          owner: bob.pkh,
          operator: qFarm.contract.address,
          token_id: 0,
        },
      },
    ];

    await rejects(qFarm.updateOperators(params), (err: Error) => {
      ok(err.message === "FA2_NOT_OWNER");

      return true;
    });
  });

  it("should fail if one transaction from a group fails", async () => {
    const params: UpdateOperatorParam[] = [
      {
        add_operator: {
          owner: alice.pkh,
          operator: qFarm.contract.address,
          token_id: 0,
        },
      },
      {
        remove_operator: {
          owner: bob.pkh,
          operator: qFarm.contract.address,
          token_id: 0,
        },
      },
    ];

    await rejects(qFarm.updateOperators(params), (err: Error) => {
      ok(err.message === "FA2_NOT_OWNER");

      return true;
    });
  });

  it("should add operator", async () => {
    const params: UpdateOperatorParam[] = [
      {
        add_operator: {
          owner: alice.pkh,
          operator: qFarm.contract.address,
          token_id: 0,
        },
      },
    ];

    await qFarm.updateOperators(params);
    await qFarm.updateStorage({ users_info: [[0, alice.pkh]] });

    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${0},${alice.pkh}`];

    strictEqual(finalFarmAliceRecord.allowances.length, 1);
    strictEqual(finalFarmAliceRecord.allowances[0], qFarm.contract.address);
  });

  it("should remove operator", async () => {
    const params: UpdateOperatorParam[] = [
      {
        remove_operator: {
          owner: alice.pkh,
          operator: qFarm.contract.address,
          token_id: 0,
        },
      },
    ];

    await qFarm.updateOperators(params);
    await qFarm.updateStorage({ users_info: [[0, alice.pkh]] });

    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${0},${alice.pkh}`];

    strictEqual(finalFarmAliceRecord.allowances.length, 0);
  });

  it("should add/remove operators per one transation", async () => {
    const params: UpdateOperatorParam[] = [
      {
        add_operator: {
          owner: alice.pkh,
          operator: qFarm.contract.address,
          token_id: 0,
        },
      },
      {
        remove_operator: {
          owner: alice.pkh,
          operator: qFarm.contract.address,
          token_id: 0,
        },
      },
      {
        add_operator: {
          owner: alice.pkh,
          operator: bob.pkh,
          token_id: 0,
        },
      },
    ];

    await qFarm.updateOperators(params);
    await qFarm.updateStorage({ users_info: [[0, alice.pkh]] });

    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${0},${alice.pkh}`];

    strictEqual(finalFarmAliceRecord.allowances.length, 1);
    strictEqual(finalFarmAliceRecord.allowances[0], bob.pkh);
  });

  it("should fail if not admin is trying to set fees", async () => {
    const fees: SetFeeParams[] = [
      {
        fid: 0,
        fees: {
          harvest_fee: 15 * feePrecision,
          withdrawal_fee: 10 * feePrecision,
          burn_reward: 10 * feePrecision,
        },
      },
    ];

    await utils.setProvider(alice.sk);
    await rejects(qFarm.setFees(fees), (err: Error) => {
      ok(err.message === "Not-admin");

      return true;
    });
  });

  it("should fail if one farm from list of farms not found", async () => {
    const fees: SetFeeParams[] = [
      {
        fid: 0,
        fees: {
          harvest_fee: 15 * feePrecision,
          withdrawal_fee: 10 * feePrecision,
          burn_reward: 23 * feePrecision,
        },
      },
      {
        fid: 666,
        fees: {
          harvest_fee: 15 * feePrecision,
          withdrawal_fee: 10 * feePrecision,
          burn_reward: 23 * feePrecision,
        },
      },
    ];

    await utils.setProvider(bob.sk);
    await rejects(qFarm.setFees(fees), (err: Error) => {
      ok(err.message === "QSystem/farm-not-set");

      return true;
    });
  });

  it("should set/update fees for one farm", async () => {
    const fees: SetFeeParams[] = [
      {
        fid: 0,
        fees: {
          harvest_fee: 1 * feePrecision,
          withdrawal_fee: 5 * feePrecision,
          burn_reward: 3 * feePrecision,
        },
      },
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
    strictEqual(
      +qFarm.storage.storage.farms[0].fees.burn_reward,
      fees[0].fees.burn_reward
    );
  });

  it("should set/update fees for group of farms", async () => {
    const fees: SetFeeParams[] = [
      {
        fid: 0,
        fees: {
          harvest_fee: 16 * feePrecision,
          withdrawal_fee: 21 * feePrecision,
          burn_reward: 25 * feePrecision,
        },
      },
      {
        fid: 1,
        fees: {
          harvest_fee: 5 * feePrecision,
          withdrawal_fee: 25 * feePrecision,
          burn_reward: 15 * feePrecision,
        },
      },
      {
        fid: 2,
        fees: {
          harvest_fee: 3 * feePrecision,
          withdrawal_fee: 3 * feePrecision,
          burn_reward: 1 * feePrecision,
        },
      },
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
      strictEqual(
        +qFarm.storage.storage.farms[i].fees.burn_reward,
        fees[i].fees.burn_reward
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
      ok(err.message === "QSystem/farm-not-set");

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
    const params: NewRewardPerSecond[] = [
      { fid: 0, reward_per_second: 100 * precision },
    ];

    await qFarm.setRewardPerSecond(params);
    await qFarm.updateStorage({ farms: [0] });

    strictEqual(
      +qFarm.storage.storage.farms[0].reward_per_second,
      params[0].reward_per_second
    );
  });

  it("should set reward per second for group of farms", async () => {
    const params: NewRewardPerSecond[] = [
      { fid: 0, reward_per_second: 100 * precision },
      { fid: 1, reward_per_second: 50 * precision },
      { fid: 2, reward_per_second: 250 * precision },
    ];

    await qFarm.setRewardPerSecond(params);
    await qFarm.updateStorage({ farms: [0, 1, 2] });

    for (let i = 0; i < params.length; ++i) {
      strictEqual(
        +qFarm.storage.storage.farms[params[0].fid].reward_per_second,
        params[0].reward_per_second
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
      ok(err.message === "QSystem/farm-not-set");

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
    const initialTokenAliceRecord: UserFA12Info =
      fa12.storage.ledger[alice.pkh];
    const initialTokenFarmRecord: UserFA12Info =
      fa12.storage.ledger[qFarm.contract.address];

    await fa12.approve(qFarm.contract.address, depositParams.amt);
    await qFarm.deposit(depositParams);
    await qFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await fa12.updateStorage({
      ledger: [qFarm.contract.address, alice.pkh],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const finalTokenAliceRecord: UserFA12Info = fa12.storage.ledger[alice.pkh];
    const finalTokenFarmRecord: UserFA12Info =
      fa12.storage.ledger[qFarm.contract.address];

    strictEqual(+finalFarm.staked, +initialFarm.staked + depositParams.amt);
    strictEqual(+finalFarm.claimed, +initialFarm.claimed);
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

    newFarmParams.fees.harvest_fee = 4.2 * feePrecision;
    newFarmParams.fees.withdrawal_fee = 5 * feePrecision;
    newFarmParams.fees.burn_reward = 6 * feePrecision;
    newFarmParams.stake_params.staked_token = { fA12: fa12LP.contract.address };
    newFarmParams.stake_params.is_v1_lp = true;
    newFarmParams.reward_per_second = 200 * precision;
    newFarmParams.timelock = 0;

    await utils.setProvider(bob.sk);
    await qFarm.addNewFarm(newFarmParams);
    await utils.setProvider(alice.sk);

    const depositParams: DepositParams = {
      fid: 4,
      amt: 100,
      referrer: undefined,
      rewards_receiver: carol.pkh,
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
      farms: [depositParams.fid],
    });
    await fa12LP.updateStorage({
      ledger: [qFarm.contract.address, alice.pkh],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const finalTokenAliceRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[alice.pkh];
    const finalTokenFarmRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[qFarm.contract.address];

    strictEqual(+finalFarm.staked, depositParams.amt);
    strictEqual(+finalFarm.claimed, 0);
    strictEqual(+finalFarmAliceRecord.staked, depositParams.amt);
    strictEqual(
      +finalTokenAliceRecord.balance,
      +initialTokenAliceRecord.balance - depositParams.amt
    );
    strictEqual(+finalTokenFarmRecord.balance, 0);
    strictEqual(+finalTokenFarmRecord.frozen_balance, depositParams.amt);
  });

  it("should fail if user's candidate for voting is banned (only for LP farms)", async () => {
    const banParams: BanBakerParam[] = [{ baker: alice.pkh, period: 5 }];

    await utils.setProvider(bob.sk);
    await qFarm.banBakers(banParams);

    const depositParams: DepositParams = {
      fid: 4,
      amt: 500,
      referrer: bob.pkh,
      rewards_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await utils.setProvider(alice.sk);
    await rejects(qFarm.deposit(depositParams), (err: Error) => {
      ok(err.message === "QFarm/baker-is-banned");

      return true;
    });
  });

  it("should deposit single FA2 token", async () => {
    let newFarmParams: NewFarmParams = await QFarmUtils.getMockNewFarmParams(
      utils
    );

    newFarmParams.fees.harvest_fee = 6 * feePrecision;
    newFarmParams.fees.withdrawal_fee = 6 * feePrecision;
    newFarmParams.fees.burn_reward = 6 * feePrecision;
    newFarmParams.stake_params.staked_token = {
      fA2: { token: fa2.contract.address, id: 0 },
    };
    newFarmParams.reward_per_second = 10 * precision;
    newFarmParams.timelock = 0;

    await utils.setProvider(bob.sk);
    await qFarm.addNewFarm(newFarmParams);
    await utils.setProvider(alice.sk);

    const depositParams: DepositParams = {
      fid: 5,
      amt: 1000,
      referrer: undefined,
      rewards_receiver: carol.pkh,
      candidate: zeroAddress,
    };

    await qFarm.updateStorage({
      farms: [depositParams.fid],
    });
    await fa2.updateStorage({
      account_info: [alice.pkh],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const initialTokenAliceRecord: UserFA2Info =
      fa2.storage.account_info[alice.pkh];
    const updateOperatorParam: UpdateOperatorParam = {
      add_operator: {
        owner: alice.pkh,
        operator: qFarm.contract.address,
        token_id: 0,
      },
    };

    await fa2.updateOperators([updateOperatorParam]);
    await qFarm.deposit(depositParams);
    await qFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await fa2.updateStorage({
      account_info: [qFarm.contract.address, alice.pkh],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const finalTokenAliceRecord: UserFA2Info =
      fa2.storage.account_info[alice.pkh];
    const finalTokenFarmRecord: UserFA2Info =
      fa2.storage.account_info[qFarm.contract.address];

    strictEqual(+finalFarm.staked, +initialFarm.staked + depositParams.amt);
    strictEqual(+finalFarm.claimed, +initialFarm.claimed);
    strictEqual(+finalFarmAliceRecord.staked, depositParams.amt);
    strictEqual(
      +(await finalTokenAliceRecord.balances.get("0")),
      +(await initialTokenAliceRecord.balances.get("0")) - depositParams.amt
    );
    strictEqual(
      +(await finalTokenFarmRecord.balances.get("0")),
      depositParams.amt
    );
  });

  it("should deposit LP FA2 token", async () => {
    let newFarmParams: NewFarmParams = await QFarmUtils.getMockNewFarmParams(
      utils
    );

    newFarmParams.fees.harvest_fee = 12 * feePrecision;
    newFarmParams.fees.withdrawal_fee = 23 * feePrecision;
    newFarmParams.fees.burn_reward = 18 * feePrecision;
    newFarmParams.stake_params.staked_token = {
      fA2: { token: fa2LP.contract.address, id: 0 },
    };
    newFarmParams.stake_params.is_v1_lp = true;
    newFarmParams.timelock = 0;

    await utils.setProvider(bob.sk);
    await qFarm.addNewFarm(newFarmParams);
    await utils.setProvider(alice.sk);

    const depositParams: DepositParams = {
      fid: 6,
      amt: 100,
      referrer: undefined,
      rewards_receiver: carol.pkh,
      candidate: bob.pkh,
    };

    await fa2LP.updateStorage({
      ledger: [alice.pkh],
    });

    const initialTokenAliceRecord: UserFA2LPInfo =
      fa2LP.storage.storage.ledger[alice.pkh];
    const updateOperatorParam: UpdateOperatorParam = {
      add_operator: {
        owner: alice.pkh,
        operator: qFarm.contract.address,
        token_id: 0,
      },
    };

    await fa2LP.updateOperators([updateOperatorParam]);
    await qFarm.deposit(depositParams);
    await qFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await fa2LP.updateStorage({
      ledger: [qFarm.contract.address, alice.pkh],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const finalTokenAliceRecord: UserFA2LPInfo =
      fa2LP.storage.storage.ledger[alice.pkh];
    const finalTokenFarmRecord: UserFA2LPInfo =
      fa2LP.storage.storage.ledger[qFarm.contract.address];

    strictEqual(+finalFarm.staked, depositParams.amt);
    strictEqual(+finalFarm.claimed, 0);
    strictEqual(+finalFarmAliceRecord.staked, depositParams.amt);
    strictEqual(
      +finalTokenAliceRecord.balance,
      +initialTokenAliceRecord.balance - depositParams.amt
    );
    strictEqual(+finalTokenFarmRecord.balance, 0);
    strictEqual(+finalTokenFarmRecord.frozen_balance, depositParams.amt);
  });

  it("should claim user's rewards (in farms without timelock)", async () => {
    const depositParams: DepositParams = {
      fid: 5,
      amt: 1000,
      referrer: undefined,
      rewards_receiver: alice.pkh,
      candidate: zeroAddress,
    };

    await qFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, bob.pkh],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const initialQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const initialQsGovBobRecord: UserFA2Info =
      qsGov.storage.account_info[bob.pkh];

    await qFarm.deposit(depositParams);
    await qFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, bob.pkh],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const finalQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const finalQsGovBobRecord: UserFA2Info =
      qsGov.storage.account_info[bob.pkh];
    const res: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmAliceRecord,
      finalFarmAliceRecord,
      precision
    );

    ok(finalFarmAliceRecord.last_staked > initialFarmAliceRecord.last_staked);
    ok(finalFarm.upd > initialFarm.upd);
    ok(
      new BigNumber(+finalFarm.claimed).isEqualTo(
        new BigNumber(+initialFarm.claimed)
          .plus(res.actualUserEarned)
          .plus(res.referralCommission)
      )
    );
    ok(
      new BigNumber(finalFarm.reward_per_share).isEqualTo(
        res.expectedShareReward
      )
    );
    ok(
      new BigNumber(finalFarmAliceRecord.prev_earned).isEqualTo(
        res.expectedUserPrevEarned
      )
    );
    ok(new BigNumber(finalFarmAliceRecord.earned).isEqualTo(0));
    ok(
      new BigNumber(+(await finalQsGovAliceRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovAliceRecord.balances.get("0"))).plus(
          res.actualUserEarned
        )
      )
    );
    ok(
      new BigNumber(+(await finalQsGovBobRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovBobRecord.balances.get("0"))).plus(
          res.referralCommission
        )
      )
    );
  });

  it("should claim user's rewards if timelock is finished (in farms with timelock)", async () => {
    const depositParams: DepositParams = {
      fid: 0,
      amt: 1000,
      referrer: zeroAddress,
      rewards_receiver: alice.pkh,
      candidate: zeroAddress,
    };

    await qFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, bob.pkh],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const initialQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const initialQsGovBobRecord: UserFA2Info =
      qsGov.storage.account_info[bob.pkh];

    await fa12.approve(qFarm.contract.address, depositParams.amt);
    await qFarm.deposit(depositParams);
    await qFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, bob.pkh],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const finalQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const finalQsGovBobRecord: UserFA2Info =
      qsGov.storage.account_info[bob.pkh];
    const res: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmAliceRecord,
      finalFarmAliceRecord,
      precision
    );

    ok(finalFarmAliceRecord.last_staked > initialFarmAliceRecord.last_staked);
    ok(finalFarm.upd > initialFarm.upd);
    ok(
      new BigNumber(+finalFarm.claimed).isEqualTo(
        new BigNumber(+initialFarm.claimed)
          .plus(res.actualUserEarned)
          .plus(res.referralCommission)
      )
    );
    ok(
      new BigNumber(finalFarm.reward_per_share).isEqualTo(
        res.expectedShareReward
      )
    );
    ok(
      new BigNumber(finalFarmAliceRecord.prev_earned).isEqualTo(
        res.expectedUserPrevEarned
      )
    );
    ok(
      new BigNumber(finalFarmAliceRecord.earned).isEqualTo(
        res.expectedUserEarnedAfterHarvest
      )
    );
    ok(
      new BigNumber(+(await finalQsGovAliceRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovAliceRecord.balances.get("0"))).plus(
          res.actualUserEarned
        )
      )
    );
    ok(
      new BigNumber(+(await finalQsGovBobRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovBobRecord.balances.get("0"))).plus(
          res.referralCommission
        )
      )
    );
  });

  it("should not claim user's rewards if timelock is not finished (in farms with timelock)", async () => {
    const depositParams: DepositParams = {
      fid: 0,
      amt: 1000,
      referrer: undefined,
      rewards_receiver: alice.pkh,
      candidate: zeroAddress,
    };

    await qFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const initialQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];

    await fa12.approve(qFarm.contract.address, depositParams.amt);
    await qFarm.deposit(depositParams);
    await qFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const finalQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const res: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmAliceRecord,
      finalFarmAliceRecord,
      precision
    );

    strictEqual(+finalFarm.claimed, +initialFarm.claimed);

    ok(finalFarmAliceRecord.last_staked > initialFarmAliceRecord.last_staked);
    ok(finalFarm.upd > initialFarm.upd);
    ok(
      new BigNumber(finalFarm.reward_per_share).isEqualTo(
        res.expectedShareReward
      )
    );
    ok(
      new BigNumber(finalFarmAliceRecord.prev_earned).isEqualTo(
        res.expectedUserPrevEarned
      )
    );
    ok(
      new BigNumber(finalFarmAliceRecord.earned).isEqualTo(
        res.expectedUserEarned
      )
    );
    ok(
      new BigNumber(+(await finalQsGovAliceRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovAliceRecord.balances.get("0")))
      )
    );
  });

  it("should mint QS GOV tokens as reward to rewards receiver", async () => {
    const depositParams: DepositParams = {
      fid: 5,
      amt: 1000,
      referrer: undefined,
      rewards_receiver: dev.pkh,
      candidate: zeroAddress,
    };

    await qFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [zeroAddress],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const initialQsGovZeroRecord: UserFA2Info =
      qsGov.storage.account_info[zeroAddress];

    await qFarm.deposit(depositParams);
    await qFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [dev.pkh, zeroAddress],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const finalQsGovZeroRecord: UserFA2Info =
      qsGov.storage.account_info[zeroAddress];
    const finalQsGovDevRecord: UserFA2Info =
      qsGov.storage.account_info[dev.pkh];
    const res: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmAliceRecord,
      finalFarmAliceRecord,
      precision
    );

    ok(
      new BigNumber(+finalFarm.claimed).isEqualTo(
        new BigNumber(+initialFarm.claimed)
          .plus(res.actualUserEarned)
          .plus(res.referralCommission)
      )
    );
    ok(
      new BigNumber(+(await finalQsGovDevRecord.balances.get("0"))).isEqualTo(
        res.actualUserEarned
      )
    );
    ok(
      new BigNumber(+(await finalQsGovZeroRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovZeroRecord.balances.get("0"))).plus(
          res.referralCommission
        )
      )
    );
  });

  it("should mint QS GOV tokens as harvest fee to zero address (in case when user does not have referrer)", async () => {
    const depositParams: DepositParams = {
      fid: 5,
      amt: 1000,
      referrer: carol.pkh,
      rewards_receiver: alice.pkh,
      candidate: zeroAddress,
    };

    await qFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, zeroAddress],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const initialQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const initialQsGovZeroRecord: UserFA2Info =
      qsGov.storage.account_info[zeroAddress];

    await qFarm.deposit(depositParams);
    await qFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, zeroAddress],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const finalQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const finalQsGovZeroRecord: UserFA2Info =
      qsGov.storage.account_info[zeroAddress];
    const res: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmAliceRecord,
      finalFarmAliceRecord,
      precision
    );

    ok(
      new BigNumber(+finalFarm.claimed).isEqualTo(
        new BigNumber(+initialFarm.claimed)
          .plus(res.actualUserEarned)
          .plus(res.referralCommission)
      )
    );
    ok(
      new BigNumber(+(await finalQsGovAliceRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovAliceRecord.balances.get("0"))).plus(
          res.actualUserEarned
        )
      )
    );
    ok(
      new BigNumber(+(await finalQsGovZeroRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovZeroRecord.balances.get("0"))).plus(
          res.referralCommission
        )
      )
    );
  });

  it("should mint QS GOV tokens as harvest fee to referrer (in case when user have referrer)", async () => {
    const depositParams: DepositParams = {
      fid: 5,
      amt: 1000,
      referrer: undefined,
      rewards_receiver: alice.pkh,
      candidate: zeroAddress,
    };

    await utils.bakeBlocks(5);
    await qFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const initialQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];

    await qFarm.deposit(depositParams);
    await qFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, carol.pkh],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const finalQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const finalQsGovCarolRecord: UserFA2Info =
      qsGov.storage.account_info[carol.pkh];
    const res: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmAliceRecord,
      finalFarmAliceRecord,
      precision
    );

    ok(
      new BigNumber(+finalFarm.claimed).isEqualTo(
        new BigNumber(+initialFarm.claimed)
          .plus(res.actualUserEarned)
          .plus(res.referralCommission)
      )
    );
    ok(
      new BigNumber(+(await finalQsGovAliceRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovAliceRecord.balances.get("0"))).plus(
          res.actualUserEarned
        )
      )
    );
    ok(
      new BigNumber(+(await finalQsGovCarolRecord.balances.get("0"))).isEqualTo(
        res.referralCommission
      )
    );
  });

  it("should calculate and mint QS GOV tokens as harvest fee with decimals (like 4.2%)", async () => {
    const depositParams: DepositParams = {
      fid: 4,
      amt: 1000,
      referrer: undefined,
      rewards_receiver: alice.pkh,
      candidate: bob.pkh,
    };

    await qFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, carol.pkh],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const initialQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const initialQsGovCarolRecord: UserFA2Info =
      qsGov.storage.account_info[carol.pkh];

    await fa12LP.approve(qFarm.contract.address, depositParams.amt);
    await qFarm.deposit(depositParams);
    await qFarm.updateStorage({
      users_info: [[depositParams.fid, alice.pkh]],
      farms: [depositParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, carol.pkh],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${alice.pkh}`];
    const finalQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const finalQsGovCarolRecord: UserFA2Info =
      qsGov.storage.account_info[carol.pkh];
    const res: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmAliceRecord,
      finalFarmAliceRecord,
      precision
    );

    ok(
      new BigNumber(+finalFarm.claimed).isEqualTo(
        new BigNumber(+initialFarm.claimed)
          .plus(res.actualUserEarned)
          .plus(res.referralCommission)
      )
    );
    ok(
      new BigNumber(+(await finalQsGovAliceRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovAliceRecord.balances.get("0"))).plus(
          res.actualUserEarned
        )
      )
    );
    ok(
      new BigNumber(+(await finalQsGovCarolRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovCarolRecord.balances.get("0"))).plus(
          res.referralCommission
        )
      )
    );
  });

  it("should vote for the baker if LP token is deposited", async () => {
    const transferAmt: number = 3000;
    const depositParams: DepositParams = {
      fid: 4,
      amt: transferAmt / 2,
      referrer: bob.pkh,
      rewards_receiver: dev.pkh,
      candidate: bob.pkh,
    };

    await fa12LP.transfer(alice.pkh, dev.pkh, transferAmt);
    await utils.setProvider(dev.sk);
    await fa12LP.approve(qFarm.contract.address, depositParams.amt);
    await qFarm.deposit(depositParams);
    await qFarm.updateStorage({
      users_info: [[depositParams.fid, dev.pkh]],
      candidates: [[depositParams.fid, dev.pkh]],
      votes: [[depositParams.fid, bob.pkh]],
      farms: [depositParams.fid],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const finalFarmDevRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${dev.pkh}`];
    const finalFarmDevCandidate: string =
      qFarm.storage.storage.candidates[`${depositParams.fid},${dev.pkh}`];
    const finalFarmBobVotes: number =
      qFarm.storage.storage.votes[`${depositParams.fid},${bob.pkh}`];

    strictEqual(finalFarm.current_delegated, depositParams.candidate);
    strictEqual(finalFarm.next_candidate, zeroAddress);
    strictEqual(+finalFarmDevRecord.prev_staked, depositParams.amt);
    strictEqual(finalFarmDevCandidate, depositParams.candidate);
    strictEqual(+finalFarmBobVotes, +finalFarm.staked);
  });

  it("should change current delegated for the next candidate if votes were redistributed", async () => {
    const depositParams: DepositParams = {
      fid: 4,
      amt: 1500,
      referrer: bob.pkh,
      rewards_receiver: dev.pkh,
      candidate: alice.pkh,
    };

    await qFarm.updateStorage({
      users_info: [[depositParams.fid, dev.pkh]],
      candidates: [[depositParams.fid, dev.pkh]],
      votes: [[depositParams.fid, bob.pkh]],
      farms: [depositParams.fid],
    });

    const initialFarmDevRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${dev.pkh}`];
    const initialFarmBobVotes: number =
      qFarm.storage.storage.votes[`${depositParams.fid},${bob.pkh}`];

    await fa12LP.approve(qFarm.contract.address, depositParams.amt);
    await qFarm.deposit(depositParams);
    await qFarm.updateStorage({
      users_info: [[depositParams.fid, dev.pkh]],
      candidates: [[depositParams.fid, dev.pkh]],
      votes: [
        [depositParams.fid, alice.pkh],
        [depositParams.fid, bob.pkh],
      ],
      farms: [depositParams.fid],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[depositParams.fid];
    const finalFarmDevRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${depositParams.fid},${dev.pkh}`];
    const finalFarmDevCandidate: string =
      qFarm.storage.storage.candidates[`${depositParams.fid},${dev.pkh}`];
    const finalFarmAliceVotes: number =
      qFarm.storage.storage.votes[`${depositParams.fid},${alice.pkh}`];
    const finalFarmBobVotes: number =
      qFarm.storage.storage.votes[`${depositParams.fid},${bob.pkh}`];

    strictEqual(finalFarm.current_delegated, depositParams.candidate);
    strictEqual(finalFarm.next_candidate, bob.pkh);
    strictEqual(+finalFarmDevRecord.prev_staked, depositParams.amt * 2);
    strictEqual(finalFarmDevCandidate, depositParams.candidate);
    strictEqual(+finalFarmAliceVotes, depositParams.amt * 2);
    strictEqual(
      +finalFarmBobVotes,
      +initialFarmBobVotes - initialFarmDevRecord.prev_staked
    );
  });

  it("should fail if farm not found", async () => {
    const harvestParams: HarvestParams = {
      fid: 666,
      rewards_receiver: dev.pkh,
    };

    await rejects(qFarm.harvest(harvestParams), (err: Error) => {
      ok(err.message === "QSystem/farm-not-set");

      return true;
    });
  });

  it("should claim user's rewards", async () => {
    const harvestParams: HarvestParams = {
      fid: 0,
      rewards_receiver: alice.pkh,
    };

    await qFarm.updateStorage({
      users_info: [[harvestParams.fid, alice.pkh]],
      farms: [harvestParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, carol.pkh],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[harvestParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${harvestParams.fid},${alice.pkh}`];
    const initialQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const initialQsGovCarolRecord: UserFA2Info =
      qsGov.storage.account_info[carol.pkh];

    await utils.setProvider(alice.sk);
    await qFarm.harvest(harvestParams);
    await qFarm.updateStorage({
      users_info: [[harvestParams.fid, alice.pkh]],
      farms: [harvestParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, carol.pkh],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[harvestParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${harvestParams.fid},${alice.pkh}`];
    const finalQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const finalQsGovCarolRecord: UserFA2Info =
      qsGov.storage.account_info[carol.pkh];
    const res: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmAliceRecord,
      finalFarmAliceRecord,
      precision
    );

    ok(finalFarmAliceRecord.last_staked === initialFarmAliceRecord.last_staked);
    ok(finalFarm.upd > initialFarm.upd);
    ok(
      new BigNumber(+finalFarm.claimed).isEqualTo(
        new BigNumber(+initialFarm.claimed)
          .plus(res.actualUserEarned)
          .plus(res.referralCommission)
      )
    );
    ok(
      new BigNumber(finalFarm.reward_per_share).isEqualTo(
        res.expectedShareReward
      )
    );
    ok(
      new BigNumber(finalFarmAliceRecord.prev_earned).isEqualTo(
        res.expectedUserPrevEarned
      )
    );
    ok(
      new BigNumber(finalFarmAliceRecord.earned).isEqualTo(
        res.expectedUserEarnedAfterHarvest
      )
    );
    ok(
      new BigNumber(+(await finalQsGovAliceRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovAliceRecord.balances.get("0"))).plus(
          res.actualUserEarned
        )
      )
    );
    ok(
      new BigNumber(+(await finalQsGovCarolRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovCarolRecord.balances.get("0"))).plus(
          res.referralCommission
        )
      )
    );
  });

  it("should fail if timelock is not finished (in farms with timelock)", async () => {
    const depositParams: DepositParams = {
      fid: 0,
      amt: 100,
      referrer: undefined,
      rewards_receiver: alice.pkh,
      candidate: bob.pkh,
    };
    const harvestParams: HarvestParams = {
      fid: 0,
      rewards_receiver: alice.pkh,
    };

    await fa12.approve(qFarm.contract.address, depositParams.amt);
    await qFarm.deposit(depositParams);
    await rejects(qFarm.harvest(harvestParams), (err: Error) => {
      ok(err.message === "QFarm/timelock-is-not-finished");

      return true;
    });
  });

  it("should mint QS GOV tokens as reward to rewards receiver", async () => {
    const harvestParams: HarvestParams = {
      fid: 5,
      rewards_receiver: dev.pkh,
    };

    await qFarm.updateStorage({
      users_info: [[harvestParams.fid, alice.pkh]],
      farms: [harvestParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [carol.pkh, dev.pkh],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[harvestParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${harvestParams.fid},${alice.pkh}`];
    const initialQsGovCarolRecord: UserFA2Info =
      qsGov.storage.account_info[carol.pkh];
    const initialQsGovDevRecord: UserFA2Info =
      qsGov.storage.account_info[dev.pkh];

    await qFarm.harvest(harvestParams);
    await qFarm.updateStorage({
      users_info: [[harvestParams.fid, alice.pkh]],
      farms: [harvestParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [carol.pkh, dev.pkh],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[harvestParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${harvestParams.fid},${alice.pkh}`];
    const finalQsGovCarolRecord: UserFA2Info =
      qsGov.storage.account_info[carol.pkh];
    const finalQsGovDevRecord: UserFA2Info =
      qsGov.storage.account_info[dev.pkh];
    const res: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmAliceRecord,
      finalFarmAliceRecord,
      precision
    );

    ok(
      new BigNumber(+finalFarm.claimed).isEqualTo(
        new BigNumber(+initialFarm.claimed)
          .plus(res.actualUserEarned)
          .plus(res.referralCommission)
      )
    );
    ok(
      new BigNumber(+(await finalQsGovDevRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovDevRecord.balances.get("0"))).plus(
          res.actualUserEarned
        )
      )
    );
    ok(
      new BigNumber(+(await finalQsGovCarolRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovCarolRecord.balances.get("0"))).plus(
          res.referralCommission
        )
      )
    );
  });

  it("should mint QS GOV tokens as harvest fee to referrer (in case when user have referrer)", async () => {
    const harvestParams: HarvestParams = {
      fid: 5,
      rewards_receiver: alice.pkh,
    };

    await qFarm.updateStorage({
      users_info: [[harvestParams.fid, alice.pkh]],
      farms: [harvestParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, carol.pkh],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[harvestParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${harvestParams.fid},${alice.pkh}`];
    const initialQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const initialQsGovCarolRecord: UserFA2Info =
      qsGov.storage.account_info[carol.pkh];

    await qFarm.harvest(harvestParams);
    await qFarm.updateStorage({
      users_info: [[harvestParams.fid, alice.pkh]],
      farms: [harvestParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, carol.pkh],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[harvestParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${harvestParams.fid},${alice.pkh}`];
    const finalQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const finalQsGovCarolRecord: UserFA2Info =
      qsGov.storage.account_info[carol.pkh];
    const res: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmAliceRecord,
      finalFarmAliceRecord,
      precision
    );

    ok(
      new BigNumber(+finalFarm.claimed).isEqualTo(
        new BigNumber(+initialFarm.claimed)
          .plus(res.actualUserEarned)
          .plus(res.referralCommission)
      )
    );
    ok(
      new BigNumber(+(await finalQsGovAliceRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovAliceRecord.balances.get("0"))).plus(
          res.actualUserEarned
        )
      )
    );
    ok(
      new BigNumber(+(await finalQsGovCarolRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovCarolRecord.balances.get("0"))).plus(
          res.referralCommission
        )
      )
    );
  });

  it("should mint QS GOV tokens as harvest fee to zero address (in case when user does not have referrer)", async () => {
    const depositParams: DepositParams = {
      fid: 5,
      amt: 1000,
      referrer: zeroAddress,
      rewards_receiver: alice.pkh,
      candidate: zeroAddress,
    };
    const harvestParams: HarvestParams = {
      fid: 5,
      rewards_receiver: alice.pkh,
    };

    await qFarm.deposit(depositParams);
    await utils.bakeBlocks(5);
    await qFarm.updateStorage({
      users_info: [[harvestParams.fid, alice.pkh]],
      farms: [harvestParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, zeroAddress],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[harvestParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${harvestParams.fid},${alice.pkh}`];
    const initialQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const initialQsGovZeroRecord: UserFA2Info =
      qsGov.storage.account_info[zeroAddress];

    await qFarm.harvest(harvestParams);
    await qFarm.updateStorage({
      users_info: [[harvestParams.fid, alice.pkh]],
      farms: [harvestParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, zeroAddress],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[harvestParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${harvestParams.fid},${alice.pkh}`];
    const finalQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const finalQsGovZeroRecord: UserFA2Info =
      qsGov.storage.account_info[zeroAddress];
    const res: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmAliceRecord,
      finalFarmAliceRecord,
      precision
    );

    ok(
      new BigNumber(+finalFarm.claimed).isEqualTo(
        new BigNumber(+initialFarm.claimed)
          .plus(res.actualUserEarned)
          .plus(res.referralCommission)
      )
    );
    ok(
      new BigNumber(+(await finalQsGovAliceRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovAliceRecord.balances.get("0"))).plus(
          res.actualUserEarned
        )
      )
    );
    ok(
      new BigNumber(+(await finalQsGovZeroRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovZeroRecord.balances.get("0"))).plus(
          res.referralCommission
        )
      )
    );
  });

  it("should calculate and mint QS GOV tokens as harvest fee with decimals (like 4.2%)", async () => {
    const harvestParams: HarvestParams = {
      fid: 5,
      rewards_receiver: alice.pkh,
    };

    await qFarm.updateStorage({
      users_info: [[harvestParams.fid, alice.pkh]],
      farms: [harvestParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, zeroAddress],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[harvestParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${harvestParams.fid},${alice.pkh}`];
    const initialQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const initialQsGovZeroRecord: UserFA2Info =
      qsGov.storage.account_info[zeroAddress];

    await qFarm.harvest(harvestParams);
    await qFarm.updateStorage({
      users_info: [[harvestParams.fid, alice.pkh]],
      farms: [harvestParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, zeroAddress],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[harvestParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${harvestParams.fid},${alice.pkh}`];
    const finalQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const finalQsGovZeroRecord: UserFA2Info =
      qsGov.storage.account_info[zeroAddress];
    const res: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmAliceRecord,
      finalFarmAliceRecord,
      precision
    );

    ok(
      new BigNumber(+finalFarm.claimed).isEqualTo(
        new BigNumber(+initialFarm.claimed)
          .plus(res.actualUserEarned)
          .plus(res.referralCommission)
      )
    );
    ok(
      new BigNumber(+(await finalQsGovAliceRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovAliceRecord.balances.get("0"))).plus(
          res.actualUserEarned
        )
      )
    );
    ok(
      new BigNumber(+(await finalQsGovZeroRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovZeroRecord.balances.get("0"))).plus(
          res.referralCommission
        )
      )
    );
  });

  it("should fail if farm not found", async () => {
    const withdrawParams: WithdrawParams = {
      fid: 666,
      amt: 100,
      receiver: alice.pkh,
      rewards_receiver: dev.pkh,
    };

    await rejects(qFarm.withdraw(withdrawParams), (err: Error) => {
      ok(err.message === "QSystem/farm-not-set");

      return true;
    });
  });

  it("should fail if staked by user amount is less than amount to withdraw", async () => {
    const withdrawParams: WithdrawParams = {
      fid: 0,
      amt: 100_000_000,
      receiver: alice.pkh,
      rewards_receiver: dev.pkh,
    };

    await rejects(qFarm.withdraw(withdrawParams), (err: Error) => {
      ok(err.message === "QFarm/balance-too-low");

      return true;
    });
  });

  it("should withdraw single FA1.2 token", async () => {
    const withdrawParams: WithdrawParams = {
      fid: 0,
      amt: 100,
      receiver: alice.pkh,
      rewards_receiver: alice.pkh,
    };

    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, alice.pkh]],
      farms: [withdrawParams.fid],
    });
    await fa12.updateStorage({
      ledger: [qFarm.contract.address, alice.pkh],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const initialTokenAliceRecord: UserFA12Info =
      fa12.storage.ledger[alice.pkh];
    const initialTokenFarmRecord: UserFA12Info =
      fa12.storage.ledger[qFarm.contract.address];

    await qFarm.withdraw(withdrawParams);
    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, alice.pkh]],
      farms: [withdrawParams.fid],
    });
    await fa12.updateStorage({
      ledger: [qFarm.contract.address, alice.pkh],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const finalTokenAliceRecord: UserFA12Info = fa12.storage.ledger[alice.pkh];
    const finalTokenFarmRecord: UserFA12Info =
      fa12.storage.ledger[qFarm.contract.address];
    const res: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmAliceRecord,
      finalFarmAliceRecord,
      precision
    );

    strictEqual(+finalFarm.staked, +initialFarm.staked - withdrawParams.amt);
    strictEqual(
      +finalFarmAliceRecord.staked,
      +initialFarmAliceRecord.staked - withdrawParams.amt
    );
    strictEqual(
      +finalTokenAliceRecord.balance,
      +initialTokenAliceRecord.balance + withdrawParams.amt
    );
    strictEqual(
      +finalTokenFarmRecord.balance,
      +initialTokenFarmRecord.balance - withdrawParams.amt
    );

    ok(
      new BigNumber(+finalFarm.claimed).isEqualTo(
        new BigNumber(+initialFarm.claimed)
          .plus(res.actualUserEarned)
          .plus(res.referralCommission)
      )
    );
  });

  it("should withdraw LP FA1.2 token", async () => {
    const withdrawParams: WithdrawParams = {
      fid: 4,
      amt: 100,
      receiver: alice.pkh,
      rewards_receiver: alice.pkh,
    };

    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, alice.pkh]],
      farms: [withdrawParams.fid],
    });
    await fa12LP.updateStorage({
      ledger: [qFarm.contract.address, alice.pkh],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const initialTokenAliceRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[alice.pkh];
    const initialTokenFarmRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[qFarm.contract.address];

    await qFarm.withdraw(withdrawParams);
    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, alice.pkh]],
      farms: [withdrawParams.fid],
    });
    await fa12LP.updateStorage({
      ledger: [qFarm.contract.address, alice.pkh],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const finalTokenAliceRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[alice.pkh];
    const finalTokenFarmRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[qFarm.contract.address];
    const res: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmAliceRecord,
      finalFarmAliceRecord,
      precision
    );

    strictEqual(+finalFarm.staked, +initialFarm.staked - withdrawParams.amt);
    strictEqual(
      +finalFarmAliceRecord.staked,
      +initialFarmAliceRecord.staked - withdrawParams.amt
    );
    strictEqual(
      +finalTokenAliceRecord.balance,
      +initialTokenAliceRecord.balance + withdrawParams.amt
    );
    strictEqual(+finalTokenFarmRecord.balance, 0);
    strictEqual(
      +finalTokenFarmRecord.frozen_balance,
      +initialTokenFarmRecord.frozen_balance - withdrawParams.amt
    );

    ok(
      new BigNumber(+finalFarm.claimed).isEqualTo(
        new BigNumber(+initialFarm.claimed)
          .plus(res.actualUserEarned)
          .plus(res.referralCommission)
      )
    );
  });

  it("should withdraw single FA2 token", async () => {
    const withdrawParams: WithdrawParams = {
      fid: 5,
      amt: 1000,
      receiver: alice.pkh,
      rewards_receiver: alice.pkh,
    };

    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, alice.pkh]],
      farms: [withdrawParams.fid],
    });
    await fa2.updateStorage({
      account_info: [qFarm.contract.address, alice.pkh],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const initialTokenAliceRecord: UserFA2Info =
      fa2.storage.account_info[alice.pkh];
    const initialTokenFarmRecord: UserFA2Info =
      fa2.storage.account_info[qFarm.contract.address];

    await qFarm.withdraw(withdrawParams);
    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, alice.pkh]],
      farms: [withdrawParams.fid],
    });
    await fa2.updateStorage({
      account_info: [qFarm.contract.address, alice.pkh],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const finalTokenAliceRecord: UserFA2Info =
      fa2.storage.account_info[alice.pkh];
    const finalTokenFarmRecord: UserFA2Info =
      fa2.storage.account_info[qFarm.contract.address];
    const res: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmAliceRecord,
      finalFarmAliceRecord,
      precision
    );

    strictEqual(+finalFarm.staked, +initialFarm.staked - withdrawParams.amt);
    strictEqual(
      +finalFarmAliceRecord.staked,
      +initialFarmAliceRecord.staked - withdrawParams.amt
    );
    strictEqual(
      +(await finalTokenAliceRecord.balances.get("0")),
      +(await initialTokenAliceRecord.balances.get("0")) + withdrawParams.amt
    );
    strictEqual(
      +(await finalTokenFarmRecord.balances.get("0")),
      +(await initialTokenFarmRecord.balances.get("0")) - withdrawParams.amt
    );

    ok(
      new BigNumber(+finalFarm.claimed).isEqualTo(
        new BigNumber(+initialFarm.claimed)
          .plus(res.actualUserEarned)
          .plus(res.referralCommission)
      )
    );
  });

  it("should withdraw LP FA2 token", async () => {
    const withdrawParams: WithdrawParams = {
      fid: 6,
      amt: 50,
      receiver: alice.pkh,
      rewards_receiver: alice.pkh,
    };

    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, alice.pkh]],
      farms: [withdrawParams.fid],
    });
    await fa2LP.updateStorage({
      ledger: [qFarm.contract.address, alice.pkh],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const initialTokenAliceRecord: UserFA2LPInfo =
      fa2LP.storage.storage.ledger[alice.pkh];
    const initialTokenFarmRecord: UserFA2LPInfo =
      fa2LP.storage.storage.ledger[qFarm.contract.address];

    await qFarm.withdraw(withdrawParams);
    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, alice.pkh]],
      farms: [withdrawParams.fid],
    });
    await fa2LP.updateStorage({
      ledger: [qFarm.contract.address, alice.pkh],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const finalTokenAliceRecord: UserFA2LPInfo =
      fa2LP.storage.storage.ledger[alice.pkh];
    const finalTokenFarmRecord: UserFA2LPInfo =
      fa2LP.storage.storage.ledger[qFarm.contract.address];
    const res: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmAliceRecord,
      finalFarmAliceRecord,
      precision
    );

    strictEqual(+finalFarm.staked, +initialFarm.staked - withdrawParams.amt);
    strictEqual(
      +finalFarmAliceRecord.staked,
      +initialFarmAliceRecord.staked - withdrawParams.amt
    );
    strictEqual(
      +finalTokenAliceRecord.balance,
      +initialTokenAliceRecord.balance + withdrawParams.amt
    );
    strictEqual(+finalTokenFarmRecord.balance, 0);
    strictEqual(
      +finalTokenFarmRecord.frozen_balance,
      +initialTokenFarmRecord.frozen_balance - withdrawParams.amt
    );

    ok(
      new BigNumber(+finalFarm.claimed).isEqualTo(
        new BigNumber(+initialFarm.claimed)
          .plus(res.actualUserEarned)
          .plus(res.referralCommission)
      )
    );
  });

  it("should withdraw tokens to the specified receiver", async () => {
    const withdrawParams: WithdrawParams = {
      fid: 6,
      amt: 20,
      receiver: dev.pkh,
      rewards_receiver: alice.pkh,
    };

    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, alice.pkh]],
      farms: [withdrawParams.fid],
    });
    await fa2LP.updateStorage({
      ledger: [qFarm.contract.address],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const initialTokenFarmRecord: UserFA2LPInfo =
      fa2LP.storage.storage.ledger[qFarm.contract.address];

    await qFarm.withdraw(withdrawParams);
    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, alice.pkh]],
      farms: [withdrawParams.fid],
    });
    await fa2LP.updateStorage({
      ledger: [qFarm.contract.address, dev.pkh],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const finalTokenDevRecord: UserFA2LPInfo =
      fa2LP.storage.storage.ledger[dev.pkh];
    const finalTokenFarmRecord: UserFA2LPInfo =
      fa2LP.storage.storage.ledger[qFarm.contract.address];
    const res: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmAliceRecord,
      finalFarmAliceRecord,
      precision
    );

    strictEqual(+finalFarm.staked, +initialFarm.staked - withdrawParams.amt);
    strictEqual(
      +finalFarmAliceRecord.staked,
      +initialFarmAliceRecord.staked - withdrawParams.amt
    );
    strictEqual(+finalTokenDevRecord.balance, withdrawParams.amt);
    strictEqual(+finalTokenFarmRecord.balance, 0);
    strictEqual(
      +finalTokenFarmRecord.frozen_balance,
      +initialTokenFarmRecord.frozen_balance - withdrawParams.amt
    );

    ok(
      new BigNumber(+finalFarm.claimed).isEqualTo(
        new BigNumber(+initialFarm.claimed)
          .plus(res.actualUserEarned)
          .plus(res.referralCommission)
      )
    );
  });

  it("should claim user's rewards (in farms without timelock)", async () => {
    const withdrawParams: WithdrawParams = {
      fid: 5,
      amt: 1000,
      receiver: alice.pkh,
      rewards_receiver: alice.pkh,
    };

    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, alice.pkh]],
      farms: [withdrawParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, zeroAddress],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const initialQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const initialQsGovZeroRecord: UserFA2Info =
      qsGov.storage.account_info[zeroAddress];

    await qFarm.withdraw(withdrawParams);
    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, alice.pkh]],
      farms: [withdrawParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, zeroAddress],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const finalQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const finalQsGovZeroRecord: UserFA2Info =
      qsGov.storage.account_info[zeroAddress];
    const res: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmAliceRecord,
      finalFarmAliceRecord,
      precision
    );

    ok(finalFarmAliceRecord.last_staked === initialFarmAliceRecord.last_staked);
    ok(finalFarm.upd > initialFarm.upd);
    ok(
      new BigNumber(+finalFarm.claimed).isEqualTo(
        new BigNumber(+initialFarm.claimed)
          .plus(res.actualUserEarned)
          .plus(res.referralCommission)
      )
    );
    ok(
      new BigNumber(finalFarm.reward_per_share).isEqualTo(
        res.expectedShareReward
      )
    );
    ok(
      new BigNumber(finalFarmAliceRecord.prev_earned).isEqualTo(
        res.expectedUserPrevEarned
      )
    );
    ok(
      new BigNumber(finalFarmAliceRecord.earned).isEqualTo(
        res.expectedUserEarnedAfterHarvest
      )
    );
    ok(
      new BigNumber(+(await finalQsGovAliceRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovAliceRecord.balances.get("0"))).plus(
          res.actualUserEarned
        )
      )
    );
    ok(
      new BigNumber(+(await finalQsGovZeroRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovZeroRecord.balances.get("0"))).plus(
          res.referralCommission
        )
      )
    );
  });

  it("should claim user's rewards if timelock is finished (in farms with timelock)", async () => {
    const withdrawParams: WithdrawParams = {
      fid: 0,
      amt: 500,
      receiver: alice.pkh,
      rewards_receiver: alice.pkh,
    };

    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, alice.pkh]],
      farms: [withdrawParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, zeroAddress],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const initialQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const initialQsGovZeroRecord: UserFA2Info =
      qsGov.storage.account_info[zeroAddress];

    await qFarm.withdraw(withdrawParams);
    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, alice.pkh]],
      farms: [withdrawParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, zeroAddress],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const finalQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const finalQsGovZeroRecord: UserFA2Info =
      qsGov.storage.account_info[zeroAddress];
    const res: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmAliceRecord,
      finalFarmAliceRecord,
      precision
    );

    ok(finalFarmAliceRecord.last_staked === initialFarmAliceRecord.last_staked);
    ok(finalFarm.upd > initialFarm.upd);
    ok(
      new BigNumber(+finalFarm.claimed).isEqualTo(
        new BigNumber(+initialFarm.claimed)
          .plus(res.actualUserEarned)
          .plus(res.referralCommission)
      )
    );
    ok(
      new BigNumber(finalFarm.reward_per_share).isEqualTo(
        res.expectedShareReward
      )
    );
    ok(
      new BigNumber(finalFarmAliceRecord.prev_earned).isEqualTo(
        res.expectedUserPrevEarned
      )
    );
    ok(
      new BigNumber(finalFarmAliceRecord.earned).isEqualTo(
        res.expectedUserEarnedAfterHarvest
      )
    );
    ok(
      new BigNumber(+(await finalQsGovAliceRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovAliceRecord.balances.get("0"))).plus(
          res.actualUserEarned
        )
      )
    );
    ok(
      new BigNumber(+(await finalQsGovZeroRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovZeroRecord.balances.get("0"))).plus(
          res.referralCommission
        )
      )
    );
  });

  it("should mint QS GOV tokens as reward to rewards receiver", async () => {
    const withdrawParams: WithdrawParams = {
      fid: 5,
      amt: 100,
      receiver: alice.pkh,
      rewards_receiver: dev.pkh,
    };

    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, alice.pkh]],
      farms: [withdrawParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [dev.pkh, zeroAddress],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const initialQsGovZeroRecord: UserFA2Info =
      qsGov.storage.account_info[zeroAddress];
    const initialQsGovDevRecord: UserFA2Info =
      qsGov.storage.account_info[dev.pkh];

    await qFarm.withdraw(withdrawParams);
    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, alice.pkh]],
      farms: [withdrawParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [dev.pkh, zeroAddress],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const finalQsGovZeroRecord: UserFA2Info =
      qsGov.storage.account_info[zeroAddress];
    const finalQsGovDevRecord: UserFA2Info =
      qsGov.storage.account_info[dev.pkh];
    const res: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmAliceRecord,
      finalFarmAliceRecord,
      precision
    );

    ok(
      new BigNumber(+finalFarm.claimed).isEqualTo(
        new BigNumber(+initialFarm.claimed)
          .plus(res.actualUserEarned)
          .plus(res.referralCommission)
      )
    );
    ok(
      new BigNumber(+(await finalQsGovDevRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovDevRecord.balances.get("0"))).plus(
          res.actualUserEarned
        )
      )
    );
    ok(
      new BigNumber(+(await finalQsGovZeroRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovZeroRecord.balances.get("0"))).plus(
          res.referralCommission
        )
      )
    );
  });

  it("should mint QS GOV tokens as harvest fee to zero address (in case when user does not have referrer)", async () => {
    const withdrawParams: WithdrawParams = {
      fid: 5,
      amt: 100,
      receiver: alice.pkh,
      rewards_receiver: alice.pkh,
    };

    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, alice.pkh]],
      farms: [withdrawParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, zeroAddress],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const initialQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const initialQsGovZeroRecord: UserFA2Info =
      qsGov.storage.account_info[zeroAddress];

    await qFarm.withdraw(withdrawParams);
    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, alice.pkh]],
      farms: [withdrawParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, zeroAddress],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const finalQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const finalQsGovZeroRecord: UserFA2Info =
      qsGov.storage.account_info[zeroAddress];
    const res: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmAliceRecord,
      finalFarmAliceRecord,
      precision
    );

    ok(
      new BigNumber(+finalFarm.claimed).isEqualTo(
        new BigNumber(+initialFarm.claimed)
          .plus(res.actualUserEarned)
          .plus(res.referralCommission)
      )
    );
    ok(
      new BigNumber(+(await finalQsGovAliceRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovAliceRecord.balances.get("0"))).plus(
          res.actualUserEarned
        )
      )
    );
    ok(
      new BigNumber(+(await finalQsGovZeroRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovZeroRecord.balances.get("0"))).plus(
          res.referralCommission
        )
      )
    );
  });

  it("should mint QS GOV tokens as harvest fee to referrer (in case when user have referrer)", async () => {
    const depositParams: DepositParams = {
      fid: 5,
      amt: 1000,
      referrer: carol.pkh,
      rewards_receiver: alice.pkh,
      candidate: zeroAddress,
    };
    const withdrawParams: WithdrawParams = {
      fid: 5,
      amt: 1000,
      receiver: alice.pkh,
      rewards_receiver: alice.pkh,
    };

    await qFarm.deposit(depositParams);
    await utils.bakeBlocks(5);
    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, alice.pkh]],
      farms: [withdrawParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, carol.pkh],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const initialQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const initialQsGovCarolRecord: UserFA2Info =
      qsGov.storage.account_info[carol.pkh];

    await qFarm.withdraw(withdrawParams);
    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, alice.pkh]],
      farms: [withdrawParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, carol.pkh],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const finalQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const finalQsGovCarolRecord: UserFA2Info =
      qsGov.storage.account_info[carol.pkh];
    const res: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmAliceRecord,
      finalFarmAliceRecord,
      precision
    );

    ok(
      new BigNumber(+finalFarm.claimed).isEqualTo(
        new BigNumber(+initialFarm.claimed)
          .plus(res.actualUserEarned)
          .plus(res.referralCommission)
      )
    );
    ok(
      new BigNumber(+(await finalQsGovAliceRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovAliceRecord.balances.get("0"))).plus(
          res.actualUserEarned
        )
      )
    );
    ok(
      new BigNumber(+(await finalQsGovCarolRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovCarolRecord.balances.get("0"))).plus(
          res.referralCommission
        )
      )
    );
  });

  it("should calculate and mint QS GOV tokens as harvest fee with decimals (like 4.2%)", async () => {
    const withdrawParams: WithdrawParams = {
      fid: 5,
      amt: 1000,
      receiver: alice.pkh,
      rewards_receiver: alice.pkh,
    };

    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, alice.pkh]],
      farms: [withdrawParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, carol.pkh],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const initialQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const initialQsGovCarolRecord: UserFA2Info =
      qsGov.storage.account_info[carol.pkh];

    await qFarm.withdraw(withdrawParams);
    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, alice.pkh]],
      farms: [withdrawParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, carol.pkh],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const finalQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const finalQsGovCarolRecord: UserFA2Info =
      qsGov.storage.account_info[carol.pkh];
    const res: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmAliceRecord,
      finalFarmAliceRecord,
      precision
    );

    ok(
      new BigNumber(+finalFarm.claimed).isEqualTo(
        new BigNumber(+initialFarm.claimed)
          .plus(res.actualUserEarned)
          .plus(res.referralCommission)
      )
    );
    ok(
      new BigNumber(+(await finalQsGovAliceRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovAliceRecord.balances.get("0"))).plus(
          res.actualUserEarned
        )
      )
    );
    ok(
      new BigNumber(+(await finalQsGovCarolRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovCarolRecord.balances.get("0"))).plus(
          res.referralCommission
        )
      )
    );
  });

  it("should burn user's rewards if timelock is not finished (in farms with timelock)", async () => {
    const depositParams: DepositParams = {
      fid: 0,
      amt: 1000,
      referrer: undefined,
      rewards_receiver: alice.pkh,
      candidate: zeroAddress,
    };
    const withdrawParams: WithdrawParams = {
      fid: 0,
      amt: 500,
      receiver: alice.pkh,
      rewards_receiver: alice.pkh,
    };

    await fa12.approve(qFarm.contract.address, depositParams.amt);
    await qFarm.deposit(depositParams);
    await utils.bakeBlocks(3);
    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, alice.pkh]],
      farms: [withdrawParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, zeroAddress],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const initialQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const initialQsGovZeroRecord: UserFA2Info =
      qsGov.storage.account_info[zeroAddress];

    await qFarm.withdraw(withdrawParams);
    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, alice.pkh]],
      farms: [withdrawParams.fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, zeroAddress],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const finalQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const finalQsGovZeroRecord: UserFA2Info =
      qsGov.storage.account_info[zeroAddress];
    const res: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmAliceRecord,
      finalFarmAliceRecord,
      precision
    );

    ok(finalFarmAliceRecord.last_staked === initialFarmAliceRecord.last_staked);
    ok(finalFarm.upd > initialFarm.upd);
    ok(
      new BigNumber(+finalFarm.claimed).isEqualTo(
        new BigNumber(+initialFarm.claimed).plus(res.actualUserBurned)
      )
    );
    ok(
      new BigNumber(finalFarm.reward_per_share).isEqualTo(
        res.expectedShareReward
      )
    );
    ok(
      new BigNumber(finalFarmAliceRecord.prev_earned).isEqualTo(
        res.expectedUserPrevEarned
      )
    );
    ok(
      new BigNumber(finalFarmAliceRecord.earned).isEqualTo(
        res.expectedUserEarnedAfterHarvest
      )
    );
    ok(
      new BigNumber(+(await finalQsGovAliceRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovAliceRecord.balances.get("0")))
      )
    );
    ok(
      new BigNumber(+(await finalQsGovZeroRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovZeroRecord.balances.get("0"))).plus(
          res.actualUserBurned
        )
      )
    );
  });

  it("should stake withdrawal fee from farm's name", async () => {
    const withdrawParams: WithdrawParams = {
      fid: 0,
      amt: 500,
      receiver: alice.pkh,
      rewards_receiver: alice.pkh,
    };

    await qFarm.updateStorage({
      users_info: [
        [withdrawParams.fid, alice.pkh],
        [withdrawParams.fid, qFarm.contract.address],
      ],
      farms: [withdrawParams.fid],
    });
    await fa12.updateStorage({
      ledger: [alice.pkh, qFarm.contract.address],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const initialFarmFarmRecord: UserInfoType =
      qFarm.storage.storage.users_info[
        `${withdrawParams.fid},${qFarm.contract.address}`
      ];
    const initialTokenAliceRecord: UserFA12Info =
      fa12.storage.ledger[alice.pkh];
    const initialTokenFarmRecord: UserFA12Info =
      fa12.storage.ledger[qFarm.contract.address];

    await qFarm.withdraw(withdrawParams);
    await qFarm.updateStorage({
      users_info: [
        [withdrawParams.fid, alice.pkh],
        [withdrawParams.fid, qFarm.contract.address],
      ],
      farms: [withdrawParams.fid],
    });
    await fa12.updateStorage({
      ledger: [alice.pkh, qFarm.contract.address],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${alice.pkh}`];
    const finalFarmFarmRecord: UserInfoType =
      qFarm.storage.storage.users_info[
        `${withdrawParams.fid},${qFarm.contract.address}`
      ];
    const finalTokenAliceRecord: UserFA12Info = fa12.storage.ledger[alice.pkh];
    const finalTokenFarmRecord: UserFA12Info =
      fa12.storage.ledger[qFarm.contract.address];
    const res: WithdrawData = QFarmUtils.getWithdrawData(
      initialFarm,
      withdrawParams.amt,
      precision
    );

    ok(
      new BigNumber(+finalFarm.staked).isEqualTo(
        new BigNumber(+initialFarm.staked).minus(res.actualUserWithdraw)
      )
    );
    ok(
      new BigNumber(finalTokenAliceRecord.balance).isEqualTo(
        new BigNumber(+initialTokenAliceRecord.balance).plus(
          res.actualUserWithdraw
        )
      )
    );
    ok(
      new BigNumber(+finalTokenFarmRecord.balance).isEqualTo(
        new BigNumber(+initialTokenFarmRecord.balance).minus(
          res.actualUserWithdraw
        )
      )
    );
    ok(finalFarmFarmRecord.last_staked > initialFarmFarmRecord.last_staked);
    ok(
      new BigNumber(+finalFarmFarmRecord.staked).isEqualTo(
        new BigNumber(+initialFarmFarmRecord.staked).plus(
          res.wirthdrawCommission
        )
      )
    );

    strictEqual(
      +finalFarmAliceRecord.staked,
      +initialFarmAliceRecord.staked - withdrawParams.amt
    );
  });

  it("should change current delegated for the next candidate if votes were redistributed", async () => {
    const withdrawParams: WithdrawParams = {
      fid: 4,
      amt: 3000,
      receiver: dev.pkh,
      rewards_receiver: dev.pkh,
    };

    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, dev.pkh]],
      votes: [
        [withdrawParams.fid, alice.pkh],
        [withdrawParams.fid, bob.pkh],
      ],
      farms: [withdrawParams.fid],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const initialFarmDevRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${dev.pkh}`];
    const initialFarmAliceVotes: number =
      qFarm.storage.storage.votes[`${withdrawParams.fid},${alice.pkh}`];
    const initialFarmBobVotes: number =
      qFarm.storage.storage.votes[`${withdrawParams.fid},${bob.pkh}`];

    await utils.setProvider(dev.sk);
    await qFarm.withdraw(withdrawParams);
    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, dev.pkh]],
      candidates: [[withdrawParams.fid, dev.pkh]],
      votes: [
        [withdrawParams.fid, alice.pkh],
        [withdrawParams.fid, bob.pkh],
      ],
      farms: [withdrawParams.fid],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const finalFarmDevRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${withdrawParams.fid},${dev.pkh}`];
    const finalFarmDevCandidate: string =
      qFarm.storage.storage.candidates[`${withdrawParams.fid},${dev.pkh}`];
    const finalFarmAliceVotes: number =
      qFarm.storage.storage.votes[`${withdrawParams.fid},${alice.pkh}`];
    const finalFarmBobVotes: number =
      qFarm.storage.storage.votes[`${withdrawParams.fid},${bob.pkh}`];

    strictEqual(finalFarm.current_delegated, initialFarm.next_candidate);
    strictEqual(finalFarm.next_candidate, initialFarm.current_delegated);
    strictEqual(+finalFarmDevRecord.prev_staked, 0);
    strictEqual(finalFarmDevCandidate, undefined);
    strictEqual(
      +finalFarmAliceVotes,
      +initialFarmAliceVotes - initialFarmDevRecord.prev_staked
    );
    strictEqual(+finalFarmBobVotes, +initialFarmBobVotes);
  });

  it("should fail if not admin is trying to burn TEZ rewards", async () => {
    await rejects(qFarm.burnTEZRewards(0), (err: Error) => {
      ok(err.message === "Not-admin");

      return true;
    });
  });

  it("should fail if farm not found", async () => {
    await utils.setProvider(bob.sk);
    await rejects(qFarm.burnTEZRewards(666), (err: Error) => {
      ok(err.message === "QSystem/farm-not-set");

      return true;
    });
  });

  it("should fail if not LP token is staked on the farm", async () => {
    await rejects(qFarm.burnTEZRewards(0), (err: Error) => {
      ok(err.message === "QSystem/not-LP-farm");

      return true;
    });
  });

  it("should withdraw bakers rewards in TEZ from the QS pool, swap for QS GOV tokens and burn them", async () => {
    await qsGov.updateStorage({
      account_info: [zeroAddress],
    });

    const depositParams: DepositParams = {
      fid: 4,
      amt: 100,
      referrer: bob.pkh,
      rewards_receiver: alice.pkh,
      candidate: alice.pkh,
    };
    const initialQsGovZeroRecord: UserFA2Info =
      qsGov.storage.account_info[zeroAddress];

    await utils.setProvider(alice.sk);
    await fa12LP.approve(qFarm.contract.address, depositParams.amt);
    await qFarm.deposit(depositParams);
    await qFarm.updateStorage({
      farms: [depositParams.fid],
    });
    await utils.setProvider(bob.sk);

    const operation = await utils.tezos.contract.transfer({
      to: qFarm.storage.storage.farms[depositParams.fid].stake_params
        .staked_token["fA12"],
      amount: 500,
      mutez: true,
    });

    await confirmOperation(utils.tezos, operation.hash);
    await utils.bakeBlocks(1);
    await qFarm.burnTEZRewards(depositParams.fid);
    await qsGov.updateStorage({
      account_info: [zeroAddress],
    });

    const finalQsGovZeroRecord: UserFA2Info =
      qsGov.storage.account_info[zeroAddress];

    ok(
      +(await finalQsGovZeroRecord.balances.get("0")) >
        +(await initialQsGovZeroRecord.balances.get("0"))
    );
  });

  it("should fail if farm not found", async () => {
    await rejects(qFarm.burnFarmRewards(666), (err: Error) => {
      ok(err.message === "QSystem/farm-not-set");

      return true;
    });
  });

  it("should burn farm rewards", async () => {
    const fid: number = 0;

    await qFarm.updateStorage({
      users_info: [[fid, qFarm.contract.address]],
      farms: [fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, zeroAddress],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[fid];
    const initialFarmFarmRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${fid},${qFarm.contract.address}`];
    const initialQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const initialQsGovZeroRecord: UserFA2Info =
      qsGov.storage.account_info[zeroAddress];

    await utils.setProvider(alice.sk);
    await qFarm.burnFarmRewards(fid);
    await qFarm.updateStorage({
      users_info: [[fid, qFarm.contract.address]],
      farms: [fid],
    });
    await qsGov.updateStorage({
      account_info: [alice.pkh, zeroAddress],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[fid];
    const finalFarmFarmRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${fid},${qFarm.contract.address}`];
    const finalQsGovAliceRecord: UserFA2Info =
      qsGov.storage.account_info[alice.pkh];
    const finalQsGovZeroRecord: UserFA2Info =
      qsGov.storage.account_info[zeroAddress];
    const res: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmFarmRecord,
      finalFarmFarmRecord,
      precision
    );

    ok(finalFarmFarmRecord.last_staked === initialFarmFarmRecord.last_staked);
    ok(finalFarm.upd > initialFarm.upd);
    ok(
      new BigNumber(+finalFarm.claimed).isEqualTo(
        new BigNumber(+initialFarm.claimed).plus(res.actualUserBurned)
      )
    );
    ok(
      new BigNumber(finalFarm.reward_per_share).isEqualTo(
        res.expectedShareReward
      )
    );
    ok(
      new BigNumber(finalFarmFarmRecord.prev_earned).isEqualTo(
        res.expectedUserPrevEarned
      )
    );
    ok(
      new BigNumber(finalFarmFarmRecord.earned).isEqualTo(
        res.expectedUserEarnedAfterHarvest
      )
    );
    ok(
      new BigNumber(+(await finalQsGovAliceRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovAliceRecord.balances.get("0"))).plus(
          res.expectedUserBurnReward
        )
      )
    );
    ok(
      new BigNumber(+(await finalQsGovZeroRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovZeroRecord.balances.get("0"))).plus(
          res.burnAmount
        )
      )
    );
  });

  it("should pay burn reward to the transaction sender", async () => {
    const fid: number = 0;

    await utils.bakeBlocks(3);
    await qFarm.updateStorage({
      users_info: [[fid, qFarm.contract.address]],
      farms: [fid],
    });
    await qsGov.updateStorage({
      account_info: [bob.pkh, zeroAddress],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[fid];
    const initialFarmFarmRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${fid},${qFarm.contract.address}`];
    const initialQsGovBobRecord: UserFA2Info =
      qsGov.storage.account_info[bob.pkh];
    const initialQsGovZeroRecord: UserFA2Info =
      qsGov.storage.account_info[zeroAddress];

    await utils.setProvider(bob.sk);
    await qFarm.burnFarmRewards(fid);
    await qFarm.updateStorage({
      users_info: [[fid, qFarm.contract.address]],
      farms: [fid],
    });
    await qsGov.updateStorage({
      account_info: [bob.pkh, zeroAddress],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[fid];
    const finalFarmFarmRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${fid},${qFarm.contract.address}`];
    const finalQsGovBobRecord: UserFA2Info =
      qsGov.storage.account_info[bob.pkh];
    const finalQsGovZeroRecord: UserFA2Info =
      qsGov.storage.account_info[zeroAddress];
    const res: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmFarmRecord,
      finalFarmFarmRecord,
      precision
    );

    ok(finalFarmFarmRecord.last_staked === initialFarmFarmRecord.last_staked);
    ok(finalFarm.upd > initialFarm.upd);
    ok(
      new BigNumber(+finalFarm.claimed).isEqualTo(
        new BigNumber(+initialFarm.claimed).plus(res.actualUserBurned)
      )
    );
    ok(
      new BigNumber(finalFarm.reward_per_share).isEqualTo(
        res.expectedShareReward
      )
    );
    ok(
      new BigNumber(finalFarmFarmRecord.prev_earned).isEqualTo(
        res.expectedUserPrevEarned
      )
    );
    ok(
      new BigNumber(finalFarmFarmRecord.earned).isEqualTo(
        res.expectedUserEarnedAfterHarvest
      )
    );
    ok(
      new BigNumber(+(await finalQsGovBobRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovBobRecord.balances.get("0"))).plus(
          res.expectedUserBurnReward
        )
      )
    );
    ok(
      new BigNumber(+(await finalQsGovZeroRecord.balances.get("0"))).isEqualTo(
        new BigNumber(+(await initialQsGovZeroRecord.balances.get("0"))).plus(
          res.burnAmount
        )
      )
    );
  });

  it("should fail if not admit is trying to withdraw farm depo", async () => {
    const withdrawParams: WithdrawFarmDepoParams = { fid: 0, amt: 0 };

    await utils.setProvider(alice.sk);
    await rejects(qFarm.withdrawFarmDepo(withdrawParams), (err: Error) => {
      ok(err.message === "Not-admin");

      return true;
    });
  });

  it("should fail if farm not found", async () => {
    const withdrawParams: WithdrawFarmDepoParams = { fid: 666, amt: 0 };

    await utils.setProvider(bob.sk);
    await rejects(qFarm.withdrawFarmDepo(withdrawParams), (err: Error) => {
      ok(err.message === "QSystem/farm-not-set");

      return true;
    });
  });

  it("should fail if staked by farm amount is less than amount to withdraw", async () => {
    const withdrawParams: WithdrawFarmDepoParams = {
      fid: 0,
      amt: 100_000_000,
    };

    await rejects(qFarm.withdrawFarmDepo(withdrawParams), (err: Error) => {
      ok(err.message === "QSystem/balance-too-low");

      return true;
    });
  });

  it("should withdraw single FA1.2 token", async () => {
    const withdrawParams: WithdrawFarmDepoParams = {
      fid: 0,
      amt: 10,
    };

    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, qFarm.contract.address]],
      farms: [withdrawParams.fid],
    });
    await fa12.updateStorage({
      ledger: [qFarm.contract.address, bob.pkh],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const initialFarmFarmRecord: UserInfoType =
      qFarm.storage.storage.users_info[
        `${withdrawParams.fid},${qFarm.contract.address}`
      ];
    const initialTokenBobRecord: UserFA12Info = fa12.storage.ledger[bob.pkh];
    const initialTokenFarmRecord: UserFA12Info =
      fa12.storage.ledger[qFarm.contract.address];

    await qFarm.withdrawFarmDepo(withdrawParams);
    await qFarm.updateStorage({
      users_info: [[withdrawParams.fid, qFarm.contract.address]],
      farms: [withdrawParams.fid],
    });
    await fa12.updateStorage({
      ledger: [qFarm.contract.address, bob.pkh],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[withdrawParams.fid];
    const finalFarmFarmRecord: UserInfoType =
      qFarm.storage.storage.users_info[
        `${withdrawParams.fid},${qFarm.contract.address}`
      ];
    const finalTokenBobRecord: UserFA12Info = fa12.storage.ledger[bob.pkh];
    const finalTokenFarmRecord: UserFA12Info =
      fa12.storage.ledger[qFarm.contract.address];

    strictEqual(+finalFarm.staked, +initialFarm.staked - withdrawParams.amt);
    strictEqual(
      +finalFarmFarmRecord.staked,
      +initialFarmFarmRecord.staked - withdrawParams.amt
    );
    strictEqual(
      +finalTokenBobRecord.balance,
      +initialTokenBobRecord.balance + withdrawParams.amt
    );
    strictEqual(
      +finalTokenFarmRecord.balance,
      +initialTokenFarmRecord.balance - withdrawParams.amt
    );
  });

  it("should withdraw LP FA1.2 token", async () => {
    let newFarmParams: NewFarmParams = await QFarmUtils.getMockNewFarmParams(
      utils
    );

    newFarmParams.fees.harvest_fee = 13 * feePrecision;
    newFarmParams.fees.withdrawal_fee = 25 * feePrecision;
    newFarmParams.fees.burn_reward = 20 * feePrecision;
    newFarmParams.stake_params.staked_token = { fA12: fa12LP.contract.address };
    newFarmParams.stake_params.is_v1_lp = true;
    newFarmParams.reward_per_second = 2 * precision;
    newFarmParams.timelock = 10;

    await utils.setProvider(bob.sk);
    await qFarm.addNewFarm(newFarmParams);

    const depositParams: DepositParams = {
      fid: 7,
      amt: 100,
      referrer: undefined,
      rewards_receiver: alice.pkh,
      candidate: bob.pkh,
    };

    await utils.setProvider(alice.sk);
    await fa12LP.approve(qFarm.contract.address, depositParams.amt);
    await qFarm.deposit(depositParams);

    const withdrawParams1: WithdrawParams = {
      fid: depositParams.fid,
      amt: depositParams.amt,
      receiver: alice.pkh,
      rewards_receiver: alice.pkh,
    };

    await qFarm.withdraw(withdrawParams1);
    await utils.setProvider(bob.sk);

    const withdrawParams2: WithdrawFarmDepoParams = {
      fid: depositParams.fid,
      amt: 10,
    };

    await qFarm.updateStorage({
      users_info: [[withdrawParams2.fid, qFarm.contract.address]],
      farms: [withdrawParams2.fid],
    });
    await fa12LP.updateStorage({
      ledger: [qFarm.contract.address],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[withdrawParams2.fid];
    const initialFarmFarmRecord: UserInfoType =
      qFarm.storage.storage.users_info[
        `${withdrawParams2.fid},${qFarm.contract.address}`
      ];
    const initialTokenFarmRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[qFarm.contract.address];

    await qFarm.withdrawFarmDepo(withdrawParams2);
    await qFarm.updateStorage({
      users_info: [[withdrawParams2.fid, qFarm.contract.address]],
      farms: [withdrawParams2.fid],
    });
    await fa12LP.updateStorage({
      ledger: [qFarm.contract.address, bob.pkh],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[withdrawParams2.fid];
    const finalFarmFarmRecord: UserInfoType =
      qFarm.storage.storage.users_info[
        `${withdrawParams2.fid},${qFarm.contract.address}`
      ];
    const finalTokenBobRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[bob.pkh];
    const finalTokenFarmRecord: UserFA12Info =
      fa12LP.storage.storage.ledger[qFarm.contract.address];

    strictEqual(+finalFarm.staked, +initialFarm.staked - withdrawParams2.amt);
    strictEqual(
      +finalFarmFarmRecord.staked,
      +initialFarmFarmRecord.staked - withdrawParams2.amt
    );
    strictEqual(+finalTokenBobRecord.balance, withdrawParams2.amt);
    strictEqual(+finalTokenFarmRecord.balance, 1100);
    strictEqual(
      +finalTokenFarmRecord.frozen_balance,
      +initialTokenFarmRecord.frozen_balance - withdrawParams2.amt
    );
  });

  it("should withdraw single FA2 token", async () => {
    let newFarmParams: NewFarmParams = await QFarmUtils.getMockNewFarmParams(
      utils
    );

    newFarmParams.fees.harvest_fee = 15 * feePrecision;
    newFarmParams.fees.withdrawal_fee = 50 * feePrecision;
    newFarmParams.fees.burn_reward = 20 * feePrecision;
    newFarmParams.stake_params.staked_token = {
      fA2: { token: fa2.contract.address, id: 0 },
    };
    newFarmParams.reward_per_second = 2 * precision;
    newFarmParams.timelock = 5;

    await utils.setProvider(bob.sk);
    await qFarm.addNewFarm(newFarmParams);

    const depositParams: DepositParams = {
      fid: 8,
      amt: 100,
      referrer: undefined,
      rewards_receiver: alice.pkh,
      candidate: bob.pkh,
    };

    await utils.setProvider(alice.sk);
    await qFarm.deposit(depositParams);

    const withdrawParams1: WithdrawParams = {
      fid: depositParams.fid,
      amt: depositParams.amt / 2,
      receiver: alice.pkh,
      rewards_receiver: alice.pkh,
    };

    await qFarm.withdraw(withdrawParams1);
    await utils.setProvider(bob.sk);

    const withdrawParams2: WithdrawFarmDepoParams = {
      fid: depositParams.fid,
      amt: 10,
    };

    await qFarm.updateStorage({
      users_info: [[withdrawParams2.fid, qFarm.contract.address]],
      farms: [withdrawParams2.fid],
    });
    await fa2.updateStorage({
      account_info: [qFarm.contract.address, bob.pkh],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[withdrawParams2.fid];
    const initialFarmFarmRecord: UserInfoType =
      qFarm.storage.storage.users_info[
        `${withdrawParams2.fid},${qFarm.contract.address}`
      ];
    const initialTokenBobRecord: UserFA2Info =
      fa2.storage.account_info[bob.pkh];
    const initialTokenFarmRecord: UserFA2Info =
      fa2.storage.account_info[qFarm.contract.address];

    await qFarm.withdrawFarmDepo(withdrawParams2);
    await qFarm.updateStorage({
      users_info: [[withdrawParams2.fid, qFarm.contract.address]],
      farms: [withdrawParams2.fid],
    });
    await fa2.updateStorage({
      account_info: [qFarm.contract.address, bob.pkh],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[withdrawParams2.fid];
    const finalFarmFarmRecord: UserInfoType =
      qFarm.storage.storage.users_info[
        `${withdrawParams2.fid},${qFarm.contract.address}`
      ];
    const finalTokenBobRecord: UserFA2Info = fa2.storage.account_info[bob.pkh];
    const finalTokenFarmRecord: UserFA2Info =
      fa2.storage.account_info[qFarm.contract.address];

    strictEqual(+finalFarm.staked, +initialFarm.staked - withdrawParams2.amt);
    strictEqual(
      +finalFarmFarmRecord.staked,
      +initialFarmFarmRecord.staked - withdrawParams2.amt
    );
    strictEqual(
      +(await finalTokenBobRecord.balances.get("0")),
      +(await initialTokenBobRecord.balances.get("0")) + withdrawParams2.amt
    );
    strictEqual(
      +(await finalTokenFarmRecord.balances.get("0")),
      +(await initialTokenFarmRecord.balances.get("0")) - withdrawParams2.amt
    );
  });

  it("should withdraw LP FA2 token", async () => {
    let newFarmParams: NewFarmParams = await QFarmUtils.getMockNewFarmParams(
      utils
    );

    newFarmParams.fees.harvest_fee = 50 * feePrecision;
    newFarmParams.fees.withdrawal_fee = 50 * feePrecision;
    newFarmParams.fees.burn_reward = 20 * feePrecision;
    newFarmParams.stake_params.staked_token = {
      fA2: { token: fa2LP.contract.address, id: 0 },
    };
    newFarmParams.stake_params.is_v1_lp = true;
    newFarmParams.reward_per_second = 2 * precision;
    newFarmParams.timelock = 10;

    await utils.setProvider(bob.sk);
    await qFarm.addNewFarm(newFarmParams);

    const depositParams: DepositParams = {
      fid: 9,
      amt: 100,
      referrer: undefined,
      rewards_receiver: alice.pkh,
      candidate: bob.pkh,
    };

    await utils.setProvider(alice.sk);
    await qFarm.deposit(depositParams);

    const withdrawParams1: WithdrawParams = {
      fid: depositParams.fid,
      amt: depositParams.amt,
      receiver: alice.pkh,
      rewards_receiver: alice.pkh,
    };

    await qFarm.withdraw(withdrawParams1);
    await utils.setProvider(bob.sk);

    const withdrawParams2: WithdrawFarmDepoParams = {
      fid: depositParams.fid,
      amt: 20,
    };

    await qFarm.updateStorage({
      users_info: [[withdrawParams2.fid, qFarm.contract.address]],
      farms: [withdrawParams2.fid],
    });
    await fa2LP.updateStorage({
      ledger: [qFarm.contract.address],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[withdrawParams2.fid];
    const initialFarmFarmRecord: UserInfoType =
      qFarm.storage.storage.users_info[
        `${withdrawParams2.fid},${qFarm.contract.address}`
      ];
    const initialTokenFarmRecord: UserFA2LPInfo =
      fa2LP.storage.storage.ledger[qFarm.contract.address];

    await qFarm.withdrawFarmDepo(withdrawParams2);
    await qFarm.updateStorage({
      users_info: [[withdrawParams2.fid, qFarm.contract.address]],
      farms: [withdrawParams2.fid],
    });
    await fa2LP.updateStorage({
      ledger: [qFarm.contract.address, bob.pkh],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[withdrawParams2.fid];
    const finalFarmFarmRecord: UserInfoType =
      qFarm.storage.storage.users_info[
        `${withdrawParams2.fid},${qFarm.contract.address}`
      ];
    const finalTokenBobRecord: UserFA2LPInfo =
      fa2LP.storage.storage.ledger[bob.pkh];
    const finalTokenFarmRecord: UserFA2LPInfo =
      fa2LP.storage.storage.ledger[qFarm.contract.address];

    strictEqual(+finalFarm.staked, +initialFarm.staked - withdrawParams2.amt);
    strictEqual(
      +finalFarmFarmRecord.staked,
      +initialFarmFarmRecord.staked - withdrawParams2.amt
    );
    strictEqual(+finalTokenBobRecord.balance, withdrawParams2.amt);
    strictEqual(+finalTokenFarmRecord.balance, 30);
    strictEqual(
      +finalTokenFarmRecord.frozen_balance,
      +initialTokenFarmRecord.frozen_balance - withdrawParams2.amt
    );
  });

  it("should transfer one token and update values correctly", async () => {
    const depositParams: DepositParams = {
      fid: 0,
      amt: 1000,
      referrer: undefined,
      rewards_receiver: bob.pkh,
      candidate: zeroAddress,
    };

    await utils.setProvider(bob.sk);
    await fa12.approve(qFarm.contract.address, depositParams.amt);
    await qFarm.deposit(depositParams);

    const amount: number = 50;
    const params: TransferParam[] = [
      {
        from_: alice.pkh,
        txs: [{ to_: bob.pkh, token_id: 0, amount: amount }],
      },
    ];

    await qFarm.updateStorage({
      users_info: [
        [0, alice.pkh],
        [0, bob.pkh],
      ],
      farms: [0],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[0];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${0},${alice.pkh}`];
    const initialFarmBobRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${0},${bob.pkh}`];

    await utils.setProvider(alice.sk);
    await qFarm.transfer(params);
    await qFarm.updateStorage({
      users_info: [
        [0, alice.pkh],
        [0, bob.pkh],
      ],
      farms: [0],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[0];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${0},${alice.pkh}`];
    const finalFarmBobRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${0},${bob.pkh}`];
    const resAlice: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmAliceRecord,
      finalFarmAliceRecord,
      precision
    );
    const resBob: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmBobRecord,
      finalFarmBobRecord,
      precision
    );

    strictEqual(+finalFarm.staked, +initialFarm.staked);
    strictEqual(
      +finalFarmAliceRecord.staked,
      +initialFarmAliceRecord.staked - amount
    );
    strictEqual(
      +finalFarmBobRecord.staked,
      +initialFarmBobRecord.staked + amount
    );

    ok(finalFarm.upd > initialFarm.upd);
    ok(
      new BigNumber(finalFarm.reward_per_share).isEqualTo(
        resAlice.expectedShareReward
      )
    );
    ok(
      new BigNumber(finalFarmAliceRecord.prev_earned).isEqualTo(
        resAlice.expectedUserPrevEarned
      )
    );
    ok(
      new BigNumber(finalFarmAliceRecord.earned).isEqualTo(
        resAlice.expectedUserEarned
      )
    );
    ok(
      new BigNumber(finalFarmBobRecord.prev_earned).isEqualTo(
        resBob.expectedUserPrevEarned
      )
    );
    ok(
      new BigNumber(finalFarmBobRecord.earned).isEqualTo(
        resBob.expectedUserEarned
      )
    );
  });

  it("should transfer a group of tokens and update values correctly", async () => {
    const depositParams: DepositParams = {
      fid: 0,
      amt: 1000,
      referrer: undefined,
      rewards_receiver: carol.pkh,
      candidate: zeroAddress,
    };

    await fa12.transfer(alice.pkh, carol.pkh, depositParams.amt);
    await utils.setProvider(carol.sk);
    await fa12.approve(qFarm.contract.address, depositParams.amt);
    await qFarm.deposit(depositParams);

    const amount: number = 50;
    const params: TransferParam[] = [
      {
        from_: alice.pkh,
        txs: [
          { to_: bob.pkh, token_id: 0, amount: amount },
          { to_: carol.pkh, token_id: 0, amount: amount },
        ],
      },
    ];

    await qFarm.updateStorage({
      users_info: [
        [0, alice.pkh],
        [0, bob.pkh],
        [0, carol.pkh],
      ],
      farms: [0],
    });

    const initialFarm: Farm = qFarm.storage.storage.farms[0];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${0},${alice.pkh}`];
    const initialFarmBobRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${0},${bob.pkh}`];
    const initialFarmCarolRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${0},${carol.pkh}`];

    await utils.setProvider(alice.sk);
    await qFarm.transfer(params);
    await qFarm.updateStorage({
      users_info: [
        [0, alice.pkh],
        [0, bob.pkh],
        [0, carol.pkh],
      ],
      farms: [0],
    });

    const finalFarm: Farm = qFarm.storage.storage.farms[0];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${0},${alice.pkh}`];
    const finalFarmBobRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${0},${bob.pkh}`];
    const finalFarmCarolRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${0},${carol.pkh}`];
    const resAlice: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmAliceRecord,
      finalFarmAliceRecord,
      precision
    );
    const resBob: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmBobRecord,
      finalFarmBobRecord,
      precision
    );
    const resCarol: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmCarolRecord,
      finalFarmCarolRecord,
      precision
    );

    strictEqual(+finalFarm.staked, +initialFarm.staked);
    strictEqual(
      +finalFarmAliceRecord.staked,
      +initialFarmAliceRecord.staked - amount * 2
    );
    strictEqual(
      +finalFarmBobRecord.staked,
      +initialFarmBobRecord.staked + amount
    );
    strictEqual(
      +finalFarmCarolRecord.staked,
      +initialFarmCarolRecord.staked + amount
    );

    ok(finalFarm.upd > initialFarm.upd);
    ok(
      new BigNumber(finalFarm.reward_per_share).isEqualTo(
        resAlice.expectedShareReward
      )
    );
    ok(
      new BigNumber(finalFarmAliceRecord.prev_earned).isEqualTo(
        resAlice.expectedUserPrevEarned
      )
    );
    ok(
      new BigNumber(finalFarmAliceRecord.earned).isEqualTo(
        resAlice.expectedUserEarned
      )
    );
    ok(
      new BigNumber(finalFarmBobRecord.prev_earned).isEqualTo(
        resBob.expectedUserPrevEarned
      )
    );
    ok(
      new BigNumber(finalFarmBobRecord.earned).isEqualTo(
        resBob.expectedUserEarned
      )
    );
    ok(
      new BigNumber(finalFarmCarolRecord.prev_earned).isEqualTo(
        resCarol.expectedUserPrevEarned
      )
    );
    ok(
      new BigNumber(finalFarmCarolRecord.earned).isEqualTo(
        resCarol.expectedUserEarned
      )
    );
  });

  it("should fail if timelock for the sender is not finished (in farms with timelock)", async () => {
    const params: TransferParam[] = [
      {
        from_: bob.pkh,
        txs: [{ to_: alice.pkh, token_id: 0, amount: 10 }],
      },
    ];

    await utils.setProvider(bob.sk);
    await rejects(qFarm.transfer(params), (err: Error) => {
      ok(err.message === "FA2_TIMELOCK_NOT_FINISHED");

      return true;
    });
  });

  it("should claim rewards after transfer correctly", async () => {
    const harvestParams: HarvestParams = {
      fid: 0,
      rewards_receiver: alice.pkh,
    };

    await utils.bakeBlocks(6);
    await qFarm.updateStorage({
      users_info: [
        [harvestParams.fid, alice.pkh],
        [harvestParams.fid, bob.pkh],
        [harvestParams.fid, carol.pkh],
      ],
      farms: [harvestParams.fid],
    });

    let initialFarm: Farm = qFarm.storage.storage.farms[harvestParams.fid];
    const initialFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${harvestParams.fid},${alice.pkh}`];
    const initialFarmBobRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${harvestParams.fid},${bob.pkh}`];
    const initialFarmCarolRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${harvestParams.fid},${carol.pkh}`];

    await utils.setProvider(alice.sk);
    await qFarm.harvest(harvestParams);
    await qFarm.updateStorage({
      users_info: [[harvestParams.fid, alice.pkh]],
      farms: [harvestParams.fid],
    });

    let finalFarm: Farm = qFarm.storage.storage.farms[harvestParams.fid];
    const finalFarmAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${harvestParams.fid},${alice.pkh}`];
    const resAlice: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmAliceRecord,
      finalFarmAliceRecord,
      precision
    );

    initialFarm = qFarm.storage.storage.farms[harvestParams.fid];

    await utils.setProvider(bob.sk);
    await qFarm.harvest(harvestParams);
    await qFarm.updateStorage({
      users_info: [[harvestParams.fid, bob.pkh]],
      farms: [harvestParams.fid],
    });

    finalFarm = qFarm.storage.storage.farms[harvestParams.fid];

    const finalFarmBobRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${harvestParams.fid},${bob.pkh}`];
    const resBob: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmBobRecord,
      finalFarmBobRecord,
      precision
    );

    initialFarm = qFarm.storage.storage.farms[harvestParams.fid];

    await utils.setProvider(carol.sk);
    await qFarm.harvest(harvestParams);
    await qFarm.updateStorage({
      users_info: [[harvestParams.fid, carol.pkh]],
      farms: [harvestParams.fid],
    });

    finalFarm = qFarm.storage.storage.farms[harvestParams.fid];

    const finalFarmCarolRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${harvestParams.fid},${carol.pkh}`];
    const resCarol: FarmData = QFarmUtils.getFarmData(
      initialFarm,
      finalFarm,
      initialFarmCarolRecord,
      finalFarmCarolRecord,
      precision
    );

    strictEqual(+finalFarm.staked, +initialFarm.staked);
    strictEqual(+finalFarmAliceRecord.staked, +initialFarmAliceRecord.staked);
    strictEqual(+finalFarmBobRecord.staked, +initialFarmBobRecord.staked);
    strictEqual(+finalFarmCarolRecord.staked, +initialFarmCarolRecord.staked);

    ok(finalFarm.upd > initialFarm.upd);
    ok(
      new BigNumber(finalFarm.reward_per_share).isEqualTo(
        resCarol.expectedShareReward
      )
    );
    ok(
      new BigNumber(finalFarmAliceRecord.prev_earned).isEqualTo(
        resAlice.expectedUserPrevEarned
      )
    );
    ok(
      new BigNumber(finalFarmAliceRecord.earned).isEqualTo(
        resAlice.expectedUserEarnedAfterHarvest
      )
    );
    ok(
      new BigNumber(finalFarmBobRecord.prev_earned).isEqualTo(
        resBob.expectedUserPrevEarned
      )
    );
    ok(
      new BigNumber(finalFarmBobRecord.earned).isEqualTo(
        resBob.expectedUserEarnedAfterHarvest
      )
    );
    ok(
      new BigNumber(finalFarmCarolRecord.prev_earned).isEqualTo(
        resCarol.expectedUserPrevEarned
      )
    );
    ok(
      new BigNumber(finalFarmCarolRecord.earned).isEqualTo(
        resCarol.expectedUserEarnedAfterHarvest
      )
    );
  });

  it("should return correct balance of staked tokens", async () => {
    const operation: OriginationOperation =
      await utils.tezos.contract.originate({
        code: VIEW_LAMBDA.code,
        storage: VIEW_LAMBDA.storage,
      });
    const lambdaContract: Contract = await operation.contract();
    const balanceOfResult: Promise<any> = await qFarm.contract.views
      .balance_of([
        { owner: alice.pkh, token_id: 0 },
        { owner: alice.pkh, token_id: 6 },
        { owner: bob.pkh, token_id: 0 },
      ])
      .read(lambdaContract.address);

    await qFarm.updateStorage({
      users_info: [
        [0, alice.pkh],
        [6, alice.pkh],
        [0, bob.pkh],
      ],
    });

    const farmFirstAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${0},${alice.pkh}`];
    const farmSecondAliceRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${6},${alice.pkh}`];
    const farmBobRecord: UserInfoType =
      qFarm.storage.storage.users_info[`${0},${bob.pkh}`];

    ok(
      new BigNumber(+farmFirstAliceRecord.staked).isEqualTo(
        balanceOfResult[2].balance
      )
    );
    ok(
      new BigNumber(+farmSecondAliceRecord.staked).isEqualTo(
        balanceOfResult[1].balance
      )
    );
    ok(
      new BigNumber(+farmBobRecord.staked).isEqualTo(balanceOfResult[0].balance)
    );
  });
});
