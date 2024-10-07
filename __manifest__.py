{
    'name': 'Sudo POS Dashboard',
    'version': '1.0',
    'description': """
        berubah
    """,
    'depends': [
        'point_of_sale',
        'pos_hr'
    ],
    'summary': 'Extension Addons for Point Of Sale Module Tilabs v16',
    'author': 'Tilabs',
    'website': 'http://tilabs.id',
    'license': 'LGPL-3',
    'category': 'Point Of Sale',

    'data': [
        'views/pos_config_views.xml',
        'views/dashboard_views.xml'
    ],
    'assets': {
        'web.assets_backend': [
            'custom_sudo_pos_dashboard/static/src/xml/pos_dashboard.xml',
            'custom_sudo_pos_dashboard/static/src/js/pos_dashboard.js',
            'custom_sudo_pos_dashboard/static/src/css/pos_dashboard.css',
            'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/2.8.0/Chart.bundle.js',
        ],
        'point_of_sale.assets': [
            'custom_sudo_pos_dashboard/static/src/js/Screens/Dashboard/DashboardScreenPos.js',
            'custom_sudo_pos_dashboard/static/src/js/Screens/Dashboard/DashboardButton.js',
            'custom_sudo_pos_dashboard/static/src/js/Screens/Dashboard/PosOrderFetcher.js',
            'custom_sudo_pos_dashboard/static/src/js/Screens/Dashboard/SalesByMenu.js',
            'custom_sudo_pos_dashboard/static/src/js/Chrome.js',
            'custom_sudo_pos_dashboard/static/src/xml/Screens/Dashboard/DashboardButton.xml',
            'custom_sudo_pos_dashboard/static/src/xml/Screens/Dashboard/DashboardScreenPos.xml',
            'custom_sudo_pos_dashboard/static/src/xml/Screens/Dashboard/SalesByMenu.xml',
            'custom_sudo_pos_dashboard/static/src/xml/Chrome.xml',
            'custom_sudo_pos_dashboard/static/src/scss/pos.scss',
        ]
    },

    'installable': True,
    'application': False,
}