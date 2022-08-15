type tez_t              is unit

type fa12_token_t       is address

type fa2_token_t        is [@layout:comb] record [
  token                   : address;
  id                      : nat;
]

type token_id_t         is nat

type token_t            is
| Tez                     of tez_t
| Fa12                    of fa12_token_t
| Fa2                     of fa2_token_t

type tokens_t           is [@layout:comb] record [
  token_a                 : token_t;
  token_b                 : token_t;
]

type flash_swap_callback_t is [@layout:comb] record [
  pair_id                 : token_id_t;
  prev_tez_balance        : nat;
  amount_in               : nat;
]

type fees_t             is [@layout:comb] record [
  interface_fee           : nat;
  swap_fee                : nat;
  auction_fee             : nat;
  withdraw_fee_reward     : nat;
]


type launch_exchange_t  is [@layout:comb] record [
  pair                    : tokens_t;
  token_a_in              : nat;
  token_b_in              : nat;
  shares_receiver         : address;
  candidate               : key_hash;
  deadline                : timestamp;
]

type vote_t             is [@layout:comb] record [
  voter                   : address;
  candidate               : key_hash;
  execute_voting          : bool;
  votes                   : nat;
]

type launch_callback_t  is [@layout:comb] record [
  vote_params             : vote_t;
  bucket                  : address;
]

type invest_liquidity_t is [@layout:comb] record [
  pair_id                 : token_id_t;
  token_a_in              : nat;
  token_b_in              : nat;
  shares                  : nat;
  shares_receiver         : address;
  candidate               : key_hash;
  deadline                : timestamp;
]

type divest_liquidity_t is [@layout:comb] record [
  pair_id                 : token_id_t;
  min_token_a_out         : nat;
  min_token_b_out         : nat;
  shares                  : nat;
  liquidity_receiver      : address;
  candidate               : key_hash;
  deadline                : timestamp;
]

type swap_side_t        is [@layout:comb] record [
  pool                    : nat;
  token                   : token_t;
]

type swap_data_t        is [@layout:comb] record [
  to_                     : swap_side_t;
  from_                   : swap_side_t;
]

type swap_direction_t   is
| A_to_b
| B_to_a

type swap_slice_t       is [@layout:comb] record [
  direction               : swap_direction_t;
  pair_id                 : token_id_t;
]

type swap_t             is [@layout:comb] record [
  lambda                  : option(unit -> list(operation));
  swaps                   : list(swap_slice_t);
  deadline                : timestamp;
  receiver                : address;
  referrer                : address;
  amount_in               : nat;
  min_amount_out          : nat;
]

type withdraw_profit_t  is [@layout:comb] record [
  receiver                : contract(unit);
  pair_id                 : token_id_t;
]

type claim_fee_t        is [@layout:comb] record [
  token                   : token_t;
  receiver                : address;
]

type claim_tez_fee_t    is [@layout:comb] record [
  pair_id                 : token_id_t;
  receiver                : address;
]

type withdraw_fee_t     is [@layout:comb] record [
  pair_id                 : option(token_id_t);
  token                   : token_t;
]

type dex_vote_t         is [@layout:comb] record [
  pair_id                 : token_id_t;
  candidate               : key_hash;
]


type dex_action_type    is
(* DEX *)
| Launch_exchange         of launch_exchange_t
| Invest_liquidity        of invest_liquidity_t
| Divest_liquidity        of divest_liquidity_t
| Swap                    of swap_t
| Withdraw_profit         of withdraw_profit_t
| Vote                    of dex_vote_t
