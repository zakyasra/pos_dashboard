from odoo import _, api, fields, models

class PosPayment(models.Model):
    _inherit = 'pos.payment'
    
    cashier = fields.Char(related='pos_order_id.cashier', string="Cashier")