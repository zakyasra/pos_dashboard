from odoo import api, fields, models, _


class ReportClosingPos(models.Model):
    _inherit = "pos.config"

    sales_recapitulation = fields.Boolean('Sales Recapitulation', default=True)
    sales_payment_recapitulation = fields.Boolean('Sales Payment Recapitulation', default=True)
    sales_menu = fields.Boolean('Sales Menu', default=True)
    promotion_summary = fields.Boolean('Promotion Summary', default=True)
    non_sales_bill_summary = fields.Boolean('Non Sales Bill Summary', default=True)
    non_sales_menu_summary = fields.Boolean('Non Sales Menu Summary', default=True)
    sales_by_menu = fields.Boolean('Sales By Menu', default=True)
    non_sales_by_menu = fields.Boolean('Non Sales By Menu', default=True)
    sales_payment_recap_by_cashier = fields.Boolean('Sales Payment Recap By Cashier', default=True)