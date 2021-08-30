import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";

import env from "../../env";

import { alice } from "../../scripts/sandbox/accounts";

const defaultNetwork = "development";
const network = env.network || defaultNetwork;

export class Utils {
  tezos: TezosToolkit;

  async init(): Promise<void> {
    const networkConfig = env.networks[network];

    this.tezos = new TezosToolkit(networkConfig.rpc);
    this.tezos.setProvider({
      config: {
        confirmationPollingTimeoutSecond: env.confirmationPollingTimeoutSecond,
      },
      signer: await InMemorySigner.fromSecretKey(alice.sk),
    });
  }

  async setProvider(newProviderSK): Promise<void> {
    this.tezos.setProvider({
      signer: await InMemorySigner.fromSecretKey(newProviderSK),
    });
  }

  static destructObj(obj) {
    let arr = [];

    Object.keys(obj).map(function (k) {
      if (typeof obj[k] === "object" && !(obj[k] instanceof Date)) {
        arr = arr.concat(Utils.destructObj(obj[k]));
      } else {
        arr.push(obj[k]);
      }
    });

    return arr;
  }
}

export const zeroAddress: string = "tz1ZZZZZZZZZZZZZZZZZZZZZZZZZZZZNkiRg";
