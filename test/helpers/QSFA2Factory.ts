import {
  TezosToolkit,
  OriginationOperation,
  TransactionOperation,
  WalletOperationBatch,
  WalletOperation,
  Contract,
  OpKind,
  WalletParamsWithKind,
} from "@taquito/taquito";

import fs from "fs";

import { confirmOperation } from "../../scripts/confirmation";

import { QSFA2FactoryStorage } from "../types/QSFA2Factory";

import qs_fa2_factory_dex_lambdas from "../contracts/qs_fa2_factory_dex_lambdas.json";
import qs_fa2_factory_token_lambdas from "../contracts/qs_fa2_factory_token_lambdas.json";

export class QSFA2Factory {
  contract: Contract;
  storage: QSFA2FactoryStorage;
  tezos: TezosToolkit;

  constructor(contract: Contract, tezos: TezosToolkit) {
    this.contract = contract;
    this.tezos = tezos;
  }

  static async init(
    qsFA2FactoryAddress: string,
    tezos: TezosToolkit
  ): Promise<QSFA2Factory> {
    return new QSFA2Factory(
      await tezos.contract.at(qsFA2FactoryAddress),
      tezos
    );
  }

  static async originate(
    tezos: TezosToolkit,
    storage: QSFA2FactoryStorage
  ): Promise<QSFA2Factory> {
    const artifacts: any = JSON.parse(
      fs.readFileSync(`test/contracts/qs_fa2_factory.json`).toString()
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

    return new QSFA2Factory(
      await tezos.contract.at(operation.contractAddress),
      tezos
    );
  }

  async updateStorage(maps = {}): Promise<void> {
    const storage: QSFA2FactoryStorage = await this.contract.storage();

    this.storage = storage;

    for (const key in maps) {
      this.storage[key] = await maps[key].reduce(
        async (prev: any, current: any) => {
          try {
            return {
              ...(await prev),
              [current]: await storage[key].get(current),
            };
          } catch (ex) {
            return {
              ...(await prev),
              [current]: 0,
            };
          }
        },
        Promise.resolve({})
      );
    }
  }

  async setDexAndTokenLambdas(): Promise<void> {
    let params: WalletParamsWithKind[] = [];

    for (const qs_fa2_factory_dex_lambda of qs_fa2_factory_dex_lambdas) {
      params.push({
        kind: OpKind.TRANSACTION,
        to: this.contract.address,
        amount: 0,
        parameter: {
          entrypoint: "setDexFunction",
          value: qs_fa2_factory_dex_lambda,
        },
      });
    }

    let batch: WalletOperationBatch = this.tezos.wallet.batch(params);
    let operation: WalletOperation = await batch.send();

    await confirmOperation(this.tezos, operation.opHash);

    params = [];

    for (const qs_fa2_factory_token_lambda of qs_fa2_factory_token_lambdas) {
      params.push({
        kind: OpKind.TRANSACTION,
        to: this.contract.address,
        amount: 0,
        parameter: {
          entrypoint: "setTokenFunction",
          value: qs_fa2_factory_token_lambda,
        },
      });
    }

    batch = this.tezos.wallet.batch(params);
    operation = await batch.send();

    await confirmOperation(this.tezos, operation.opHash);
  }

  async launchExchange(
    token: string,
    id: number,
    amount: number,
    mutezAmount: number
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .launchExchange(token, id, amount)
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }
}
