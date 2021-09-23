[@inline] function call_q_farm(
  const action          : action_type;
  var s                 : full_storage_type)
                        : full_return_type is
  block {
    const id : nat = case action of
      Set_admin(_)             -> 0n
    | Confirm_admin(_)         -> 1n
    | Set_fees(_)              -> 2n
    | Set_reward_per_second(_) -> 3n
    | Set_burner(_)            -> 4n
    | Set_proxy_minter(_)      -> 5n
    | Set_baker_registry(_)    -> 6n
    | Add_new_farm(_)          -> 7n
    | Pause_farms(_)           -> 8n
    | Deposit(_)               -> 9n
    | Withdraw(_)              -> 10n
    | Harvest(_)               -> 11n
    | Burn_xtz_rewards(_)      -> 12n
    | Burn_farm_rewards(_)     -> 13n
    | Withdraw_farm_depo(_)    -> 14n
    end;

    const res : return_type = case s.q_farm_lambdas[id] of
      Some(f) -> f(action, s.storage)
    | None    -> (failwith("QFarm/func-not-set") : return_type)
    end;

    s.storage := res.1;
  } with (res.0, s)

[@inline] function setup_func(
  const params          : setup_func_type;
  var s                 : full_storage_type)
                        : full_return_type is
  block {
    if params.index > q_farm_methods_max_index
    then failwith("QFarm/wrong-index")
    else skip;

    case s.q_farm_lambdas[params.index] of
      Some(_) -> failwith("QFarm/func-set")
    | None    -> s.q_farm_lambdas[params.index] := params.func
    end;
  } with (no_operations, s)
