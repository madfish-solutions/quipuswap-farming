function update_farm_rewards(
  var _farm             : farm_type;
  var s                 : storage_type)
                        : storage_type * farm_type is
  block {
    if Tezos.now >= _farm.start_time
    then {
      if _farm.staked =/= 0n
      then {
        const time_diff : nat = abs(Tezos.now - _farm.upd);
        const reward : nat = time_diff * _farm.reward_per_second;

        _farm.reward_per_share :=
          _farm.reward_per_share + reward / _farm.staked;
      }
      else skip;

      _farm.upd := Tezos.now;

      s.farms[_farm.fid] := _farm;
    }
    else skip;
  } with (s, _farm)

function get_proxy_minter_mint_entrypoint(
  const proxy_minter    : address)
                        : contract(mint_gov_toks_type) is
  case (
    Tezos.get_entrypoint_opt("%mint_tokens", proxy_minter)
                        : option(contract(mint_gov_toks_type))
  ) of
    Some(contr) -> contr
  | None        -> (
    failwith("QFarm/proxy-minter-mint-tokens-entrypoint-404")
                        : contract(mint_gov_toks_type)
  )
  end

function claim_rewards(
  var user              : user_info_type;
  var operations        : list(operation);
  var farm              : farm_type;
  const receiver        : address;
  const s               : storage_type)
                        : claim_return_type is
  block {
    const earned : nat = user.earned / precision;

    if earned =/= 0n
    then {
      user.earned := abs(user.earned - earned * precision);

      const actual_earned : nat = earned *
        abs(fee_precision - farm.fees.harvest_fee) / fee_precision;
      const harvest_fee : nat = abs(earned - actual_earned);
      var mint_data : mint_gov_toks_type := list [
        record [
          receiver = receiver;
          amount   = actual_earned;
        ]
      ];

      farm.claimed := farm.claimed + earned;

      if harvest_fee =/= 0n
      then {
        const fee_receiver : address = case s.referrers[Tezos.sender] of
          None           -> zero_address
        | Some(referrer) -> referrer
        end;
        const harvest_fee_mint_data : mint_gov_tok_type = record [
          receiver = fee_receiver;
          amount   = harvest_fee;
        ];

        mint_data := harvest_fee_mint_data # mint_data;
      }
      else skip;

      operations := Tezos.transaction(
        mint_data,
        0mutez,
        get_proxy_minter_mint_entrypoint(s.proxy_minter)
      ) # operations;
    }
    else skip;
  } with (record [
    operations = operations;
    user       = user;
    farm       = farm;
  ])

function burn_rewards(
  var user              : user_info_type;
  var operations        : list(operation);
  var farm              : farm_type;
  const pay_burn_reward : bool;
  const s               : storage_type)
                        : claim_return_type is
  block {
    const earned : nat = user.earned / precision;

    if earned =/= 0n
    then {
      user.earned := abs(user.earned - earned * precision);

      farm.claimed := farm.claimed + earned;

      var mint_data : mint_gov_toks_type := list [];

      if pay_burn_reward
      then {
        const burn_amount : nat = earned *
          abs(fee_precision - farm.fees.burn_reward) / fee_precision;
        const reward : nat = abs(earned - burn_amount);
        const dst1 : mint_gov_tok_type = record [
          receiver = zero_address;
          amount   = burn_amount;
        ];

        mint_data := dst1 # mint_data;

        if reward =/= 0n
        then {
          const dst2 : mint_gov_tok_type = record [
            receiver = Tezos.sender;
            amount   = reward;
          ];

          mint_data := dst2 # mint_data;
        }
        else skip;
      }
      else {
        const dst : mint_gov_tok_type = record [
          receiver = zero_address;
          amount   = earned;
        ];

        mint_data := dst # mint_data;
      };

      operations := Tezos.transaction(
        mint_data,
        0mutez,
        get_proxy_minter_mint_entrypoint(s.proxy_minter)
      ) # operations;
    }
    else skip;
  } with (record [
    operations = operations;
    user       = user;
    farm       = farm;
  ])

