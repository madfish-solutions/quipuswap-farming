type use_type           is dex_action_type

(* TODO: use variant type instead *)
type token_type         is [@layout:comb] record [
  token                   : address; (* Token address *)
  id                      : nat; (* Token ID *)
  is_fa2                  : bool; (* Flag: token standard is FA2 or not *)
]

type get_balance_type   is [@layout:comb] record [
  balance                 : nat; (* GOV token balance *)
  flag                    : bool; (* GOV token was found in response or not *)
];

[@inline] const zero_address : address =
  ("tz1ZZZZZZZZZZZZZZZZZZZZZZZZZZZZNkiRg" : address);

[@inline] const zero_key_hash : key_hash =
  ("tz1ZZZZZZZZZZZZZZZZZZZZZZZZZZZZNkiRg" : key_hash);

[@inline] const no_operations : list(operation) = nil;

[@inline] const precision : nat = 1000000000000000000n;
