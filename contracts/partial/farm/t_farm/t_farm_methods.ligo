[@inline] function call_t_farm(
  const action          : action_type;
  var s                 : full_storage_type)
                        : full_return_type is
  block {
    const id : nat = case action of
      Set_admin(_)          -> 0n
    | Confirm_admin(_)      -> 1n
    | Set_fees(_)           -> 2n
    | Set_burner(_)         -> 3n
    | Set_baker_registry(_) -> 4n
    | Add_new_farm(_)       -> 5n
    | Pause_farms(_)        -> 6n
    | Deposit(_)            -> 7n
    | Withdraw(_)           -> 8n
    | Harvest(_)            -> 9n
    | Burn_xtz_rewards(_)   -> 10n
    | Claim_farm_rewards(_) -> 11n
    | Withdraw_farm_depo(_) -> 12n
    end;

    const res : return_type = case s.t_farm_lambdas[id] of
      Some(f) -> f(action, s.storage)
    | None    -> (failwith("TFarm/func-not-set") : return_type)
    end;

    s.storage := res.1;
  } with (res.0, s)

[@inline] function setup_func(
  const params          : setup_func_type;
  var s                 : full_storage_type)
                        : full_return_type is
  block {
    if params.index > t_farm_methods_max_index
    then failwith("TFarm/wrong-index")
    else skip;

    case s.t_farm_lambdas[params.index] of
      Some(_) -> failwith("TFarm/func-set")
    | None    -> s.t_farm_lambdas[params.index] := params.func
    end;
  } with (no_operations, s)
