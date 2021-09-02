import {
  TezosToolkit,
  OriginationOperation,
  Contract,
  TransactionOperation,
} from "@taquito/taquito";

import fs from "fs";

import { confirmOperation } from "../../scripts/confirmation";

import { QSFA2FactoryStorage } from "../types/QSFA2Factory";

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
