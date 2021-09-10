type storage_type       is [@layout:comb] record [
  (* Set of registered farms *)
  farms                   : set(address);
  (* QS GOV token *)
  qsgov                   : fa2_type;
  (* Contract's actual admin address *)
  admin                   : address;
  (* Contract's pending admin address *)
  pending_admin           : address;
]

type register_farm_type is [@layout:comb] record [
  (* Farm address *)
  farm                    : address;
  (* Flag: register or unregister *)
  register                : bool;
]

type withdraw_type_1    is unit

type withdraw_type_2    is list(bal_response_type)

type set_admin_type     is address (* New admin address *)

type confirm_admin_type is unit

type action_type        is
  Register_farm           of register_farm_type
| Mint_qsgov_tokens       of mint_gov_toks_type
| Withdraw_qsgov_tokens   of withdraw_type_1
| Withdraw_callback       of withdraw_type_2
| Set_admin               of set_admin_type
| Confirm_admin           of confirm_admin_type

type return_type        is (list(operation) * storage_type)
