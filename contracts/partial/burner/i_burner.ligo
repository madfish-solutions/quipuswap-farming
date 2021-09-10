type burn_type          is Burn             of (address * nat)

type storage_type       is [@layout:comb] record [
  (* QS GOV token LP on Quipuswap DEX *)
  (* TODO: you are 100% sure that qsgov and the qsgov_lp are FA2;
  it maight be enough to just store the FA2 atributes here *)
  qsgov_lp                : token_type;
  (* QS GOV token *)
  qsgov                   : token_type;
]

type burn_callback_type is list(bal_response_type)

type action_type        is
  Default
| Burn_callback           of burn_callback_type

type return_type        is (list(operation) * storage_type)
