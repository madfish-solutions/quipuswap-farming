type fees_type          is [@layout:comb] record [
  (* % in earned tokens *)
  harvest_fee             : nat;
  (* % of withdrawal amount *)
  withdrawal_fee          : nat;
  (* % from burn amount (farm rewards) *)
  burn_reward          : nat;
]

type farm_type          is [@layout:comb] record [
  (* Fees data *)
  fees                    : fees_type;
  (* Last farm updated timestamp *)
  upd                     : timestamp;
  (* Staking params *)
  stake_params            : stake_params_type;
  (* Token in which rewards are paid *)
  reward_token            : fa2_type;
  (* Timelock in seconds, 0 for farms without timelock *)
  timelock                : nat;
  (* The account XTZ are currently delegated for *)
  current_delegated       : key_hash;
  (* The best candidate to become next delegated *)
  current_candidate       : key_hash;
  (* Falg: farm paused or not *)
  paused                  : bool;
  (* QS GOV tokens per second *)
  reward_per_second       : nat;
  (* Reward per 1 staked token *)
  reward_per_share        : nat;
  (* Total count of staked tokens in the farm *)
  staked                  : nat;
  (* Farm start timestamp *)
  start_time              : timestamp;
  (* Farm ID *)
  fid                     : fid_type;
]

type storage_type       is [@layout:comb] record [
  (* Farms data *)
  farms                   : big_map(fid_type, farm_type);
  (* Referrers *)
  referrers               : big_map(address, address);
  (* Users data *)
  users_info              : big_map((fid_type * address), user_info_type);
  (* Votes per candidate (baker) *)
  votes                   : big_map((fid_type * key_hash), nat);
  (* User and choosen candidate *)
  candidates              : big_map((fid_type * address), key_hash);
  (* QS GOV token *)
  qsgov                   : fa2_type;
  (* QS GOV token LP on Quipuswap DEX *)
  qsgov_lp                : address;
  (* Contract's actual admin address *)
  admin                   : address;
  (* Contract's pending admin address *)
  pending_admin           : address;
  (* Burner contract address *)
  burner                  : address;
  (* Proxy minter contract address *)
  proxy_minter            : address;
  (* Baker registry contract address *)
  baker_registry          : address;
  (* Number of farms registered on contract *)
  farms_count             : nat;
]

type set_fee_type       is [@layout:comb] record [
  (* Farm ID *)
  fid                     : fid_type;
  (* Fees data *)
  fees                    : fees_type;
]

type set_fees_type      is list(set_fee_type)

type rew_per_sec_type   is [@layout:comb] record [
  (* Farm ID *)
  fid                     : fid_type;
  (* QS GOV tokens per second *)
  reward_per_second       : nat;
]

type set_rew_p_sec_type is list(rew_per_sec_type)

type set_proxy_type     is address (* New proxy minter contract address *)

type add_new_farm_type  is [@layout:comb] record [
  (* Fees data *)
  fees                    : fees_type;
  (* Staking params *)
  stake_params            : stake_params_type;
  (* Flag: paused or not at the beginning *)
  paused                  : bool;
  (* QS GOV tokens per second *)
  reward_per_second       : nat;
  (* Timelock in seconds, 0 for farms without timelock *)
  timelock                : nat;
  (* Farm start timestamp *)
  start_time              : timestamp;
]

type burn_farm_rew_type is nat (* Farm ID *)

type action_type        is
  Set_admin               of set_admin_type
| Confirm_admin           of confirm_admin_type
| Set_fees                of set_fees_type
| Set_reward_per_second   of set_rew_p_sec_type
| Set_burner              of set_burner_type
| Set_proxy_minter        of set_proxy_type
| Set_baker_registry      of set_registry_type
| Add_new_farm            of add_new_farm_type
| Pause_farms             of pause_farms_type
| Deposit                 of deposit_type
| Withdraw                of withdraw_type
| Harvest                 of harvest_type
| Burn_xtz_rewards        of burn_xtz_rew_type
| Burn_farm_rewards       of burn_farm_rew_type
| Withdraw_farm_depo      of withdraw_farm_type

type return_type        is (list(operation) * storage_type)

type q_farm_func_type   is (action_type * storage_type) -> return_type

type full_storage_type  is [@layout:comb] record [
  (* Contract's real storage *)
  storage                 : storage_type;
  (* Lambdas *)
  q_farm_lambdas          : big_map(nat, q_farm_func_type);
]

type full_return_type   is (list(operation) * full_storage_type)

type setup_func_type    is [@layout:comb] record [
  (* Index (ID) of the function *)
  index                   : nat;
  (* Function's lambda *)
  func                    : q_farm_func_type;
]

type default_type       is unit

type full_action_type   is
  Use                     of action_type
| Setup_func              of setup_func_type
| Default                 of unit

[@inline] const q_farm_methods_max_index : nat = 15n;
