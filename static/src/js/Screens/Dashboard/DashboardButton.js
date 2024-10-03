odoo.define('custom_sudo_pos_dashboard.DashboardButton', function (require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const { useListener } = require("@web/core/utils/hooks");
    const Registries = require('point_of_sale.Registries');

    class DashboardButton extends PosComponent {
        setup() {
            super.setup();
            useListener('click', this.onClick);
        }
        async onClick() {
            this.env.posbus.trigger('dashboard-button-clicked');
            this.showScreen('DashboardScreenPos');
        }
    }
    DashboardButton.template = 'DashboardButton';

    Registries.Component.add(DashboardButton);
    return DashboardButton
});
