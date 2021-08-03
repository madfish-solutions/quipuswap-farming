(* Call q_farm lambda function *)
[@inline] function call_q_farm(
  const action          : action_type;
  var s                 : full_storage_type)
                        : full_return_type is
  block {
    (* Get lambda function index by action *)
    const id : nat = case action of
      Set_admin(_)             -> 0n
    | Confirm_admin(_)         -> 1n
    | Set_alloc_points(_)      -> 2n
    | Set_fees(_)              -> 3n
    | Set_reward_per_second(_) -> 4n
    | Set_burner(_)            -> 5n
    | Set_proxy_minter(_)      -> 6n
    | Set_baker_registry(_)    -> 7n
    | Add_new_farm(_)          -> 8n
    | Pause_farms(_)           -> 9n
    | Deposit(_)               -> 10n
    | Withdraw(_)              -> 11n
    | Harvest(_)               -> 12n
    | Burn_xtz_rewards(_)      -> 13n
    | Burn_farm_rewards(_)     -> 14n
    | Buyback(_)               -> 15n
    | Fa12_tok_bal_callback(_) -> 16n
    | Fa2_tok_bal_callback(_)  -> 17n
    end;

    (* Call lambda function *)
    const res : return_type = case s.q_farm_lambdas[id] of
      Some(f) -> f(action, s.storage)
    | None    -> (failwith("QFarm/func-not-set") : return_type)
    end;

    (* Update q_farm storage *)
    s.storage := res.1;
  } with (res.0, s)

(* Setup lambda function by index for q_farm contract *)
[@inline] function setup_func(
  const params          : setup_func_type;
  var s                 : full_storage_type)
                        : full_return_type is
  block {
    (* Check lambda's index *)
    if params.index > q_farm_methods_max_index
    then failwith("QFarm/wrong-index")
    else skip;

    (* Setup lambda function *)
    case s.q_farm_lambdas[params.index] of
      Some(_) -> failwith("QFarm/func-set")
    | None     -> s.q_farm_lambdas[params.index] := params.func
    end;
  } with (no_operations, s)
