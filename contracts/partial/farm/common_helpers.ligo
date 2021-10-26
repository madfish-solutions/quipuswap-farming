function get_farm(
  const fid             : fid_type;
  const farms           : big_map(fid_type, farm_type))
                        : farm_type is
  case farms[fid] of
    None       -> (failwith("QSystem/farm-not-set") : farm_type)
  | Some(farm) -> farm
  end

function get_token_metadata(
  const fid             : fid_type;
  const token_metadata  : big_map(fid_type, tok_meta_type))
                        : tok_meta_type is
  case token_metadata[fid] of
    None           -> (failwith("QSystem/farm-not-set") : tok_meta_type)
  | Some(metadata) -> metadata
  end

function get_user_info(
  const fid             : fid_type;
  const user            : address;
  const users_info      : big_map((fid_type * address), user_info_type))
                        : user_info_type is
    case users_info[(fid, user)] of
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
  const banned_bakers   : big_map(key_hash, baker_type))
                        : baker_type is
    case banned_bakers[baker] of
      Some(info) -> info
    | None       -> record [
      period = 0n;
      start  = (0 : timestamp);
    ]
    end

function is_banned_baker(
  const baker           : key_hash;
  const banned_bakers   : big_map(key_hash, baker_type))
                        : bool is
  block {
    const baker_info : baker_type = get_baker_info(baker, banned_bakers);
  } with baker_info.start + int(baker_info.period) > Tezos.now

function get_user_candidate(
  const farm            : farm_type;
  const user_addr       : address;
  const candidates      : big_map((fid_type * address), key_hash))
                        : key_hash is
  case candidates[(farm.fid, user_addr)] of
    None            -> farm.current_delegated
  | Some(candidate) -> candidate
  end

function get_votes(
  const fid             : fid_type;
  const candidate       : key_hash;
  const votes           : big_map((fid_type * key_hash), nat))
                        : nat is
  case votes[(fid, candidate)] of
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
  const user_candidate  : key_hash;
  const user_addr       : address;
  var user              : user_info_type;
  var farm              : farm_type;
  var s                 : storage_type)
                        : storage_type is
  block {
    case s.candidates[(farm.fid, user_addr)] of
      None            -> skip
    | Some(user_candidate) -> {
      const candidate_votes : nat =
        get_votes(farm.fid, user_candidate, s.votes);

      if candidate_votes >= user.prev_staked
      then s.votes[(farm.fid, user_candidate)] :=
        abs(candidate_votes - user.prev_staked)
      else skip;
    }
    end;

    const user_candidate_prev_votes : nat =
      get_votes(farm.fid, user_candidate, s.votes);
    const user_candidate_votes = user_candidate_prev_votes + user.staked;

    s.votes[(farm.fid, user_candidate)] := user_candidate_votes;

    if user.staked =/= 0n
    then s.candidates[(farm.fid, user_addr)] := user_candidate
    else remove (farm.fid, user_addr) from map s.candidates;

    user.prev_staked := user.staked;

    s.users_info[(farm.fid, user_addr)] := user;

    const current_delegated_votes : nat =
      get_votes(farm.fid, farm.current_delegated, s.votes);
    const next_candidate_votes : nat =
      get_votes(farm.fid, farm.next_candidate, s.votes);

    if user_candidate_votes > current_delegated_votes
    then {
      farm.next_candidate := farm.current_delegated;
      farm.current_delegated := user_candidate;
    }
    else if user_candidate_votes > next_candidate_votes and
      user_candidate =/= farm.current_delegated
    then {
      farm.next_candidate := user_candidate;
    }
    else if next_candidate_votes > current_delegated_votes
    then {
      const tmp : key_hash = farm.current_delegated;

      farm.current_delegated := farm.next_candidate;
      farm.next_candidate := tmp;
    }
    else skip;

    s.farms[farm.fid] := farm;
  } with s

function form_vote_ops(
  const s               : storage_type;
  var farm              : farm_type)
                        : (farm_type * list(operation)) is
  block {
    if is_banned_baker(farm.next_candidate, s.banned_bakers)
    then farm.next_candidate := zero_key_hash
    else skip;

    const votes : nat =
      if is_banned_baker(farm.current_delegated, s.banned_bakers)
      then 0n
      else farm.staked;

    if votes = 0n
    then farm.current_delegated := farm.next_candidate;
    else skip;

    const vote_op : operation = get_vote_operation(
      farm.stake_params.qs_pool,
      farm.current_delegated,
      votes
    );
    const validate_baker_op : operation = Tezos.transaction(
      farm.current_delegated,
      0mutez,
      get_baker_registry_validate_entrypoint(s.baker_registry)
    );
  } with (farm, list [validate_baker_op; vote_op])

function append_op(
  const op              : operation;
  const acc             : list(operation))
                        : list(operation) is
  op # acc

function append_ops(
  const what            : list(operation);
  const to_             : list(operation))
                        : list(operation) is
  List.fold_right(append_op, to_, what)
