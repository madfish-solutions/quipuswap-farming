type storage_type       is [@layout:comb] record [
  farms                   : set(address); (* Set of registered farms *)
  qsgov                   : token_type; (* QS GOV token *)
  admin                   : address; (* Contract's actual admin address *)
  pending_admin           : address; (* Contract's pending admin address *)
]

type register_farm_type is [@layout:comb] record [
  farm                    : address; (* Farm address *)
  register                : bool; (* Flag: register or unregister *)
]

type mint_tokens_type   is [@layout:comb] record [
  amt                     : nat; (* Number of tokens to mint *)
  recipient               : address; (* Tokens recipient address *)
]

type withdraw_type_1    is unit

type withdraw_type_2    is list(bal_response_type)

type set_admin_type     is address (* New admin address *)

type confirm_admin_type is unit

type action_type        is
  Register_farm           of register_farm_type
| Mint_qsgov_tokens       of mint_tokens_type
| Withdraw_qsgov_tokens   of withdraw_type_1
| Withdraw_callback       of withdraw_type_2
| Set_admin               of set_admin_type
| Confirm_admin           of confirm_admin_type

type return_type        is (list(operation) * storage_type)
