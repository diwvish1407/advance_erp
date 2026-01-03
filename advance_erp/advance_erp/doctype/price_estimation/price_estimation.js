frappe.ui.form.on('Price Estimation', {
    onload: function(frm) {
        frm.call({
            method: "get_price_estimation_defaults",
            callback: function(r) {
                if (r.message) {
                    const defaults = r.message;
                    for (let key in defaults) {
                        if (frm.fields_dict[key]) {
                            frm.set_value(key, defaults[key]);
                        }
                    }
                }
            }
        });
        load_price_history(frm);
        if (!frm.doc.item_code || !frm.doc.warehouse || !frm.doc.period_days) return;
        frm.call({
            method: "get_stock_level",
            args: {
                item_code: frm.doc.item_code,
                warehouse: frm.doc.warehouse,
                period_days: frm.doc.period_days,
                low_stock_threshold: frm.doc.low_stock_threshold,
                high_stock_threshold: frm.doc.high_stock_threshold
            },
            callback: function(r) {
                if(r.message) {
                    alert(r.message)
                    frm.set_value("stock_level", r.message);
                }
            }
        });
    },
    item_code: function(frm) {
        fetch_rates(frm);
        load_price_history(frm);
        if (!frm.doc.item_code || !frm.doc.warehouse || !frm.doc.period_days) return;
        frm.call({
            method: "get_stock_level",
            args: {
                item_code: frm.doc.item_code,
                warehouse: frm.doc.warehouse,
                period_days: frm.doc.period_days,
                low_stock_threshold: frm.doc.low_stock_threshold,
                high_stock_threshold: frm.doc.high_stock_threshold
            },
            callback: function(r) {
                if(r.message) {
                    frm.set_value("stock_level", r.message);
                }
            }
        });
    },
    warehouse: function(frm) {
        fetch_rates(frm);
        load_price_history(frm);
        if (!frm.doc.item_code || !frm.doc.warehouse || !frm.doc.period_days) return;
        frm.call({
            method: "get_stock_level",
            args: {
                item_code: frm.doc.item_code,
                warehouse: frm.doc.warehouse,
                period_days: frm.doc.period_days,
                low_stock_threshold: frm.doc.low_stock_threshold,
                high_stock_threshold: frm.doc.high_stock_threshold
            },
            callback: function(r) {
                if(r.message) {
                    frm.set_value("stock_level", r.message);
                }
            }
        });
    },
    refresh: function(frm) {
        load_price_history(frm);
        if (!frm.doc.item_code || !frm.doc.warehouse || !frm.doc.period_days) return;
        frm.call({
            method: "get_stock_level",
            args: {
                item_code: frm.doc.item_code,
                warehouse: frm.doc.warehouse,
                period_days: frm.doc.period_days,
                low_stock_threshold: frm.doc.low_stock_threshold,
                high_stock_threshold: frm.doc.high_stock_threshold
            },
            callback: function(r) {
                if(r.message) {
                    frm.set_value("stock_level", r.message);
                }
            }
        });
    },
    customer(frm) {
        if (!frm.doc.customer) return;
        frm.call({
            method: "get_customer_payment_behaviour",
            args: { customer: frm.doc.customer },
            callback: function(r) {
                if(r.message) {
                    frm.set_value("payment_behaviour", r.message);
                }
            }
        });
        frm.call({
            method: "get_customer_purchase_power",
            args: {
                customer: frm.doc.customer
            },
            callback: function(r) {
                if(r.message) {
                    frm.set_value("purchase_power", r.message);
                }
            }
        });
    },
    period_days: function(frm) {
        if (!frm.doc.item_code || !frm.doc.warehouse || !frm.doc.period_days) return;
        frm.call({
            method: "get_stock_level",
            args: {
                item_code: frm.doc.item_code,
                warehouse: frm.doc.warehouse,
                period_days: frm.doc.period_days,
                low_stock_threshold: frm.doc.low_stock_threshold,
                high_stock_threshold: frm.doc.high_stock_threshold
            },
            callback: function(r) {
                if(r.message) {
                    frm.set_value("stock_level", r.message);
                }
            }
        });
    },
    low_stock_threshold: function(frm) {
        if (!frm.doc.item_code || !frm.doc.warehouse || !frm.doc.period_days) return;
        frm.call({
            method: "get_stock_level",
            args: {
                item_code: frm.doc.item_code,
                warehouse: frm.doc.warehouse,
                period_days: frm.doc.period_days,
                low_stock_threshold: frm.doc.low_stock_threshold,
                high_stock_threshold: frm.doc.high_stock_threshold
            },
            callback: function(r) {
                if(r.message) {
                    frm.set_value("stock_level", r.message);
                }
            }
        });
    },
    high_stock_threshold: function(frm) {
        if (!frm.doc.item_code || !frm.doc.warehouse || !frm.doc.period_days) return;
        frm.call({
            method: "get_stock_level",
            args: {
                item_code: frm.doc.item_code,
                warehouse: frm.doc.warehouse,
                period_days: frm.doc.period_days,
                low_stock_threshold: frm.doc.low_stock_threshold,
                high_stock_threshold: frm.doc.high_stock_threshold
            },
            callback: function(r) {
                if(r.message) {
                    frm.set_value("stock_level", r.message);
                }
            }
        });
    }
});

