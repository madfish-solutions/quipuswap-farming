[@inline] function call_farmland(
  const action          : action_type;
  var s                 : full_storage_type)
                        : full_return_type is
  block {
    const id : nat = case action of
      Set_admin(_) -> 0n
    | Confirm_admin(_) -> 1n
    | Set_alloc_points(_) -> 2n
    | Set_fees(_) -> 3n
    | Set_reward_per_second(_) -> 4n
    | Deposit(_) -> 5n
    | Withdraw(_) -> 6n
    | Harvest(_) -> 7n
    end;
    const res : return_type = case s.farmland_lambdas[id] of
        Some(f) -> f(action, s.storage)
      | None -> (failwith("Farmland/func-not-set") : return_type)
    end;

    s.storage := res.1;
  } with (res.0, s)

[@inline] function setup_func(
  const params          : setup_func_type;
  var s                 : full_storage_type)
                        : full_return_type is
  block {
    if params.index > farmland_methods_max_index
    then failwith("Farmland/wrong-index")
    else skip;

    case s.farmland_lambdas[params.index] of
      Some(_n) -> failwith("Farmland/func-set")
    | None -> s.farmland_lambdas[params.index] := params.func
    end;
  } with (no_operations, s)
