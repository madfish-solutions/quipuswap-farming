import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";

import { confirmOperation } from "../../scripts/confirmation";

import { carol } from "../../scripts/sandbox/accounts";

import env from "../../env";

const defaultNetwork = "development";
const network = env.network || defaultNetwork;

export class Utils {
  tezos: TezosToolkit;

  async init(providerSK: string): Promise<void> {
    const networkConfig = env.networks[network];

    this.tezos = new TezosToolkit(networkConfig.rpc);
    this.tezos.setProvider({
      config: {
        confirmationPollingTimeoutSecond: env.confirmationPollingTimeoutSecond,
      },
      signer: await InMemorySigner.fromSecretKey(providerSK),
    });

    const operation = await this.tezos.contract.transfer({
      to: carol.pkh,
      amount: 50000000,
      mutez: true,
    });

    await confirmOperation(this.tezos, operation.hash);
  }

  async setProvider(newProviderSK: string): Promise<void> {
    this.tezos.setProvider({
      signer: await InMemorySigner.fromSecretKey(newProviderSK),
    });
  }

  static destructObj(obj: any) {
    let arr = [];

    Object.keys(obj).map(function (k) {
      if (
        typeof obj[k] === "object" &&
        (!(obj[k] instanceof Date) ||
          !(obj[k] instanceof null) ||
          !(obj[k] instanceof undefined))
      ) {
        arr = arr.concat(Utils.destructObj(obj[k]));
      } else {
        arr.push(obj[k]);
      }
    });

    return arr;
  }
}

export const zeroAddress: string = "tz1ZZZZZZZZZZZZZZZZZZZZZZZZZZZZNkiRg";
