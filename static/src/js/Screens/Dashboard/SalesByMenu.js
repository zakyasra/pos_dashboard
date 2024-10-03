odoo.define('custom_sudo_pos_dashboard.SalesByMenu', function (require) {
    'use strict';

    const { useListener } = require("@web/core/utils/hooks");
    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    const { useState } = owl;

    /**
     * @props {models.Order} [initHighlightedOrder] initially highligted order
     * @props {Array<models.Order>} orders
     */
    class SalesByMenu extends PosComponent {
        setup() {
            super.setup();
        }
    }
    SalesByMenu.template = 'SalesByMenu';

    Registries.Component.add(SalesByMenu);

    return SalesByMenu;
});
