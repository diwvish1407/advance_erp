frappe.pages['google-map'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Google Map',
        single_column: true
    });

    // Create map container
    $('<div id="map" style="height: 600px; width: 100%;"></div>').appendTo(page.body);

    load_google_map();
};

function load_google_map() {
    // Load Google Maps script only once
    if (window.google && window.google.maps) {
        initMap();
        return;
    }

    var script = document.createElement('script');
    script.src = "https://maps.googleapis.com/maps/api/js?key=AIzaSyCWsgt9I6EmDj6NU9mExZ9Ig_D6q12WSCM&callback=initMap";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
}

function initMap() {
    const route_plan = "lo5k13tbga"; // Replace with dynamic if needed

    frappe.call({
        method: "advance_erp.advance_erp.page.google_map.delivery_route.get_route_points",
        args: { route_plan: route_plan },
        callback: function(r) {
            const data = r.message;
            if (!data) return;

            const warehouse = {lat: data.warehouse_lat, lng: data.warehouse_lng};

            const map = new google.maps.Map(document.getElementById("map"), {
                zoom: 12,
                center: warehouse
            });

            // Warehouse marker
            new google.maps.Marker({
                position: warehouse,
                map: map,
                label: "W",
                title: data.warehouse_name
            });

            // Filter valid stops
            let stops = data.stops.filter(stop => stop.latitude && stop.longitude);
            stops.sort((a, b) => a.stop_sequence - b.stop_sequence);

            // Add stop markers
            stops.forEach(stop => {
                new google.maps.Marker({
                    position: {lat: stop.latitude, lng: stop.longitude},
                    map: map,
                    label: `${stop.stop_sequence}`,
                    title: stop.customer + " - " + stop.delivery_note
                });
            });

            // Draw actual route along roads
            drawRouteOnMap(map, warehouse, stops);
        }
    });
}

// Directions along roads
function drawRouteOnMap(map, warehouse, stops) {
    const directionsService = new google.maps.DirectionsService();
    const directionsRenderer = new google.maps.DirectionsRenderer({
        suppressMarkers: true,
        preserveViewport: true
    });
    directionsRenderer.setMap(map);

    const waypoints = stops.map(stop => ({
        location: new google.maps.LatLng(stop.latitude, stop.longitude),
        stopover: true
    }));

    directionsService.route({
        origin: new google.maps.LatLng(warehouse.lat, warehouse.lng),
        destination: new google.maps.LatLng(warehouse.lat, warehouse.lng),
        waypoints: waypoints,
        optimizeWaypoints: false, // keep backend optimized order
        travelMode: google.maps.TravelMode.DRIVING
    }, (result, status) => {
        if (status === "OK") {
            directionsRenderer.setDirections(result);
        } else {
            console.error("Directions request failed due to " + status);
        }
    });
}
