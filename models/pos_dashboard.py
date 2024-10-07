# -*- coding: utf-8 -*-
###################################################################################
#
#    Cybrosys Technologies Pvt. Ltd.
#    Copyright (C) 2022-TODAY Cybrosys Technologies (<https://www.cybrosys.com>).
#    Author: Irfan (<https://www.cybrosys.com>)
#
#    This program is free software: you can modify
#    it under the terms of the GNU Affero General Public License (AGPL) as
#    published by the Free Software Foundation, either version 3 of the
#    License, or (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <https://www.gnu.org/licenses/>.
#
###################################################################################
import pytz
from odoo import models, fields, api
from datetime import timedelta, datetime, date
import inspect


class PosPayment(models.Model):
    _inherit = 'pos.payment'

    payment_name = fields.Char(related="payment_method_id.name", store=True)


class PosOrderLine(models.Model):
    _inherit = 'pos.order.line'

    date_order = fields.Datetime(related="order_id.date_order", store=True)
    pos_id = fields.Integer(related="order_id.pos_id", store=True)
    restaurant = fields.Boolean(related="order_id.restaurant", store=True)


class PosSession(models.Model):
    _inherit = 'pos.session'

    pos_id = fields.Integer(related="config_id.id", store=True)
    restaurant = fields.Boolean(related="config_id.module_pos_restaurant", store=True)
    opening_at_formatted = fields.Char('date opening formatted', compute="_compute_date_formatted")

    def _compute_date_formatted(self):
        for rec in self:
            rec.opening_at_formatted = rec.start_at.strftime("%Y-%m-%d")



