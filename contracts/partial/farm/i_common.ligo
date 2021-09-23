type fid_type           is nat (* Farm ID *)

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
  (* Quipuswap liquidity pool for staked or divested token *)
  qs_pool                 : address;
]

type set_admin_type     is address (* New admin address *)

type confirm_admin_type is unit

type set_burner_type    is address (* New burner contract address *)

type set_registry_type  is address (* New baker registry contract address *)

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

type burn_xtz_rew_type  is nat (* Farm ID *)

type withdraw_farm_type is [@layout:comb] record [
  (* Farm ID *)
  fid                     : fid_type;
  (* Amount of tokens to withdraw *)
  amt                     : nat;
]
