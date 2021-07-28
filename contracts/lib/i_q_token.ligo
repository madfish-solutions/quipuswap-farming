type mint_gov_tok_type  is [@layout:comb] record [
  (* Receiver of new tokens *)
  receiver              : address;
  (* Amount of tokens to mint *)
  amount                : nat;
]

type mint_gov_toks_type is list(mint_gov_tok_type)
