type fid_type           is nat (* Farm ID *)

type user_info_type     is [@layout:comb] record [
  (* Last time when user staked tokens *)
  last_staked             : timestamp;
  (* Total amount of tokens staked by user *)
  staked                  : nat;
  (* Earned amount of tokens by user *)
  earned                  : nat;
  (* Claimed by user amount of tokens per all time *)
  claimed                 : nat;
  (* Previous earned amount of tokens by user *)
  prev_earned             : nat;
  (* Total amount of tokens staked by user in previous contract call *)
  prev_staked             : nat;
  (* Set of user's allowances for staked tokens transfer *)
  allowances              : set(address);
]

type stake_params_type  is [@layout:comb] record [
  (* Token to stake *)
  staked_token            : token_type;
  (* Flag: QuipuSwap V1 LP token staked or not *)
  is_v1_lp                : bool;
]

type set_admin_type     is address (* New admin address *)

type confirm_admin_type is unit

type set_burner_type    is address (* New burner contract address *)

type set_registry_type  is address (* New baker registry contract address *)

type set_is_v1_lp_type  is [@layout:comb] record [
  (* Farm ID *)
  fid                     : fid_type;
  (* Flag: staked LP tokens is LP of QuipuSwap V1 TEZ/TOK pair or not *)
  is_v1_lp                : bool;
]

type baker_type         is [@layout:comb] record [
  (* Period during which baker will be banned (in seconds)*)
  period                  : nat;
  (* Banning start time *)
  start                   : timestamp;
]

type ban_baker_type     is [@layout:comb] record [
  (* Baker to ban or unban *)
  baker                   : key_hash;
  (* Period during which baker will be banned (in seconds). 0 for unban *)
  period                  : nat;
]

type ban_bakers_type    is list(ban_baker_type)

type pause_farm_type    is [@layout:comb] record [
  (* Farm ID *)
  fid                     : fid_type;
  (* Flag: pause or unpause *)
  pause                   : bool;
]

type pause_farms_type   is list(pause_farm_type)

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

type burn_tez_rew_type  is nat (* Farm ID *)

type withdraw_farm_type is [@layout:comb] record [
  (* Farm ID *)
  fid                     : fid_type;
  (* Amount of tokens to withdraw *)
  amt                     : nat;
]

type tok_meta_type      is [@layout:comb] record [
  (* Token (farm) ID *)
  token_id                : nat;
  (* Token metadata *)
  token_info              : map(string, bytes);
]

type meta_pair_type     is [@layout:comb] record [
  (* Metadata key *)
  key                     : string;
  (* Metadata value *)
  value                   : bytes;
]

type upd_tok_meta_type  is [@layout:comb] record [
  (* Token (farm) ID *)
  token_id                : nat;
  (* Token metadata *)
  token_info              : list(meta_pair_type);
]

type default_type       is unit
