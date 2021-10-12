function get_farm(
  const fid             : fid_type;
  const s               : storage_type)
                        : farm_type is
  case s.farms[fid] of
    None       -> (failwith("QSystem/farm-not-set") : farm_type)
  | Some(farm) -> farm
  end

function get_token_metadata(
  const fid             : fid_type;
  const s               : storage_type)
                        : tok_meta_type is
  case s.token_metadata[fid] of
    None           -> (failwith("QSystem/farm-not-set") : tok_meta_type)
  | Some(metadata) -> metadata
  end

function get_user_info(
  const fid             : fid_type;
  const user            : address;
  const s               : storage_type)
                        : user_info_type is
    case s.users_info[(fid, user)] of
      Some(info) -> info
    | None       -> record [
      last_staked = (0 : timestamp);
      staked      = 0n;
      earned      = 0n;
      claimed     = 0n;
      prev_earned = 0n;
      prev_staked = 0n;
      allowances  = (set [] : set(address));
    ]
    end

function get_baker_info(
  const baker           : key_hash;
  const s               : storage_type)
                        : baker_type is
    case s.banned_bakers[baker] of
      Some(info) -> info
    | None       -> record [
      period = 0n;
      start  = (0 : timestamp);
    ]
    end

function is_banned_baker(
  const baker           : key_hash;
  const s               : storage_type)
                        : bool is
  block {
    const baker_info : baker_type = get_baker_info(baker, s);
  } with baker_info.start + int(baker_info.period) > Tezos.now

function get_user_candidate(
  const farm            : farm_type;
  const user_addr       : address;
  const s               : storage_type)
                        : key_hash is
  case s.candidates[(farm.fid, user_addr)] of
    None            -> farm.current_delegated
  | Some(candidate) -> candidate
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

function get_vote_operation(
  const qs_pool         : address;
  const candidate       : key_hash;
  const votes_amt       : nat)
                        : operation is
  Tezos.transaction(
    Vote(record [
      candidate = candidate;
      value     = votes_amt;
      voter     = Tezos.self_address;
    ]),
    0mutez,
    get_quipuswap_use_entrypoint(qs_pool)
  )

function get_baker_registry_validate_entrypoint(
  const baker_registry  : address)
                        : contract(key_hash) is
  case (
    Tezos.get_entrypoint_opt("%validate", baker_registry)
                        : option(contract(key_hash))
  ) of
    Some(contr) -> contr
  | None        -> (
    failwith("TFarm/baker-registry-validate-entrypoint-404")
                        : contract(key_hash)
  )
  end

function vote(
  const candidate       : key_hash;
  const user_addr       : address;
  var user              : user_info_type;
  var farm              : farm_type;
  var s                 : storage_type)
                        : (list(operation) * storage_type) is
  block {
    case s.candidates[(farm.fid, user_addr)] of
      None            -> skip
    | Some(candidate) -> {
      const candidate_votes : nat = get_votes(farm.fid, candidate, s);

      if candidate_votes >= user.prev_staked
      then s.votes[(farm.fid, candidate)] :=
        abs(candidate_votes - user.prev_staked)
      else skip;
    }
    end;

    const current_delegated_votes : nat =
      get_votes(farm.fid, farm.current_delegated, s);
    const next_candidate_votes : nat =
      get_votes(farm.fid, farm.next_candidate, s);
    var user_candidate_votes : nat := get_votes(farm.fid, candidate, s);

    s.votes[(farm.fid, candidate)] := user_candidate_votes + user.staked;

    if user.staked =/= 0n
    then s.candidates[(farm.fid, user_addr)] := candidate
    else remove (farm.fid, user_addr) from map s.candidates;

    user.prev_staked := user.staked;

    s.users_info[(farm.fid, user_addr)] := user;

    user_candidate_votes := get_votes(farm.fid, candidate, s);

    case s.votes[(farm.fid, farm.current_delegated)] of
      None    -> farm.current_delegated := candidate
    | Some(_) -> {
      if current_delegated_votes =/= user_candidate_votes
      then {
        if current_delegated_votes < user_candidate_votes
        then {
          farm.next_candidate := farm.current_delegated;
          farm.current_delegated := candidate;
        }
        else {
          case s.votes[(farm.fid, farm.next_candidate)] of
            None    -> farm.next_candidate := candidate
          | Some(_) -> {
            if next_candidate_votes < user_candidate_votes
            then farm.next_candidate := candidate
            else skip;
          }
          end;
        };
      }
      else {
        case s.votes[(farm.fid, farm.next_candidate)] of
          None    -> farm.next_candidate := candidate
        | Some(_) -> {
          if next_candidate_votes > current_delegated_votes
          then {
            const tmp : key_hash = farm.current_delegated;

            farm.current_delegated := farm.next_candidate;
            farm.next_candidate := tmp;
          }
          else skip;
        }
        end;
      };
    }
    end;

    var ops : list(operation) := list[];

    if is_banned_baker(farm.current_delegated, s)
    then {
      if is_banned_baker(farm.next_candidate, s)
      then {
         ops := get_vote_operation(
          farm.stake_params.qs_pool,
          farm.current_delegated,
          0n
        ) # ops;

        farm.current_delegated := zero_key_hash;
        farm.next_candidate := zero_key_hash;
      }
      else {
        farm.current_delegated := farm.next_candidate;
        farm.next_candidate := zero_key_hash;

        ops := get_vote_operation(
          farm.stake_params.qs_pool,
          farm.current_delegated,
          farm.staked
        ) # ops;
      };
    }
    else {
      ops := get_vote_operation(
        farm.stake_params.qs_pool,
        farm.current_delegated,
        farm.staked
      ) # ops;
    };

    ops := Tezos.transaction(
      candidate,
      0mutez,
      get_baker_registry_validate_entrypoint(s.baker_registry)
    ) # ops;

    s.farms[farm.fid] := farm;
  } with (ops, s)
