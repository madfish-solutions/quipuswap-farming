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
    failwith("QSGOV/mint-gov-token-entrypoint-404")
                        : contract(mint_gov_toks_type)
  )
  end

(* Util to get proxy minter's %withdraw_callback entrypoint *)
function get_withdraw_callback_entrypoint(
  const this            : address)
                        : contract(list(bal_response_type)) is
  case (
    Tezos.get_entrypoint_opt("%withdraw_callback", this)
                        : option(contract(list(bal_response_type)))
  ) of
    Some(contr) -> contr
  | None        -> (
    failwith("ProxyMinter/withdraw-callback-entrypoint-404")
                        : contract(list(bal_response_type))
  )
  end
