[@inline] function call_t_farm(
  const action          : action_type;
  var s                 : full_storage_type)
                        : full_return_type is
  block {
    const id : nat = case action of
      Set_admin(_)             -> 0n
    | Confirm_admin(_)         -> 1n
    | Set_fees(_)              -> 2n
    | Set_burner(_)            -> 3n
    | Set_baker_registry(_)    -> 4n
    | Ban_bakers(_)            -> 5n
    | Add_new_farm(_)          -> 6n
    | Pause_farms(_)           -> 7n
    | Deposit(_)               -> 8n
    | Withdraw(_)              -> 9n
    | Harvest(_)               -> 10n
    | Burn_xtz_rewards(_)      -> 11n
    | Claim_farm_rewards(_)    -> 12n
    | Withdraw_farm_depo(_)    -> 13n
    | Transfer(_)              -> 14n
    | Update_operators(_)      -> 15n
    | Balance_of(_)            -> 16n
    | Update_token_metadata(_) -> 17n
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
