# Test coverage for contracts

## QFarm

1. `set_admin`:

   - ✅ should fail if not admin is trying to setup new pending admin;
   - ✅ should setup new pending admin by admin.

2. `confirm_admin`:

   - ✅ should fail if not pending admin is trying to confirm new admin;
   - ✅ should confirm new admin by pending admin.

3. `set_alloc_points`:

4. `set_fees`:

5. `set_reward_per_second`:

   - ✅ should fail if not admin is trying to set reward per second;
   - ✅ should change reward per second by admin.

6. `set_burner`:

   - ✅ should fail if not admin is trying to set burner;
   - ✅ should change burner by admin.

7. `set_proxy_minter`:

   - ✅ should fail if not admin is trying to set proxy minter;
   - ✅ should change proxy minter by admin.

8. `set_baker_registry`:

   - ✅ should fail if not admin is trying to set baker registry;
   - ✅ should change baker registry by admin.

9. `add_new_farm`:

10. `pause_farms`:

11. `deposit`:

12. `withdraw`:

13. `harvest`:

14. `burn_xtz_rewards`:

15. `burn_farm_rewards`:

16. `fa12_tok_bal_callback`:

17. `fa2_tok_bal_callback`:

18. `buyback`:

## Burner

1. `default`:

2. `burn_callback`:
