frappe.listview_settings['Sales Order'] = {
    refresh: function(listview) {
        // Run only once per listview load
        if (!frappe.boot.auto_ready_visible_highlight) {
            frappe.boot.auto_ready_visible_highlight = true;
            
            // Function to update colors for visible rows
            const updateVisibleRowColors = async () => {
                try {
                    const settings = await frappe.db.get_single('Advanced Settings');
                    if (!settings.enable_auto_ready_to_deliver) return;
                    alert("Hello World");

                    // Only visible rows in the list
                    const visible_rows = listview.wrapper.find('.list-row');

                    visible_rows.each(async function() {
                        const row_name = $(this).attr('data-name');
                        if (!row_name) return;

                        const doc = await frappe.db.get_doc('Sales Order', row_name);

                        // Check stock
                        let all_in_stock = true;
                        for (const item of doc.items) {
                            const bins = await frappe.db.get_list('Bin', {
                                filters: { item_code: item.item_code, warehouse: item.warehouse },
                                fields: ['actual_qty']
                            });

                            if (!bins.length || bins[0].actual_qty < item.qty) {
                                all_in_stock = false;
                                break;
                            }
                        }

                        // Apply color
                        if (all_in_stock) {
                            $(this).css('background-color', '#d4f8d4'); // green
                            $(this).attr('title', 'All items in stock - Ready to Deliver');
                        } else {
                            $(this).css('background-color', ''); // default
                            $(this).attr('title', '');
                        }
                    });
                } catch (err) {
                    console.error('Auto Ready Highlight Error:', err);
                }
            };

            // Initial run
            updateVisibleRowColors();

            // Run every 5 seconds
            setInterval(updateVisibleRowColors, 5000);

            // Also run when listview scrolls or refreshes
            listview.wrapper.on('scroll', () => updateVisibleRowColors());
            listview.on('rendered', () => updateVisibleRowColors());
        }
    }
};
