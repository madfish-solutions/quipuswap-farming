type fees_type          is [@layout:comb] record [
  (* % in earned tokens *)
  harvest_fee             : nat;
  (* % of withdrawal amount *)
  withdrawal_fee          : nat;
]

type farm_type          is [@layout:comb] record [
  (* Fees data *)
  fees                    : fees_type;
  (* Last farm updated time *)
  upd                     : timestamp;
  (* Staking params *)
  stake_params            : stake_params_type;
  (* Token in which rewards are paid *)
  reward_token            : token_type;
  (* Timelock in seconds, 0 for farms without timelock *)
  timelock                : nat;
  (* The account TEZ are currently delegated for *)
  current_delegated       : key_hash;
  (* The best candidate to become next delegated *)
  next_candidate          : key_hash;
  (* Falg: farm paused or not *)
  paused                  : bool;
  (* Reward per second *)
  reward_per_second       : nat;
  (* Reward per 1 staked token *)
  reward_per_share        : nat;
  (* Total count of staked tokens in the farm *)
  staked                  : nat;
  (* Total count of claimed tokens *)
  claimed                 : nat;
  (* Farm start time *)
  start_time              : timestamp;
  (* Farm end time *)
  end_time                : timestamp;
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
  (* Banned baker => banned baker info *)
  banned_bakers           : big_map(key_hash, baker_type);
  (* Token (farm) metadata *)
  token_metadata          : big_map(fid_type, tok_meta_type);
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

type set_rps_type       is [@layout:comb] record [
  (* Farm ID *)
  fid                     : fid_type;
  (* New reward per second *)
  reward_per_second       : nat;
]

type add_new_farm_type  is [@layout:comb] record [
  (* Fees data *)
  fees                    : fees_type;
  (* Staking params *)
  stake_params            : stake_params_type;
  (* Token (farm) metadata *)
  token_info              : map(string, bytes);
  (* Token in which rewards are paid *)
  reward_token            : token_type;
  (* Flag: paused or not at the beginning *)
  paused                  : bool;
  (* Timelock in seconds, 0 for farms without timelock *)
  timelock                : nat;
  (* Farm start time *)
  start_time              : timestamp;
  (* Farm end time *)
  end_time                : timestamp;
  (* Reward per second *)
  reward_per_second       : nat;
]

type claim_farm_type    is nat (* Farm ID *)

type claim_return_type  is [@layout:comb] record [
  (* Claim rewards operations *)
  operations              : list(operation);
  (* Updated user (after claiminig ) *)
  user                    : user_info_type;
  (* Updated farm (after claiming) *)
  farm                    : farm_type;
]

type action_type        is
  Set_admin               of set_admin_type
| Confirm_admin           of confirm_admin_type
| Set_fees                of set_fees_type
| Set_burner              of set_burner_type
| Set_baker_registry      of set_registry_type
| Set_is_v2_lp            of set_is_v1_lp_type
| Set_reward_per_second   of set_rps_type
| Ban_bakers              of ban_bakers_type
| Add_new_farm            of add_new_farm_type
| Pause_farms             of pause_farms_type
| Deposit                 of deposit_type
| Withdraw                of withdraw_type
| Harvest                 of harvest_type
| Burn_tez_rewards        of burn_tez_rew_type
| Claim_farm_rewards      of claim_farm_type
| Withdraw_farm_depo      of withdraw_farm_type
| Transfer                of list(fa2_send_type)
| Update_operators        of list(upd_operator_type)
| Balance_of              of balance_of_type
| Update_token_metadata   of upd_tok_meta_type

type return_type        is (list(operation) * storage_type)

type t_farm_func_type   is (action_type * storage_type) -> return_type

type full_storage_type  is [@layout:comb] record [
  (* Contract's real storage *)
  storage                 : storage_type;
  (* Lambdas *)
  t_farm_lambdas          : big_map(nat, bytes);
  (* Contract's metadata according to TZIP-016 *)
  metadata                : big_map(string, bytes);
]

type full_return_type   is (list(operation) * full_storage_type)

type setup_func_type    is [@layout:comb] record [
  (* Index (ID) of the function *)
  index                   : nat;
  (* Function's lambda *)
  func                    : bytes;
]

type full_action_type   is
  Use                     of action_type
| Setup_func              of setup_func_type
| Default                 of default_type

[@inline] const t_farm_methods_max_index : nat = 19n;
