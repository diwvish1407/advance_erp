# Copyright (c) 2026, Diwakar and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from math import radians, sin, cos, sqrt, atan2

class AdvancedERPSettings(Document):
	pass


@frappe.whitelist()
def validate_sales_invoice_location(sales_lat, sales_long, customer_lat, customer_long):

    # Fetch settings
    enable_check = frappe.db.get_single_value('Advanced ERP Settings', 'enable_geolocation_feature_for_invoicing')
    if not enable_check:
        return {"status": "ok", "message": "Location check disabled"}

    radius = frappe.db.get_single_value('Advanced ERP Settings', 'radius')

    if not sales_lat or not sales_long:
        frappe.throw("Salesperson location not provided.")

    if not customer_lat or not customer_long:
        frappe.throw("Customer location not set.")

    distance = haversine(float(sales_lat), float(sales_long), float(customer_lat), float(customer_long))/1000

    if distance > radius:
        frappe.throw(f"Outside allowed delivery radius of {radius} m. Distance: {distance:.2f} m")

    return {"status": "ok", "message": f"Within allowed radius ({distance:.2f} m)"}

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000
    dLat = radians(lat2 - lat1)
    dLon = radians(lon2 - lon1)
    a = sin(dLat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dLon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    return R * c
