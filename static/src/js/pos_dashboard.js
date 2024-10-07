odoo.define('custom_sudo_pos_dashboard.Dashboard', function (require) {
    "use strict";

    var AbstractAction = require('web.AbstractAction');
    var core = require('web.core');
    const {
        loadBundle
    } = require("@web/core/assets");
    var ajax = require('web.ajax');
    var session = require('web.session');
    var web_client = require('web.web_client');
    var rpc = require('web.rpc');
    var _t = core._t;
    var QWeb = core.qweb;

    var date = new Date();
    var last_month = new Date(date.getTime());
    last_month.setDate(date.getDate() - 30);

    var filter_type_pos;

    var PosDashboard = AbstractAction.extend({
        template: 'PosDashboard',
        events: {
            'change #pos_type_til': 'setTypePos',
            'change #start_date, #end_date, #pos_name_til': 'fetch_data_by_pos',
            //            'click .total_order_main': 'total_order_main',
            //            'click .pos_order': 'pos_order',
            //            'click .pos_total_sales': 'pos_order',
            //            'click .pos_session': 'pos_session',
            //            'click .pos_refund_orders': 'pos_refund_orders',
            //            'click .pos_worst_product': 'pos_worst_product',
            //            'click .pos_refund_today_orders': 'pos_refund_today_orders',
        },
        init: function (parent, context) {
            this._super(parent, context);
            this.dashboards_templates = ['Filter', 'PosOrders', 'PosChart', 'PosCustomer'];
            this.top_salesperson = [];
            this.total_sale = [];
            this.total_order_count = [];
            this.total_refund_count = [];
            this.total_session = [];
            this.today_refund_total = [];
            this.today_sale = [];
            this.today_worst_product = [];
            this.worst_qty = [];
            this.get_data = [];
            this.pos_config_id = [];
        },
        willStart: function () {
            var self = this;
            return $.when(loadBundle(this), this._super()).then(function () {
                return self.fetch_data();
            });
        },
        start: function () {
            var self = this;
            this.set("title", 'Dashboard');
            return this._super().then(function () { });
        },
        get_filter: function () {
            var date = new Date();
            var date_start = $('#start_date').val() ? $('#start_date').val() : this.converter_date(last_month);
            var date_end = $('#end_date').val() ? $('#end_date').val() : this.converter_date(date);
            var pos_id = $('#pos_name_til').val();
            var type_pos = $('#pos_type_til').val();

            return { date_start, date_end, type_pos, pos_id };
        },
        converter_date: function (date) {
            var tahun = date.getFullYear();
            var bulan = ("0" + (date.getMonth() + 1)).slice(-2);
            var tanggal = ("0" + date.getDate()).slice(-2);
            var result = String(tahun) + '-' + String(bulan) + '-' + String(tanggal)
            return result
        },
        getData: function (posType) {
            var self = this;
            var pos = this._rpc({
                model: 'pos.order',
                method: 'get_data_pos',
                args: [false, posType]
            }).then(function (result) {

                $('#pos_name_til').empty();
                $('#pos_name_til').append('<option value="all" style="display:none; text-align: center;"> -- All Pos -- </option>');

                var index = 0;
                _.forEach(result, function (x) {
                    $('#pos_name_til').append('<option value=' + result[index]['id'] + '>' + result[index]['name'] + '</option>');
                    index++;
                });
                var pos_id = $('#pos_name_til').val();
                self.fetch_data(posType, pos_id);
            });
        },
        renderElement: function (e) {
            var self = this;
            var pos_id = $('#pos_name_til').val();
            var type_pos = $('#pos_type_til').val();
            $.when(this._super()).then(function (e) {
                self.render_dashboards();
                self.render_graphs();
                self.$el.parent().addClass('oe_background_grey');
                self.getData();
                self.fetch_data();
            })
        },
        fetch_data_by_pos: function () {
            var type_pos = $('#pos_type_til').val();
            var pos_config_id = $('#pos_name_til').val()
            this.render_payment_method_pie(type_pos, pos_config_id);
            this.render_top_customer_graph(type_pos, pos_config_id);
            this.fetch_data(type_pos, pos_config_id)
            this.render_top_product_graph();
            this.render_product_category_graph();
        },
        setTypePos: function () {
            filter_type_pos = $('#pos_type_til').val()
            this.get_filter();
            $('#pos_name_til').val('all');
            var type_pos = $('#pos_type_til').val();
            var pos_id = $('#pos_name_til').val();
            this.getData(type_pos);
            var type_pos = $('#pos_type_til').val();
            this.render_top_customer_graph(type_pos, pos_id);
            this.render_payment_method_pie(type_pos, pos_id)
            this.render_top_product_graph();
            this.render_product_category_graph();
        },
        fetch_data: function (posType, pos_id) {
            var date = new Date();
            var last_month = new Date(date.getTime());
            last_month.setDate(date.getDate() - 30);
            var self = this;
            var date_start = $('#start_date').val() ? $('#start_date').val() : self.converter_date(last_month);
            var date_end = $('#end_date').val() ? $('#end_date').val() : self.converter_date(date);
            var type_pos = $("#pos_type_til");
            var type_value = type_pos.val();
            var mainAvrPerPax = $("#main_avr_net_sales");
            var mainTotalPax = $("#main_total_pax_til");
            var def1 = this._rpc({
                model: 'pos.order',
                method: 'get_refund_details',
                args: [date_start, date_end, posType, pos_id],
            }).then(function (result) {
                $('#total_order_til').text(result['total_order_count'])
                $('#total_net_sales_til').text(result['total_net_sales'])
                $('#total_sales_til').text(result['total_sale'])
                $('#opened_session_til').text(result['opened_session'])
                $('#closed_session_til').text(result['closed_session'])
                $('#total_refund_count_til').text(result['total_refund_count'])
                $('#total_refund_til').text(result['total_refund'])
                $('#customer_count_til').text(result['customer_count'])
                $('#non_sales_transaction_til').text(result['non_sales_transaction'])
                $('#net_sales_perpax_til').text(result['net_sales_perpax'])
                $('#net_sales_perbill_til').text(result['net_sales_perbill'])
                if (type_value == 'false') {
                    mainTotalPax.hide();
                    mainAvrPerPax.hide()
                } else if (type_value == 'true') {
                    mainTotalPax.show();
                    mainAvrPerPax.show();
                }
            });
            var def2 = self._rpc({
                model: "pos.order",
                method: "get_details",
                args: [date_start, date_end, posType, pos_id],
            })
                .then(function (res) {
                    $("#table_sales_person").find("td").remove();

                    $.each(res['salesperson'], function (index, salesperson) {
                        const name = salesperson[0];
                        const orders = salesperson[1];
                        const amount = salesperson[2];
                        $("#table_sales_person tbody").append(`<tr>
                  <td>${name}</td>
                  <td>${orders}</td>
                  <td>${amount}</td>
              </tr>`);
                    });
                    self.payment_details = res['payment_details'];
                    self.top_salesperson = res['salesperson'];
                    self.selling_product = res['selling_product'];
                });
            return $.when(def1, def2);
        },
        render_dashboards: function () {
            var self = this;
            _.each(this.dashboards_templates, function (template) {
                self.$('.o_pos_dashboard').append(QWeb.render(template, {
                    widget: self
                }));
            });
        },
        render_graphs: function (type_pos, pos_id) {
            var self = this;
            self.render_top_customer_graph(type_pos, pos_id);
            self.render_payment_method_pie(type_pos, pos_id);
            self.render_top_product_graph();
            self.render_product_category_graph();
        },
        total_order_main: function (e) {
            var self = this;
            var date = new Date();
            var start = $('#start_date').val() ? $('#start_date').val() : self.converter_date(last_month);
            var end = $('#end_date').val() ? $('#end_date').val() : self.converter_date(date);
            var { date_start, date_end } = this.get_filter();
            e.stopPropagation();
            e.preventDefault();
            session.user_has_group('hr.group_hr_user').then(function (has_group) {
                if (has_group) {
                    var options = {
                        on_reverse_breadcrumb: self.on_reverse_breadcrumb,
                    };
                    if (typeof filter_type_pos === "string") {
                        filter_type_pos = Boolean(filter_type_pos);
                    } else if (filter_type_pos === undefined) {
                        filter_type_pos = true;
                    }

                    self.do_action({
                        name: _t("Today Order"),
                        type: 'ir.actions.act_window',
                        res_model: 'pos.order',
                        view_mode: 'tree,form,calendar',
                        view_type: 'form',
                        views: [
                            [false, 'list'],
                            [false, 'form']
                        ],
                        domain: [
                            ['date_order', '<=', date_end],
                            ['date_order', '>=', date_start],
                            ['restaurant', '=', filter_type_pos]
                        ],
                        target: 'current'
                    }, options)
                }
            });

        },
        pos_refund_orders: function (e) {
            var self = this;
            var date = new Date();
            var yesterday = new Date(date.getTime());
            yesterday.setDate(date.getDate() - 1);
            e.stopPropagation();
            e.preventDefault();

            session.user_has_group('hr.group_hr_user').then(function (has_group) {
                if (has_group) {
                    var options = {
                        on_reverse_breadcrumb: self.on_reverse_breadcrumb,
                    };
                    self.do_action({
                        name: _t("Refund Orders"),
                        type: 'ir.actions.act_window',
                        res_model: 'pos.order',
                        view_mode: 'tree,form,calendar',
                        view_type: 'form',
                        views: [
                            [false, 'list'],
                            [false, 'form']
                        ],
                        domain: [
                            ['amount_total', '<', 0.0]
                        ],
                        target: 'current'
                    }, options)
                }
            });

        },
        pos_refund_today_orders: function (e) {
            var self = this;
            var date = new Date();
            var yesterday = new Date(date.getTime());
            yesterday.setDate(date.getDate() - 1);
            e.stopPropagation();
            e.preventDefault();

            session.user_has_group('hr.group_hr_user').then(function (has_group) {
                if (has_group) {
                    var options = {
                        on_reverse_breadcrumb: self.on_reverse_breadcrumb,
                    };
                    self.do_action({
                        name: _t("Refund Orders"),
                        type: 'ir.actions.act_window',
                        res_model: 'pos.order',
                        view_mode: 'tree,form,calendar',
                        view_type: 'form',
                        views: [
                            [false, 'list'],
                            [false, 'form']
                        ],
                        domain: [
                            ['amount_total', '<', 0.0],
                            ['date_order', '<=', date],
                            ['date_order', '>=', yesterday]
                        ],
                        target: 'current'
                    }, options)
                }
            });

        },
        pos_worst_product: function (e) {
            var self = this;
            var date = new Date();
            var yesterday = new Date(date.getTime());
            yesterday.setDate(date.getDate() - 1);
            e.stopPropagation();
            e.preventDefault();
            var qty = this.worst_qty;
            session.user_has_group('hr.group_hr_user').then(function (has_group) {
                if (has_group) {
                    var options = {
                        on_reverse_breadcrumb: self.on_reverse_breadcrumb,
                    };
                    self.do_action({
                        name: _t("Worst Product"),
                        type: 'ir.actions.act_window',
                        res_model: 'pos.order.line',
                        view_mode: 'tree,form,calendar',
                        view_type: 'form',
                        views: [
                            [false, 'list'],
                            [false, 'form']
                        ],
                        domain: [
                            ['qty', '=', qty],
                            ['date_order', '<=', date],
                            ['date_order', '>=', yesterday]
                        ],
                        target: 'current'
                    }, options)
                }
            });

        },

        pos_order: function (e) {
            var self = this;
            var date = new Date();
            var yesterday = new Date(date.getTime());
            yesterday.setDate(date.getDate() - 1);
            e.stopPropagation();
            e.preventDefault();
            session.user_has_group('hr.group_hr_user').then(function (has_group) {
                if (has_group) {
                    var options = {
                        on_reverse_breadcrumb: self.on_reverse_breadcrumb,
                    };
                    self.do_action({
                        name: _t("Total Order"),
                        type: 'ir.actions.act_window',
                        res_model: 'pos.order',
                        view_mode: 'tree,form,calendar',
                        view_type: 'form',
                        views: [
                            [false, 'list'],
                            [false, 'form']
                        ],
                        target: 'current'
                    }, options)
                }
            });

        },
        pos_session: function (e) {
            var self = this;
            e.stopPropagation();
            e.preventDefault();
            session.user_has_group('hr.group_hr_user').then(function (has_group) {
                if (has_group) {
                    var options = {
                        on_reverse_breadcrumb: self.on_reverse_breadcrumb,
                    };
                    self.do_action({
                        name: _t("sessions"),
                        type: 'ir.actions.act_window',
                        res_model: 'pos.session',
                        view_mode: 'tree,form,calendar',
                        view_type: 'form',
                        views: [
                            [false, 'list'],
                            [false, 'form']
                        ],
                        target: 'current'
                    }, options)
                }
            });

        },

        onclick_pos_sales: function (events) {
            var option = $(events.target).val();
            var type_pos = $("#pos_type_til").val();
            var pos_id = $("#pos_name_til").val();
            var self = this
            var ctx = self.$("#canvas_1");
            rpc.query({
                model: "pos.order",
                method: "get_department",
                args: [option, type_pos, pos_id],
            }).then(function (arrays) {
                var data = {
                    labels: arrays[1],
                    datasets: [{
                        label: arrays[2],
                        data: arrays[0],
                        backgroundColor: [
                            "rgba(255, 99, 132,1)",
                            "rgba(54, 162, 235,1)",
                            "rgba(75, 192, 192,1)",
                            "rgba(153, 102, 255,1)",
                            "rgba(10,20,30,1)"
                        ],
                        borderColor: [
                            "rgba(255, 99, 132, 0.2)",
                            "rgba(54, 162, 235, 0.2)",
                            "rgba(75, 192, 192, 0.2)",
                            "rgba(153, 102, 255, 0.2)",
                            "rgba(10,20,30,0.3)"
                        ],
                        borderWidth: 1
                    },

                    ]
                };

                //options
                //options
                var options = {
                    responsive: true,
                    title: {
                        display: true,
                        position: "top",
                        text: "SALE DETAILS",
                        fontSize: 18,
                        fontColor: "#111"
                    },
                    legend: {
                        display: true,
                        position: "bottom",
                        labels: {
                            fontColor: "#333",
                            fontSize: 16
                        }
                    },
                    scales: {
                        yAxes: [{
                            ticks: {
                                min: 0
                            }
                        }]
                    }
                };

                //create Chart class object
                if (window.myCharts != undefined)
                    window.myCharts.destroy();
                window.myCharts = new Chart(ctx, {
                    type: "bar",
                    data: data,
                    options: options
                });

            });
        },
        render_payment_method_pie: function (type_pos, pos_id) {
            var self = this
            var ctx = self.$(".payment_method_pie");
            var date = new Date();
            var last_month = new Date(date.getTime());
            last_month.setDate(date.getDate() - 30);
            var date_start = $('#start_date').val() ? $('#start_date').val() : self.converter_date(last_month);
            var date_end = $('#end_date').val() ? $('#end_date').val() : self.converter_date(date);
            var type = $('#pos_type_til').val();
            rpc.query({
                model: "pos.order",
                method: "get_payment_method",
                args: [date_start, date_end, type_pos, pos_id],

            }).then(function (arrays) {

                var data = {}
                data = {
                    labels: arrays[1],
                    datasets: [{
                        label: "",
                        data: arrays[0],
                        backgroundColor: [
                            "rgb(148, 22, 227)",
                            "rgba(54, 162, 235)",
                            "rgba(75, 192, 192)",

                            "rgba(10,20,30)"
                        ],
                        borderColor: [
                            "rgba(255, 99, 132,)",
                            "rgba(54, 162, 235,)",
                            "rgba(75, 192, 192,)",
                            "rgba(153, 102, 255,)",
                            "rgba(10,20,30,)"
                        ],
                        borderWidth: 1
                    },

                    ]
                };
                //options
                var options = {
                    responsive: true,
                    title: {
                        display: true,
                        position: "top",
                        text: "Payment Methods",
                        fontSize: 18,
                        fontColor: "#111"
                    },
                    legend: {
                        display: true,
                        position: "bottom",
                        labels: {
                            fontColor: "#333",
                            fontSize: 16
                        }
                    },
                    scales: {
                        yAxes: [{
                            ticks: {
                                min: 0
                            }
                        }]
                    }
                };
                //create Chart class object
                if (window.paymentMethodPie != undefined)
                    window.paymentMethodPie.destroy();
                window.paymentMethodPie = new Chart(ctx, {
                    type: "pie",
                    data: data,
                    options: options
                });
            });
        },

        render_top_customer_graph: function (type_pos, pos_id) {
            var self = this
            var date = new Date();
            var last_month = new Date(date.getTime());
            last_month.setDate(date.getDate() - 30);
            var date_start = $('#start_date').val() ? $('#start_date').val() : self.converter_date(last_month);
            var date_end = $('#end_date').val() ? $('#end_date').val() : self.converter_date(date);
            var ctx = self.$(".top_customer");
            rpc.query({
                model: "pos.order",
                method: "get_the_top_customer",
                args: [date_start, date_end, type_pos, pos_id],
            }).then(function (arrays) {
                var data = {
                    labels: arrays[1],
                    datasets: [{
                        label: "",
                        data: arrays[0],
                        backgroundColor: [
                            "rgb(148, 22, 227)",
                            "rgba(54, 162, 235)",
                            "rgba(75, 192, 192)",
                            "rgba(153, 102, 255)",
                            "rgba(10,20,30)"
                        ],
                        borderColor: [
                            "rgba(255, 99, 132,)",
                            "rgba(54, 162, 235,)",
                            "rgba(75, 192, 192,)",
                            "rgba(153, 102, 255,)",
                            "rgba(10,20,30,)"
                        ],
                        borderWidth: 1
                    },

                    ]
                };

                //options
                var options = {
                    responsive: true,
                    title: {
                        display: true,
                        position: "top",
                        text: " Top Customer",
                        fontSize: 18,
                        fontColor: "#111"
                    },
                    legend: {
                        display: true,
                        position: "bottom",
                        labels: {
                            fontColor: "#333",
                            fontSize: 16
                        }
                    },
                    scales: {
                        yAxes: [{
                            ticks: {
                                min: 0
                            }
                        }]
                    }
                };

                //create Chart class object
                if (window.topCustomer != undefined)
                    window.topCustomer.destroy();
                window.topCustomer = new Chart(ctx, {
                    type: "pie",
                    data: data,
                    options: options
                });

            });
        },

        render_top_product_graph: function () {
            var self = this
            var ctx = self.$(".top_selling_product");
            var date = new Date();
            var last_month = new Date(date.getTime());
            last_month.setDate(date.getDate() - 30);
            var date_start = $('#start_date').val() ? $('#start_date').val() : self.converter_date(last_month);
            var date_end = $('#end_date').val() ? $('#end_date').val() : self.converter_date(date);
            var type_pos = $('#pos_type_til').val();
            var pos_id = $('#pos_name_til').val();
            rpc.query({
                model: "pos.order",
                method: "get_the_top_products",
                args: [date_start, date_end, type_pos, pos_id],
            }).then(function (arrays) {
                var data = {

                    labels: arrays[1],
                    datasets: [{
                        label: "Quantity",
                        data: arrays[0],
                        backgroundColor: [
                            "rgba(255, 99, 132,1)",
                            "rgba(54, 162, 235,1)",
                            "rgba(75, 192, 192,1)",
                            "rgba(153, 102, 255,1)",
                            "rgba(10,20,30,1)"
                        ],
                        borderColor: [
                            "rgba(255, 99, 132, 0.2)",
                            "rgba(54, 162, 235, 0.2)",
                            "rgba(75, 192, 192, 0.2)",
                            "rgba(153, 102, 255, 0.2)",
                            "rgba(10,20,30,0.3)"
                        ],
                        borderWidth: 1
                    },

                    ]
                };

                //options
                var options = {
                    responsive: true,
                    title: {
                        display: true,
                        position: "top",
                        text: " Top products",
                        fontSize: 18,
                        fontColor: "#111"
                    },
                    legend: {
                        display: true,
                        position: "bottom",
                        labels: {
                            fontColor: "#333",
                            fontSize: 16
                        }
                    },
                    scales: {
                        yAxes: [{
                            ticks: {
                                min: 0
                            }
                        }]
                    }
                };

                //create Chart class object
                if (window.topProduct != undefined)
                    window.topProduct.destroy();
                window.topProduct = new Chart(ctx, {
                    type: "horizontalBar",
                    data: data,
                    options: options
                });

            });
        },

        render_product_category_graph: function () {
            var self = this
            var date = new Date();
            var last_month = new Date(date.getTime());
            last_month.setDate(date.getDate() - 30);
            var date_start = $('#start_date').val() ? $('#start_date').val() : self.converter_date(last_month);
            var date_end = $('#end_date').val() ? $('#end_date').val() : self.converter_date(date);
            var type_pos = $('#pos_type_til').val();
            var pos_id = $('#pos_name_til').val();
            var ctx = self.$(".top_product_categories");
            rpc.query({
                model: "pos.order",
                method: "get_the_top_categories",
                args: [date_start, date_end, type_pos, pos_id],
            }).then(function (arrays) {


                var data = {
                    labels: arrays[1],
                    datasets: [{
                        label: "Quantity",
                        data: arrays[0],
                        backgroundColor: [
                            "rgba(255, 99, 132,1)",
                            "rgba(54, 162, 235,1)",
                            "rgba(75, 192, 192,1)",
                            "rgba(153, 102, 255,1)",
                            "rgba(10,20,30,1)"
                        ],
                        borderColor: [
                            "rgba(255, 99, 132, 0.2)",
                            "rgba(54, 162, 235, 0.2)",
                            "rgba(75, 192, 192, 0.2)",
                            "rgba(153, 102, 255, 0.2)",
                            "rgba(10,20,30,0.3)"
                        ],
                        borderWidth: 1
                    },


                    ]
                };

                //options
                var options = {
                    responsive: true,
                    title: {
                        display: true,
                        position: "top",
                        text: " Top product categories",
                        fontSize: 18,
                        fontColor: "#111"
                    },
                    legend: {
                        display: true,
                        position: "bottom",
                        labels: {
                            fontColor: "#333",
                            fontSize: 16
                        }
                    },
                    scales: {
                        yAxes: [{
                            ticks: {
                                min: 0
                            }
                        }]
                    }
                };

                //create Chart class object
                if (window.topCategory != undefined)
                    window.topCategory.destroy();
                window.topCategory = new Chart(ctx, {
                    type: "horizontalBar",
                    data: data,
                    options: options
                });
            });
        },
    });


    core.action_registry.add('pos_dashboard', PosDashboard);

    return PosDashboard;

});