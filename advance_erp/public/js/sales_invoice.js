// frappe.ui.form.on('Sales Invoice', {
//     before_save: function(frm) {
//         navigator.geolocation.getCurrentPosition(
//             async function(position) {
//                 let sales_lat = position.coords.latitude;
//                 let sales_long = position.coords.longitude;
//                 let customer_lat = frm.doc.customer_latitude;
//                 let customer_long = frm.doc.customer_longitude;
//                 if (!customer_lat || !customer_long) {
//                     frappe.throw(__('Customer location not set.'));
//                 }
//                 try {
//                     let res = await frappe.call({
//                         method: "advance_erp.advance_erp.doctype.advanced_erp_settings.advanced_erp_settings.validate_sales_invoice_location",
//                         args: {
//                             sales_lat: sales_lat,
//                             sales_long: sales_long,
//                             customer_lat: customer_lat,
//                             customer_long: customer_long
//                         }
//                     });
//                     if (res.message.status === "ok") {
//                         frm.doc.sales_lat = sales_lat;
//                         frm.doc.sales_long = sales_long;
//                         frm.save_or_update();
//                     }

//                 } catch (e) {
//                     frappe.validated = false;
//                     frappe.msgprint(e.message);
//                 }
//             },
//             function(error) {
//                 frappe.msgprint(__('Please enable your device location to create a Sales Invoice.'));
//                 frappe.validated = false;
//             }
//         );
//         frappe.validated = false;
//     }
// });
