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
  const farm            : farm_type;
  const receiver        : address;
  const s               : storage_type)
                        : (option(operation) * user_info_type) is
  block {
    const earned : nat = user.earned / precision;
    var op : option(operation) := (None : option(operation));

    if earned = 0n
    then skip
    else {
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

      if harvest_fee > 0n
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

      op := Some(
        Tezos.transaction(
          mint_data,
          0mutez,
          get_proxy_minter_mint_entrypoint(s.proxy_minter)
        )
      );
    };
  } with (op, user)

function burn_rewards(
  var user              : user_info_type;
  const farm            : farm_type;
  const pay_burn_reward : bool;
  const s               : storage_type)
                        : (option(operation) * user_info_type) is
  block {
    const earned : nat = user.earned / precision;
    var op : option(operation) := (None : option(operation));

    if earned = 0n
    then skip
    else {
      user.earned := abs(user.earned - earned * precision);

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

        if reward > 0n
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

      op := Some(
        Tezos.transaction(
          mint_data,
          0mutez,
          get_proxy_minter_mint_entrypoint(s.proxy_minter)
        )
      );
    };
  } with (op, user)

function get_fa12_tok_bal_callback_entrypoint(
  const this            : address)
                        : contract(nat) is
  case (
    Tezos.get_entrypoint_opt("%fa12_tok_bal_callback", this)
                        : option(contract(nat))
  ) of
    Some(contr) -> contr
  | None        -> (
    failwith("QFarm/fa12-bal-tok-callback-entrypoint-404")
                        : contract(nat)
  )
  end

function get_fa2_tok_bal_callback_entrypoint(
  const this            : address)
                        : contract(list(bal_response_type)) is
  case (
    Tezos.get_entrypoint_opt("%fa2_tok_bal_callback", this)
                        : option(contract(list(bal_response_type)))
  ) of
    Some(contr) -> contr
  | None        -> (
    failwith("QFarm/fa2-tok-bal-callback-entrypoint-404")
                        : contract(list(bal_response_type))
  )
  end

function get_burn_callback_entrypoint(
  const burner          : address)
                        : contract(list(bal_response_type)) is
  case (
    Tezos.get_entrypoint_opt("%burn_callback", burner)
                        : option(contract(list(bal_response_type)))
  ) of
    Some(contr) -> contr
  | None        -> (
    failwith("QFarm/burner-burn-callback-entrypoint-404")
                        : contract(list(bal_response_type))
  )
  end

(*
  Swap tokens to XTZ. XTZ swap for QS GOV tokens and burn all of them.

  !DEV! order of operations creating is fully reverted cause of Ligo's
  features: items can only be added to the beginning of the list
*)
function swap(
  const bal             : nat;
  const s               : storage_type)
                        : return_type is
  block {
    const balance_of_params : balance_of_type = record [
      requests = list [
        record [
          owner    = Tezos.self_address;
          token_id = s.qsgov.id;
        ]
      ];
      callback = get_burn_callback_entrypoint(s.burner)
    ];

    var operations : list(operation) := list [
      (* Swap all XTZ to QS GOV tokens operation *)
      Tezos.transaction(
        TezToTokenPayment(record [
          min_out  = s.temp.min_qs_gov_output;
          receiver = Tezos.self_address;
        ]),
        0mutez,
        get_quipuswap_use_entrypoint(s.qsgov_lp)
      );
      (* Get balance of output QS GOV tokens to burn them *)
      Tezos.transaction(
        balance_of_params,
        0mutez,
        get_fa2_token_balance_of_entrypoint(s.qsgov.token)
      )
    ];

    case s.temp.token of
      FA12(token_address) -> {
      (* Approve operation *)
      operations := Tezos.transaction(
        FA12_approve_type(s.temp.qs_pool, 0n),
        0mutez,
        get_fa12_token_approve_entrypoint(token_address)
      ) # operations;
    }
    | FA2(token_info)     -> {
      (* Remove operator operation *)
      operations := Tezos.transaction(
        FA2_approve_type(list [
          Remove_operator(record [
            owner    = Tezos.self_address;
            operator = s.temp.qs_pool;
            token_id = token_info.id;
          ])
        ]),
        0mutez,
        get_fa2_token_approve_entrypoint(token_info.token)
      ) # operations;
    }
    end;

    (* Swap all tokens to XTZ operation *)
    operations := Tezos.transaction(
      TokenToTezPayment(record [
        amount   = bal;
        min_out  = 1n;
        receiver = Tezos.self_address;
      ]),
      0mutez,
      get_quipuswap_use_entrypoint(s.temp.qs_pool)
    ) # operations;

    case s.temp.token of
      FA12(token_address) -> {
      (* Approve operation *)
      operations := Tezos.transaction(
        FA12_approve_type(s.temp.qs_pool, bal),
        0mutez,
        get_fa12_token_approve_entrypoint(token_address)
      ) # operations;
    }
    | FA2(token_info)     -> {
      (* Add operator operation *)
      operations := Tezos.transaction(
        FA2_approve_type(list [
          Add_operator(record [
            owner    = Tezos.self_address;
            operator = s.temp.qs_pool;
            token_id = token_info.id;
          ])
        ]),
        0mutez,
        get_fa2_token_approve_entrypoint(token_info.token)
      ) # operations;
    }
    end;
  } with (operations, s)

