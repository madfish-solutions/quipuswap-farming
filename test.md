# Test coverage for contracts

## QFarm

1. `set_admin`:

   - ✅ should fail if not admin is trying to setup new pending admin;
   - ✅ should setup new pending admin by admin.

2. `confirm_admin`:

   - ✅ should fail if not pending admin is trying to confirm new admin;
   - ✅ should confirm new admin by pending admin.

3. `set_alloc_points`:

   - ✅ should fail if not admin is trying to set allocation points;
   - ✅ should fail if one farm from list of farms not found;
   - should fail if farm not started yet;
   - should fail if wrong allocation points number;
   - should set/update allocation point for one farm;
   - should set/update allocation points for group of farms.

4. `set_fees`:

   - ✅ should fail if not admin is trying to set fees;
   - ✅ should fail if one farm from list of farms not found;
   - ✅ should set/update fees for one farm;
   - ✅ should set/update fees for group of farms.

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

   - ✅ should fail if not admin is trying to add new farm;
   - ✅ should add new farm by admin and set all farm's fields correctly.

10. `deposit`:

11. `withdraw`:

12. `harvest`:

13. `burn_xtz_rewards`:

14. `burn_farm_rewards`:

15. `fa12_tok_bal_callback`:

16. `fa2_tok_bal_callback`:

17. `buyback`:

## Burner

1. `default`:

2. `burn_callback`:
