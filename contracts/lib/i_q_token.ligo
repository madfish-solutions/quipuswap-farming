type mint_gov_tok_type  is [@layout:comb] record [
  receiver              : address; (* Receiver of new tokens *)
  amount                : nat; (* Amount of tokens to mint *)
]
