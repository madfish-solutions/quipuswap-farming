type fid_type           is nat

type fees_type          is [@layout:comb] record [
  interface_fee           : nat;
  withdrawal_fee          : nat;
]

type user_info_type     is [@layout:comb] record [
  last_staked             : nat;
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
  timelocked              : bool;
  alloc_point             : nat;
  share_reward            : nat;
  staked                  : nat;
]

type storage_type       is [@layout:comb] record [
  farms                   : big_map(fid_type, farm_type);
  qugo_token              : address;
  admin                   : address;
  pending_admin           : address;
  farms_count             : nat;
  qugo_per_second         : nat;
  total_alloc_point       : nat;
]

type set_admin_type     is address

type confirm_admin_type is unit

type set_alloc_type     is [@layout:comb] record [
  fid                     : fid_type;
  alloc_point             : nat;
  with_update             : bool;
]

type set_allocs_type    is list(set_alloc_type)

type action_type        is
  Set_admin               of set_admin_type
| Confirm_admin           of confirm_admin_type
| Set_alloc_points        of set_allocs_type

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

[@inline] const farmland_methods_max_index : nat = 2n;

[@inline] const timelock_period : nat = 2_592_000n; (* 30 days *)
