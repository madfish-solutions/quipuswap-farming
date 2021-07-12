type init_exchange_type is nat

type tez_to_tok_type    is record [
  (* Min amount of tokens received to accept exchange *)
  min_out                 : nat;
  (* Tokens receiver *)
  receiver                : address;
]

type tok_to_tez_type    is record [
  (* Amount of tokens to be exchanged *)
  amount                  : nat;
  (* Min amount of XTZ received to accept exchange *)
  min_out                 : nat;
  (* Tokens receiver *)
  receiver                : address;
]

type invest_liq_type    is nat

type divest_liq_type    is record [
  (* Min amount of XTZ received to accept the divestment *)
  min_tez                 : nat;
  (* Min amount of tokens received to accept the divestment *)
  min_tokens              : nat;
  (* Amount of shares to be burnt *)
  shares                  : nat;
]

type vote_type          is record [
  (* The chosen baker *)
  candidate               : key_hash;
  (* Amount of shares that are used to vote *)
  value                   : nat;
  (* The account from which the voting is done *)
  voter                   : address;
]

type veto_type          is record [
  (* Amount of shares that are used to vote against the chosen baker *)
  value                   : nat;
  (* The account from which the veto voting is done *)
  voter                   : address;
]

type withdraw_type      is address

type dex_action_type    is
| InitializeExchange      of init_exchange_type
| TezToTokenPayment       of tez_to_tok_type
| TokenToTezPayment       of tok_to_tez_type
| InvestLiquidity         of invest_liq_type
| DivestLiquidity         of divest_liq_type
| Vote                    of vote_type
| Veto                    of veto_type
| WithdrawProfit          of withdraw_type
