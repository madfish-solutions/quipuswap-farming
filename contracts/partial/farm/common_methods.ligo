function burn_tez(
  const s               : full_storage_type)
                        : full_return_type
  is (
    list [
      Tezos.transaction(
        unit,
        Tezos.amount,
        (get_contract(s.storage.burner) : contract(unit))
      )
    ],
    s
  )
