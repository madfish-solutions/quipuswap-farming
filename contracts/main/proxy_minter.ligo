#include "../lib/i_q_token.ligo"
#include "../lib/i_fa12.ligo"
#include "../lib/i_fa2.ligo"
#include "../lib/i_dex.ligo"

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
    Add_minter(params)        -> add_minter(params, s)
  | Mint_tokens(params)       -> mint_tokens(params, s)
  | Withdraw_tokens(params)   -> withdraw_tokens(params, s)
  | Set_admin(params)         -> set_admin(params, s)
  | Confirm_admin             -> confirm_admin(s)
  end
