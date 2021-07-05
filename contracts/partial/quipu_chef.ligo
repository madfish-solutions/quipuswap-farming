[@inline] function call_quipu_chef(
  const action          : action_type;
  var s                 : full_storage_type)
                        : full_return_type is
  block {
    const id : nat = case action of
      Test(_n) -> 0n
    end;
    const res : return_type = case s.quipu_chef_lambdas[id] of
        Some(f) -> f(action, s.storage)
      | None -> (failwith("QuipuChef/function-not-set") : return_type)
    end;

    s.storage := res.1;
  } with (res.0, s)

[@inline] function set_quipu_chef_function(
  const params          : set_quipu_chef_function_params_type;
  var s                 : full_storage_type)
                        : full_return_type is
  block {
    case s.quipu_chef_lambdas[params.index] of
      Some(_n) -> failwith("QuipuChef/function-set")
    | None -> s.quipu_chef_lambdas[params.index] := params.func
    end;
  } with (no_operations, s)
