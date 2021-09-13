import { TezosToolkit, Contract, TransactionOperation } from "@taquito/taquito";

import { confirmOperation } from "../../scripts/confirmation";

import { QSFA12DexStorage } from "../types/QSFA12Dex";

export class QSFA12Dex {
  contract: Contract;
  storage: QSFA12DexStorage;
  tezos: TezosToolkit;

  constructor(contract: Contract, tezos: TezosToolkit) {
    this.contract = contract;
    this.tezos = tezos;
  }

  static async init(
    qsFA12DexAddress: string,
    tezos: TezosToolkit
  ): Promise<QSFA12Dex> {
    return new QSFA12Dex(await tezos.contract.at(qsFA12DexAddress), tezos);
  }

  async updateStorage(maps = {}): Promise<void> {
    const storage: QSFA12DexStorage = await this.contract.storage();

    this.storage = storage;

    for (const key in maps) {
      this.storage.storage[key] = await maps[key].reduce(
        async (prev: any, current: any) => {
          try {
            return {
              ...(await prev),
              [current]: await storage.storage[key].get(current),
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

  async transfer(
    src: string,
    dst: string,
    value: number
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .transfer(src, dst, value)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async approve(spender: string, value: number): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .approve(spender, value)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }
}
