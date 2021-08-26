import { Token } from "./Common";

export type ProxyMinterStorage = {
  farms: string[];
  qsgov: Token;
  admin: string;
  pending_admin: string;
};
