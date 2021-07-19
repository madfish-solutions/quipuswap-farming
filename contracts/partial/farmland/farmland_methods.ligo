(* Call farmland lambda function *)
[@inline] function call_farmland(
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
    | Add_new_farm(_)          -> 7n
    | Pause_farms(_)           -> 8n
    | Deposit(_)               -> 9n
    | Withdraw(_)              -> 10n
    | Harvest(_)               -> 11n
    | Burn(_)                  -> 12n
    end;

    (* Call lambda function *)
    const res : return_type = case s.farmland_lambdas[id] of
      Some(f) -> f(action, s.storage)
    | None    -> (failwith("Farmland/func-not-set") : return_type)
    end;

    (* Update farmland storage *)
    s.storage := res.1;
  } with (res.0, s)

(* Setup lambda function by index for farmland contract *)
[@inline] function setup_func(
  const params          : setup_func_type;
  var s                 : full_storage_type)
                        : full_return_type is
  block {
    (* Check lambda's index *)
    if params.index > farmland_methods_max_index
    then failwith("Farmland/wrong-index")
    else skip;

    (* Setup lambda function *)
    case s.farmland_lambdas[params.index] of
      Some(_) -> failwith("Farmland/func-set")
    | None     -> s.farmland_lambdas[params.index] := params.func
    end;
  } with (no_operations, s)
