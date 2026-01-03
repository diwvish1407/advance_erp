frappe.ui.form.on('Price Estimation Setting', {
    refresh: function(frm) {set_editable_status(frm);},
    enable_editing: function(frm) {set_editable_status(frm);}
});
function set_editable_status(frm) {
    const editable = frm.doc.enable_editing === 1;
    frm.fields.forEach(field => {
        if (['enable_editing', 'section_break_okjn', 'column_break_thnc', 'column_break_ywpr', 'column_break_igof'].includes(field.df.fieldname)) return;
        frm.set_df_property(field.df.fieldname, 'read_only', !editable);
    });
    frm.refresh_fields();
}

