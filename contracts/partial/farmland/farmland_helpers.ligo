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
  const farm            : farm_type;
  const user            : address)
                        : user_info_type is
    (* Get user info *)
    case farm.users_info[user] of
      Some(info) -> info
    | None       -> record [
      referrer    = (None : option(address));
      last_staked = (0 : timestamp);
      staked      = 0n;
      earned      = 0n;
      prev_earned = 0n;
    ]
    end

(* Util to update rewards of the specified farm *)
function update_farm_rewards(
  var farm              : farm_type;
  var s                 : storage_type)
                        : storage_type is
  block {
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
      s.farms[farm.fid] := farm;
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
