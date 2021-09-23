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
  (* The account XTZ are currently delegated for *)
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
  banned_bakers           : big_map(key_hash, banned_baker_type);
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

type add_new_farm_type  is [@layout:comb] record [
  (* Fees data *)
  fees                    : fees_type;
  (* Staking params *)
  stake_params            : stake_params_type;
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

type action_type        is
  Set_admin               of set_admin_type
| Confirm_admin           of confirm_admin_type
| Set_fees                of set_fees_type
| Set_burner              of set_burner_type
| Set_baker_registry      of set_registry_type
| Ban_bakers              of ban_bakers_type
| Add_new_farm            of add_new_farm_type
| Pause_farms             of pause_farms_type
| Deposit                 of deposit_type
| Withdraw                of withdraw_type
| Harvest                 of harvest_type
| Burn_xtz_rewards        of burn_xtz_rew_type
| Claim_farm_rewards      of claim_farm_type
| Withdraw_farm_depo      of withdraw_farm_type

type return_type        is (list(operation) * storage_type)

type t_farm_func_type   is (action_type * storage_type) -> return_type

type full_storage_type  is [@layout:comb] record [
  (* Contract's real storage *)
  storage                 : storage_type;
  (* Lambdas *)
  t_farm_lambdas          : big_map(nat, t_farm_func_type);
]

type full_return_type   is (list(operation) * full_storage_type)

type setup_func_type    is [@layout:comb] record [
  (* Index (ID) of the function *)
  index                   : nat;
  (* Function's lambda *)
  func                    : t_farm_func_type;
]

type full_action_type   is
  Use                     of action_type
| Setup_func              of setup_func_type

[@inline] const t_farm_methods_max_index : nat = 13n;
