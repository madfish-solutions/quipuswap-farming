#include "../lib/i_fa12.ligo"
#include "../lib/i_fa2.ligo"
#include "../lib/i_dex.ligo"

#include "../partial/i_common.ligo"
#include "../partial/common.ligo"

#include "../partial/baker_registry/i_baker_registry.ligo"
#include "../partial/baker_registry/baker_registry_methods.ligo"

function main(
  const action          : action_type;
  const s               : storage_type)
                        : return_type is
  case action of
    Validate(baker)     -> validate(baker, s)
  | Register(baker)     -> register(baker, s)
  end
