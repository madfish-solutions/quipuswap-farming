type fid_type           is nat (* Farm ID *)

type fees_type          is [@layout:comb] record [
  (* % in earned tokens *)
  harvest_fee             : nat;
  (* % of withdrawal amount *)
  withdrawal_fee          : nat;
]

type user_info_type     is [@layout:comb] record [
  (* Last time when user staked tokens *)
  last_staked             : timestamp;
  (* Total amount of tokens staked by user *)
  staked                  : nat;
  (* Earned amount of tokens by user *)
  earned                  : nat;
  (* Previous earned amount of tokens by user *)
  prev_earned             : nat;
  (* Amount of used votes for the preferred baker *)
  used_votes              : nat;
]

type stake_params_type  is [@layout:comb] record [
  (* Token to stake *)
  staked_token            : token_type;
  (* Flag: LP token staked or not *)
  is_lp_staked_token      : bool;
  (* If LP token staked - non zero address + ID, else - zero address + 0 ID *)
  token                   : token_type;
  (* Quipuswap liquidity pool for staked or divested token *)
  qs_pool                 : address;
]

type farm_type          is [@layout:comb] record [
  (* Fees data *)
  fees                    : fees_type;
  (* Last farm updated timestamp *)
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
  current_candidate       : key_hash;
  (* Farm allocation point *)
  alloc_point             : nat;
  (* Flag: points already allocated or nor *)
  allocated               : bool;
  (* Reward per share *)
  rps                     : nat;
  (* Total count of staked tokens in the farm *)
  staked                  : nat;
  (* Farm start timestamp *)
  start_time              : timestamp;
  (* Farm ID *)
  fid                     : fid_type;
  (* Total votes participated in voting *)
  total_votes             : nat;
]

type temp_type          is [@layout:comb] record [
  (* Min amount of QS GOV swapped tokens *)
  min_qs_gov_output       : nat;
  (* Token that will be swapped for XTZ *)
  token                   : token_type;
  (* Quipuswap liquidity pool for tokens exchange *)
  qs_pool                 : address;
]

type storage_type       is [@layout:comb] record [
  (* Farms data *)
  farms                   : big_map(fid_type, farm_type);
  (* Referrers *)
  referrers               : big_map(address, address);
  (* Users data *)
  users_info              : big_map(fid_type * address, user_info_type);
  (* Votes per candidate (baker) *)
  votes                   : big_map(fid_type * key_hash, nat);
  (* User and choosen candidate *)
  candidates              : big_map(fid_type * address, key_hash);
  (* Temp data that stores data between inter contract calls and callbacks *)
  temp                    : temp_type;
  (* QS GOV token *)
  qsgov                   : token_type;
  (* QS GOV token liquidity pool on Quipuswap DEX *)
  qsgov_pool              : address;
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
  (* Reward per second for all farms *)
  qsgov_per_second        : nat;
  (* Sum of all allocation points in farms *)
  total_alloc_point       : nat;
]

type set_admin_type     is address (* New admin address *)

type confirm_admin_type is unit

type set_alloc_type     is [@layout:comb] record [
  (* Farm ID *)
  fid                     : fid_type;
  (* New allocation for the farm *)
  alloc_point             : nat;
]

type set_allocs_type    is list(set_alloc_type)

type set_fee_type       is [@layout:comb] record [
  (* Farm ID *)
  fid                     : fid_type;
  (* Fees data *)
  fees                    : fees_type;
]

type set_fees_type      is list(set_fee_type)

type set_rps_type       is nat (* QS GOV tokens (reward) per second *)

type set_burner_type    is address (* New burner contract address *)

type set_proxy_type     is address (* New proxy minter contract address *)

type set_registry_type  is address (* New baker registry contract address *)

type add_new_farm_type  is [@layout:comb] record [
  (* Fees data *)
  fees                    : fees_type;
  (* Staking params *)
  stake_params            : stake_params_type;
  (* Timelock in seconds, 0 for farms without timelock *)
  timelock                : nat;
  (* Farm allocation point *)
  alloc_point             : nat;
  (* Farm start timestamp *)
  start_time              : timestamp;
]

type deposit_type       is [@layout:comb] record [
  (* Farm ID *)
  fid                     : fid_type;
  (* Amount of tokens to deposit *)
  amt                     : nat;
  (* User's referrer *)
  referrer                : option(address);
  (* Receiver of earned tokens *)
  rewards_receiver        : address;
  (* The baker for voting *)
  candidate               : key_hash;
]

type withdraw_type      is [@layout:comb] record [
  (* Farm ID *)
  fid                     : fid_type;
  (* Amount of tokens to withdraw *)
  amt                     : nat;
  (* Receiver of unstaked tokens *)
  receiver                : address;
  (* Receiver of earned tokens *)
  rewards_receiver        : address;
]

type harvest_type       is [@layout:comb] record [
  (* Farm ID *)
  fid                     : fid_type;
  (* Receiver of earned tokens *)
  rewards_receiver        : address;
]

type burn_xtz_rew_type  is nat (* Farm ID *)

type burn_farm_rew_type is nat (* Farm ID *)

type buyback_type       is [@layout:comb] record [
  (* Farm ID *)
  fid                     : fid_type;
  (* Amount of tokens to withdraw *)
  amt                     : nat;
  (* Min amount of QS GOV tokens from swap *)
  min_qs_gov_output       : nat;
]

type fa12_bal_type      is nat

type fa2_bal_type       is list(bal_response_type)

type action_type        is
  Set_admin               of set_admin_type
| Confirm_admin           of confirm_admin_type
| Set_alloc_points        of set_allocs_type
| Set_fees                of set_fees_type
| Set_reward_per_second   of set_rps_type
| Set_burner              of set_burner_type
| Set_proxy_minter        of set_proxy_type
| Set_baker_registry      of set_registry_type
| Add_new_farm            of add_new_farm_type
| Deposit                 of deposit_type
| Withdraw                of withdraw_type
| Harvest                 of harvest_type
| Burn_xtz_rewards        of burn_xtz_rew_type
| Burn_farm_rewards       of burn_farm_rew_type
| Buyback                 of buyback_type
| Fa12_tok_bal_callback   of fa12_bal_type
| Fa2_tok_bal_callback    of fa2_bal_type

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

type full_action_type   is
  Use                     of action_type
| Setup_func              of setup_func_type

[@inline] const q_farm_methods_max_index : nat = 17n;
