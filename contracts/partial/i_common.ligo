type use_type           is dex_action_type

type fa12_type          is address

type fa2_type           is [@layout:comb] record [
  token                   : address; (* Token address *)
  id                      : token_id_type; (* Token ID *)
]

type token_type         is
  FA12                    of fa12_type
| FA2                     of fa2_type

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

[@inline] const fee_precision : nat = 10000n;
