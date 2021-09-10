type storage_type       is [@layout:comb] record [
  (* Set of registered minters *)
  minters                 : set(address);
  (* QS GOV token *)
  qsgov                   : fa2_type;
  (* Contract's actual admin address *)
  admin                   : address;
  (* Contract's pending admin address *)
  pending_admin           : address;
]

type add_minter_type    is [@layout:comb] record [
  (* Minter address *)
  minter                  : address;
  (* Flag: register or unregister *)
  register                : bool;
]

type withdraw_type      is nat (* Amount of tokens to withdraw *)

type set_admin_type     is address (* New admin address *)

type confirm_admin_type is unit

type action_type        is
  Add_minter              of add_minter_type
| Mint_tokens             of mint_gov_toks_type
| Withdraw_tokens         of withdraw_type
| Set_admin               of set_admin_type
| Confirm_admin           of confirm_admin_type

type return_type        is (list(operation) * storage_type)
