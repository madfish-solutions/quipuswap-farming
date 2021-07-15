function get_burn_callback_entrypoint(
  const this            : address)
                        : contract(list(bal_response_type)) is
  case (
    Tezos.get_entrypoint_opt("%burn_callback", this)
                        : option(contract(list(bal_response_type)))
  ) of
    Some(contr) -> contr
  | None        -> (
    failwith("Burner/burn-callback-entrypoint-404")
                        : contract(list(bal_response_type))
  )
  end
