(* Util to get farm from storage by farm ID *)
function get_farm(
  const fid             : fid_type;
  const s               : storage_type)
                        : farm_type is
  (* Get farm info *)
  case s.farms[fid] of
    None       -> (failwith("Farmland/farm-not-set") : farm_type)
  | Some(farm) -> farm
  end

(* Util to get user info related to specific farm *)
function get_user_info(
  const fid             : fid_type;
  const user            : address;
  const s               : storage_type)
                        : user_info_type is
  block {
    (* Get farm by ID *)
    const farm : farm_type = get_farm(fid, s);

    (* Get user info *)
    const user_info : user_info_type = case farm.users_info[user] of
      Some(info) -> info
    | None       -> record [
      last_staked = 0n;
      staked      = 0n;
      earned      = 0n;
      prev_earned = 0n;
      referrer    = (None : option(address));
    ]
    end;
  } with user_info

(* Util to update rewards of the specified farm *)
function update_farm_rewards(
  const fid             : fid_type;
  var s                 : storage_type)
                        : storage_type is
  block {
    (* Get farm by ID *)
    var farm : farm_type := get_farm(fid, s);

    (* Check if farm is already started *)
    if Tezos.level <= farm.start_block
    then skip
    else {
      (* Check if some tokens is already staked *)
      if farm.staked =/= 0n
      then {
        (* Calculate timedelta in blocks *)
        const time_diff : nat = abs(Tezos.now - farm.upd);

        (* Calculate new rewards to be minted for the farm *)
        const reward : nat = time_diff * s.qsgov_per_second *
          precision * farm.alloc_point / s.total_alloc_point;

        (* Update farm's reward per share *)
        farm.rps := farm.rps + reward / farm.staked;
      }
      else skip;

      (* Update farm's update block *)
      farm.upd := Tezos.now;

      (* Save the farm to the storage *)
      s.farms[fid] := farm;
    };
  } with s

(* Util to get proxy minter's %mint_qsgov_tokens entrypoint *)
function get_proxy_minter_mint_entrypoint(
  const proxy_minter    : address)
                        : contract(mint_gov_toks_type) is
  case (
    Tezos.get_entrypoint_opt("%mint_qsgov_tokens", proxy_minter)
                        : option(contract(mint_gov_toks_type))
  ) of
    Some(contr) -> contr
  | None        -> (
    failwith("ProxyMinter/mint-qsgov-tokens-entrypoint-404")
                        : contract(mint_gov_toks_type)
  )
  end

(* Util to claim sender's rewards *)
function claim_rewards(
  var user              : user_info_type;
  const farm            : farm_type;
  const receiver        : address;
  const s               : storage_type)
                        : (option(operation) * user_info_type) is
  block {
    (* Update users's reward *)
    user.earned := user.earned +
      abs(user.staked * farm.rps - user.prev_earned);

    (* Calculate user's real reward *)
    const earned : nat = user.earned / precision;

    (* Operation to be performed *)
    var op : option(operation) := (None : option(operation));

    (* Ensure sufficient reward *)
    if earned = 0n
    then skip
    else {
      (* Decrement pending reward *)
      user.earned := abs(user.earned - earned * precision);

      (* Calculate actual reward including harvest fee *)
      const actual_earned : nat = earned *
        abs(10000n - farm.fees.harvest_fee) / 10000n;

      (* Calculate harvest fee *)
      const harvest_fee : nat = abs(earned - actual_earned);

      (* Prepare params for QS GOV tokens minting to rewards receiver *)
      var mint_data : mint_gov_toks_type := list [
        record [
          receiver = receiver;
          amount   = actual_earned;
        ]
      ];

      (* Ensure harvest fee is greater than 0 *)
      if harvest_fee > 0n
      then {
        (* Get sender's referrer *)
        const receiver : address = case user.referrer of
          None           -> zero_address
        | Some(referrer) -> referrer
        end;

        (* Prepare params for QS GOV tokens minting to referrer *)
        const harvest_fee_mint_data : mint_gov_tok_type = record [
          receiver = receiver;
          amount   = harvest_fee;
        ];

        (* Update mint params *)
        mint_data := harvest_fee_mint_data # mint_data;
      }
      else skip;

      (* Operation for minting QS GOV tokens *)
      op := Some(
        Tezos.transaction(
          mint_data,
          0mutez,
          get_proxy_minter_mint_entrypoint(s.proxy_minter)
        )
      );
    };
  } with (op, user)
