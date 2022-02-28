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
    | Set_is_v1_lp(_)          -> 5n
    | Set_reward_per_second(_) -> 6n
    | Ban_bakers(_)            -> 7n
    | Add_new_farm(_)          -> 8n
    | Pause_farms(_)           -> 9n
    | Deposit(_)               -> 10n
    | Withdraw(_)              -> 11n
    | Harvest(_)               -> 12n
    | Burn_tez_rewards(_)      -> 13n
    | Claim_farm_rewards(_)    -> 14n
    | Withdraw_farm_depo(_)    -> 15n
    | Transfer(_)              -> 16n
    | Update_operators(_)      -> 17n
    | Balance_of(_)            -> 18n
    | Update_token_metadata(_) -> 19n
    end;

    const lambda_bytes : bytes = case s.t_farm_lambdas[id] of
      Some(l) -> l
    | None    -> failwith("TFarm/func-not-set")
    end;

    const res : return_type =
      case (Bytes.unpack(lambda_bytes) : option(t_farm_func_type)) of
        Some(f) -> f(action, s.storage)
      | None    -> failwith("TFarm/can-not-unpack-lambda")
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
