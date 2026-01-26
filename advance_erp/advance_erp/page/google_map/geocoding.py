import requests
import frappe

def get_google_api_key():
    return frappe.db.get_single_value(
        "Google Map Settings", "api_key"
    )

def geocode_address(address_text):
    try:
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {
            "address": address_text,
            "key": get_google_api_key()
        }

        r = requests.get(url, params=params, timeout=10).json()

        if r.get("status") != "OK":
            frappe.logger().error({
                "module": "geocoding",
                "address": address_text,
                "google_response": r
            })
            return None, None

        location = r["results"][0]["geometry"]["location"]
        return location["lat"], location["lng"]

    except Exception:
        frappe.log_error(frappe.get_traceback(), "Google Geocoding Error")
        return None, None


def set_lat_lng(doc, method):
    if doc.custom_latitude and doc.custom_longitude:
        return

    address_parts = filter(None, [
        doc.address_line1,
        doc.address_line2,
        doc.city,
        doc.state,
        doc.country,
        doc.pincode
    ])

    address_text = ", ".join(address_parts)

    if not address_text:
        return

    lat, lng = geocode_address(address_text)

    if lat and lng:
        doc.custom_latitude = lat
        doc.custom_longitude = lng

