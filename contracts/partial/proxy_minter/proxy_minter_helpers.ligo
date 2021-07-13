function get_mint_gov_tokens_entrypoint(
  const token           : address)
                        : contract(mint_gov_tok_type) is
  case (
    Tezos.get_entrypoint_opt("%mint_gov_token", token)
                        : option(contract(mint_gov_tok_type))
  ) of
    Some(contr) -> contr
  | None -> (
    failwith("QUGO/mint-gov-token-entrypoint-404")
                        : contract(mint_gov_tok_type)
  )
  end

function get_withdraw_callback_entrypoint(
  const this            : address)
                        : contract(list(bal_response_type)) is
  case (
    Tezos.get_entrypoint_opt("%withdraw_callback", this)
                        : option(contract(list(bal_response_type)))
  ) of
    Some(contr) -> contr
  | None -> (
    failwith("ProxyMinter/withdraw-callback-entrypoint-404")
                        : contract(list(bal_response_type))
  )
  end

function get_qugo_token_balance_of_entrypoint(
  const token           : address)
                        : contract(balance_type) is
  case (
    Tezos.get_entrypoint_opt("%balance_of", token)
                        : option(contract(balance_type))
  ) of
    Some(contr) -> contr
  | None -> (
    failwith("QGOV/balance-of-entrypoint-404")
                        : contract(balance_type)
  )
  end
