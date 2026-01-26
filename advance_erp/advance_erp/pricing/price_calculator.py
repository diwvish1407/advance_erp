import frappe
from frappe.utils.data import add_days, today
from frappe.utils import now_datetime

def generate_pricing_suggestions():
    strategies = frappe.get_all("Pricing Strategy", filters={"enabled": 1}, fields="*")

    for strategy in strategies:
        demand_days = strategy.demand_days or 30
        start_date = add_days(today(), -demand_days)

        items = frappe.get_all(
            "Item",
            filters={"item_group": strategy.item_group},
            fields=["name", "standard_rate", "last_purchase_rate"]
        )

        for item in items:
            bin_record = frappe.get_all(
                "Bin",
                filters={"item_code": item.name, "warehouse": strategy.warehouse},
                fields=["actual_qty"]
            )
            stock_qty = bin_record[0].actual_qty if bin_record else 0

            # Fetch submitted sales invoices in date range
            invoices = frappe.get_all(
                "Sales Invoice",
                filters={"posting_date": [">=", start_date], "docstatus": 1},
                fields=["name"]
            )
            invoice_names = [inv.name for inv in invoices]

            # Fetch sales invoice items for this item in valid invoices
            sales_items = frappe.get_all(
                "Sales Invoice Item",
                filters={
                    "item_code": item.name,
                    "parent": ["in", invoice_names]
                },
                fields=["qty"]
            )
            sales_qty = sum([s.qty for s in sales_items])
            sales_velocity = sales_qty / demand_days

            base_price = item.standard_rate
            suggested_price = base_price
            reason = ""

            if strategy.high_stock_qty and stock_qty > strategy.high_stock_qty:
                decrease_pct = strategy.price_decrease_pct or 0
                suggested_price *= (1 - decrease_pct / 100)
                reason += f"Overstock: Stock={stock_qty}, "

            elif strategy.low_stock_qty and stock_qty < strategy.low_stock_qty:
                increase_pct = strategy.price_increase_pct or 0
                suggested_price *= (1 + increase_pct / 100)
                reason += f"Understock: Stock={stock_qty}, "

            cost_price = item.last_purchase_rate or base_price * 0.7
            min_price = cost_price * (1 + (strategy.min_margin or 0) / 100)
            if suggested_price < min_price:
                suggested_price = min_price
                reason += "Ensured min margin, "

            doc = frappe.get_doc({
                "doctype": "Pricing Suggestion",
                "item": item.name,
                "warehouse": strategy.warehouse,
                "current_price": base_price,
                "suggested_price": suggested_price,
                "cost_price": cost_price,
                "margin_pct": (suggested_price - cost_price) / cost_price * 100,
                "stock_qty": stock_qty,
                "sales_qty": sales_qty,
                "sales_velocity": sales_velocity,
                "reason": reason,
                "status": "Draft",
                "generated_on": now_datetime(),
                "pricing_strategy": strategy.name
            })
            doc.insert(ignore_permissions=True)
