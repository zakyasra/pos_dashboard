from odoo import api, fields, models, _
from odoo.exceptions import UserError
from itertools import groupby
from collections import defaultdict
from decimal import Decimal, getcontext

class PosSession(models.Model):
    _inherit = "pos.session"

    user_id_closing = fields.Many2one(comodel_name="res.users", string='Closed By',
        index=True,
        readonly=True,
        states={'closing_control': [('readonly', False)]},
        ondelete='restrict')

    # override method
    def action_pos_session_closing_control(self, balancing_account=False, amount_to_balance=0, bank_payment_method_diffs=None):
        print("INI TIL POS")
        bank_payment_method_diffs = bank_payment_method_diffs or {}
        for session in self:
            if any(order.state == 'draft' for order in session.order_ids):
                raise UserError(_("You cannot close the POS when orders are still in draft"))
            if session.state == 'closed':
                raise UserError(_('This session is already closed.'))
            session.write({'state': 'closing_control', 'stop_at': fields.Datetime.now()})
            session.user_id_closing = session.env.user.id
            if not session.config_id.cash_control:
                return session.action_pos_session_close(balancing_account, amount_to_balance, bank_payment_method_diffs)
            # If the session is in rescue, we only compute the payments in the cash register
            # It is not yet possible to close a rescue session through the front end, see `close_session_from_ui`
            if session.rescue and session.config_id.cash_control:
                default_cash_payment_method_id = self.payment_method_ids.filtered(lambda pm: pm.type == 'cash')[0]
                orders = self.order_ids.filtered(lambda o: o.state == 'paid' or o.state == 'invoiced')
                total_cash = sum(
                    orders.payment_ids.filtered(lambda p: p.payment_method_id == default_cash_payment_method_id).mapped('amount')
                ) + self.cash_register_balance_start

                session.cash_register_balance_end_real = total_cash

            return session.action_pos_session_validate(balancing_account, amount_to_balance, bank_payment_method_diffs)

    def is_module_pos_order_type_installed(self):
        pos_order_type = self.env['ir.module.module'].sudo().search([('name', '=', 'til_pos_order_type')], limit=1)
        return pos_order_type.state
        
    def is_module_pos_complimentary_installed(self):
        pos_complimentary = self.env['ir.module.module'].sudo().search([('name', '=', 'til_pos_complimentary')], limit=1)
        return pos_complimentary.state

    def is_module_pos_restaurant_installed(self):
        pos_restaurant = self.env['ir.module.module'].sudo().search([('name', '=', 'pos_restaurant')], limit=1)
        return pos_restaurant.state

    def is_module_pos_loyalty_installed(self):
        pos_loyalty = self.env['ir.module.module'].sudo().search([('name', '=', 'pos_loyalty')], limit=1)
        return pos_loyalty.state

    def get_sales_total(self):
        return sum(item.amount_total for item in self.order_ids)

    def get_discount_total(self):
        return 0

    def get_net_sales_total(self):
        amount_total = sum(item.amount_total for item in self.order_ids)
        amount_tax = sum(item.amount_tax for item in self.order_ids)
        return amount_total-amount_tax

    def get_ppn_total(self):
        return sum(item.amount_tax for item in self.order_ids)

    def get_gross_sales_total(self):
        return sum(item.amount_total for item in self.order_ids)

    def get_receipt_total(self):
        return sum(item.amount_total for item in self.order_ids)

    def get_pax_total(self):
        if self.is_module_pos_restaurant_installed() == 'installed':
            return sum(item.customer_count for item in self.order_ids)
        else:
            return 0

    def get_average_net_sales_pax_total(self):
        if self.get_pax_total() != 0:
            return self.get_net_sales_total() / self.get_pax_total()
        else:
            return 0

    def get_average_gross_sales_pax_total(self):
        if self.get_pax_total() != 0:
            return self.get_gross_sales_total() / self.get_pax_total()
        else:
            return 0

    def get_number_of_bills_total(self):
        return len(self.order_ids)

    def get_average_net_sales_bill_total(self):
        if len(self.order_ids) != 0:
            return self.get_net_sales_total() / self.get_number_of_bills_total()
        else:
            return 0

    def get_average_gross_sales_bill_total(self):
        if len(self.order_ids) != 0:
            return self.get_gross_sales_total() / self.get_number_of_bills_total()
        else:
            return 0

    def get_cancel_value_total(self):
        arr = []
        for item in self.order_ids:
            if item.is_refunded:
               arr.append(item)
        return sum(item.amount_total for item in arr)

    def get_sales_by_type(self):
        if self.is_module_pos_order_type_installed() != 'installed':
            return []

        grouped_data = {}

        for order in self.order_ids:
            order_type = order.pos_order_type.name
            vals = {
                'pos_reference': order.pos_reference,
                'amount_total': order.amount_total,
                'amount_paid': order.amount_paid,
                'amount_tax': order.amount_tax,
                'pos_order_type': order_type,
            }

            grouped_data.setdefault(order_type, []).append(vals)

        grouped_data_arr = [
            {
                'type': order_type,
                'bill': len(orders),
                'amount_total': sum(order['amount_total'] for order in orders)
            }
            for order_type, orders in grouped_data.items()
        ]

        return grouped_data_arr

    def get_sales_by_table_section(self):
        if self.is_module_pos_restaurant_installed() != 'installed':
            return []

        grouped_data = {}

        for order in self.order_ids:
            if order.table_id:
                table_name = order.table_id.name
                vals = {
                    'table': table_name,
                    'pos_reference': order.pos_reference,
                    'amount_total': order.amount_total,
                }

                grouped_data.setdefault(table_name, []).append(vals)

        grouped_data_arr = [
            {
                'table': table_name,
                'bill': len(orders),
                'amount_total': sum(order['amount_total'] for order in orders)
            }
            for table_name, orders in grouped_data.items()
        ]

        return grouped_data_arr

    def get_sales_by_visit_purpose(self):
        if self.is_module_pos_order_type_installed() != 'installed':
            return []

        grouped_data = {}

        # Filtering relevant orders
        relevant_orders = [order for order in self.order_ids if order.pos_order_type.visit_purpose]

        for order in relevant_orders:
            order_type = order.pos_order_type.name
            vals = {
                'pos_reference': order.pos_reference,
                'amount_total': order.amount_total,
                'amount_paid': order.amount_paid,
                'amount_tax': order.amount_tax,
                'pos_order_type': order_type,
            }

            grouped_data.setdefault(order_type, []).append(vals)

        total_amount = sum(order['amount_total'] for order_list in grouped_data.values() for order in order_list)

        grouped_data_arr = [
            {
                'type': order_type,
                'bill': len(orders),
                'amount_total': sum(order['amount_total'] for order in orders),
                'sales': sum(order['amount_total'] for order in orders) / total_amount * 100
            }
            for order_type, orders in grouped_data.items()
        ]

        return grouped_data_arr

    def get_promotions(self):
        if self.is_module_pos_loyalty_installed() != 'installed':
            return []

        grouped_data = {}

        pos_order_lines = self.env['pos.order.line'].search([
            ('is_reward_line', '=', True),
            ('order_id.session_id', '=', self.id)
        ])

        for line in pos_order_lines:
            name = line.reward_id.program_id.name
            vals = {'name': name, 'qty': line.qty, 'value': abs(line.price_subtotal_incl)}
            grouped_data.setdefault(name, []).append(vals)

        grouped_data_arr = [
            {
                'name': promotion,
                'qty': sum(order['qty'] for order in promotions),
                'value': sum(order['value'] for order in promotions)
            }
            for promotion, promotions in grouped_data.items()
        ]

        return grouped_data_arr

    def get_sales_by_menu_category(self):
        if self.is_module_pos_loyalty_installed() != 'installed':
            return []

        pos_order_lines = self.env['pos.order.line'].search([
            '&', ('order_id.session_id', '=', self.id),
            '&', ('is_reward_line', '=', False),
            ('product_id.pos_categ_id', '!=', False)
        ])

        # Use defaultdict to simplify grouping
        grouped_data = defaultdict(list)

        for line in pos_order_lines:
            menu_name = line.product_id.pos_categ_id.parent_id.name or line.product_id.pos_categ_id.name
            item = {
                'menu': menu_name,
                'parent_id': line.product_id.pos_categ_id.parent_id.name,
                'qty': line.qty,
                'disc': line.discount,
                'subtotal': line.price_subtotal,
                'total': line.price_subtotal_incl,
            }
            grouped_data[menu_name].append(item)

        total_amount = sum(order['total'] for order_list in grouped_data.values() for order in order_list)

        precision = 2
        getcontext().prec = precision + 2  # Set precision for the context

        grouped_data_arr = [
            {
                'menu': menu,
                'qty': sum(menu['qty'] for menu in menus),
                'disc': sum(menu['disc'] for menu in menus),
                'subtotal': sum(menu['subtotal'] for menu in menus),
                'total': sum(menu['total'] for menu in menus),
                'percentage': round(sum(menu['total'] for menu in menus) / total_amount * 100, 1)
            }
            for menu, menus in grouped_data.items()
        ]

        grouped_data_arr[-1]['percentage'] = 0
        temp_percentage = sum(order['percentage'] for order in grouped_data_arr)
        last_percentage = 100 - temp_percentage
        grouped_data_arr[-1]['percentage'] = round(last_percentage, 1)

        return grouped_data_arr

    def get_sales_by_menu_category_detail(self):
        pos_order_lines = self.env['pos.order.line'].search([
            '&', ('order_id.session_id', '=', self.id),
            '&', ('is_reward_line', '=', False),
            ('product_id.pos_categ_id', '!=', False)
        ])

        # Use defaultdict to simplify grouping
        grouped_data = defaultdict(list)

        for line in pos_order_lines:
            # Example usage
            category_id = line.product_id.pos_categ_id.id
            category = self.env['pos.category'].browse(category_id)
            category_path = self.env['pos.category'].get_category_path(category)
            print(category_path)
            item = {
                'menu': category_path,
                'qty': line.qty,
                'subtotal': line.price_subtotal,
            }
            grouped_data[category_path].append(item)
        print(grouped_data)

        total_amount = sum(order['subtotal'] for order_list in grouped_data.values() for order in order_list)
        precision = 2
        getcontext().prec = precision + 2  # Set precision for the context

        grouped_data_arr = []
        for menu, menus in grouped_data.items():
            qty = sum(menu['qty'] for menu in menus)
            subtotal = sum(menu['subtotal'] for menu in menus)
            percentage = (subtotal / total_amount) * 100
            grouped_data_arr.append({
                'menu': menu,
                'qty': int(qty),
                'subtotal': subtotal,
                'percentage': round(percentage, 1)
            })
        print(grouped_data_arr)

        grouped_data_arr[-1]['percentage'] = 0
        temp_percentage = sum(order['percentage'] for order in grouped_data_arr)
        last_percentage = 100 - temp_percentage
        grouped_data_arr[-1]['percentage'] = round(last_percentage, 1)

        return grouped_data_arr if self.is_module_pos_loyalty_installed() == 'installed' else []

    def get_payment_method(self):
        pos_payment_method = []

        for payment_method in self.payment_method_ids:
            pos_payments = self.env['pos.payment'].search([
                ('payment_method_id', '=', payment_method.id),
                ('session_id', '=', self.id)
            ])

            for payment in pos_payments:
                pos_payment_method.append({'name': payment.payment_method_id.name, 'amount': payment.amount})

        pos_payment_method.sort(key=lambda x: x['name'])

        # Group the data by the 'name' key
        grouped_data = {key: list(group) for key, group in groupby(pos_payment_method, key=lambda x: x['name'])}

        grouped_data_arr = [
            {'name': payment_method, 'amount': sum(payment['amount'] for payment in payments)}
            for payment_method, payments in grouped_data.items()
        ]

        return grouped_data_arr
