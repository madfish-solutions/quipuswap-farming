type use_type           is dex_action_type

type token_type         is [@layout:comb] record [
  token                   : address; (* Token address *)
  id                      : nat; (* Token ID *)
]

type get_balance_type   is [@layout:comb] record [
  balance                 : nat; (* GOV token balance *)
  flag                    : bool; (* GOV token was found in response or not *)
];

[@inline] const zero_address : address =
  ("tz1ZZZZZZZZZZZZZZZZZZZZZZZZZZZZNkiRg" : address);

[@inline] const no_operations : list(operation) = nil;

[@inline] const precision : nat = 1000000000000000000n;