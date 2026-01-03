frappe.ui.form.on("Quotation", {
    refresh(frm) {
        if (!frm.is_new()) {
            frm.add_custom_button(__('View Last Prices'), function() {
                open_last_prices_dialog(frm);
            });
            frm.add_custom_button("Suggest Price", function() {
                frappe.call({
                    method: "advance_erp.advance_erp.pricing.quotation.get_suggested_prices",
                    args: { quotation_name: frm.doc.name },
                    callback: function(r) {
                        if (r.message && r.message.length) {
                            let items = r.message;
                            let html = `<table class="table table-bordered" style="width:100%; table-layout: fixed;">
                                <thead>
                                    <tr>
                                        <th style="width:20%; background-color: bisque;">Item Code</th>
                                        <th style="width:25%; background-color: bisque;">Item Name</th>
                                        <th style="width:20%; background-color: bisque;">Current Price</th>
                                        <th style="width:20%; background-color: bisque;">Suggested Price</th>
                                        <th style="width:15%; background-color: bisque;">Apply</th>
                                    </tr>
                                </thead>
                                <tbody>`;
                            items.forEach((item, i) => {
                                html += `<tr>
                                    <td style="background: #FFFDE1;">${item.item_code}</td>
                                    <td style="background: #FFFDE1;">${item.item_name}</td>
                                    <td style="background: #FFFDE1;">${item.current_price}</td>
                                    <td style="background: #FFFDE1;">
                                        <input type="text"
                                            class="suggested-price"
                                            data-index="${i}"
                                            value="${item.suggested_price}"
                                            style="width:100%; box-sizing:border-box;"
                                            oninput="this.value = this.value
                                                .replace(/[^0-9.]/g, '')
                                                .replace(/(\..*)\./g, '$1');">
                                    </td>
                                    <td style="text-align: center; background: #FFFDE1;">
                                        <input type="checkbox" class="keep-suggested" data-index="${i}" checked>
                                    </td>
                                </tr>`;
                            });
                            html += `</tbody></table>`;
                            let d = new frappe.ui.Dialog({
                                title: "Review Suggested Prices",
                                fields: [
                                    {
                                        fieldtype: "HTML",
                                        fieldname: "items_html",
                                        options: html
                                    }
                                ],
                                primary_action_label: "Apply Suggested Price",
                                primary_action: function() {
                                    let selected_items = items.map((item, i) => {
                                        let checkbox = d.$wrapper.find(`.keep-suggested[data-index="${i}"]`)[0];
                                        let checked = checkbox ? checkbox.checked : false;
                                        let suggested_price_input = d.$wrapper.find(`.suggested-price[data-index="${i}"]`);
                                        let suggested_price = suggested_price_input ? parseFloat(suggested_price_input.val()) : item.suggested_price;
                                        if (suggested_price < 0 || isNaN(suggested_price)) {
                                            suggested_price = 0;
                                        }
                                        return {
                                            item_code: item.item_code,
                                            keep_suggested: checked,
                                            suggested_price: suggested_price
                                        };
                                    });
                                    frappe.call({
                                        method: "advance_erp.advance_erp.pricing.quotation.apply_suggested_prices",
                                        args: {
                                            quotation_name: frm.doc.name,
                                            items: selected_items
                                        },
                                        callback: function() {
                                            frm.reload_doc();
                                            d.hide();
                                        }
                                    });
                                }
                            });
                            d.show();
                        }
                    }
                });
            });
        }
        if (frm.doc.docstatus === 1) {
            frm.remove_custom_button('View Last Prices');
        }
    }
});


function open_last_prices_dialog(frm) {
    let dialog = new frappe.ui.Dialog({
        title: 'View Last Prices',
        fields: [
            {
                fieldname: 'customer_filter_type',
                label: 'Filter Type',
                fieldtype: 'Select',
                options: ['Current Customer', 'All Customers', 'Customer Group'],
                default: 'Current Customer',
                reqd: 1
            },
            { fieldtype: 'Column Break' },
            {
                fieldname: 'customer_group',
                label: 'Customer Group',
                fieldtype: 'Link',
                options: 'Customer Group',
                depends_on: "eval:doc.customer_filter_type=='Customer Group'"
            },
            { fieldtype: 'Column Break' },
            {
                fieldname: 'item_codes',
                label: 'Item Codes',
                fieldtype: 'MultiSelectList',
                get_data: function (txt) {
                    let items = (frm.doc.items || []).map(row => row.item_code);
                    return items
                        .filter(i => !txt || i.toLowerCase().includes(txt.toLowerCase()))
                        .map(i => ({
                            value: i,
                            description: i
                        }));
                }
            },
            { fieldtype: 'Column Break' },
            {
                fieldname: 'last_n_prices',
                label: 'Number of Last Prices',
                fieldtype: 'Int',
                default: 3
            }
        ],
        size: 'extra-large'
    });
    dialog.show();
    dialog.$wrapper.css({
        width: '1100px',
        height: '80vh',
        marginLeft: '5%',
        marginTop: '5%'
    });
    let $btn_row = $(`
        <div style="display:flex; justify-content:flex-end; margin-bottom:15px;">
            <button class="btn btn-primary">Fetch Prices</button>
        </div>
    `);
    dialog.$body.append($btn_row);
    $btn_row.find('button').on('click', () => {
        let filters = dialog.get_values();
        fetch_last_prices(filters, dialog, frm);
    });
}

