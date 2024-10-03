odoo.define('custom_sudo_pos_dashbboard.Chrome', function (require) {
    'use strict'

    const Chrome = require('point_of_sale.Chrome')
    const Registries = require('point_of_sale.Registries')

    const DashboardChrome = (Chrome) =>
        class extends Chrome {
            get isDashboardScreenShown() {
                return this.mainScreen.name === 'DashboardScreenPos'
            }
        }

    Registries.Component.extend(Chrome, DashboardChrome)

    return Chrome
})