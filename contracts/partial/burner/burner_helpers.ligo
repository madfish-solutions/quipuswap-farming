(* Util to get FA2 token balance by ID and owner *)
function get_fa2_token_balance(
  const response        : list(bal_response_type);
  const owner           : address;
  const token_id        : token_id_type)
                        : nat is
  block {
    var bal : nat := 0n;

    (* Get balance of FA2 token with specified ID *)
    function get_balance(
      var bal           : nat;
      const v           : bal_response_type)
                        : nat is
      block {
        const request : bal_request_type = record [
          token_id = token_id;
          owner    = owner;
        ];

        (* Check if response data has specified token balance  *)
        if v.request = request
        then bal := v.balance;
        else skip;
      } with bal;

    (* Get specified FA2 token balance in list of %balance_of responses *)
    bal := List.fold(get_balance, response, bal);
  } with bal
