type token_type         is [@layout:comb] record [
  token                   : address; (* Token address *)
  id                      : nat; (* Token ID *)
]

type storage_type       is [@layout:comb] record [
  farms                   : set(address); (* Set of registered farms *)
  qugo_token              : token_type; (* Quipuswap GOV token *)
  admin                   : address; (* Contract's actual admin address *)
  pending_admin           : address; (* Contract's pending admin address *)
]

type register_farm_type is [@layout:comb] record [
  farm                    : address; (* Farm address *)
  register                : bool; (* Flag: register or unregister *)
]

type mint_tokens_type   is [@layout:comb] record [
  amt                     : nat; (* Number of tokens to mint *)
  recepient               : address; (* Tokens recepient address *)
]

type withdraw_type      is address (* GOV tokens recipient address *)

type set_admin_type     is address (* New admin address *)

type confirm_admin_type is unit

type action_type        is
  Register_farm           of register_farm_type
| Mint_gov_tokens         of mint_tokens_type
| Withdraw_gov_tokens     of withdraw_type
| Set_admin               of set_admin_type
| Confirm_admin           of confirm_admin_type

type return_type        is (list(operation) * storage_type)
