# Copyright (c) 2026, Diwakar and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import today, add_years, add_days, date_diff, nowdate, add_months,formatdate, flt, getdate
from erpnext.stock.utils import get_stock_balance


class PriceEstimation(Document):
    def before_save(self):
        self.calculate_total_extra_cost()

    def calculate_total_extra_cost(doc):
        total = 0
        for row in doc.extra_costs or []:
            amount = flt(row.amount)
            if amount < 0:
                frappe.throw(_("Extra cost amount cannot be negative"))
            total += amount
        doc.total_extra_cost = flt(total, 2)

@frappe.whitelist()
def get_price_estimation_defaults():
    settings = frappe.get_doc("Price Estimation Setting")
    defaults = {
        "period_days": settings.default_period_days,
        "quote_qty_weight": settings.default_quote_qty_weight,
        "customer_level_weight": settings.default_customer_level_weight,
        "stock_level_weight": settings.default_stock_level_weight,
        "sales_order_trend_weight": settings.default_sales_order_trend_weight,
        "market_competition_weight": settings.default_market_condition_weight,
        "predictive_factor_weight": settings.default_predictive_factor_weight,
        "low_stock_threshold": settings.default_low_stock_threshold,
        "high_stock_threshold": settings.default_high_stock_threshold,
        "low_demand_threshold": settings.default_low_demand_threshold,
        "high_demand_threshold": settings.default_high_demand_threshold
    }
    return defaults

@frappe.whitelist()
def get_historical_prices(item_code, warehouse=None):
    settings = frappe.get_single("Price Estimation Setting")
    limit = getattr(settings, "historical_prices_number_of_last_records")
    result = {
        "quotations": [],
        "invoices": []
    }
    quotation_items = frappe.db.sql("""
        SELECT
            qi.parent AS quotation,
            q.transaction_date,
            qi.rate,
            qi.qty,
            (qi.rate * qi.qty) AS amount
        FROM `tabQuotation Item` qi
        INNER JOIN `tabQuotation` q ON q.name = qi.parent
        WHERE
            qi.item_code = %s
            AND q.docstatus = 1
        ORDER BY q.transaction_date DESC
        LIMIT %s
    """, (item_code, limit), as_dict=True)

    result["quotations"] = quotation_items

    if warehouse:
        invoice_items = frappe.db.sql("""
            SELECT
                sii.parent AS invoice,
                si.posting_date,
                sii.rate,
                sii.qty,
                (sii.rate * sii.qty) AS amount
            FROM `tabSales Invoice Item` sii
            INNER JOIN `tabSales Invoice` si ON si.name = sii.parent
            WHERE
                sii.item_code = %s
                AND sii.warehouse = %s
                AND si.docstatus = 1
            ORDER BY si.posting_date DESC
            LIMIT %s
        """, (item_code, warehouse, limit), as_dict=True)

        result["invoices"] = invoice_items

    return result

@frappe.whitelist()
def get_customer_payment_behaviour(customer):
    """
    Calculate customer's payment behaviour:
    - Good: Pays on time or before due date
    - Fair: Pays late but within payment_behaviour_duration_months_for_fair (from settings)
    - Poor: Pays more than 3 months late
    """
    # Fetch setting value
    settings = frappe.get_single("Price Estimation Setting")
    fair_months = getattr(settings, "payment_behaviour_duration_months_for_fair", 1)

    # Fetch submitted invoices for this customer with payment info
    invoices = frappe.db.sql("""
        SELECT posting_date, due_date, paid_amount
        FROM `tabSales Invoice`
        WHERE customer = %s
          AND docstatus = 1
        ORDER BY posting_date DESC
    """, (customer,), as_dict=True)

    if not invoices:
        return "Good"  # No history → assume Good

    # Calculate delay in months for each invoice
    delays = []
    for inv in invoices:
        if inv.paid_amount < 0.01:
            # Not paid at all → assume worst delay
            delay_days = date_diff(nowdate(), inv.due_date)
        else:
            # Invoice is paid, get actual paid date
            # For simplicity, assume fully paid on posting date (you can expand to Payment Entry)
            delay_days = date_diff(inv.posting_date, inv.due_date)
        
        delays.append(delay_days)

    # Consider average delay
    avg_delay_days = sum(delays) / len(delays)
    avg_delay_months = avg_delay_days / 30.0  # approx

    if avg_delay_months <= 0:
        return "Good"
    elif avg_delay_months <= fair_months:
        return "Fair"
    elif avg_delay_months > 3:
        return "Poor"
    else:
        return "Fair"


@frappe.whitelist()
def get_customer_purchase_power(customer):
    customer_amounts = frappe.db.sql("""
        SELECT si.customer, SUM(sii.qty * sii.rate) AS total_amount
        FROM `tabSales Invoice` si
        INNER JOIN `tabSales Invoice Item` sii ON sii.parent = si.name
        WHERE si.docstatus = 1
        GROUP BY si.customer
        ORDER BY total_amount DESC
    """, as_dict=True)
    if not customer_amounts:
        return "Low"
    total_customers = len(customer_amounts)
    customer_position = next(
        (i for i, r in enumerate(customer_amounts) if r["customer"] == customer),
        total_customers
    )
    percentile = customer_position / total_customers
    if percentile < 0.33:
        return "High"
    elif percentile < 0.66:
        return "Medium"
    else:
        return "Low"



@frappe.whitelist()
def get_stock_level(item_code, warehouse, period_days, low_stock_threshold, high_stock_threshold):
    start_date = add_days(getdate(), - int(period_days))
    stock_entries = frappe.db.sql("""
        SELECT actual_qty
        FROM `tabStock Ledger Entry`
        WHERE item_code = %s
          AND warehouse = %s
          AND posting_date >= %s
    """, (item_code, warehouse, start_date), as_dict=True)
    if stock_entries:
        avg_stock = sum([e.actual_qty for e in stock_entries]) / len(stock_entries)
    else:
        avg_stock = 0
    current_stock = frappe.get_value("Bin", {"item_code": item_code, "warehouse": warehouse}, "actual_qty") or 0
    low_limit = avg_stock * (1 - flt(low_stock_threshold))
    high_limit = avg_stock * (1 + flt(high_stock_threshold))

    # Determine level
    if current_stock < low_limit:
        level = "Low"
    elif current_stock > high_limit:
        level = "High"
    else:
        level = "Stable"
    return level
