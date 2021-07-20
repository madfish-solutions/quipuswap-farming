type fid_type           is nat (* Farm ID *)

type fees_type          is [@layout:comb] record [
  harvest_fee             : nat; (* % in earned tokens *)
  withdrawal_fee          : nat; (* % of withdrawal amount *)
]

type user_info_type     is [@layout:comb] record [
  last_staked             : timestamp; (* Last time when user staked tokens *)
  staked                  : nat; (* Total amount of tokens staked by user *)
  earned                  : nat; (* Earned amount of tokens by user *)
  prev_earned             : nat; (* Previous earned amount of tokens by user *)
]

type timelock_type      is [@layout:comb] record [
  duration                : nat; (* in seconds, 0 for farms without timelock *)
]

type farm_type          is [@layout:comb] record [
  users_info              : map(address, user_info_type); (* Users data *)
  fees                    : fees_type; (* Fees data *)
  upd                     : timestamp; (* Last farm updated timestamp *)
  staked_token            : token_type; (* Token to stake *)
  reward_token            : token_type; (* Token in which rewards are paid *)
  timelock                : timelock_type; (* Timelock info *)
  is_lp_farm              : bool; (* Flag: LP token staked or not *)
  is_fa2_token            : bool; (* Flag: staked tok standard is FA2 or not *)
  paused                  : bool; (* Falg: farm paused or not *)
  alloc_point             : nat; (* Farm allocation point *)
  rps                     : nat; (* Reward per share *)
  staked                  : nat; (* Total count of staked tokens in the farm *)
  start_block             : nat; (* Farm start block *)
  fid                     : nat; (* Farm ID *)
]

type storage_type       is [@layout:comb] record [
  farms                   : big_map(fid_type, farm_type); (* Farms data *)
  referrers               : big_map(address, address); (* Referrers *)
  qsgov                   : token_type; (* QS GOV token *)
  admin                   : address; (* Contract's actual admin address *)
  pending_admin           : address; (* Contract's pending admin address *)
  burner                  : address; (* Burner contract address *)
  proxy_minter            : address; (* Proxy minter contract address *)
  farms_count             : nat; (* Number of farms registered on contract *)
  qsgov_per_second        : nat; (* Reward per second for all farms *)
  total_alloc_point       : nat; (* Sum of all allocation points in farms *)
  collected_wfee          : nat; (* Number of collected withdrawal fee *)
]

type set_admin_type     is address (* New admin address *)

type confirm_admin_type is unit

type set_alloc_type     is [@layout:comb] record [
  fid                     : fid_type; (* Farm ID *)
  alloc_point             : nat; (* New allocation for the farm *)
  with_update             : bool; (* Flag: update rewards on the farm or not *)
]

type set_allocs_type    is list(set_alloc_type)

type set_fee_type       is [@layout:comb] record [
  fid                     : fid_type; (* Farm ID *)
  fees                    : fees_type; (* Fees data *)
]

type set_fees_type      is list(set_fee_type)

type set_rps_type       is nat (* QS GOV tokens (reward) per second *)

type set_burner_type    is address (* New burner contract address *)

type set_proxy_type     is address (* New proxy minter contract address *)

type add_new_farm_type  is [@layout:comb] record [
  fees                    : fees_type; (* Fees data *)
  staked_token            : token_type; (* Token to stake *)
  is_lp_farm              : bool; (* Flag: LP token staked or not *)
  is_fa2_token            : bool; (* Flag: staked tok standard is FA2 or not *)
  paused                  : bool; (* Flag: paused or not at the beginning *)
  timelock                : timelock_type; (* Timelock info *)
  alloc_point             : nat; (* Farm allocation point *)
  start_block             : nat; (* Farm start block *)
]

type pause_farm_type    is [@layout:comb] record [
  fid                     : fid_type; (* Farm ID *)
  pause                   : bool; (* Flag: pause or unpause *)
]

type pause_farms_type   is list(pause_farm_type)

type deposit_type       is [@layout:comb] record [
  fid                     : fid_type; (* Farm ID *)
  amt                     : nat; (* Amount of tokens to deposit *)
  referrer                : option(address); (* User's referrer *)
  rewards_receiver        : address; (* Receiver of unstaked tokens *)
]

type withdraw_type      is [@layout:comb] record [
  fid                     : fid_type; (* Farm ID *)
  amt                     : nat; (* Amount of tokens to withdraw *)
  receiver                : address; (* Receiver of unstaked tokens *)
  rewards_receiver        : address; (* Receiver of unstaked tokens *)
]

type harvest_type       is [@layout:comb] record [
  fid                     : fid_type; (* Farm ID *)
  rewards_receiver        : address; (* Receiver of earned tokens *)
]

type burn_rewards_type  is nat (* Farm ID *)

type burn_qsgov_type    is unit

type action_type        is
  Set_admin               of set_admin_type
| Confirm_admin           of confirm_admin_type
| Set_alloc_points        of set_allocs_type
| Set_fees                of set_fees_type
| Set_reward_per_second   of set_rps_type
| Set_burner              of set_burner_type
| Set_proxy_minter        of set_proxy_type
| Add_new_farm            of add_new_farm_type
| Pause_farms             of pause_farms_type
| Deposit                 of deposit_type
| Withdraw                of withdraw_type
| Harvest                 of harvest_type
| Burn_rewards            of burn_rewards_type
| Burn_qsgov_tokens       of burn_qsgov_type

type return_type        is (list(operation) * storage_type)

type farmland_func_type is (action_type * storage_type) -> return_type

type full_storage_type  is [@layout:comb] record [
  storage                 : storage_type; (* Contract's real storage *)
  farmland_lambdas        : big_map(nat, farmland_func_type); (* Lambdas *)
]

type full_return_type   is (list(operation) * full_storage_type)

type setup_func_type    is [@layout:comb] record [
  index                   : nat; (* Index (ID) of the function *)
  func                    : farmland_func_type; (* Function's lambda *)
]

type full_action_type   is
  Use                     of action_type
| Setup_func              of setup_func_type

[@inline] const default_qsgov_id : nat = 0n;

[@inline] const farmland_methods_max_index : nat = 13n;

[@inline] const timelock_period : nat = 2_592_000n; (* 30 days *)
