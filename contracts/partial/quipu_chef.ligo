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
