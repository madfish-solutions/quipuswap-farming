import {
  TezosToolkit,
  OriginationOperation,
  Contract,
  TransactionOperation,
} from "@taquito/taquito";

import fs from "fs";

import env from "../../env";

import { confirmOperation } from "../../scripts/confirmation";

import { BurnerStorage } from "../types/Burner";
import { BalanceResponse } from "test/types/FA2";

export class Burner {
  contract: Contract;
  storage: BurnerStorage;
  tezos: TezosToolkit;

  constructor(contract: Contract, tezos: TezosToolkit) {
    this.contract = contract;
    this.tezos = tezos;
  }

  static async init(
    burnerAddress: string,
    tezos: TezosToolkit
  ): Promise<Burner> {
    return new Burner(await tezos.contract.at(burnerAddress), tezos);
  }

  static async originate(
    tezos: TezosToolkit,
    storage: BurnerStorage
  ): Promise<Burner> {
    const artifacts: any = JSON.parse(
      fs.readFileSync(`${env.buildDir}/burner.json`).toString()
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

    return new Burner(
      await tezos.contract.at(operation.contractAddress),
      tezos
    );
  }

  async burn(mutezAmount: number): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .default([])
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async burnCallback(
    balanceResponse: BalanceResponse[]
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .burn_callback(balanceResponse)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }
}