function get_baker_registry_validate_entrypoint(
  const baker_registry  : address)
                        : contract(key_hash) is
  case (
    Tezos.get_entrypoint_opt("%validate", baker_registry)
                        : option(contract(key_hash))
  ) of
    Some(contr) -> contr
  | None        -> (
    failwith("QFarm/baker-registry-validate-entrypoint-404")
                        : contract(key_hash)
  )
  end

function get_votes(
  const fid             : fid_type;
  const candidate       : key_hash;
  const s               : storage_type)
                        : nat is
  case s.votes[(fid, candidate)] of
    None      -> 0n
  | Some(amt) -> amt
  end

function get_vote_op(
  const farm            : farm_type;
  const candidate       : key_hash)
                        : operation is
  Tezos.transaction(
    Vote(record [
      candidate = candidate;
      value     = farm.staked;
      voter     = Tezos.self_address;
    ]),
    0mutez,
    get_quipuswap_use_entrypoint(farm.stake_params.qs_pool)
  )

(*
  Vote for the preferred baker using user's LP tokens (shares)

  !DEV! order of operations creating is reverted cause of Ligo's features:
  items can only be added to the beginning of the list
*)
function vote(
  var operations        : list(operation);
  var user              : user_info_type;
  var farm              : farm_type;
  var s                 : storage_type;
  const depo            : deposit_type)
                        : (list(operation) * storage_type) is
  block {
    (* Check if user already voted for the preferred candidate *)
    case s.candidates[(farm.fid, Tezos.sender)] of
      None            -> skip
    | Some(candidate) -> {
      (* Get prev votes count for the user's candidate *)
      const prev_votes : nat = get_votes(farm.fid, candidate, s);

      (* Subtract user's votes from the candidate *)
      if prev_votes >= user.used_votes
      then s.votes[(farm.fid, candidate)] := abs(prev_votes - user.used_votes)
      else skip;
    }
    end;

    (* Get votes amount for all used below candidates *)
    const current_delegated_votes : nat =
      get_votes(farm.fid, farm.current_delegated, s);
    const next_candidate_votes : nat =
      get_votes(farm.fid, farm.next_candidate, s);
    var depo_candidate_votes : nat := get_votes(farm.fid, depo.candidate, s);

    (* Update user's new candidate votes amount *)
    s.votes[(farm.fid, depo.candidate)] := depo_candidate_votes + user.staked;

    (* Update votes for the candidate from user's deposit *)
    depo_candidate_votes := get_votes(farm.fid, depo.candidate, s);

    (* Update user's candidate *)
    s.candidates[(farm.fid, Tezos.sender)] := depo.candidate;

    (* Update user's used votes amount (equal to all staked tokens amount) *)
    user.used_votes := user.staked;

    (* Save updated user to the farm *)
    s.users_info[(farm.fid, Tezos.sender)] := user;

    (* Check if farm already voted for the baker *)
    case s.votes[(farm.fid, farm.current_delegated)] of
      None    -> {
      (* Update the baker who was voted for by the majority *)
      farm.current_delegated := depo.candidate;

      operations := get_vote_op(farm, depo.candidate) # operations;
    }
    | Some(_) -> {
      if current_delegated_votes =/= depo_candidate_votes
      then {
        if current_delegated_votes < depo_candidate_votes
        then {
          (* Update next candidate and current baker *)
          farm.next_candidate := farm.current_delegated;
          farm.current_delegated := depo.candidate;

          operations :=  get_vote_op(farm, depo.candidate) # operations;
        }
        else {
          (* Update next candidate *)
          case s.votes[(farm.fid, farm.next_candidate)] of
            None    -> farm.next_candidate := depo.candidate
          | Some(_) -> {
            if next_candidate_votes < depo_candidate_votes
            then farm.next_candidate := depo.candidate
            else skip;
          }
          end;

          operations := get_vote_op(farm, farm.current_delegated) # operations;
        };
      }
      else {
        case s.votes[(farm.fid, farm.next_candidate)] of
          None    -> skip
        | Some(_) -> {
          if next_candidate_votes > current_delegated_votes
          then {
            (* Swap current baker and next candidate *)
            const tmp : key_hash = farm.current_delegated;

            farm.current_delegated := farm.next_candidate;
            farm.next_candidate := tmp;
          }
          else skip;
        }
        end;

        operations := get_vote_op(farm, farm.current_delegated) # operations;
      };
    }
    end;

    s.farms[farm.fid] := farm;

    operations := Tezos.transaction(
      depo.candidate,
      0mutez,
      get_baker_registry_validate_entrypoint(s.baker_registry)
    ) # operations;
  } with (operations, s)

(*
  Revote for the preferred baker using user's LP tokens (shares)

  !DEV! order of operations creating is reverted cause of Ligo's features:
  items can only be added to the beginning of the list
*)
function revote(
  var operations        : list(operation);
  var user              : user_info_type;
  var farm              : farm_type;
  var s                 : storage_type;
  const value           : nat)
                        : (list(operation) * storage_type) is
  block {
    var users_candidate : key_hash := zero_key_hash;

    (* Get user's candidate *)
    case s.candidates[(farm.fid, Tezos.sender)] of
      None            -> skip
    | Some(candidate) -> {
      (* Get prev votes count for the user's candidate *)
      const prev_votes : nat = get_votes(farm.fid, candidate, s);

      (* Subtract user's votes from the candidate *)
      if prev_votes >= value
      then s.votes[(farm.fid, candidate)] := abs(prev_votes - value)
      else skip;

      users_candidate := candidate;
    }
    end;

    (* Update user's used votes amount (equal to all staked tokens amount) *)
    user.used_votes := abs(user.used_votes - value);

    (* Save updated user to the farm *)
    s.users_info[(farm.fid, Tezos.sender)] := user;

    (* Get votes amount for all used below candidates *)
    const current_delegated_votes : nat =
      get_votes(farm.fid, farm.current_delegated, s);
    const next_candidate_votes : nat =
      get_votes(farm.fid, farm.next_candidate, s);
    const depo_candidate_votes : nat = get_votes(farm.fid, users_candidate, s);

    (* Check if farm already voted for the baker *)
    case s.votes[(farm.fid, farm.current_delegated)] of
      None    -> {
      (* Update the baker who was voted for by the majority *)
      farm.current_delegated := users_candidate;

      operations := get_vote_op(farm, users_candidate) # operations;
    }
    | Some(_) -> {
      if current_delegated_votes =/= depo_candidate_votes
      then {
        if current_delegated_votes < depo_candidate_votes
        then {
          (* Update next candidate and current baker *)
          farm.next_candidate := farm.current_delegated;
          farm.current_delegated := users_candidate;

          operations :=  get_vote_op(farm, users_candidate) # operations;
        }
        else {
          (* Update next candidate *)
          case s.votes[(farm.fid, farm.next_candidate)] of
            None    -> farm.next_candidate := users_candidate
          | Some(_) -> {
            if next_candidate_votes < depo_candidate_votes
            then farm.next_candidate := users_candidate
            else skip;
          }
          end;

          operations := get_vote_op(farm, farm.current_delegated) # operations;
        };
      }
      else {
        case s.votes[(farm.fid, farm.next_candidate)] of
          None    -> skip
        | Some(_) -> {
          if next_candidate_votes > current_delegated_votes
          then {
            (* Swap current baker and next candidate *)
            const tmp : key_hash = farm.current_delegated;

            farm.current_delegated := farm.next_candidate;
            farm.next_candidate := tmp;
          }
          else skip;
        }
        end;

        operations := get_vote_op(farm, farm.current_delegated) # operations;
      };
    }
    end;

    s.farms[farm.fid] := farm;
  } with(operations, s)
