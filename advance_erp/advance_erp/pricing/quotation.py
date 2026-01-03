import frappe
from frappe.utils import add_days, today
import json

@frappe.whitelist()
def get_last_prices(item_codes, customer=None, all_customers=False, customer_group=None, last_n_prices=5):
    print(item_codes)
    if isinstance(item_codes, str):
        item_codes = json.loads(item_codes)
    customer_conditions = []
    if not all_customers:
        if customer:
            customer_conditions.append(f"si.customer = '{customer}'")
        elif customer_group:
            customers = frappe.get_all('Customer', filters={'customer_group': customer_group}, pluck='name')
            if customers:
                customers_str = ",".join([f"'{c}'" for c in customers])
                customer_conditions.append(f"si.customer IN ({customers_str})")
            else:
                return []
    customer_where = " AND ".join(customer_conditions)
    if customer_where:
        customer_where = " AND " + customer_where
    all_prices = []
    for item in item_codes:
        query = f"""
            SELECT
                si.name as sales_invoice,
                si.customer,
                sii.item_code,
                sii.item_name,
                sii.rate,
                si.posting_date
            FROM `tabSales Invoice Item` sii
            JOIN `tabSales Invoice` si ON sii.parent = si.name
            WHERE sii.item_code = '{item}' {customer_where}
            ORDER BY si.posting_date DESC
            LIMIT {last_n_prices}
        """
        results = frappe.db.sql(query, as_dict=True)
        for r in results:
            r['choose'] = 0
        all_prices.extend(results)
    return all_prices

@frappe.whitelist()
def get_suggested_prices(quotation_name):
    doc = frappe.get_doc("Quotation", quotation_name)
    period_year = 1
    interval_days = 30
    threshold_percent = 20
    adjust_percent = 10
    start_date = add_days(today(), -365*period_year)
    items_list = []
    for item in doc.items:
        total_sales = frappe.get_all(
            "Sales Order Item",
            filters={
                "item_code": item.item_code,
                "docstatus": 1,
                "creation": [">=", start_date]
            },
            fields=["sum(qty*rate) as total_value"]
        )
        total_value = total_sales[0].total_value or 0
        intervals = (365*period_year) / interval_days
        avg_sales_per_interval = total_value / intervals
        recent_start = add_days(today(), -interval_days)
        recent_sales = frappe.get_all(
            "Sales Order Item",
            filters={
                "item_code": item.item_code,
                "docstatus": 1,
                "creation": [">=", recent_start]
            },
            fields=["sum(qty*rate) as recent_value"]
        )
        recent_value = recent_sales[0].recent_value or 0
        if avg_sales_per_interval == 0:
            velocity = 0
        else:
            velocity = (recent_value - avg_sales_per_interval) / avg_sales_per_interval * 100
        if velocity > threshold_percent:
            suggested_price = item.rate * (1 + adjust_percent / 100)
        elif velocity < -threshold_percent:
            suggested_price = item.rate * (1 - adjust_percent / 100)
        else:
            suggested_price = item.rate
        suggested_price = round(suggested_price, 2)
        try:
            log = frappe.get_doc({
                "doctype": "Suggested Price Log",
                "quotation": quotation_name,
                "quotation_item": item.name,
                "current_price": item.rate,
                "base_price": item.rate,
                "demand_velocity_percent": round(velocity,2),
                "suggested_price": suggested_price,
                "applied": 0
            })
            log.insert(ignore_permissions=True)
        except Exception as e:
            frappe.log_error(f"Error saving Suggested Price Log: {e}")
        items_list.append({
            "item_code": item.item_code,
            "item_name": item.item_name,
            "current_price": item.rate,
            "suggested_price": suggested_price,
            "keep_suggested": 1
        })
    return items_list


@frappe.whitelist()
def apply_suggested_prices(quotation_name, items):
    if isinstance(items, str):
        items = json.loads(items)
    doc = frappe.get_doc("Quotation", quotation_name)
    for row in doc.items:
        for item in items:
            if isinstance(item, dict) and row.item_code == item.get("item_code"):
                if item.get("keep_suggested"):
                    row.rate = round(item.get("suggested_price") or row.rate, 2)
                    frappe.db.set_value("Suggested Price Log",
                                        {"quotation": quotation_name, "quotation_item": row.name},
                                        "applied", 1)
                else:
                    log_name = frappe.db.get_value("Suggested Price Log",
                                        {"quotation": quotation_name, "quotation_item": row.name})
                    if log_name:
                        frappe.delete_doc("Suggested Price Log", log_name, ignore_permissions=True)
    doc.save()
    return True