class PosDashboard(models.Model):
    _inherit = 'pos.order'

    pos_id = fields.Integer(related="config_id.id", store=True)
    restaurant = fields.Boolean(related="config_id.module_pos_restaurant", store=True)

    @api.model
    def get_payment_method(self, date_start, date_end, pos_type, pos_id):
        if pos_type is None:
            pos_type = True
        elif pos_type == "false":
            pos_type = False
        elif pos_type == "true":
            pos_type = True
        domain = [('config_id.module_pos_restaurant', '=', pos_type)]
        if pos_id is None or pos_id == 'all':
            domain = [('config_id.module_pos_restaurant', '=', pos_type)]
        else:
            domain = [('config_id.module_pos_restaurant', '=', pos_type), ('config_id.id', '=', int(pos_id))]
        orders = self.env['pos.order'].search(domain)
        total_price = {}
        payment_names = {}
        for order in orders:
            if date_start <= order.date_order_formatted <= date_end:
                payments = order.payment_ids
                for payment in payments:
                    payment_name = payment.payment_method_id.name
                    if payment_name in payment_names:
                        # payment_names.append(payment_name)
                        total_price[payment_name] += payment.amount  #
                    else:
                        total_price[payment_name] = payment.amount
        payment_names = list(total_price.keys())
        total_prices = list(total_price.values())
        final = [total_prices, payment_names]
        return final

    @api.model
    def get_department(self, option, pos_type, pos_id):
        condition = ''
        if pos_id != 'all':
            condition = f" AND restaurant = {pos_type} AND pos_id = {pos_id}"
        else:
            condition = f" AND restaurant = {pos_type}"

        company_id = self.env.company.id
        if option == 'pos_hourly_sales':
            user_tz = self.env.user.tz if self.env.user.tz else pytz.UTC
            query = '''select  EXTRACT(hour FROM date_order at time zone 'utc' at time zone '{}') 
                       as date_month,sum(amount_total) from pos_order where  
                       EXTRACT(month FROM date_order::date) = EXTRACT(month FROM CURRENT_DATE) 
                       AND pos_order.company_id = ''' + str(
                company_id) + condition + ''' group by date_month '''
            query = query.format(user_tz)
            label = 'HOURS'
        elif option == 'pos_monthly_sales':
            query = '''select  date_order::date as date_month,sum(amount_total) from pos_order where 
             EXTRACT(month FROM date_order::date) = EXTRACT(month FROM CURRENT_DATE) AND pos_order.company_id = ''' + str(
                company_id) + condition + '''  group by date_month '''
            label = 'DAYS'
        else:
            query = '''select TO_CHAR(date_order,'MON')date_month,sum(amount_total) from pos_order where
             EXTRACT(year FROM date_order::date) = EXTRACT(year FROM CURRENT_DATE) AND pos_order.company_id = ''' + str(
                company_id) + condition + ''' group by date_month'''
            label = 'MONTHS'
        self._cr.execute(query)
        docs = self._cr.dictfetchall()
        order = []
        for record in docs:
            order.append(record.get('sum'))
        today = []
        for record in docs:
            today.append(record.get('date_month'))
        final = [order, today, label]
        return final

    def get_data_pos(self, is_bar):
        if is_bar == 'true':
            is_bar = True
        elif is_bar == 'false':
            is_bar = False
        elif is_bar is None:
            is_bar = True
        pos_ids = self.env['pos.config'].search([('module_pos_restaurant', '=', is_bar)])
        vals = []
        for pos in pos_ids:
            vals.append({
                'id': pos.id,
                'name': pos.name,
            })
        return vals

    @api.model
    def get_details(self, date_start, date_end, pos_type, pos_id):
        if pos_type is None:
            pos_type = True
        elif pos_type == "false":
            pos_type = False
        elif pos_type == "true":
            pos_type = True
        date_range = f"AND date_order BETWEEN '{date_start} 00:00:00' AND '{date_end} 23:59:59'"
        condition = ''
        if pos_id == 'all' or pos_id is None:
            if pos_type:
                condition = f" AND restaurant = {pos_type}"
            else:
                condition = f" AND (restaurant = {pos_type} or restaurant is null)"
        else:
            if pos_type:
                condition = f" AND restaurant = {pos_type} AND pos_id = {pos_id}"
            else:
                condition = f" AND (restaurant = {pos_type} or restaurant is null) AND pos_id = {pos_id}"

        company_id = self.env.company.id
        cr = self._cr
        query = f'''
            select hr_employee.name,sum(pos_order.amount_paid) as total,count(pos_order.amount_paid) as orders 
            from pos_order  
            inner join hr_employee on pos_order.cashier = hr_employee.name 
            where pos_order.company_id = {str(company_id)}
            {date_range} {condition}
            GROUP BY hr_employee.name order by total DESC;'''
        cr.execute(query)
        salesperson = cr.fetchall()
        total_sales = []
        for rec in salesperson:
            rec = list(rec)
            sym_id = rec[1]
            company = self.env.company
            if company.currency_id.position == 'after':
                rec[1] = "%s %s" % (sym_id, company.currency_id.symbol)
            else:
                rec[1] = "%s %s" % (company.currency_id.symbol, sym_id)
            rec = tuple(rec)
            total_sales.append(rec)
        return {
            'salesperson': total_sales,
        }

    date_order_formatted = fields.Char('date order formatted', compute="_compute_date_formatted")

    def _compute_date_formatted(self):
        for rec in self:
            rec.date_order_formatted = rec.date_order.strftime("%Y-%m-%d")

    def today_worst_product(self):
        date_now_formatted = fields.datetime.now().strftime("%Y-%m-%d")
        pos_order = self.env['pos.order'].search([])
        pos_order_id = []
        for rec in pos_order:
            if rec.date_order_formatted == date_now_formatted:
                pos_order_id.append(rec.id)
        pos_order_line = self.env['pos.order.line'].search([('order_id', 'in', pos_order_id)])
        list_qty = []
        for rec in pos_order_line:
            list_qty.append(rec.qty)
        minimum_qty = 0
        if len(list_qty) != 0:
            minimum_qty = min(list_qty)
        total_product = 0
        for rec in pos_order_line:
            if rec.qty == minimum_qty:
                total_product += 1
        return total_product, minimum_qty
    
    def is_module_pos_restaurant_installed(self):
        pos_restaurant = self.env['ir.module.module'].sudo().search([('name', '=', 'pos_restaurant')], limit=1)
        return pos_restaurant.state == 'installed'
    
    def is_module_pos_complimentary_installed(self):
        pos_complimentary = self.env['ir.module.module'].sudo().search([('name', '=', 'til_pos_complimentary')], limit=1)
        return pos_complimentary.state == 'installed'

    @api.model
    def get_refund_details(self, date_start, date_end, pos_type, pos_id):
        if pos_type is None:
            pos_type = True
        elif pos_type == "false":
            pos_type = False
        elif pos_type == "true":
            pos_type = True
        default_date = datetime.today().date()
        domain = [('restaurant', '=', pos_type)]
        if pos_id == 'all' or pos_id is None:
            pass
        else:
            domain = [('restaurant', '=', pos_type), ('pos_id', '=', int(pos_id))]
        pos_order = self.env['pos.order'].search(domain)
        is_module_pos_restaurant_installed = self.is_module_pos_restaurant_installed()
        total = 0
        today_refund_total = 0
        total_order_count = 0
        total_refund_count = 0
        total_refund = 0
        today_worst_product, worst_qty = self.today_worst_product()
        today_sale = 0
        total_sales = 0
        total_net_sales = 0
        customer_count = 0
        non_sales_transaction = 0
        for rec in pos_order:
            if date_start <= rec.date_order_formatted <= date_end:
                if rec.amount_total > 0:
                    total_wo_tax = rec.amount_total - rec.amount_tax
                    total_net_sales += total_wo_tax
                    total_sales += rec.amount_total
                total = total + total_sales
                total_order_count = total_order_count + 1
                today_sale = today_sale + 1
                customer_count += rec.customer_count if is_module_pos_restaurant_installed else 0
                if rec.amount_total < 0.0:
                    total_refund_count = total_refund_count + 1
                    total_refund += rec.amount_total
                if self.is_module_pos_complimentary_installed():
                    if rec.pricelist_id.is_complimentary:
                        for line in rec.lines:
                            product = line.product_id
                            total_price = product.list_price * line.qty
                            non_sales_transaction += total_price
        domain_session = [('restaurant', '=', pos_type)]
        if pos_id == 'all' or pos_id is None:
            pass
        else:
            domain_session = [('restaurant', '=', pos_type), ('config_id.id', '=', int(pos_id))]
        pos_session = self.env['pos.session'].search(domain_session)
        opened_session = 0
        closed_session = 0
        net_sales_perpax = 0
        net_sales_perbill = 0
        if pos_type and total_net_sales != 0 and customer_count != 0:
            net_sales_perpax = total_net_sales / customer_count

        if total_net_sales != 0 and total_order_count:
            net_sales_perbill = total_net_sales / total_order_count
        for record in pos_session:
            if date_start <= record.opening_at_formatted <= date_end:
                if record.state == "opened":
                    opened_session += 1
                elif record.state == "closed":
                    closed_session += 1
        return {
            'total_sale': round(total_sales, 2),
            'total_order_count': total_order_count,
            'total_net_sales': round(total_net_sales, 2),
            'opened_session': opened_session,
            'closed_session': closed_session,
            'total_refund_count': total_refund_count,
            'total_refund': abs(total_refund),
            'customer_count': customer_count,
            'non_sales_transaction': non_sales_transaction,
            'net_sales_perpax': round(net_sales_perpax, 2),
            'net_sales_perbill': round(net_sales_perbill, 2),
            'today_worst_product': today_worst_product,
            'today_sale': today_sale,
            'worst_qty': worst_qty,
        }

    @api.model
    def get_the_top_customer(self, date_start, date_end, pos_type, pos_id):
        date_range = f" AND date_order BETWEEN '{date_start} 00:00:00' AND '{date_end} 23:59:59'"
        condition = ''
        if pos_type is None:
            pos_type = True
        elif pos_type == "false":
            pos_type = False
        elif pos_type == "true":
            pos_type = True
        if pos_id == 'all' or pos_id is None:
            if pos_type:
                condition = f" AND restaurant = {pos_type}"
            else:
                condition = f" AND (restaurant = {pos_type} or restaurant is null)"
        else:
            if pos_type:
                condition = f" AND restaurant = {pos_type} AND pos_id = {pos_id}"
            else:
                condition = f" AND (restaurant = {pos_type} or restaurant is null) AND pos_id = {pos_id}"
        company_id = self.env.company.id
        query = '''select res_partner.name as customer,pos_order.partner_id,sum(pos_order.amount_paid) as amount_total 
        from pos_order 
        inner join res_partner on res_partner.id = pos_order.partner_id 
        where pos_order.company_id = ''' + str(
            company_id) + condition + date_range + ''' 
            GROUP BY pos_order.partner_id, res_partner.name  
            ORDER BY amount_total DESC 
            LIMIT 10;'''
        self._cr.execute(query)
        docs = self._cr.dictfetchall()
        order = []
        for record in docs:
            order.append(record.get('amount_total'))
        day = []
        for record in docs:
            day.append(record.get('customer'))
        final = [order, day]
        return final

    @api.model
    def get_the_top_products(self, date_start, date_end, pos_type, pos_id):
        if pos_type is None:
            pos_type = True
        elif pos_type == "false":
            pos_type = False
        elif pos_type == "true":
            pos_type = True
        company_id = self.env.company.id
        condition = ""
        if pos_id == 'all' or pos_id is None:
            if pos_type:
                condition = f"AND restaurant = {pos_type}"
            else:
                condition = f"AND (restaurant = {pos_type} or restaurant is null)"
        else:
            if pos_type:
                condition = f"AND restaurant = {pos_type} AND pos_id = {pos_id}"
            else:
                condition = f"AND (restaurant = {pos_type} or restaurant is null) AND pos_id = {pos_id}"
        date_range = f"AND date_order BETWEEN '{date_start} 00:00:00' AND '{date_end} 23:59:59'"
        query = f"""select DISTINCT(product_template.name)->>'en_US' as product_name,sum(qty) as total_quantity 
        from pos_order_line 
        inner join product_product on product_product.id=pos_order_line.product_id 
        inner join product_template on product_product.product_tmpl_id = product_template.id 
        where pos_order_line.company_id = {str(company_id)} {condition}
        {date_range}
        group by product_template.id 
        ORDER BY total_quantity 
        DESC Limit 10;"""
        self._cr.execute(query)
        top_product = self._cr.dictfetchall()
        total_quantity = []
        for record in top_product:
            total_quantity.append(record.get('total_quantity'))
        product_name = []
        for record in top_product:
            product_name.append(record.get('product_name'))

        final = [total_quantity, product_name]
        return final

    @api.model
    def get_the_top_categories(self, date_start, date_end, pos_type, pos_id):
        if pos_type is None:
            pos_type = True
        elif pos_type == "false":
            pos_type = False
        elif pos_type == "true":
            pos_type = True
        company_id = self.env.company.id
        condition = ""
        if pos_id == 'all' or pos_id is None:
            if pos_type:
                condition = f"AND restaurant = {pos_type}"
            else:
                condition = f"AND (restaurant = {pos_type} or restaurant is null)"
        else:
            if pos_type:
                condition = f"AND restaurant = {pos_type} AND pos_id = {pos_id}"
            else:
                condition = f"AND (restaurant = {pos_type} or restaurant is null) AND pos_id = {pos_id}"
        date_range = f"AND date_order BETWEEN '{date_start} 00:00:00' AND '{date_end} 23:59:59'"
        query = f"""select DISTINCT(product_category.complete_name) as product_category,sum(qty) as total_quantity
        from pos_order_line 
        inner join product_product on product_product.id=pos_order_line.product_id  
        inner join product_template on product_product.product_tmpl_id = product_template.id 
        inner join product_category on product_category.id =product_template.categ_id 
        where pos_order_line.company_id = {str(company_id)} {condition}
        {date_range}
        group by product_category 
        ORDER BY total_quantity DESC;"""
        self._cr.execute(query)
        top_product = self._cr.dictfetchall()
        total_quantity = []
        for record in top_product:
            total_quantity.append(record.get('total_quantity'))
        product_categ = []
        for record in top_product:
            product_categ.append(record.get('product_category'))
        final = [total_quantity, product_categ]
        return final
