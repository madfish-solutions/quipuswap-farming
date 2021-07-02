function test(
  const action          : action_type;
  const s               : storage_type)
                        : return_type is
  block {
    case action of
      Test(_test_params) -> {
        skip;
      }
    end
  } with (no_operations, s)
