from odoo import models

class PosCategory(models.Model):
    _inherit = "pos.category"

    def get_category_path(self, category):
        path = [category.name]
        while category.parent_id:
            category = category.parent_id
            path.insert(0, category.name)
        return ' - '.join(path)