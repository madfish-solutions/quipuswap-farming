import { TransactionOperation } from "@taquito/taquito";

import { FA2 } from "./helpers/FA2";
import { Utils, zeroAddress } from "./helpers/Utils";
import { ProxyMinter } from "./helpers/ProxyMinter";

import { rejects, ok, strictEqual } from "assert";

import { alice, bob, carol, dev } from "../scripts/sandbox/accounts";

import { fa2Storage } from "../storage/test/FA2";
import { proxyMinterStorage } from "../storage/ProxyMinter";

import { MintParams } from "./types/ProxyMinter";
import { Minter, MintGovTokenParams } from "./types/FA2";

import { confirmOperation } from "../scripts/confirmation";

describe("ProxyMinter tests", async () => {
  var qsGov: FA2;
  var utils: Utils;
  var proxyMinter: ProxyMinter;

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk);

    qsGov = await FA2.originate(utils.tezos, fa2Storage);

    proxyMinterStorage.admin = alice.pkh;
    proxyMinterStorage.pending_admin = zeroAddress;
    proxyMinterStorage.qsgov.token = qsGov.contract.address;
    proxyMinterStorage.qsgov.id = 0;

    proxyMinter = await ProxyMinter.originate(utils.tezos, proxyMinterStorage);

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
    await rejects(proxyMinter.setAdmin(bob.pkh), (err: Error) => {
      ok(err.message === "Not-admin");

      return true;
    });
  });

  it("should setup new pending admin by admin", async () => {
    await utils.setProvider(alice.sk);
    await proxyMinter.setAdmin(bob.pkh);
    await proxyMinter.updateStorage();

    strictEqual(proxyMinter.storage.admin, alice.pkh);
    strictEqual(proxyMinter.storage.pending_admin, bob.pkh);
  });

  it("should fail if not pending admin is trying to confirm new admin", async () => {
    await rejects(proxyMinter.confirmAdmin(), (err: Error) => {
      ok(err.message === "Not-pending-admin");

      return true;
    });
  });

  it("should confirm new admin by pending admin", async () => {
    await utils.setProvider(bob.sk);
    await proxyMinter.confirmAdmin();
    await proxyMinter.updateStorage();

    strictEqual(proxyMinter.storage.admin, bob.pkh);
    strictEqual(proxyMinter.storage.pending_admin, zeroAddress);
  });

  it("should fail if not admin is trying to add or remove a minter", async () => {
    await utils.setProvider(alice.sk);
    await rejects(proxyMinter.addMinter(zeroAddress, true), (err: Error) => {
      ok(err.message === "Not-admin");

      return true;
    });
  });

  it("should add a minter", async () => {
    await utils.setProvider(bob.sk);
    await proxyMinter.addMinter(alice.pkh, true);
    await proxyMinter.updateStorage();

    strictEqual(proxyMinter.storage.minters.length, 1);
    strictEqual(proxyMinter.storage.minters[0], alice.pkh);
  });

  it("should remove a minter", async () => {
    await proxyMinter.addMinter(alice.pkh, false);
    await proxyMinter.updateStorage();

    strictEqual(proxyMinter.storage.minters.length, 0);
  });

  it("should fail if transaction sender is not a registered minter", async () => {
    const mintParams: MintParams[] = [{ receiver: alice.pkh, amount: 10 }];

    await utils.setProvider(alice.sk);
    await rejects(proxyMinter.mintTokens(mintParams), (err: Error) => {
      ok(err.message === "ProxyMinter/sender-is-not-a-minter");

      return true;
    });
  });

  it("should mint QS GOV tokens for one address", async () => {
    const amount = 666;
    const minters: Minter[] = [
      { minter: proxyMinter.contract.address, share: 71000000 },
    ];
    const mintParams: MintParams[] = [{ receiver: dev.pkh, amount: amount }];

    await qsGov.setMinters(minters);
    await utils.setProvider(bob.sk);
    await proxyMinter.addMinter(bob.pkh, true);
    await proxyMinter.mintTokens(mintParams);
    await qsGov.updateStorage({ account_info: [dev.pkh] });

    strictEqual(
      +(await qsGov.storage.account_info[dev.pkh].balances.get("0")),
      amount
    );
  });

  it("should mint QS GOV tokens for group of addresses", async () => {
    const amount = 666;
    const mintParams: MintParams[] = [
      { receiver: dev.pkh, amount: amount },
      { receiver: dev.pkh, amount: amount },
      { receiver: zeroAddress, amount: amount * 2 },
    ];

    await proxyMinter.mintTokens(mintParams);
    await qsGov.updateStorage({ account_info: [dev.pkh, zeroAddress] });

    strictEqual(
      +(await qsGov.storage.account_info[dev.pkh].balances.get("0")),
      amount * 3
    );
    strictEqual(
      +(await qsGov.storage.account_info[zeroAddress].balances.get("0")),
      amount * 2
    );
  });

  it("should fail if not admin is trying to withdraw QS GOV tokens", async () => {
    const withdrawAmount: number = 10;

    await utils.setProvider(alice.sk);
    await rejects(proxyMinter.withdrawTokens(withdrawAmount), (err: Error) => {
      ok(err.message === "Not-admin");

      return true;
    });
  });

  it("should transfer the specified amount of QS GOV tokens from proxy minter contract to admin address", async () => {
    const amount = 666;
    const minters: Minter[] = [
      { minter: proxyMinter.contract.address, share: 71_000_000 },
      { minter: carol.pkh, share: 29_000_000 },
    ];
    const mintGovTokenParams: MintGovTokenParams[] = [
      { receiver: dev.pkh, amount: amount },
    ];
    const totalShares: number = minters.reduce(
      (acc, curr) => acc + curr.share,
      0
    );
    const expectedProxyMinterTokensAmount: number = Math.floor(
      (minters[0].share * (totalShares * amount)) /
        minters[1].share /
        totalShares
    );
    const withdrawAmount: number = expectedProxyMinterTokensAmount / 2;

    await qsGov.setMinters(minters);
    await utils.setProvider(carol.sk);
    await qsGov.mintGovToken(mintGovTokenParams);
    await qsGov.updateStorage({
      account_info: [dev.pkh, proxyMinter.contract.address],
    });

    strictEqual(
      +(await qsGov.storage.account_info[dev.pkh].balances.get("0")),
      amount * 4
    );
    strictEqual(
      +(await qsGov.storage.account_info[
        proxyMinter.contract.address
      ].balances.get("0")),
      expectedProxyMinterTokensAmount
    );

    await utils.setProvider(bob.sk);
    await proxyMinter.withdrawTokens(withdrawAmount);
    await qsGov.updateStorage({
      account_info: [dev.pkh, proxyMinter.contract.address, bob.pkh],
    });

    strictEqual(
      +(await qsGov.storage.account_info[dev.pkh].balances.get("0")),
      amount * 4
    );
    strictEqual(
      +(await qsGov.storage.account_info[
        proxyMinter.contract.address
      ].balances.get("0")),
      expectedProxyMinterTokensAmount / 2
    );
    strictEqual(
      +(await qsGov.storage.account_info[bob.pkh].balances.get("0")),
      50_000_000_000 + expectedProxyMinterTokensAmount / 2
    );
  });

  it("should withdraw all QS GOV tokens from the contract", async () => {
    const withdrawAmount: number = +(await qsGov.storage.account_info[
      proxyMinter.contract.address
    ].balances.get("0"));
    const initialBobBalance: number = +(await qsGov.storage.account_info[
      bob.pkh
    ].balances.get("0"));

    await proxyMinter.withdrawTokens(withdrawAmount);
    await qsGov.updateStorage({
      account_info: [proxyMinter.contract.address, bob.pkh],
    });

    strictEqual(
      +(await qsGov.storage.account_info[
        proxyMinter.contract.address
      ].balances.get("0")),
      0
    );
    strictEqual(
      +(await qsGov.storage.account_info[bob.pkh].balances.get("0")),
      initialBobBalance + withdrawAmount
    );
  });

  it("should fail if the specified amount of QS GOV tokens is more than actual balance on the contract", async () => {
    const withdrawAmount: number = 1;

    await rejects(proxyMinter.withdrawTokens(withdrawAmount), (err: Error) => {
      ok(err.message === "FA2_INSUFFICIENT_BALANCE");

      return true;
    });
  });
});
