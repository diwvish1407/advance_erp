frappe.ui.form.on('Delivery Route Plan', {
    refresh: function(frm) {
        if (!frm.is_new()) {
            frm.add_custom_button('Fetch Deliveries', function() {
                frappe.call({
                    method: "advance_erp.advance_erp.page.google_map.delivery_route.fetch_delivery_notes",
                    args: { route_plan: frm.doc.name },
                    callback: function(r) {
                        if(r.message) {
                            frm.reload_doc();
                            frappe.show_alert(`Fetched ${r.message.stops_added} delivery stops`);
                        }
                    }
                });
            });
            
            frm.add_custom_button('Optimize Route', function() {
                frappe.call({
                    method: "advance_erp.advance_erp.page.google_map.delivery_route.optimize_route",
                    args: { route_plan: frm.doc.name },
                    callback: function(r) {
                        if(r.message) {
                            frm.reload_doc();
                            frappe.show_alert(
                                `Route optimized! Distance: ${r.message.total_distance} km, Duration: ${r.message.total_duration} min`
                            );
                        }
                    }
                });
            });
        }
    }
});
