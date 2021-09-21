function register(
  const baker           : baker_type;
  var s                 : storage_type)
                        : return_type is
  block {
    s[baker] := True;
  } with (list [
    Tezos.set_delegate(Some(baker))
  ], s)

function validate(
  const baker           : baker_type;
  const s               : storage_type)
                        : return_type is
  case s[baker] of
    Some(_) -> (no_operations, s)
  | None    -> register(baker, s)
  end
