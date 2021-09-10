(* Util to get QS GOV token %mint_gov_token entrypoint *)
function get_mint_qsgov_tokens_entrypoint(
  const token           : address)
                        : contract(mint_gov_toks_type) is
  case (
    Tezos.get_entrypoint_opt("%mint_gov_token", token)
                        : option(contract(mint_gov_toks_type))
  ) of
    Some(contr) -> contr
  | None        -> (
    failwith("ProxyMinter/gsgov-mint-gov-token-entrypoint-404")
                        : contract(mint_gov_toks_type)
  )
  end
