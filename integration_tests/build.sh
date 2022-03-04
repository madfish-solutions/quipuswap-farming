#!/bin/sh
chosen_ligo() {
    docker run -v $PWD:$PWD --rm -i ligolang/ligo:0.24.0 "$@"
}

mkdir integration_tests/compiled
chosen_ligo compile contract $PWD/contracts/main/q_farm.ligo > ./integration_tests/compiled/q_farm.tz

chosen_ligo compile contract $PWD/contracts/main/t_farm.ligo > ./integration_tests/compiled/t_farm.tz

mkdir integration_tests/compiled/lambdas

DIR=integration_tests/compiled/lambdas/tfarm
mkdir $DIR
for i in    0,set_admin \
            1,confirm_admin \
            2,set_fees \
            3,set_burner \
            4,set_baker_registry \
            5,set_is_v1_lp \
            6,set_reward_per_second \
            7,ban_bakers \
            8,add_new_farm \
            9,pause_farms \
            10,deposit \
            11,withdraw \
            12,harvest \
            13,burn_tez_rewards \
            14,claim_farm_rewards \
            15,withdraw_farm_depo \
            16,transfer \
            17,update_operators \
            18,balance_of \
            19,update_token_metadata \
         ; do 

    IDX=${i%,*};
    FUNC=${i#*,};
    echo $IDX-$FUNC;

    chosen_ligo compile expression pascaligo --michelson-format json --init-file $PWD/contracts/main/t_farm.ligo "Bytes.pack(${FUNC})" > $PWD/$DIR/${IDX}-${FUNC}.json
done

DIR=integration_tests/compiled/lambdas/qfarm
mkdir $DIR
for i in    0,set_admin \
            1,confirm_admin \
            2,set_fees \
            3,set_reward_per_second \
            4,set_burner \
            5,set_proxy_minter \
            6,set_baker_registry \
            7,set_is_v1_lp \
            8,ban_bakers \
            9,add_new_farm \
            10,pause_farms \
            11,deposit \
            12,withdraw \
            13,harvest \
            14,burn_tez_rewards \
            15,burn_farm_rewards \
            16,withdraw_farm_depo \
            17,transfer \
            18,update_operators \
            19,balance_of \
            20,update_token_metadata \
         ; do 

    IDX=${i%,*};
    FUNC=${i#*,};
    echo $IDX-$FUNC;

    chosen_ligo compile expression pascaligo --michelson-format json --init-file $PWD/contracts/main/q_farm.ligo "Bytes.pack(${FUNC})" > $PWD/$DIR/${IDX}-${FUNC}.json
done