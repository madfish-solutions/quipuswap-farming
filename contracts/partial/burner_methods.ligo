function get_token_burn_entrypoint(
  const t               : address)
                        : contract(burn_type) is
  case (Tezos.get_entrypoint_opt("%burn", t) : option(contract(burn_type))) of
    Some(contr) -> contr
  | None -> (failwith("Burner/burn-entrypoint-404") : contract(burn_type))
  end

function get_quipuswap_use_entrypoint(
  const pool            : address)
                        : contract(use_type) is
  case (Tezos.get_entrypoint_opt("%use", pool) : option(contract(use_type))) of
    Some(contr) -> contr
  | None -> (failwith("Burner/use-entrypoint-404") : contract(use_type))
  end
