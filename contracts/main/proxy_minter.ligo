#include "../partial/i_common.ligo"

#include "../partial/proxy_minter/i_proxy_minter.ligo"
#include "../partial/proxy_minter/proxy_minter_methods.ligo"

function main(
  const action          : action_type;
  const s               : storage_type)
                        : return_type is
  case action of
    Register_farm(params)       -> register_farm(params, s)
  | Mint_gov_tokens(params)     -> mint_gov_tokens(params, s)
  | Withdraw_gov_tokens(params) -> withdraw_gov_tokens(params, s)
  | Set_admin(params)           -> set_admin(params, s)
  | Confirm_admin(params)       -> confirm_admin(params, s)
  end
