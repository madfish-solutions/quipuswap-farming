from ..utils.users import admin, zero


initial_q_farm_storage = {
    'storage': {
        'farms': {},
        'referrers': {},
        'temp': {
            'min_qs_gov_output': 0,
            'token': {
                'token': zero,
                'id': 0,
                'is_fa2': False,
            },
            'qs_pool': zero,
        },
        'qsgov': {
            'token': zero,
            'id': 0,
            'is_fa2': True,
        },
        'qsgov_pool': zero,
        'admin': admin,
        'pending_admin': zero,
        'burner': zero,
        'proxy_minter': zero,
        'baker_registry': zero,
        'farms_count': 0,
        'qsgov_per_second': 0,
        'total_alloc_point': 0,
    },
    'q_farm_lambdas': {},
}
