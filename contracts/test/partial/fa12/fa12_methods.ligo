(* Helper function to get account *)
function get_account(const user : address; const s : token_storage) : account is
  block {
    var acc : account := case s.ledger[user] of
    | None -> record [
        balance = 0n;
        allowances = (map [] : map(address, nat));
      ]
    | Some(v) -> v
    end;
  } with acc

(* Helper function to get allowance for an account *)
function get_account_allowance(const owner : account; const spender : address) : nat is
  case owner.allowances[spender] of
  | Some(v) -> v
  | None -> 0n
  end

(* Transfer token to another account *)
function transfer(const src : address; const dst : address; const value : nat; var s : token_storage) : return is
  block {
    (* Sending to yourself? *)
    if src = dst then
      failwith("Token/self-to-self-transfer")
    else
      skip;

    (* Retrieve sender account from token_storage *)
    const sender_account : account = get_account(src, s);

    (* Balance check *)
    if sender_account.balance < value then
      failwith("Token/low-balance")
    else
      skip;

    (* Check this address can spend the tokens *)
    if src =/= Tezos.sender then block {
      const sender_allowance : nat = get_account_allowance(sender_account, Tezos.sender);

      if sender_allowance < value then
        failwith("Token/not-enough-allowance")
      else
        skip;

      (* Decrease sender allowance *)
      sender_account.allowances[Tezos.sender] := abs(sender_allowance - value);
    } else
      skip;

    (* Update sender balance *)
    sender_account.balance := abs(sender_account.balance - value);

    (* Update token_storage *)
    s.ledger[src] := sender_account;

    (* Create or get destination account *)
    var dest_account : account := get_account(dst, s);

    (* Update destination account balance *)
    dest_account.balance := dest_account.balance + value;

    (* Update token_storage *)
    s.ledger[dst] := dest_account;
  } with ((nil : list(operation)), s)

(* Approve an nat to be spent by another address in the name of the sender *)
function approve(const spender : address; const value : nat; var s : token_storage) : return is
  block {
    if spender = Tezos.sender then
      failwith("Token/self-to-self-approval")
    else
      skip;

    (* Create or get sender account *)
    var sender_account : account := get_account(Tezos.sender, s);

    (* Set spender allowance *)
    sender_account.allowances[spender] := value;

    (* Update token_storage *)
    s.ledger[Tezos.sender] := sender_account;
  } with ((nil : list(operation)), s)

(* View function that forwards the balance of user to a contract *)
function get_balance(const owner : address; const contr : contract(nat); const s : token_storage) : return is
  block {
    const owner_account : account = get_account(owner, s);
  } with (list [Tezos.transaction(owner_account.balance, 0tz, contr)], s)

(* View function that forwards the allowance of spender in the name of token_owner to a contract *)
function get_allowance(const owner : address; const spender : address; const contr : contract(nat); const s : token_storage) : return is
  block {
    const owner_account : account = get_account(owner, s);
    const spender_allowance : nat = get_account_allowance(owner_account, spender);
  } with (list [Tezos.transaction(spender_allowance, 0tz, contr)], s)

(* View function that forwards the total_supply to a contract *)
function get_total_supply(const contr : contract(nat); const s : token_storage) : return is
  (list [Tezos.transaction(s.total_supply, 0tz, contr)], s)
