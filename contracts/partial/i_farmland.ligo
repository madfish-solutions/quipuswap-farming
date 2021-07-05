type fid_type           is nat

type fees_type          is [@layout:comb] record [
  interface_fee           : nat;
  withdrawal_fee          : nat;
]

type user_info_type     is [@layout:comb] record [
  staked                  : nat;
  earned                  : nat;
  prev_earned             : nat;
]

type farm_type          is [@layout:comb] record [
  users_info              : map(address, user_info_type);
  fees                    : fees_type;
  updated                 : timestamp;
  staked_token            : address;
  reward_token            : address;
  is_lp_farm              : bool;
  timelock                : bool;
  rps                     : nat;
  share_reward            : nat;
  staked                  : nat;
]

type storage_type       is [@layout:comb] record [
  farms                   : big_map(fid_type, farm_type);
  qugo_token              : address;
  admin                   : address;
  pending_admin           : address;
  farms_count             : nat;
]

type set_admin_type     is address

type confirm_admin_type is unit

type action_type        is
  Set_admin               of set_admin_type
| Confirm_admin           of confirm_admin_type

type return_type        is (list(operation) * storage_type)

type farmland_func_type is (action_type * storage_type) -> return_type

type full_storage_type  is [@layout:comb] record [
  storage                 : storage_type;
  farmland_lambdas        : big_map(nat, farmland_func_type);
]

type full_return_type   is (list(operation) * full_storage_type)

type setup_func_type    is [@layout:comb] record [
  index                   : nat;
  func                    : farmland_func_type;
]

type full_action_type   is
  Use                     of action_type
| Setup_func              of setup_func_type

[@inline] const no_operations : list(operation) = nil;

[@inline] const zero_address : address =
  ("tz1ZZZZZZZZZZZZZZZZZZZZZZZZZZZZNkiRg" : address);

[@inline] const default_qugo_id : nat = 0n;

[@inline] const farmland_methods_count : nat = 1n;

[@inline] const timelock_period : nat = 2_592_000n; (* 30 days *)
