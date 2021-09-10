import {
  TezosToolkit,
  OriginationOperation,
  Contract,
  TransactionOperation,
} from "@taquito/taquito";

import fs from "fs";

import env from "../../env";

import { confirmOperation } from "../../scripts/confirmation";

import { ProxyMinterStorage, MintParams } from "../types/ProxyMinter";
import { BalanceResponse } from "../types/FA2";

export class ProxyMinter {
  contract: Contract;
  storage: ProxyMinterStorage;
  tezos: TezosToolkit;

  constructor(contract: Contract, tezos: TezosToolkit) {
    this.contract = contract;
    this.tezos = tezos;
  }

  static async init(
    proxyMinterAddress: string,
    tezos: TezosToolkit
  ): Promise<ProxyMinter> {
    return new ProxyMinter(await tezos.contract.at(proxyMinterAddress), tezos);
  }

  static async originate(
    tezos: TezosToolkit,
    storage: ProxyMinterStorage
  ): Promise<ProxyMinter> {
    const artifacts: any = JSON.parse(
      fs.readFileSync(`${env.buildDir}/proxy_minter.json`).toString()
    );
    const operation: OriginationOperation = await tezos.contract
      .originate({
        code: artifacts.michelson,
        storage: storage,
      })
      .catch((e) => {
        console.error(e);

        return null;
      });

    await confirmOperation(tezos, operation.hash);

    return new ProxyMinter(
      await tezos.contract.at(operation.contractAddress),
      tezos
    );
  }

  async updateStorage(): Promise<void> {
    const storage: ProxyMinterStorage = await this.contract.storage();

    this.storage = storage;
  }

  async addMinter(
    minter: string,
    register: boolean
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .add_minter(minter, register)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async mintTokens(recipients: MintParams[]): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .mint_tokens(recipients)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async withdrawTokens(): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .withdraw_tokens([])
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async withdrawCallback(
    balanceResponse: BalanceResponse[]
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .withdraw_callback(balanceResponse)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async setAdmin(newAdmin: string): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .set_admin(newAdmin)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async confirmAdmin(): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .confirm_admin([])
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }
}
