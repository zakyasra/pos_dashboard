from odoo import api, fields, models, _
from itertools import groupby


class PosOrderLine(models.Model):
    _inherit = "pos.order.line"

    def get_order_line_by_category(self, session_id, shift=None):
        parent_category = self._get_high_category()
        result_sales = []
        result_non_sales = []
        for parent in parent_category:
            result_sales.append(self._generate_map_sales(session_id=session_id, category_id=parent, shift=shift))
            result_non_sales.append(self._generate_map_non_sales(session_id=session_id, category_id=parent, shift=shift))
        return [[item for item in result_sales if item['subtotal'] > 0], [item for item in result_non_sales if item['subtotal'] > 0]]

    def _remove_empty_category(self, vals):
        return [item for item in vals if item['subtotal'] > 0]

    def _generate_map_sales(self, session_id, category_id, shift):
        vals = {
            'category_name': category_id.name,
            'order_line_sum': False,
            'child_ids': False,
            'total_qty': 0,
            'subtotal': 0,
        }
        child_ids = []
        for child in category_id.child_id:
            child_ids.append(self._generate_map_sales(session_id=session_id, category_id=child, shift=shift))
        vals['child_ids'] = child_ids if child_ids else False
        child_total_qty = 0
        child_subtotal = 0
        if child_ids:
            child_total_qty = sum(item['total_qty'] for item in child_ids)
            child_subtotal = sum(item['subtotal'] for item in child_ids)
        lines = self._get_line(session_id=session_id, category_id=category_id, is_complimentary=False, shift=shift)
        vals['order_line_sum'] = lines if len(lines) > 0 else False
        vals['total_qty'] = sum(item['total_qty'] for item in lines) + child_total_qty
        vals['subtotal'] = sum(item['subtotal'] for item in lines) + child_subtotal
        return vals

    def _generate_map_non_sales(self, session_id, category_id, shift):
        vals = {
            'category_name': category_id.name,
            'order_line_sum': False,
            'child_ids': False,
            'total_qty': 0,
            'subtotal': 0,
        }
        child_ids = []
        for child in category_id.child_id:
            child_ids.append(self._generate_map_non_sales(session_id=session_id, category_id=child, shift=shift))
        vals['child_ids'] = child_ids if child_ids else False
        child_total_qty = 0
        child_subtotal = 0
        if child_ids:
            child_total_qty = sum(item['total_qty'] for item in child_ids)
            child_subtotal = sum(item['subtotal'] for item in child_ids)
        lines = self._get_line(session_id=session_id, category_id=category_id, is_complimentary=True, shift=shift)
        vals['order_line_sum'] = lines if len(lines) > 0 else False
        vals['total_qty'] = sum(item['total_qty'] for item in lines) + child_total_qty
        vals['subtotal'] = sum(item['subtotal'] for item in lines) + child_subtotal
        return vals

    # def _get_line(self, session_id, category_id):
    #     query = "select pt.name->>'en_US' as product_name, sum(pol.qty),sum(pol.price_subtotal_incl) from pos_order_line pol inner join product_product pp on pp.id=pol.product_id inner join product_template pt on pt.id=pp.product_tmpl_id inner join pos_category pc on pc.id=pt.pos_categ_id inner join pos_order po on po.id=pol.order_id inner join pos_session ps on ps.id=po.session_id where ps.id=%s and pc.id=%s group by pt.name" % \
    #             (
    #                 session_id,
    #                 category_id.id
    #             )
    #     self._cr.execute(query)
    #     result_set = self._cr.fetchall()
    #     vals = []
    #     print(result_set)
    #     for result in result_set:
    #         vals.append({
    #             'product_name': result[0],
    #             'total_qty': result[1],
    #             'subtotal': result[2],
    #         })
    #     return vals

    @api.model
    def _get_line(self, session_id, category_id, is_complimentary, shift):
        is_module_pos_complimentary_installed = self.env['pos.session'].is_module_pos_complimentary_installed() == 'installed'
        pos_order_line = self.env['pos.order.line']

        domain = [
            ('order_id.session_id', '=', session_id),
            ('product_id.product_tmpl_id.pos_categ_id', '=', category_id.id),
        ]

        if shift:
            domain.append(('order_id.shift', '=', shift))
        
        if is_module_pos_complimentary_installed:
            domain.append(('order_id.pricelist_id.is_complimentary', '=', is_complimentary))

        fields_list = [
            'product_id',
            'order_id',
            'qty',
            'total_cost',
            'price_subtotal_incl',
        ]

        result_set = self._read_group(
            domain=domain,
            fields=fields_list,
            groupby=['product_id'],
        )


        vals = []
        for result in result_set:
            vals.append({
                'product_name': result['product_id'][1],
                'total_qty': result['qty'],
                'subtotal': result['total_cost'] if is_complimentary == True and is_module_pos_complimentary_installed else result['price_subtotal_incl'],
            })
        print(vals)
        return vals

    def _get_high_category(self):
        category_ids = self.env['pos.category'].search([('parent_id', '=', False)], order='name asc')
        return category_ids
