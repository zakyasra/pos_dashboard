odoo.define('custom_sudo_pos_dashboard.PosOrderFetcher', function (require) {
    'use strict';

    const { Gui } = require('point_of_sale.Gui');
    const { isConnectionError } = require('point_of_sale.utils');

    const { EventBus } = owl;

    class PosOrderFetcher extends EventBus {
        constructor() {
            super();
            this.isLoading = false
            this.todayPayments = [];
            this.todayOrderMenu = [];
            this.menu = [];
            this.orderline = [];
            this.order = [];
            this.is_module_pos_complimentary_installed = false
        }

        async fetch(shift = null) {
            if (this.isLoading) {
                return
            }

            try {
                this.isLoading = true
                const [is_module_pos_complimentary_installed, todayPayments, todayOrderMenu, menu, orderline, order] = await Promise.all([
                    this._fetch_check_module(),
                    this._fetch_payments(shift),
                    this._fetch_orderMenu(shift),
                    this._fetch_menu(),
                    this._fetch_orderline(shift),
                    this._fetch_order(shift),
                ]);

                this.is_module_pos_complimentary_installed = is_module_pos_complimentary_installed
                this.todayPayments = todayPayments;
                this.todayOrderMenu = todayOrderMenu;
                this.menu = menu;
                this.orderline = orderline;
                this.order = order;

                this.trigger('update');
            } catch (error) {
                if (isConnectionError(error)) {
                    Gui.showPopup('ErrorPopup', {
                        title: this.comp.env._t('Network Error'),
                        body: this.comp.env._t('Unable to fetch orders if offline.'),
                    });
                    Gui.setSyncStatus('error');
                } else {
                    throw error;
                }
            } finally {
                this.isLoading = false
            }
        }

        async _fetch_payments(shift) {
            const orders = await this._get_payments(shift);
            return orders
        }

        async _fetch_order(shift) {
            const order = await this._getOrder(shift);
            return order
        }

        async _fetch_orderMenu(shift) {
            const orderMenu = await this._getOrderMenu(shift);
            return orderMenu
        }

        async _fetch_menu() {
            const menu = await this._getMenu();
            return menu
        }

        async _fetch_orderline(shift) {
            const orderline = await this._getOrderLine(shift);
            return orderline
        }

        async _fetch_check_module() {
            const check = await this._check_is_module_pos_complimentary_installed();
            return check == 'installed'
        }

        async _get_payments(shift = null) {
            let fields = ['amount', 'payment_method_id', 'cashier']
            let domain = [['session_id', '=', this.comp.env.pos.pos_session.id]]

            if (shift) {
                domain.push(['pos_order_id.shift_id', '=', shift])
            }

            if (this.comp.env.pos?.default_pos_shift_ids) {
                fields.push('shift_id')
            }

            return await this.rpc({
                model: 'pos.payment',
                method: 'search_read',
                fields: fields,
                domain: domain,
                context: this.comp.env.session.user_context,
            })
        }

        async _getOrder(shift) {
            let fields = ['name', 'margin', 'amount_tax', 'amount_total', 'amount_paid', 'lines', 'pricelist_id', 'pos_reference']
            let domain = [['session_id', '=', this.comp.env.pos.pos_session.id]]

            if (this.comp.env.pos.config.module_pos_restaurant) {
                fields.push('customer_count')
            }

            if (this.comp.env.pos?.default_pos_shift_ids) {
                fields.push('shift_id')
            }

            if (shift) {
                domain.push(['shift_id', '=', shift])
            }

            return await this.rpc({
                model: 'pos.order',
                method: 'search_read',
                fields: fields,
                domain: domain,
                context: this.comp.env.session.user_context,
            })
        }

        async _getOrderMenu(shift) {
            let domain = [['order_id.session_id', '=', this.comp.env.pos.pos_session.id]]

            if (shift) {
                domain.push(['order_id.shift_id', '=', shift])
            }

            return await this.rpc({
                model: 'pos.order.line',
                method: 'search_read',
                fields: ['product_id', 'full_product_name', 'qty', 'price_subtotal', 'price_subtotal_incl', 'order_id', 'total_cost'],
                domain: domain,
                context: this.comp.env.session.user_context,
            })
        }

        async _getMenu() {
            return await this.rpc({
                model: 'pos.category',
                method: 'search_read',
                fields: [],
                domain: [['parent_id', '=', false]],
                context: this.comp.env.session.user_context,
            })
        }

        async _getOrderLine(shift = null) {
            const domain = [['order_id.pricelist_id.is_complimentary', '=', true]]
            const kwargs = { session_id: this.comp.env.pos.pos_session.id };
            if (shift) {
                kwargs.shift = shift;
            }
            return await this.rpc({
                model: 'pos.order.line',
                method: 'get_order_line_by_category',
                kwargs: kwargs,
                domain: domain,
                args: [[this.comp.env.pos.pos_session.id]],
            })
        }

        async _check_is_module_pos_complimentary_installed() {
            const kwargs = {};

            return await this.rpc({
                model: 'pos.session',
                method: 'is_module_pos_complimentary_installed',
                kwargs: kwargs,
                domain: [],
                args: [[this.comp.env.pos.pos_session.id]]
            })
        }

        get_payments(id) {
            return this.todayPayments;
        }

        get_order(id) {
            return this.order;
        }

        get_orderMenu(id) {
            return this.todayOrderMenu;
        }

        get_menu(id) {
            return this.menu;
        }

        get_orderline(id) {
            return this.orderline;
        }

        get_is_module_pos_complimentary_installed(id) {
            return this.is_module_pos_complimentary_installed;
        }

        get_is_loading() {
            return this.isLoading
        }

        setComponent(comp) {
            this.comp = comp;
            return this;
        }

        async rpc() {
            Gui.setSyncStatus('connecting');
            const result = await this.comp.rpc(...arguments);
            Gui.setSyncStatus('connected');
            return result;
        }

    }

    return new PosOrderFetcher();
});
