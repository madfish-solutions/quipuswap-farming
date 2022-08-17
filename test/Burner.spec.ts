import { FA2 } from "./helpers/FA2";
import { Utils, zeroAddress } from "./helpers/Utils";
import { Burner } from "./helpers/Burner";
import { DexCore } from "./helpers/DexCore";

import { rejects, ok, strictEqual } from "assert";

import { alice } from "../scripts/sandbox/accounts";

import { burnerStorage } from "../storage/Burner";
import { fa2Storage } from "storage/test/FA2";
import { dexCoreStorage } from "storage/test/DexCore";
import { bakerRegistryStorage } from "../storage/BakerRegistry";
import { BakerRegistry } from "./helpers/BakerRegistry";
import { BigNumber } from "bignumber.js";

import {
  UpdateOperatorParam,
  BalanceResponse,
  BalanceRequest,
} from "./types/FA2";

import {
  DivestLiquidity,
  LaunchExchange,
  TokensPerShare,
} from "../test/types/DexCore";

describe("Burner tests", async () => {
  var qsGov: FA2;
  var utils: Utils;
  var burner: Burner;
  var dexCore: DexCore;
  var bakerRegistry: BakerRegistry;

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk);
    dexCoreStorage.storage.admin = alice.pkh;
    bakerRegistry = await BakerRegistry.originate(
      utils.tezos,
      bakerRegistryStorage,
    );

    dexCoreStorage.storage.baker_registry = bakerRegistry.contract.address;

    qsGov = await FA2.originate(utils.tezos, fa2Storage);
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
    const params: LaunchExchange = {
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
    };
    const expectedPairId: BigNumber = new BigNumber(0);

    await dexCore.launchExchange(params, params.token_b_in.toNumber());

    await dexCore.updateStorage({
      ledger: [[params.shares_receiver, expectedPairId.toFixed()]],
      tokens: [expectedPairId.toFixed()],
      pairs: [expectedPairId.toFixed()],
    });

    burnerStorage.qsgov_lp = dexCore.contract.address;
    burnerStorage.qsgov.token = qsGov.contract.address;
    burnerStorage.qsgov.id = 0;
    burnerStorage.pool_id = expectedPairId.toNumber();
    burner = await Burner.originate(utils.tezos, burnerStorage);
  });

  it("should swap all TEZ from contract for QS GOV tokens and burn them", async () => {
    await qsGov.updateStorage({
      account_info: [burner.contract.address, zeroAddress],
    });

    strictEqual(+(await qsGov.storage.account_info[zeroAddress]), NaN);
    strictEqual(
      +(await qsGov.storage.account_info[burner.contract.address]),
      NaN,
    );

    await burner.burn(100);
    await qsGov.updateStorage({
      account_info: [burner.contract.address, zeroAddress],
    });

    strictEqual(
      +(await qsGov.storage.account_info[zeroAddress].balances.get("0")),
      99,
    );
    strictEqual(
      +(await qsGov.storage.account_info[burner.contract.address].balances.get(
        "0",
      )),
      0,
    );
  });

  it("should fail if zero TEZ amount have been sent", async () => {
    await rejects(burner.burn(0), (err: Error) => {
      ok(err.message === "118");

      return true;
    });
  });

  it("should fail if not QS GOV token contract is trying to call callback", async () => {
    const balanceRequest: BalanceRequest = { owner: alice.pkh, token_id: 0 };
    const balanceResponse: BalanceResponse[] = [
      { request: balanceRequest, balance: 666 },
    ];

    await rejects(burner.burnCallback(balanceResponse), (err: Error) => {
      ok(err.message === "Burner/not-QS-GOV-token");

      return true;
    });
  });
});
