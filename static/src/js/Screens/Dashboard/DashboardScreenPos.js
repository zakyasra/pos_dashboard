odoo.define('custom_sudo_pos_dashboard.DashboardScreenPos', function (require) {
    'use strict';

    const { useListener } = require("@web/core/utils/hooks");
    const PosComponent = require('point_of_sale.PosComponent');
    const IndependentToOrderScreen = require('point_of_sale.IndependentToOrderScreen');
    const Registries = require('point_of_sale.Registries');
    const PosOrderFetcher = require('custom_sudo_pos_dashboard.PosOrderFetcher');
    const session = require('web.session');

    const { onMounted, onWillUnmount, useState, useEffect } = owl;

    const TIMEOUT = 50;
    /**
     * @props {models.Order} [initHighlightedOrder] initially highligted order
     * @props {Array<models.Order>} orders
     */
    class DashboardScreenPos extends IndependentToOrderScreen {
        setup() {
            super.setup();
            useListener('close-screen', this.close);
            PosOrderFetcher.setComponent(this);
            onMounted(this.onMounted);
            onWillUnmount(this.onWillUnmount);

            console.log("Test Dashboard");

            // If sudo_pos_shift installed
            this.shift = this.env.pos?.default_pos_shift_ids ? this?.env?.pos?.default_pos_shift_ids : {};
            this.session_shift = this.env.pos?.default_pos_shift_ids ? this.env.pos.get_shift() : []

            this.state = useState({
                shown_shift: this?.env?.pos?.default_pos_shift_ids?.name ?? null,
                id_shown_shift: this?.env?.pos?.default_pos_shift_ids?.id ?? null,
            });

            useEffect(
                () => {
                    console.log('fetching');
                    PosOrderFetcher.fetch(this.state.id_shown_shift)
                },
                () => [this.state.id_shown_shift])
        }

        onMounted() {
            PosOrderFetcher.on('update', this, this.render);
            setTimeout(() => PosOrderFetcher.fetch(this.state.id_shown_shift), 0);
        }

        onWillUnmount() {
            PosOrderFetcher.off('update', this);
        }

        close() {
            if (!this.env.pos.config.iface_floorplan) {
                super.close();
            } else {
                const order = this.env.pos.get_order();
                if (order) {
                    const { name: screenName } = order.get_screen_data();
                    this.showScreen(screenName);
                } else {
                    this.showScreen('FloorScreen');
                }
            }
        }

        filterShift(data) {
            // if (this.state.id_shown_shift && this?.env?.pos?.default_pos_shift_ids)
            //     return data.filter((d) => d.shift_id[0] == this.state.id_shown_shift);
            return data;
        }

        set_shown_shift(shift) {
            const shift_data = this.session_shift?.find((d) => d.id == shift)
            this.state.id_shown_shift = shift;
            this.state.shown_shift = shift_data ? shift_data?.name : null;
        }

        async endShift() {
            let self = this

            let { confirmed, payload } = await this.showPopup("ConfirmPopup", {
                title: this.env._t("Warning!"),
                body: this.env._t("Are you sure you want to end shift?"),
                confirmText: this.env._t("Yes"),
                cancelText: this.env._t("No")
            });

            if (confirmed) {
                await self.rpc({
                    model: "pos.shift",
                    method: "change_shift",
                    args: [[], this.shift.id]
                })

                this.close();
                if (this.env.pos.config.module_pos_restaurant) {
                    this.env.pos.reset_cashier();
                    this.showTempScreen("LoginScreen");
                }
                this.env.pos.load_server_data()
            }
        }

        async onClickChooseShift() {
            if (!this.env.pos?.default_pos_shift_ids) {
                return
            }

            const shiftList = this.session_shift.map((d) => ({
                id: d.id,
                label: `Shift ${d.name}`,
                isSelected:
                    this.state.id_shown_shift !== null &&
                    d.id === this.state.id_shown_shift,
                item: d.id
            }));

            shiftList.push({
                id: null,
                label: "Show All",
                isSelected: this.state.id_shown_shift === null,
                item: null
            });

            const { confirmed, payload } = await this.showPopup("SelectionPopup", {
                title: this.env._t("Select the Shift"),
                list: shiftList
            });

            if (confirmed) {
                console.log(payload);
                this.set_shown_shift(payload);
            }
        }

        get get_shift_value() {
            return this.state.shown_shift !== null
                ? `Shown Shift: ${this.state.shown_shift}`
                : this.env._t("Report Shift");
        }

        get outlet() {
            return this.env.pos.config
        }

        get session() {
            const session = this.env.pos.pos_session
            return session
        }

        get start_at() {
            var start_at = this.env.pos.pos_session.start_at
            var date = new Date(Date.parse(start_at));
            var get_hours = date.getHours()
            date.setHours(get_hours + 7);
            var new_date = String(date.getDate());
            var new_month = String(date.getMonth());
            var new_year = String(date.getFullYear());
            var new_hours = String(date.getHours());
            var new_minute = String(date.getMinutes());
            var new_second = String(date.getSeconds());
            var new_start_at = new_date + '-' + new_month + '-' + new_year + ' ' + new_hours + ':' + new_minute + ':' + new_second;
            return new_start_at
        }

        get end_at() {
            var stop_at = this.env.pos.pos_session.stop_at
            if (!stop_at) return "-"
            var date = new Date(Date.parse(stop_at));
            var get_hours = date.getHours()
            date.setHours(get_hours + 7);
            var new_date = String(date.getDate());
            var new_month = String(date.getMonth());
            var new_year = String(date.getFullYear());
            var new_hours = String(date.getHours());
            var new_minute = String(date.getMinutes());
            var new_second = String(date.getSeconds());
            var new_stop_at = new_date + '-' + new_month + '-' + new_year + ' ' + new_hours + ':' + new_minute + ':' + new_second;
            return new_stop_at
        }

        get actual_ending_cash() {
            var session = this.session.cash_register_balance_start;
            var payment_method = this.payment_method;
            var actual_ending_cash = 0;
            if (payment_method.length > 0) {
                var sum = 0;
                _.map(payment_method, function (payment) {
                    if (payment.payment_method == "Cash") {
                        sum = payment.amount;
                    }
                })
                actual_ending_cash = sum + session
            } else {
                actual_ending_cash = session
            }
            return actual_ending_cash
        }

        get difference() {
            var difference = 0;
            return difference
        }

        get net_sales() {
            var orderMenu = this.filterShift(PosOrderFetcher.get_order());
            const sum = orderMenu.reduce((acc, object) => {
                return (acc + object.amount_total) - object.amount_tax;
            }, 0);

            return sum;
        }

        get tax_total() {
            var orderMenu = this.filterShift(PosOrderFetcher.get_order());
            const sum = orderMenu.reduce((acc, object) => {
                return acc + object.amount_tax;
            }, 0);
            return sum;
        }

        get voucher_sales() {
            return 0;
        }

        get gross_sales() {
            var orderMenu = this.filterShift(PosOrderFetcher.get_order());
            const sum = orderMenu.reduce((acc, object) => {
                return acc + object.amount_total;
            }, 0);

            return sum;
        }

        get total_rounding_sales() {
            var orderMenu = this.filterShift(PosOrderFetcher.get_order());
            var total_amount = this.gross_sales;
            var total_paid = orderMenu.reduce((acc, object) => {
                return acc + object.amount_paid;
            }, 0);

            return total_paid - total_amount;
        }

        get guest_sales() {
            var orderMenu = this.filterShift(PosOrderFetcher.get_order());
            const sum = orderMenu.reduce((acc, object) => {
                return acc + object.customer_count;
            }, 0);

            return sum;
        }

        get average_net_sales_per_guest() {
            var net_sales = this.net_sales;
            var guest_sales = this.guest_sales;
            var average = net_sales / guest_sales;
            return isFinite(average) ? average : 0;
        }

        get average_gross_sales_per_guest() {
            var gross_sales = this.gross_sales;
            var guest_sales = this.guest_sales;
            var average = gross_sales / guest_sales;
            return isFinite(average) ? average : 0;
        }

        get bills() {
            var orderMenu = this.filterShift(PosOrderFetcher.get_order());
            return orderMenu.length;
        }

        get average_net_sales_per_bills() {
            var net_sales = this.net_sales;
            var bills = this.bills;
            var average = net_sales / bills;
            return isFinite(average) ? average : 0;
        }

        get average_gross_sales_per_bills() {
            var gross_sales = this.gross_sales;
            var bills = this.bills;
            var average = gross_sales / bills;
            return isFinite(average) ? average : 0;
        }

        get payment_method() {
            var payment_lines = PosOrderFetcher.get_payments();
            var result = [];
            payment_lines.reduce(function (res, value) {
                if (!res[value.payment_method_id[1]]) {
                    res[value.payment_method_id[1]] = { payment_method: value.payment_method_id[1], amount: 0 };
                    result.push(res[value.payment_method_id[1]])
                }
                res[value.payment_method_id[1]].amount += value.amount;
                return res;
            }, {});

            return result;
        }

        get payment_method_total() {
            let totalPayment = 0
            for (let i = 0; i < this.payment_method.length; i++) {
                totalPayment += this.payment_method[i].amount
            }
            return totalPayment;
        }

        get payment_method_by_cashier() {
            var payment_lines = PosOrderFetcher.get_payments();

            const groupedByCashier = payment_lines.reduce((res, value) => {
                // Jika cashier belum ada, buat struktur baru
                if (!res[value.cashier]) {
                    res[value.cashier] = {
                        cashier: value.cashier,
                        payments: {}
                    };
                }
                // Dapatkan payment_method_id
                const paymentMethod = value.payment_method_id[1];
                // Jika payment method belum ada di dalam cashier, inisialisasi
                if (!res[value.cashier].payments[paymentMethod]) {
                    res[value.cashier].payments[paymentMethod] = {
                        payment_method: paymentMethod,
                        amount: 0
                    };
                }
                // Tambahkan amount ke payment method
                res[value.cashier].payments[paymentMethod].amount += value.amount;

                return res;
            }, {});

            const result = Object.values(groupedByCashier).map(cashier => ({
                cashier: cashier.cashier,
                payments: Object.values(cashier.payments)
            }));

            const totalPayment = result?.reduce((acc, cashier) => {
                const payments = Object.values(cashier.payments)
                const cashierTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
                return acc + cashierTotal;
            }, 0);

            return { result: result, totalPayment: totalPayment };
        }

        get payment_method_by_cashier_total() {
            const totalPayment = this.payment_method_by_cashier?.reduce((acc, cashier) => {
                const payments = Object.values(cashier.payments)
                const cashierTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
                return acc + cashierTotal;
            }, 0);


            return totalPayment;
        }

        get order_menu() {
            var orderMenu = PosOrderFetcher.get_orderMenu();
            var orders = this.filterShift(PosOrderFetcher.get_order());
            var pricelists = this.env.pos.pricelists;

            var result = [];
            var filter_line = []
            _.each(orderMenu, function (res) {
                var curr_order = _.find(orders, function (order) {
                    return order.name === res.order_id[1];
                });
                if (curr_order) {
                    var pricelist = _.find(pricelists, function (pricelist) {
                        return pricelist.display_name === curr_order.pricelist_id[1];
                    });
                    if (!pricelist?.is_complimentary) {
                        filter_line.push(res);
                    }
                }
            });

            filter_line.reduce(function (res, value) {
                if (!res[value.full_product_name]) {
                    res[value.full_product_name] = { order_id: value.order_id, product_id: value.product_id, full_product_name: value.full_product_name, qty: 0, price_subtotal: 0, ppn: 0, price_subtotal_incl: 0, is_reward_line: value.is_reward_line, total_cost: value.total_cost };
                    result.push(res[value.full_product_name]);
                }
                res[value.full_product_name].qty += value.qty;
                res[value.full_product_name].ppn += value.price_subtotal_incl - value.price_subtotal;
                res[value.full_product_name].price_subtotal += value.price_subtotal;
                res[value.full_product_name].price_subtotal_incl += value.price_subtotal_incl;
                return res;
            }, {});

            result.forEach(object => {
                var list = this.env.pos.db.get_product_by_id(object.product_id[0]);
                object.category = list.pos_categ_id;
            });

            var free_product = [];
            result.forEach(obj => {
                if (obj.full_product_name.includes("Free Product")) {
                    var splitString = obj.full_product_name.split("- ");
                    free_product.push({ 'name': splitString[1], 'qty': obj.qty });
                }
            });

            var new_result = false;

            var total_order_menu_qty = result.reduce((acc, object) => {
                return acc + object.qty;
            }, 0);

            var total_order_menu_subtotal = result.reduce((acc, object) => {
                return acc + object.price_subtotal;
            }, 0);

            var total_order_menu_ppn = result.reduce((acc, object) => {
                return acc + object.ppn;
            }, 0);

            var total_order_menu_total = result.reduce((acc, object) => {
                return acc + object.price_subtotal_incl;
            }, 0);

            var vals = {
                'result': result,
                'total_order_menu_qty': total_order_menu_qty,
                'total_order_menu_subtotal': total_order_menu_subtotal,
                'total_order_menu_ppn': total_order_menu_ppn,
                'total_order_menu_total': total_order_menu_total,
            }

            return vals;
        }

        get sales_by_order_type() {
            var orderMenu = PosOrderFetcher.get_orderMenu();
            var orders = this.filterShift(PosOrderFetcher.get_order());
            var order_type_ids = this.env.pos.order_type_ids;

            var filter_line = [];

            _.each(orderMenu, function (res) {
                var curr_order = _.find(orders, function (order) {
                    return order.name === res.order_id[1];
                });
                if (curr_order) {
                    var order_type = _.find(order_type_ids, function (order_type) {
                        return order_type.id === curr_order.pos_order_type[0];
                    });
                    res.pos_order_type = curr_order.pos_order_type[0]
                    if (order_type) filter_line.push(res);
                }
            });

            const getOrderTypeName = (orderTypeId) => {
                const type = order_type_ids.find((type) => type.id === orderTypeId);
                return type ? type.name : "Unknown";
            };

            // Function to group and sum data by pos_order_type
            const groupByPosOrderType = (lines) => {
                return lines.reduce((acc, line) => {
                    const posType = line.pos_order_type;
                    if (!acc[posType]) {
                        acc[posType] = {
                            id: posType,
                            name: getOrderTypeName(posType),
                            qty: 0,
                            total: 0,
                        };
                    }
                    acc[posType].qty += line.qty;
                    acc[posType].total += line.price_subtotal_incl;
                    return acc;
                }, {});
            };

            const groupedData = Object.values(groupByPosOrderType(filter_line));
            const grandTotalQty = groupedData.reduce((acc, group) => acc + group.qty, 0);
            const grandTotal = groupedData.reduce((acc, group) => acc + group.total, 0);

            return { data: groupedData, total: grandTotal, total_qty: grandTotalQty }
        }

        get orderline_sales() {
            var orderline = PosOrderFetcher.get_orderline()[0];
            // console.log(orderline);
            return orderline;
        }

        get line_promo() {
            var orderMenu = PosOrderFetcher.get_orderMenu();
            var filter_orderMenu = _.filter(orderMenu, function (res) {
                if (res.is_reward_line == true) {
                    return res
                }
            });
            var result = [];
            filter_orderMenu.reduce(function (res, value) {
                if (!res[value.reward_id[1]]) {
                    res[value.reward_id[1]] = { promotion_name: value.reward_id[1], reward_id: value.reward_id, is_reward_line: value.is_reward_line, qty: 0, total: 0 };
                    result.push(res[value.reward_id[1]])
                }
                res[value.reward_id[1]].qty += value.qty;
                res[value.reward_id[1]].total += Math.abs(value.price_subtotal_incl);
                return res;
            }, {});

            var qty_total = result.reduce((acc, object) => {
                return acc + object.qty;
            }, 0);

            var grand_total = result.reduce((acc, object) => {
                return acc + object.total;
            }, 0);

            var vals = {
                'result': result,
                'qty_total': qty_total,
                'grand_total': Math.abs(grand_total),
            }

            return vals;
        }

        get non_sales_bill() {
            var order = this.filterShift(PosOrderFetcher.get_order());
            var pricelists = this.env.pos.pricelists

            var result = [];
            _.each(order, function (obj) {
                var pricelist = _.find(pricelists, function (item) {
                    return item.id === obj.pricelist_id[0];
                });
                if (pricelist?.is_complimentary) {
                    var orderPriceWithoutTax = obj.amount_total - obj.amount_tax;
                    var orderCost = orderPriceWithoutTax + Math.abs(obj.margin);
                    obj['orderCost'] = orderCost;
                    result.push(obj);
                }
            });

            const sum = result.reduce((acc, object) => {
                return acc + object.orderCost;
            }, 0);

            var vals = {
                'result': result,
                'sum': sum,
            }

            return vals;
        }

        get non_sales_menu() {
            var orderMenu = PosOrderFetcher.get_orderMenu();
            var orders = this.filterShift(PosOrderFetcher.get_order());
            var pricelists = this.env.pos.pricelists;
            var result = [];
            var filter_line = [];
            _.each(orderMenu, function (res) {
                var curr_order = _.find(orders, function (order) {
                    return order.name === res.order_id[1];
                });
                if (curr_order) {
                    var pricelist = _.find(pricelists, function (pricelist) {
                        return pricelist.display_name === curr_order.pricelist_id[1];
                    });
                    if (pricelist?.is_complimentary) {
                        filter_line.push(res);
                    }
                }
            });

            filter_line.reduce(function (res, value) {
                if (!res[value.full_product_name]) {
                    res[value.full_product_name] = { order_id: value.order_id, product_id: value.product_id, full_product_name: value.full_product_name, qty: 0, price_subtotal: 0, ppn: 0, price_subtotal_incl: 0, is_reward_line: value.is_reward_line, total_cost: value.total_cost };
                    result.push(res[value.full_product_name]);
                }
                res[value.full_product_name].qty += value.qty;
                res[value.full_product_name].ppn += value.price_subtotal_incl - value.price_subtotal;
                res[value.full_product_name].price_subtotal += value.price_subtotal;
                res[value.full_product_name].price_subtotal_incl += value.price_subtotal_incl;
                return res;
            }, {});

            result.forEach(object => {
                var list = this.env.pos.db.get_product_by_id(object.product_id[0]);
                object.category = list.pos_categ_id;
            });

            return result;
        }

        get orderline_non_sales() {
            var orderline = PosOrderFetcher.get_orderline()[1];
            return orderline;
        }

        get _check_is_module_pos_complimentary_installed() {
            var check = PosOrderFetcher.get_is_module_pos_complimentary_installed();
            return check;
        }

        get getConfig() {
            return this.env.pos.config
        }

        get currentShift() {
            return this.env.pos.default_pos_shift_ids ? this.env.pos.default_pos_shift_ids.name : "";
        }
    }

    DashboardScreenPos.template = 'DashboardScreenPos';

    Registries.Component.add(DashboardScreenPos);

    return DashboardScreenPos;
});