function reset_temp(
  var s                 : storage_type)
                        : storage_type is
  block {
    s.temp := record [
      min_qs_gov_output = 0n;
      qs_pool           = zero_address;
      token             = FA12(zero_address);
    ];
  } with s

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
    const votes1 : nat = get_votes(farm.fid, farm.current_delegated, s);
    const votes2 : nat = get_votes(farm.fid, farm.current_candidate, s);
    var votes3 : nat := get_votes(farm.fid, depo.candidate, s);

    (* Update user's new candidate votes amount *)
    s.votes[(farm.fid, depo.candidate)] := votes3 + user.staked;

    (* Update votes for the candidate from user's deposit *)
    votes3 := get_votes(farm.fid, depo.candidate, s);

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
      if votes1 =/= votes3
      then {
        if votes1 < votes3
        then {
          (* Update current candidate and current baker *)
          farm.current_candidate := farm.current_delegated;
          farm.current_delegated := depo.candidate;

          operations :=  get_vote_op(farm, depo.candidate) # operations;
        }
        else {
          (* Update current candidate *)
          case s.votes[(farm.fid, farm.current_candidate)] of
            None    -> farm.current_candidate := depo.candidate
          | Some(_) -> {
            if votes2 < votes3
            then farm.current_candidate := depo.candidate
            else skip;
          }
          end;

          operations := get_vote_op(farm, farm.current_delegated) # operations;
        };
      }
      else {
        case s.votes[(farm.fid, farm.current_candidate)] of
          None    -> skip
        | Some(_) -> {
          if votes2 > votes1
          then {
            (* Swap current baker and current candidate *)
            const tmp : key_hash = farm.current_delegated;

            farm.current_delegated := farm.current_candidate;
            farm.current_candidate := tmp;
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
    const votes1 : nat = get_votes(farm.fid, farm.current_delegated, s);
    const votes2 : nat = get_votes(farm.fid, farm.current_candidate, s);
    const votes3 : nat = get_votes(farm.fid, users_candidate, s);

    (* Check if farm already voted for the baker *)
    case s.votes[(farm.fid, farm.current_delegated)] of
      None    -> {
      (* Update the baker who was voted for by the majority *)
      farm.current_delegated := users_candidate;

      operations := get_vote_op(farm, users_candidate) # operations;
    }
    | Some(_) -> {
      if votes1 =/= votes3
      then {
        if votes1 < votes3
        then {
          (* Update current candidate and current baker *)
          farm.current_candidate := farm.current_delegated;
          farm.current_delegated := users_candidate;

          operations :=  get_vote_op(farm, users_candidate) # operations;
        }
        else {
          (* Update current candidate *)
          case s.votes[(farm.fid, farm.current_candidate)] of
            None    -> farm.current_candidate := users_candidate
          | Some(_) -> {
            if votes2 < votes3
            then farm.current_candidate := users_candidate
            else skip;
          }
          end;

          operations := get_vote_op(farm, farm.current_delegated) # operations;
        };
      }
      else {
        case s.votes[(farm.fid, farm.current_candidate)] of
          None    -> skip
        | Some(_) -> {
          if votes2 > votes1
          then {
            (* Swap current baker and current candidate *)
            const tmp : key_hash = farm.current_delegated;

            farm.current_delegated := farm.current_candidate;
            farm.current_candidate := tmp;
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