function fetch_last_prices(filters, dialog, frm) {
    let customer = null;
    let all_customers = false;
    let customer_group = null;
    if (filters.customer_filter_type === 'Current Customer') {
        customer = frm.doc.customer;
    } 
    else if (filters.customer_filter_type === 'All Customers') {
        all_customers = true;
    } 
    else if (filters.customer_filter_type === 'Customer Group') {
        customer_group = filters.customer_group;
    }
    let quotation_items = (frm.doc.items || []).map(row => row.item_code);
    let item_codes = quotation_items;
    if (Array.isArray(filters.item_codes) && filters.item_codes.length > 0) {
        item_codes = filters.item_codes;
    }
    frappe.call({
        method: 'advance_erp.advance_erp.pricing.quotation.get_last_prices',
        args: {
            customer,
            all_customers,
            customer_group,
            item_codes,
            last_n_prices: filters.last_n_prices
        },
        callback: function (r) {
            if (r.message && r.message.length) {
                show_last_prices_table(r.message, dialog, frm);
            } else {
                frappe.msgprint(__('No prices found'));
            }
        }
    });
}


function show_last_prices_table(prices, dialog, frm) {
    if (dialog.$table_wrapper) dialog.$table_wrapper.remove();
    dialog.$table_wrapper = $('<div style="max-height:280px; overflow-y:auto; border:1px solid black;"></div>').appendTo(dialog.body);
    const colors = ['skyblue', 'pink'];
    const colorMap = {};
    let colorIndex = 0;
    let table_rows = prices.map((row, i) => {
        if (!colorMap[row.item_code]) {
            colorMap[row.item_code] = colors[colorIndex % 2];
            colorIndex++;
        }
        const bgColor = colorMap[row.item_code];
        return `
            <tr data-index="${i}" style="background:${bgColor}">
                <td>${row.customer}</td>
                <td>${row.item_code}</td>
                <td>${row.item_name}</td>
                <td>${row.sales_invoice}</td>
                <td>${row.posting_date}</td>
                <td>${row.rate}</td>
                <td><input type="checkbox" class="choose-checkbox" data-index="${i}"></td>
            </tr>
        `;
    }).join('');
    let table_html = `
        <table class="table table-bordered" style="width:100%; border-collapse:collapse; margin: 0;">
            <thead style="background-color: bisque; position: sticky; top: 0; z-index: 10;">
                <tr>
                    <th>Customer</th>
                    <th>Item Code</th>
                    <th>Item Name</th>
                    <th>Sales Invoice</th>
                    <th>Posting Date</th>
                    <th>Rate</th>
                    <th>Choose</th>
                </tr>
            </thead>
            <tbody>
                ${table_rows}
            </tbody>
        </table>
    `;
    dialog.$table_wrapper.html(table_html);
    dialog.$table_wrapper.on('change', '.choose-checkbox', function () {
        let index = $(this).data('index');
        let item_code = prices[index].item_code;
        if (this.checked) {
            prices.forEach((r, i) => {
                if (i != index && r.item_code == item_code) {
                    r.choose = false;
                    dialog.$table_wrapper.find(`input.choose-checkbox[data-index="${i}"]`).prop('checked', false);
                }
            });
        }
        prices[index].choose = this.checked;
    });
    if (dialog.$apply_btn) {
        dialog.$apply_btn.remove();
    }
    if (dialog.$button_wrapper) {
        dialog.$button_wrapper.remove();
    }
    dialog.$button_wrapper = $(`
        <div style="
            display: flex;
            justify-content: flex-end;
            margin-top: 10px;
        "></div>
    `).appendTo(dialog.body);

    dialog.$apply_btn = $(`<button class="btn btn-primary">Apply Prices</button>`)
        .appendTo(dialog.$button_wrapper)
        .click(() => {
            apply_selected_prices(frm, prices);
            dialog.hide();
        });
}

function apply_selected_prices(frm, table_data) {
    let updated = false;
    table_data.forEach(row => {
        if (row.choose) {
            let quotation_item = frm.doc.items.find(
                i => i.item_code === row.item_code
            );
            if (quotation_item) {
                frappe.model.set_value(
                    quotation_item.doctype,
                    quotation_item.name,
                    "rate",
                    row.rate
                );
                updated = true;
            }
        }
    });
    if (updated) {
        frm.trigger("calculate_taxes_and_totals");
        frm.dirty();
        frm.refresh_field("items");
        frappe.msgprint(__('Prices Applied.'));
    }
}


