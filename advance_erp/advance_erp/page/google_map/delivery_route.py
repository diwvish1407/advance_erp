import frappe

@frappe.whitelist()
def fetch_delivery_notes(route_plan):
    route = frappe.get_doc("Delivery Route Plan", route_plan)

    # Clear existing stops
    route.delivery_route_stop = []

    # Fetch submitted Delivery Notes for the date & warehouse
    delivery_notes = frappe.get_all(
        "Delivery Note",
        filters={
            "posting_date": route.route_date,
            "set_warehouse": route.warehouse,
            "docstatus": 1
        },
        fields=["name", "customer", "customer_address"]
    )

    for dn in delivery_notes:
        address = frappe.get_doc("Address", dn.customer_address)
        if not address.custom_latitude or not address.custom_longitude:
            continue  # skip if lat/lng missing

        route.append("delivery_route_stop", {
            "delivery_note": dn.name,
            "customer": dn.customer,
            "address": address.name,
            "latitude": address.custom_latitude,
            "longitude": address.custom_longitude,
            "stop_sequence": 0,  # will be set after optimization
            "status": "Pending"
        })

    route.save()
    frappe.db.commit()
    return {"stops_added": len(route.delivery_route_stop)}


import frappe
import requests

@frappe.whitelist()
def get_route_points(route_plan):
    """
    Returns warehouse and delivery stops with coordinates for Google Map
    """
    route = frappe.get_doc("Delivery Route Plan", route_plan)

    # Warehouse coordinates: fallback to Lucknow if not set
    warehouse_lat = float(route.start_latitude) if route.start_latitude else 26.8467
    warehouse_lng = float(route.start_longitude) if route.start_longitude else 80.9462

    # Stops with valid coordinates only
    stops = []
    for stop in route.delivery_route_stop:
        if stop.latitude not in (None, 0, "0") and stop.longitude not in (None, 0, "0"):
            stops.append({
                "stop_sequence": int(stop.stop_sequence),
                "latitude": float(stop.latitude),
                "longitude": float(stop.longitude),
                "customer": stop.customer,
                "delivery_note": stop.delivery_note
            })

    # Sort by optimized stop_sequence
    stops.sort(key=lambda x: x["stop_sequence"])

    return {
        "warehouse_lat": warehouse_lat,
        "warehouse_lng": warehouse_lng,
        "warehouse_name": "Warehouse - Lucknow",
        "stops": stops
    }


def snap_to_road(lat, lng, api_key):
    url = "https://roads.googleapis.com/v1/snapToRoads"
    params = {
        "path": f"{lat},{lng}",
        "interpolate": "false",
        "key": api_key
    }
    res = requests.get(url, params=params, timeout=10).json()
    if res.get("snappedPoints"):
        location = res["snappedPoints"][0]["location"]
        return location["latitude"], location["longitude"]
    return lat, lng  # fallback



import frappe
import requests


def snap_to_road(lat, lng, api_key):
    url = "https://roads.googleapis.com/v1/snapToRoads"
    params = {
        "path": f"{lat},{lng}",
        "interpolate": "false",
        "key": api_key
    }
    res = requests.get(url, params=params, timeout=10).json()
    if res.get("snappedPoints"):
        loc = res["snappedPoints"][0]["location"]
        return loc["latitude"], loc["longitude"]
    return lat, lng  # fallback


@frappe.whitelist()
def optimize_route(route_plan):
    route = frappe.get_doc("Delivery Route Plan", route_plan)

    if not route.delivery_route_stop:
        frappe.throw("No delivery stops found")

    if not route.start_latitude or not route.start_longitude:
        frappe.throw("Warehouse latitude/longitude missing")

    api_key = frappe.db.get_single_value("Google Map Settings", "api_key")

    # ✅ SNAP ORIGIN
    start_lat, start_lng = snap_to_road(
        route.start_latitude,
        route.start_longitude,
        api_key
    )
    origin = f"{start_lat},{start_lng}"
    destination = origin  # round trip

    # ✅ SNAP WAYPOINTS
    waypoints = []
    stops = list(route.delivery_route_stop)

    for stop in stops:
        if stop.latitude and stop.longitude:
            lat, lng = snap_to_road(stop.latitude, stop.longitude, api_key)
            waypoints.append(f"{lat},{lng}")

    if not waypoints:
        frappe.throw("No valid routable stops found")

    params = {
        "origin": origin,
        "destination": destination,
        "waypoints": "optimize:true|" + "|".join(waypoints),
        "key": api_key,
        "mode": "driving"
    }
    print(params)
    url = "https://maps.googleapis.com/maps/api/directions/json"
    res = requests.get(url, params=params, timeout=15).json()

    if res.get("status") != "OK":
        frappe.throw(
            f"Google Directions API Error: {res.get('status')} - {res.get('error_message')}"
        )

    route_data = res["routes"][0]
    waypoint_order = route_data["waypoint_order"]
    legs = route_data["legs"]

    total_distance = 0
    total_duration = 0

    # ✅ Update sequence ONLY
    for seq, stop_idx in enumerate(waypoint_order, start=1):
        stops[stop_idx].stop_sequence = seq

        leg = legs[seq - 1]
        total_distance += leg["distance"]["value"]
        total_duration += leg["duration"]["value"]

    route.total_distance_km = round(total_distance / 1000, 2)
    route.total_duration_min = round(total_duration / 60, 2)
    route.status = "Optimized"

    route.save()
    frappe.db.commit()

    return {
        "total_distance": route.total_distance_km,
        "total_duration": route.total_duration_min
    }