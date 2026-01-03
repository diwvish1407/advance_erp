# Copyright (c) 2026, Diwakar and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _

class PriceEstimationSetting(Document):
	def validate(self):
		weight_fields = [
			"default_quote_qty_weight",
			"default_customer_level_weight",
			"default_stock_level_weight",
			"default_sales_order_trend_weight",
			"default_market_condition_weight",
			"default_predictive_factor_weight"
		]
		total = sum([self.get(f) or 0 for f in weight_fields])
		if total != 100:
			frappe.throw(_("Total of all weight fields must be <b>100%</b>."))
