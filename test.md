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
   - ✅ should fail if farm not started yet;
   - ✅ should set/update allocation point for one farm;
   - ✅ should set/update allocation points for group of farms.

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

   - should fail if farm not found;
   - should fail if farm is paused (allocation point equal to 0);
   - should update rewards correctly;
   - should update user's and farm's data correctly;
   - should claim user's rewards in time of every deposit (in farms without timelock);
   - should claim user's rewards if timelock is finished (in farms with timelock);
   - should calculate harest fee correctly;
   - should mint QS GOV tokens as reward to rewards receiver;
   - should mint QS GOV tokens as harvest fee to referrer (in case when user have referrer);
   - should mint QS GOV tokens as harvest fee to zero address (in case when user does not have referrer);
   - should fail if user is trying to refer himself;
   - should set/update referrer;
   - should deposit single token;
   - should deposit LP token;
   - should deposit FA1.2 token;
   - should deposit FA2 token;
   - should vote for the baker if LP token is deposited.

11. `withdraw`:

12. `harvest`:

13. `burn_xtz_rewards`:

14. `burn_farm_rewards`:

15. `fa12_tok_bal_callback`:

16. `fa2_tok_bal_callback`:

17. `buyback`:

## TFarm

1. `set_admin`:

2. `confirm_admin`:

3. `set_fees`:

4. `set_burner`:

5. `set_baker_registry`:

6. `add_new_farm`:

7. `pause_farms`:

8. `deposit`:

9. `withdraw`:

10. `harvest`:

11. `burn_xtz_rewards`:

12. `claim_farm_rewards`:

13. `withdraw_farm_depo`:

## Burner

1. `default`:

2. `burn_callback`:

## Baker registry

1. `validate`:

   - ✅ should do nothing if baker is registered;
   - ✅ should register new baker if baker is not already registered;
   - ✅ should fail if the baker is not already registered and the address to register is not a baker.

2. `register`:

   - ✅ should register new baker;
   - ✅ should fail if the address to register is not a baker.

## Proxy minter

1. `register_farm`:

2. `mint_qsgov_tokens`:

3. `withdraw_qsgov_tokens`:

4. `withdraw_qsgov_tokens_callback`:

5. `set_admin`:

6. `confirm_admin`:
