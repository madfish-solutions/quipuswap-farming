(* Ensure the baker is the real baker *)
function register(
  const baker           : baker_type;
  var s                 : storage_type)
                        : return_type is
  block {
    (* Add baker to the storage *)
    s[baker] := True;
  } with (list [
    (* Set delegate operation for the added baker *)
    Tezos.set_delegate(Some(baker))
  ], s)

(* Validate the received address is in the list of the validated bakers *)
function validate(
  const baker           : baker_type;
  const s               : storage_type)
                        : return_type is
  (* Validate or register the new baker *)
  case s[baker] of
    Some(_) -> (no_operations, s)
  | None    -> register(baker, s)
  end
