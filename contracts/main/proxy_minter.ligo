#include "../lib/i_q_token.ligo"
#include "../lib/i_fa12.ligo"
#include "../lib/i_fa2.ligo"

#include "../partial/i_common.ligo"
#include "../partial/common.ligo"

#include "../partial/proxy_minter/i_proxy_minter.ligo"
#include "../partial/proxy_minter/proxy_minter_helpers.ligo"
#include "../partial/proxy_minter/proxy_minter_methods.ligo"

function main(
  const action          : action_type;
  const s               : storage_type)
                        : return_type is
  case action of
    Register_farm(params)     -> register_farm(params, s)
  | Mint_gov_tokens(params)   -> mint_gov_tokens(params, s)
  | Withdraw_gov_tokens       -> withdraw_gov_tokens(s)
  | Withdraw_callback(params) -> withdraw_gov_tokens_callback(params, s)
  | Set_admin(params)         -> set_admin(params, s)
  | Confirm_admin             -> confirm_admin(s)
  end
