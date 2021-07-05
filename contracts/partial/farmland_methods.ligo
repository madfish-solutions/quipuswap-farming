[@inline] function call_farmland(
  const action          : action_type;
  var s                 : full_storage_type)
                        : full_return_type is
  block {
    const id : nat = case action of
      Set_admin(_params) -> 0n
    | Confirm_admin(_params) -> 1n
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
    case s.farmland_lambdas[params.index] of
      Some(_n) -> failwith("Farmland/func-set")
    | None -> s.farmland_lambdas[params.index] := params.func
    end;
  } with (no_operations, s)