function fetch_rates(frm) {
    if (!frm.doc.item_code) {
        frm.set_value('last_purchase_rate', 0);
        frm.set_value('valuation_rate', 0);
        return;
    }
    frappe.db.get_value('Item', frm.doc.item_code, 'last_purchase_rate', function(r) {
        if(r) frm.set_value('last_purchase_rate', r.last_purchase_rate);
    });
    if(frm.doc.warehouse) {
        frappe.db.get_value('Bin', {
            item_code: frm.doc.item_code,
            warehouse: frm.doc.warehouse
        }, 'valuation_rate', function(r) {
            if(r) {
                frm.set_value('valuation_rate', r.valuation_rate);
            } else {
                frm.set_value('valuation_rate', 0);
            }
        });
    } else {
        frm.set_value('valuation_rate', 0);
    }
}

function load_price_history(frm) {
    if (!frm.doc.item_code) {
        frm.set_value('previous_quotations', '');
        frm.set_value('previous_invoices', '');
        return;
    }
    frm.call({
        method: "get_historical_prices",
        args: {
            item_code: frm.doc.item_code,
            warehouse: frm.doc.warehouse
        },
        callback: function (r) {
            if (!r.message) return;
            render_quotation_table(frm, r.message.quotations || []);
            render_invoice_table(frm, r.message.invoices || []);
        }
    });
}
function render_quotation_table(frm, rows) {
    const wrapper = frm.fields_dict.previous_quotations.$wrapper;

    if (!rows.length) {
        wrapper.html('<p>No quotation history found.</p>');
        return;
    }

    let html = `
        <table class="table table-bordered table-sm">
            <thead>
                <tr>
                    <th>Quotation</th>
                    <th>Date</th>
                    <th>Rate</th>
                </tr>
            </thead>
            <tbody>
    `;

    rows.forEach(r => {
        html += `
            <tr>
                <td>
                    <a href="/app/quotation/${r.quotation}" target="_blank">
                        ${r.quotation}
                    </a>
                </td>
                <td>${frappe.datetime.str_to_user(r.transaction_date)}</td>
                <td>${format_currency(r.rate)}</td>
            </tr>
        `;
    });

    html += `</tbody></table>`;

    wrapper.html(html);
}

function render_invoice_table(frm, rows) {
    const wrapper = frm.fields_dict.previous_invoices.$wrapper;

    if (!frm.doc.warehouse) {
        wrapper.html('<p>Select warehouse to view invoice history.</p>');
        return;
    }

    if (!rows.length) {
        wrapper.html('<p>No sales invoice history found.</p>');
        return;
    }

    let html = `
        <table class="table table-bordered table-sm">
            <thead>
                <tr>
                    <th>Invoice</th>
                    <th>Date</th>
                    <th>Rate</th>
                </tr>
            </thead>
            <tbody>
    `;

    rows.forEach(r => {
        html += `
            <tr>
                <td>
                    <a href="/app/sales-invoice/${r.invoice}" target="_blank">
                        ${r.invoice}
                    </a>
                </td>
                <td>${frappe.datetime.str_to_user(r.posting_date)}</td>
                <td>${format_currency(r.rate)}</td>
            </tr>
        `;
    });

    html += `</tbody></table>`;

    wrapper.html(html);
}
