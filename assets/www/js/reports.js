
reports = {
    showShifts: function() {
        var _this = this;
        var args = {
            hide_toolbar: true,
            win_id: "shifts_report_win"
        };

        appNav.showBack();
        var id = appNav.pushTemplate("shifts_report_tpl", args);

        // populate current shift.
        var shift = ShiftManager.getCurrentShift();
        var html = '';
        if (shift) {
            html = this._renderShift(shift, true)
        } else {
            html = '<tr><td align="center"><div><b>No Active Shift</b></div></td></tr>';
        }
        $('#current_shift_list').html(html)

        // populate historical shifts.
        var shifts = ShiftManager.getShiftHistory();
        var logged_in_uid = amplify.store('user_data').uid;
        if (shifts) {
            html = '';
            html_arr = [];
            $.each(shifts, function(index, shift) {
                if (shift.crew[0].uid == logged_in_uid) {
                    html_arr.push(_this._renderShift(shift, false));
                }
            });
            html = html_arr.join('');
        } else {
            html = '<tr><td align="center"><div><b>No Historical Shifts</b></div></td></tr>';
        }
        $('#shifts_report_list').html(html);
    },
    _clean: function(txt) {
        if (!txt) {
            return 'N/A';
        } else {
            return txt;
        }
    },

    _renderShift: function(shift, current_shift) {
        var html = '<tr><td>';
        html += '<br><br><b>Shift Start: </b>';
        html += this._clean(moment(shift.shift_start).format("YYYY-MM-DD hh:mm:ss"));
        html += '<br><b>Shift End: </b>';
        html += this._clean(shift.shift_end ? moment(shift.shift_end).format("YYYY-MM-DD hh:mm:ss") : "Shift active");
        if (!current_shift) {
            html += '</td></tr><tr><td><div class="nav_btn" onclick="ui.showOldShiftSummary(\'' + shift.id + '\')">Print Summary</div></td>';
        }
        html += '</td></tr><tr><td><div class="nav_btn" onclick="reports.showShiftTrans(\'' + shift.id + '\')">View Transactions</div></td>';
        html += '</td></tr><tr><td><div class="nav_btn" onclick="reports.showShiftTransSummary(\'' + shift.id + '\')">View Summary</div></td>';
        html += '</td></tr>';
        return html;
    },

    showReceipt: function(trans_ref_num) {
        var completed_trans = amplify.store("completed_transactions");
        var found_trans = null;
        $.each(completed_trans, function(idx, trans) {
            if (trans.trans_ref_num == trans_ref_num) {
                found_trans = trans;
            }
        });
        if (found_trans) {
            ui.showReceipt(found_trans);
        }
    },

    showShiftTrans: function(shift_id) {
        var _this = this;
        var args = {
            hide_toolbar: true,
            win_id: "shift_trans_report_win"
        };

        function populateTrans() {
            var completed_trans = amplify.store("completed_transactions");
            var html_arr = [];
            completed_trans.reverse();
            $.each(completed_trans, function(idx, trans) {
                if (trans.shift_id == shift_id) {
                    var total = 0;
                    var num_prods = 0;
                    $.each(trans.products, function(pidx, prod) {
                        total+= (prod.price * prod.qty);
                        num_prods+= 1;

                    });
                    var html = '<tr style="border-bottom:2px solid black"><td><div style="padding:10px;">Ref: ' +
                        trans.trans_ref_num_short + '<br>Products: '+ num_prods;
                    html += '<br>Total: ' + (parseFloat(total).toFixed(2));
                    html += '<br>Type: ' + trans.payment_type;
                    var status = (trans.synchronized) ? "Synchronized" : "Pending";
                    html += '</div><div style="padding:10px;">Status: ' + status + '</div></td>';
                    if (trans.synchronized != true && moment().diff(trans.end, "minutes") <= 15) {
                        html += '<tr><td><div class="nav_btn" onclick="ui.showVoidTrans(\'' + trans.trans_ref_num + '\')">Cancel Transaction</div></td></tr>';
                    }
                    html += '<tr><td style="border-bottom:2px solid black"><div class="nav_btn" onclick="reports.showReceipt(\'' + trans.trans_ref_num + '\')">Show Receipt</div></td></tr>';
                    html_arr.push(html);
                }
            });
            $('#shift_trans_list').html(html_arr.join(''));
        }

        appNav.showBack();
        var id = appNav.pushTemplate("shift_trans_report_tpl", args, populateTrans);
    },

    showShiftTransSummary: function(shift_id) {
        var _this = this;

        function populateTrans() {
            var completed_trans = amplify.store("completed_transactions");
            var html_arr = [];
            var html_bulk_arr = [];
            var product_totals = {};
            var product_bulk_totals = {};
            $.each(completed_trans, function(idx, trans) {
                if (trans.shift_id == shift_id) {
                    var total = 0;

                    $.each(trans.products, function(pidx, prod) {
                        var prod_id = pidx.split('-')[0];
                        var target = null;
                        if (prod.trolley == 3) {
                            target = product_bulk_totals;
                        } else {
                            target = product_totals;
                        }

                        if(!target[prod_id]) {
                            target[prod_id] = {
                                'cc_pending': 0,
                                'cc_success': 0,
                                'cc_failed': 0,
                                'cash': 0
                            };
                        }
                        if (trans.payment_type == 'cc' && !trans.synchronized) {
                            target[prod_id]['cc_pending'] +=  prod.qty;
                        } else if (trans.payment_type == 'cc' && trans.synchronized && trans.failed) {
                            target[prod_id]['cc_failed'] +=  prod.qty;
                        } else if (trans.payment_type == 'cc' && trans.synchronized && !trans.failed) {
                            target[prod_id]['cc_success'] +=  prod.qty;
                        } else if (trans.payment_type == 'cash') {
                            target[prod_id]['cash'] +=  prod.qty;
                        } else {
                            console.log('Unknown payment_type!')
                        }
                    });
                }
            });

            $.each(product_totals, function(prod_id, total) {
                var comb = total.cash + total.cc_pending + total.cc_success + total.cc_failed;
                var prod = ui.getProduct(prod_id);
                html_arr.push(
                    "<tr>" +
                    "<td class='bottom-border' >" + prod.prod_name + "</td>" +
                    "<td class='bottom-border' align='center'>" + total.cash + "</td>"+
                    "<td class='bottom-border' align='center'>" + comb + "</td>" +
                    "<td class='bottom-border' align='center'>"+ total.cc_pending + "</td>" +
                    "<td class='bottom-border' align='center'>" + total.cc_success + "</td>" +
                    "<td class='bottom-border' align='center'>" + total.cc_failed + "</td>" +
                    "</tr>"
                );
            });
            $('#shift_trans_summary_list').html(html_arr.join(''));




        }

        var args = {
            hide_toolbar: true,
            win_id: "shift_trans_summary_report_win",
        };

        appNav.showBack();
        var id = appNav.pushTemplate("shift_trans_summary_report_tpl", args, populateTrans);
    }
}
