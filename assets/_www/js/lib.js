// Copyright BlueMarket Retail Solutions. jasper@bluemarket.co.za

var interface_version = "AviaPay-0.0.15";
var domain_list = {
    //"za": "http://localhost:8081/aviapay-pos-server"
    // "demo": "https://bluemarket.co.za/demo-pos-server",
    "za": "https://bluemarket.co.za/demo-pos-server"
    // "za": "http://safair-pos-server.dev/"
};
/*
var live_domain = "https://bluemarket.co.za";
var domain = live_domain;
var dev_domain = "https://bmdev.co.za";
var base_url = domain + "/store/";
*/
var disable_amercian_express = true;
var trans_cutoff_days = 7;
var domain = "";
var base_url = "";
var default_currency_symbol = "&euro;";
var is_touch_device = 'ontouchstart' in document.documentElement;
var unique_count = new Date().getTime();
var tpls = {};
var m_interval = false;
var ui = {
    id: "ui",
    name: "UI",
    search_win_id: "",
    settings_open: false,
    settings_animating: false,
    search_settings_open: false,
    search_settings_animating: false,
    is_provider_scan: false,
    waiting_for_card: false,
    last_trans: null,
    payment_types: {
        cash: "Cash",
        bm: "BlueMarket",
        cc: "Credit Card"
    },
    getCurrentProviderId: function() {
        return amplify.store("provider_id");
    },
    getCurrentProvider: function() {
        return amplify.store("employer");
    },
    mkCurrentTransShortReference: function() {
        var prefix = moment().format('DDhhmmss');
        var index = ui.getNextTransIndex();
        var provider_id = ui.getCurrentProviderId();
        var device_id = ui.getDeviceID(provider_id);

        return provider_id + "-" + device_id + "-" + prefix + "-" + index;
    },
    getNextTransIndex: function() {
        var index = amplify.store("trans_index");
        if (!index) {
            index = 0;
        }
        index++;
        amplify.store("trans_index", index);
        return index;
    },
    mkCurrentTransReference: function(trans, is_credit_note) {
        if (!trans) {
            if (is_credit_note) {
                trans = ui.getCurrentCreditNote();
            } else {
                trans = ui.getCurrentTrans();
            }
        }
        //var trans = ui.getCurrentTrans();
        var provider_id = ui.getCurrentProviderId();
        var device_id = ui.getDeviceID(provider_id);
        var device_num = ui.getDeviceNum();
        var now = new Date().getTime();
        var start = trans.start;
        var index = ui.getNextTransIndex();
        var trans_ref_num = provider_id + "-" + device_num + "-" + device_id + "-" + index + "-" + start + "-" + now;
        return trans_ref_num;
    },
    getDeviceNum: function() {
        return amplify.store("device_num");

    },
    doCreditNote: function() {
        var trans = ui.getCurrentCreditNote();
        trans.trans_ref_num = ui.mkCurrentTransReference(trans, true);
        trans.trans_ref_num_short = ui.mkCurrentTransShortReference();
        trans.synchronized = false;
        ui.setTransCompleted(trans);
        ui.initTransData(true); // clear the current transaction
        ui.showCreditNoteReceipt(trans, function() {
        });
        // add more validation?

    },

    doSetPendingTrans: function(trans, callback) {
        var args = {
            provider_id: amplify.store("provider_id"),
            trans_data: JSON.stringify(trans)
        };
        appNav.showLoading();
        $.post(base_url + "set_pending_trans/" + mkSessURL(), args, function(json) {
            appNav.hideLoading();

            if (! session.isValidSessionResponse(json)) {
                return session.showLogin();
            }
            if (json.success) {
                if (callback) {
                    callback();
                }
            } else {
                appNav.showDialog({
                    message: "Unable to create transaction!",
                    back: function() {
                        appNav.closeDialog();
                    }
                });

            }
        }).fail(function() {
            appNav.hideLoading();
            appNav.showDialog({
                message: "Unable to connect!",
                back: function() {
                    appNav.closeDialog();
                }
            });
        });


    },


    showOnboardCategorySelect: function() {
        var flight_num = $("#flight_num").val();
        var seat_num = $("#seat_num").val();

        if (flight_num) {
            amplify.store("flight_num", flight_num);
            ShiftManager.setFlightNumber(flight_num);
        }

        if (seat_num) {
            amplify.store("seat_num", seat_num);
        }

        appNav.showToolbar("trans_toolbar_tpl");

        var args = {
            hide_toolbar: false,
            win_id: "category_select_win",
            onFocusRestored: function() {
                ui.showTransTotal(ui.getCurrentTrans());
            }
        };
        appNav.showBack();
        appNav.setNavRight('<a class="nav_link nav_link_button button" href="javascript:ui.startScanner(false)">Scan</a>');
        var id = appNav.pushTemplate("category_select_tpl", args);

        ui.showTransTotal(ui.getCurrentTrans());
    },

    cardTest: function() {
        if (window.cardReader) { // Android
            window.cardReader.readCard(200);
        }
    },


    MagTest: function() {
        if (window.cardReader) { // Android
            window.cardReader.readMag();
        }
    },

    NFCTest: function() {
        if (window.cardReader) { // Android
            window.cardReader.readNFC();
        }
    },
    doSale: function(payment_type) {
        var trans = ui.getCurrentTrans();
        trans.trans_ref_num = ui.mkCurrentTransReference();
        trans.trans_ref_num_short = ui.mkCurrentTransShortReference();
        trans.synchronized = false;
        trans.payment_type = payment_type;

        if (payment_type == "bm") {
            ui.doSyncTransData(true, function() {
                ui.doSetPendingTrans(trans, function() {
                    var code = domain + "/tr/" + trans.trans_ref_num;
                    var args = {
                       hide_toolbar: true,
                       win_id: "bluemarket_payment_win"
                    };
                    appNav.showBack();
                    var id = appNav.pushTemplate("bluemarket_payment_tpl", args);
                    showCode("bm_pay_code", code, 1);
                    ui.monitorPayment(trans);
                });
            });
            return;
        }
        if (payment_type == "cash") {
            /*
            try {
                if (window.appHelper) { // Android
                    window.appHelper.openDrawer();
                }
            } catch (e) {
                // pass
                console.log(e);
            }
            */
            ui.last_trans = Date.now();
            ui.setTransCompleted(trans);
            ui.initTransData(); // clear the current transaction
            ui.showReceipt(trans, function() {
            });
        } else if (payment_type == "cc") {
            ui.showWaitingForCard();

            ui.waitForCard(60 * 1000);

        }
        // add more validation?

    },
    waitForCard: function(timeout) {
        if (! window.cardReader) { // Android
            console.log("Card reader not available");
            return;
        }
        ui.waiting_for_card = true;
        var start = new Date().getTime();
        //$("#card_wait_timeout_div").html(timeout / 1000);
        /*
        var interval = setInterval(function() {
            if (start + timeout < new Date().getTime()) {
                clearInterval(interval);
                ui.waiting_for_card = false;
                appNav.popTemplate();
            };
            var time_left = (parseInt((start + timeout - new Date().getTime()) / 1000)).toString();
            //$("#card_wait_timeout_div").html(time_left);
        }, 200);
        */

        setTimeout(function() {
            console.log('BEGIN window.cardReader.readCard();')
            var totalAmount = ui.getTransTotal(false) * 100;
            window.cardReader.readCard(totalAmount);
            console.log('END window.cardReader.readCard();')
        }, 1000);

    },

    showWaitingForCard: function() {
        var args = {
           hide_toolbar: true,
           win_id: "waiting_for_card_win"
        };
        appNav.setNavRight("");
        appNav.setNavLeft("");
        // appNav.setNavLeft('<a class="nav_link button" href="javascript:ui.clearCardWaiting()"><img class="back_arrow" src="images/arrow_back.png" style="max-height:35px"></a>');
        var id = appNav.pushTemplate("waiting_for_card_tpl", args);
        $("#stop_card_read_btn").show();
    },

    stopCardRead: function() {
        if (window.cardReader !== undefined) {
            window.cardReader.stopReadCard();
        }
        ui.clearCardWaiting();
        ui.showPaymentPage();
    },

    initCardPayment: function(card_num, exp_date) {
        console.log(card_num);
        ui.clearCardWaiting();
        appNav.showLoading();
        /*
        var is_offline_trans = amplify.store("is_offline_trans");
        if (is_offline_trans == false) {

        } else {

        }
        */

        if (!exp_date || exp_date.length != 4) {
            ui.cardPaymentFailed("Could not read expiry date, please try another card or use cash.");
            return;
        }

        // Check if card has expired.
        var year = 2000 + parseInt(exp_date.slice(0, 2));
        var month = parseInt(exp_date.slice(2, 4));
        if (!moment([year, month]).isAfter(moment())) {
            ui.cardPaymentFailed("Card has expired, please try another card or use cash.");
            return;
        }

        if (!card_num) {
            ui.cardPaymentFailed("Could not read credit card number, please try another card or use cash.");
            return;
        }

        // Check valid BIN ranges
        var res = binRangeBlacklistManager.checkBinRangeValid(card_num);
        if (res[0] == false) {
            ui.cardPaymentFailed(res[1] + " cards are not supported, please try another card or use cash.");
            return;
        }

        if (blacklistManager.checkNumberExists(card_num)) { // don't process if the card is blacklisted.
            ui.cardPaymentFailed("Problem authorizing card, please try another card or use cash.");
            return;
        }

        if (ui.transactionForCardExists(card_num)) {
            appNav.hideLoading();
            return appNav.showDialog({
                message: "The selected credit card has already been used on this flight, do you wish to continue?",
                ok: function() {
                    appNav.closeDialog();
                    setTimeout(function() {
                        processCard();
                    }, 1000);
                },
                cancel: function() {
                    appNav.closeDialog();
                }
            });
        } else {
            return setTimeout(function() {
                processCard();
            }, 1000);
        }
        function processCard() {
            appNav.hideLoading();
            var trans = ui.getCurrentTrans();
            trans.card_num = card_num;
            exp_date = exp_date.substr(2,2) + "20" + exp_date.substr(0,2);
            trans.exp_date = exp_date;

            trans.trans_ref_num = ui.mkCurrentTransReference();
            trans.trans_ref_num_short = ui.mkCurrentTransShortReference();
            trans.is_offline_trans = amplify.store("is_offline_trans");
            trans.seat_num = amplify.store("seat_num");
            trans.synchronized = false;
            trans.payment_type = "cc";

            console.log(trans);

            ui.last_trans = Date.now();
            ui.setTransCompleted(trans);
            ui.initTransData(); // clear the current transaction
            ui.showReceipt(trans, function() {
            });
        }

    },

    transactionForCardExists: function(card_num) {
        var transactions = amplify.store("completed_transactions");
        if (! transactions) {
            return false;
        }
        var card_exists = false;
        $.each(transactions, function(idx, trans) {
            if (trans.card_num && trans.card_num == card_num) {
                card_exists = true;
            }
        });
        return card_exists;
    },

    cardPaymentFailed: function(message) {
        ui.clearCardWaiting();
        appNav.hideLoading();
        appNav.showDialog({
            message: "Payment failed: " + message,
            back: function() {
                appNav.closeDialog();
                ui.showPaymentPage();
                return;
            }
       });
    },

    cardPaymentProgress: function(message) { // Allow to give more detail progress information from the card reader.
        $("#stop_card_read_btn").hide();
        $("#card_reader_progress").html(message);
    },
    clearCardWaiting: function() {
        console.log("Clearing card waiting");
        $("#card_reader_progress").html('');
        ui.waiting_for_card = false;
        appNav.popTemplate();
    },
    cancelMonitorPayment: function() {
        clearInterval(m_interval);
        appNav.popTemplate();
    },
    monitorPayment: function(trans) {
        m_interval = setInterval(function() {
            var args = {
                trans_ref_num: trans.trans_ref_num,
            };
            $.getJSON(base_url + "get_trans_ref_status/" + mkSessURL()+"?u="+getUnique(), args, function(json) {
                if (! session.isValidSessionResponse(json)) {
                    return session.showLogin();
                }
                if (json.success) {
                    if (json.status_id == 3) {
                        clearInterval(m_interval);
                        ui.setTransCompleted(trans);
                        ui.initTransData(false); // clear the current transaction
                        appNav.showDialog({
                            message: "Payment successful! :)",
                            back: function() {
                                appNav.closeDialog();
                                ui.showHome(true);
                            }
                       });
                    }
                }
            });

        }, 3000);

    },


    setTransCompleted: function(trans) {


        var trolley_sales = amplify.store("trolley_sales") || {};
        $.each(trans.products, function(prod_key, prod) {
            var parts = prod_key.split("-");
            var prod_id = parts[0];
            if (trolley_sales[prod_id] && trolley_sales[prod_id] != 0) {
                trans.products[prod_key].trolley = trolley_sales[prod_id];
            }
        })
        amplify.store("trolley_sales", null);
        var completed_trans = amplify.store("completed_transactions");
        if (!completed_trans) {
            completed_trans = [];
        }
        var now = new Date().getTime();
        trans.end = now;
        try {
            trans.shift_id = ShiftManager.getCurrentShiftID();
        } catch (e) {
            trans.shift_id = 0;
        }
        completed_trans.push(trans);
        amplify.store("completed_transactions", completed_trans);
    },

    clearOldData: function() {
        // Clear old transactions.
        var completed_trans = amplify.store("completed_transactions");
        if (completed_trans) {
            var new_trans = [];
            var now_ts = new Date().getTime();
            $.each(completed_trans, function(idx, trans) {
                var timeDiff = now_ts - trans.start;
                var timeDiffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
                if (timeDiffDays < window.trans_cutoff_days) {
                    new_trans.push(trans);
                }
            });
            amplify.store("completed_transactions", new_trans);
        }

        // Clear old shifts.
        ShiftManager.clearOldShifts(window.trans_cutoff_days);
    },

    showCreditNoteReceipt: function(trans, callback) {
        appNav.showBack();
        appNav.setNavRight('');
        appNav.hideToolbar();
        var provider = this.getCurrentProvider();
        var d = new Date();

        var now = moment().format('MMMM Do YYYY, h:mm:ss a');
        var prod_html = "";
        var total = 0;
        var sub_total = 0;
        var total_tax = 0;
        $.each(trans.products, function(prod_id, pobj) {

            var prod = ui.getProdFromStore(prod_id);
            if (!prod) {
                console.log("Prod not found");
                return;
            }
            if (prod.is_on_special == "1") {
                price = prod.special_price;
            } else {
                price = prod.price;
            }
            var tax = price * 0.14;
            var excl_price = price - tax;
            total_tax+= parseFloat(tax) * parseFloat(pobj.qty);

            var excl_item_total = (parseFloat(excl_price) * parseFloat(pobj.qty));
            var incl_item_total = (parseFloat(price) * parseFloat(pobj.qty));

            sub_total+= excl_item_total;
            total+= parseFloat(price) * parseFloat(pobj.qty);

            prod_html+= '<tr><td>'+pobj.qty+' x </td><td>'+prod.prod_name+'</td><td align="right">'+incl_item_total.toFixed(2)+'</td></tr>';

        });
        var args = {
            hide_toolbar: false,
            currency: amplify.store("default_currency_symbol"),
            date_time: now,
            total: "-" + total.toFixed(2),
            subtotal: "-" + sub_total.toFixed(2),
            tax: "-" + total_tax.toFixed(2),
            ref_num: trans.trans_ref_num_short,
            provider_name: provider.provider_name,
            win_id: "credit_note_receipt_win"
        };


        setTimeout(function() {
            appNav.showToolbar("receipt_toolbar_tpl", {ref_num:trans.trans_ref_num});
        }, 700);

        var receipt_html = $.loadUITemplate("credit_note_receipt_tpl", args);
        $("#print_frame").contents().find('html').html(receipt_html);
        appNav.setNavLeft('');
        appNav.setNavRight('<a class="nav_link nav_link_button button" href="javascript:ui.showAirHome(true)">Done</a>');
        //appNav.setNavLeft('<a class="nav_link button" href="javascript:ui.showHome()"><img class="back_arrow" src="images/arrow_back.png" style="max-height:35px"></a>');
        var id = appNav.pushTemplate("credit_note_receipt_tpl", args);
        $("#prod_list").append(prod_html);

        ui.doSyncTransData(false, false);
    },



    showReceipt: function(trans, callback) {
        appNav.showBack();
        appNav.setNavRight('');
        appNav.hideToolbar();
        var provider = this.getCurrentProvider();
        var d = new Date();

        var now = moment().format('MMMM Do YYYY, h:mm:ss a');
        var prod_html = "";
        var total = 0;
        var sub_total = 0;
        var total_tax = 0;
        $.each(trans.products, function(prod_id, pobj) {

            var prod = ui.getProdFromStore(prod_id);
            if (!prod) {
                console.log("Prod not found");
                return;
            }
            price = pobj.price;
            /*
            if (prod.is_on_special == "1") {
                price = prod.special_price;
            } else {
                price = prod.price;
            }
            */
            var tax = price * 0.14;
            var excl_price = price - tax;
            total_tax+= parseFloat(tax) * parseFloat(pobj.qty);

            var excl_item_total = (parseFloat(excl_price) * parseFloat(pobj.qty));
            var incl_item_total = (parseFloat(price) * parseFloat(pobj.qty));

            sub_total+= excl_item_total;
            total+= parseFloat(price) * parseFloat(pobj.qty);

            prod_html+= '<tr><td>'+pobj.qty+' x </td><td>'+prod.prod_name+'</td><td align="right">'+incl_item_total.toFixed(2)+'</td></tr>';

        });
        try {
            var payment_type = ui.payment_types[trans.payment_type];
        } catch (e) {
            payment_type = "Cash";
        }

        var args = {
            hide_toolbar: false,
            currency: amplify.store("default_currency_symbol"),
            date_time: now,
            payment_type: payment_type,
            total: total.toFixed(2),
            subtotal: sub_total.toFixed(2),
            tax: total_tax.toFixed(2),
            ref_num: trans.trans_ref_num_short,
            provider_name: provider.provider_name,
            win_id: "receipt_win",
            onFocusRestored: function() {
                setTimeout(function() {
                    appNav.showToolbar("receipt_toolbar_tpl", {ref_num:trans.trans_ref_num});
                }, 700);
            }
        };
        appNav.showToolbar("receipt_toolbar_tpl", {ref_num:trans.trans_ref_num});
        //appNav.setToolbarContent("receipt_toolbar_tpl");
        //appNav.setToolbarContent($.loadUITemplate("receipt_toolbar_tpl"));
        //appNav.showToolbar();
        var receipt_html = $.loadUITemplate("receipt_tpl", args);
        $("#print_frame").contents().find('html').html(receipt_html);
        appNav.setNavLeft('');
        appNav.setNavRight('<a class="nav_link nav_link_button button" href="javascript:ui.closeTransaction()">Done</a>');
        //appNav.setNavLeft('<a class="nav_link button" href="javascript:ui.showHome()"><img class="back_arrow" src="images/arrow_back.png" style="max-height:35px"></a>');
        var id = appNav.pushTemplate("receipt_tpl", args);
        $("#prod_list").append(prod_html);
        setTimeout(function() {
            appNav.showToolbar("receipt_toolbar_tpl", {ref_num:trans.trans_ref_num});
        }, 750);
        //ui.doSyncTransData(false, false);
        //toImg($("#print_area"));
    },

    printSlip: function() {

        html2canvas($("#print_area")[0]).then(
            function(canvas) {
                var dataURL = canvas.toDataURL("image/png").split(",")[1];
                if (window.slipPrinter) {
                    window.slipPrinter.startPrint(dataURL);
                }
            }
        );
    },


    getPendingTransData: function() {
        var completed = amplify.store("completed_transactions");
        var pending = [];
        completed = completed || [];
        $.each(completed, function(idx, trans) {
            if (!trans.synchronized) {
                pending.push(trans);
            }
        });
        return pending;
    },

    doSyncTransData: function(show_loading, callback) {
        console.log("doSyncTransData");
        var pending_trans = ui.getPendingTransData();
        if (pending_trans.length == 0) {
            return;
        }
        if (ui.last_trans && moment().diff(ui.last_trans, "minutes") < 15) {
            console.log("Last transaction was less than 15 mins ago, not doing sync");
            return;
        }
        var args = {
            provider_id: amplify.store("provider_id"),
            pos_device_serial: ui.getAndroidDeviceID(),
            trans_data: JSON.stringify(pending_trans)
        };
        if (show_loading) {
            appNav.showLoading();
        }

        $.post(base_url + "sync_trans/" + mkSessURL(), args, function(json) {
            if (show_loading) {
                appNav.hideLoading();
            }

            if (! session.isValidSessionResponse(json)) {
                return session.showLogin();
            }
            if (json.success) {
                var completed_trans = amplify.store("completed_transactions");

                $.each(pending_trans, function(idx, sync_trans) {
                    $.each(completed_trans, function(c_idx, comp_trans) {
                        if (sync_trans.trans_ref_num == comp_trans.trans_ref_num) {
                            comp_trans.synchronized = true;

                            if ($.inArray(comp_trans.trans_ref_num_short, json.failed) > -1) {
                                comp_trans.failed = true;
                            }


                        }
                    });
                })
                amplify.store("completed_transactions", completed_trans);

                // Sync shifts, just in case ;)
                ShiftManager.syncCurrentShift();
                ShiftManager.syncShiftHistory();

                if (callback) {
                    callback();
                }
            } else {
                /*
                appNav.showDialog({
                    message: "Unable to send!",
                    back: function() {
                        appNav.closeDialog();
                    }
                });
                */
            }
        }).fail(function() {
            if (show_loading) {
                appNav.hideLoading();
                appNav.showDialog({
                    message: "Unable to connect!",
                    back: function() {
                        appNav.closeDialog();
                    }
                });
            }
        });



    },

    doPrintReceipt: function() {
        $("#print_frame").get(0).contentWindow.print();
    },

    showGetEmailInfo: function(ref_num) {
        appNav.setNavRight('');
        appNav.showBack();
        appNav.hideToolbar();
        var args = {
            hide_toolbar: true,
            ref_num: ref_num,
            win_id: "send_email_win"
        };
        var id = appNav.pushTemplate("get_customer_email_tpl", args);



    },
    showGetEmailInfo: function(ref_num) {
        appNav.setNavRight('');
        appNav.showBack();
        appNav.hideToolbar();
        var args = {
            hide_toolbar: true,
            ref_num: ref_num,
            win_id: "send_email_win"
        };
        var id = appNav.pushTemplate("get_customer_email_tpl", args);



    },

    showGetSMSInfo: function(ref_num) {
        appNav.setNavRight('');
        appNav.showBack();
        appNav.hideToolbar();
        var args = {
            hide_toolbar: true,
            ref_num: ref_num,
            win_id: "send_sms_win"
        };
        var id = appNav.pushTemplate("get_customer_cell_tpl", args);



    },
    doEmailReceipt: function(ref_num) {
        var to_name = $("#get_customer_name").val();
        var to_email = $("#get_customer_email").val();
        var to_uid = $("#get_customer_cell").val();
        ui.doSyncTransData(true, function() {
            var args = {
                to_uid: to_uid,
                to_name: to_name,
                to_email: to_email,
                ref_num: ref_num
            };
            appNav.showLoading();
            $.post(base_url + "email_receipt/" + mkSessURL(), args, function(json) {
                appNav.hideLoading();
                if (json.success) {
                    appNav.popTemplate();
                    appNav.showDialog({
                        message: "Sent successfully",
                        back: appNav.closeDialog
                    });
                } else {
                    appNav.showDialog({
                        message: "Unable to send!",
                        back: function() {
                            appNav.closeDialog();
                        }
                    });
                }
            }).fail(function() {
                appNav.hideLoading();
                appNav.showDialog({
                    message: "Unable to connect!",
                    back: function() {
                        appNav.closeDialog();
                    }
                });
            });
        });
    },


    doSMSReceipt: function(ref_num) {
        var to_name = $("#get_customer_name").val();
        var to_email = $("#get_customer_email").val();
        var to_uid = $("#get_customer_cell").val();
        ui.doSyncTransData(true, function() {
            var args = {
                to_uid: to_uid,
                to_name: to_name,
                to_email: to_email,
                ref_num: ref_num
            };
            appNav.showLoading();
            $.post(base_url + "sms_receipt/" + mkSessURL(), args, function(json) {
                appNav.hideLoading();
                if (json.success) {
                    appNav.popTemplate();
                    appNav.showDialog({
                        message: "Sent successfully",
                        back: appNav.closeDialog
                    });

                } else {
                    appNav.showDialog({
                        message: "Unable to send!",
                        back: function() {
                            appNav.closeDialog();
                        }
                    });
                }
            }).fail(function() {
                appNav.hideLoading();
                appNav.showDialog({
                    message: "Unable to connect!",
                    back: function() {
                        appNav.closeDialog();
                    }
                });
            });
        });
    },

    doHoldSale: function() {


    },

    closeTransaction: function() {

        var location = amplify.store("current_location_type");
        if (location == "onboard") {
            appNav.showLoading();
            appNav.popAll2(function() {
                //setTimeout(ui.showOnboard, 900);
               ui.showOnboard();
                appNav.hideLoading();
            });
            //setTimeout(appNav.hideLoading, 200);
        } else if (location == "checkin") {
            appNav.popAll(ui.showCheckin);
        } else if (location == "gate") {
            appNav.popAll(ui.showGate)
        } else {
            ui.showHome(true);
        }

    },

    getTransByRefNum: function(trans_ref_num) {
        var completed_trans = amplify.store("completed_transactions");
        var found_trans = null;
        $.each(completed_trans, function(idx, trans) {
            if (trans.trans_ref_num == trans_ref_num) {
                found_trans = trans;
            }
        });
        return found_trans;

    },

    removeCompletedTrans: function(trans_ref_num) {
        var completed_trans = amplify.store("completed_transactions");
        var out_trans = [];
        var trans_synchronized = false;
        $.each(completed_trans, function(idx, trans) {
            if (trans.trans_ref_num == trans_ref_num && trans.synchronized == true) {
                trans_synchronized = true;
                return;
            }
            if (trans.trans_ref_num != trans_ref_num) {
                out_trans.push(trans);
            }
        });
        if (trans_synchronized == false) {
            amplify.store("completed_transactions", out_trans);
            return true;
        } else {
            return false;
        }
    },

    showVoidTrans: function(trans_ref_num) {
        appNav.showDialog({
            message: "Are you sure you want to void this transaction?",
            ok: function() {
                appNav.closeDialog();
                var trans = ui.getTransByRefNum(trans_ref_num);

                if (moment().diff(trans.end, "minutes") > 15) {
                    return appNav.showDialog({
                        message: "This transaction is now older than 10 minutes and can no longer be cancelled",
                        back: appNav.closeDialog
                    });

                }
                if (ui.removeCompletedTrans(trans_ref_num)) {
                    ui.voidTrans(trans);
                    appNav.popTemplate();
                    reports.showShifts();
                    appNav.showDialog({
                        message: "Transaction removed successfully",
                        back: appNav.closeDialog
                    });
                } else {
                    appNav.showDialog({
                        message: "This transaction cannot be removed",
                        back: appNav.closeDialog
                    });
                }
            },
            back: appNav.closeDialog

        });

    },


    showVoidCurrentTrans: function(is_credit_note) {
        appNav.showDialog({
            message: "Are you sure you want to void this transaction?",
            ok: function() {
                ui.voidCurrentTrans(is_credit_note);
                ui.closeTransaction();
                appNav.closeDialog();
            },
            back: appNav.closeDialog

        });

    },

    showNoEmployer: function() {
        appNav.setNavLeft('<a class="nav_link button" href="javascript:session.showLogin()"><img class="back_arrow" src="images/arrow_back.png" style="max-height:35px"></a>');
        appNav.setNavRight('');
        appNav.hideToolbar();
        var args = {
            hide_toolbar: true,
            win_id: "no_employer_win"
        };
        var id = appNav.pushTemplate("no_employer_tpl", args);

    },
    doSearch: function(is_credit_note) {
        var search_txt = $("#search_txt").val();
        search_txt = search_txt.trim();
        var prods = amplify.store("products");
        var provider_id = amplify.store("provider_id");
        if (search_txt == "") {
            return ui.showNewTransProducts(provider_id, prods, is_credit_note);
        }
        var res_prods = [];
        $.each(prods, function(idx, prod) {
            if (prod.prod_name.toLowerCase().search(search_txt.toLowerCase()) > -1) {
                res_prods.push(prod);
            }
        });
        ui.showNewTransProducts(provider_id, res_prods, is_credit_note);
    },
    selectEmployer: function(provider_id) {
        var employer_list = amplify.store("employer_list");
        var found = false;
        $.each(employer_list, function(idx, empl) {
            if (empl.provider_id == provider_id) {
                amplify.store("provider_id", provider_id);
                amplify.store("employer", empl);
                found = true;
            }

        });
        if (found) {
            amplify.store("current_trans", null);
            this.fetchProducts(provider_id, this.showHome);
        } else {
            appNav.showDialog({
                message: "Invalid employer",
                back: appNav.closeDialog
            });
        }
    },
    showEmployerSelector: function() {
        appNav.setNavLeft('<a class="nav_link button" href="javascript:session.showLogin()"><img class="back_arrow" src="images/arrow_back.png" style="max-height:35px"></a>');
        appNav.setNavRight('');
        //appNav.setNavRight('<a class="nav_link" href="javascript:ui.startScanner()">Scan</a>');
        var provider_id = amplify.store("provider_id");
        appNav.hideToolbar();
        var employer_list = amplify.store("employer_list");
        var empl_html = "";
        if (employer_list) {
            $.each(employer_list, function(idx, empl) {
                empl_html+= $.loadUITemplate("employer_selector_cell_tpl", {
                    provider_name: empl.provider_name,
                    provider_id: empl.provider_id,
                    thumb: ui.getThumbURL(empl.provider_id, empl.provider_logo)
                });
            });
        }

        var args = {
            empl_list: empl_html,
            hide_toolbar: true,
            win_id: "employer_selector_win"
        };
        var id = appNav.pushTemplate("employer_selector_tpl", args);

    },
    getProductPriceHTML: function(args) {
        if (args.is_on_special == "1") {
            args.display_price = default_currency_symbol + "&nbsp;" + parseFloat(args.special_price).toFixed(2);
            args.usual_price = "<s>" + default_currency_symbol + "&nbsp;" + parseFloat(args.price).toFixed(2) + "</s>";
        } else {
            args.usual_price = "";
            args.display_price = default_currency_symbol + "&nbsp;" + parseFloat(args.price).toFixed(2);
        }
        /*
            provider_id
            provider_name
            provider_thumb
            prod_id
            qty_available
            price
        */
        return $.loadUITemplate("product_price_tpl", args);
    },


    getPrettyPrice: function(prod) {
        var min_price = 0.00;
        var max_price = 0.00;
        var is_on_special = false;
        var p = 0.00;
        if (prod.is_on_special == "1") {
            is_on_special = true;
            p = parseFloat(prod.special_price);
        } else {
            p = parseFloat(prod.price);
        }
        if (min_price == 0.00) {
            min_price = p;
            max_price = p;
        } else {
            if (p > max_price) {
                max_price = p;
            }
            if (p < min_price) {
                min_price = p;
            }
        }
        min_price = min_price.toFixed(2);
        max_price = max_price.toFixed(2);
        return {min:min_price, max:max_price};
        /*
        console.log(min_price);
        console.log(max_price);
        console.log("***************");
        */
    },
    voidCurrentTrans: function(is_credit_note) {
        if (is_credit_note) {
            var trans = amplify.store("current_credit_note");
        } else {
            var trans = amplify.store("current_trans");
        }
        if (!trans) {
            return;
        }
        ui.voidTrans(trans);
        ui.initTransData(is_credit_note);
    },
    voidTrans: function(trans) {
        var voids = amplify.store("voided_transactions");
        if (!voids) {
            voids = [];
        }
        voids.push(trans);
        amplify.store("voided_transactions", voids);
        amplify.store("trolley_sales", null);

    },
    initTransData: function(is_credit_note) {
        var now = new Date().getTime();
        var customer = amplify.store("current_customer");
        trans = {start:now, products:{}, customer: customer};
        if (is_credit_note) {
            amplify.store("current_credit_note", trans);
        } else {
            amplify.store("current_trans", trans);
        }
        return trans;
    },
    getCurrentCreditNote: function() {
        var trans = amplify.store("current_credit_note");
        if (! trans) {
            trans = this.initTransData();
        }
        return trans;


    },

    setCurrentCreditNote: function(trans) {
        amplify.store("current_credit_note", trans);
    },
    getCurrentTrans: function() {
        var trans = amplify.store("current_trans");
        if (! trans) {
            trans = this.initTransData();
        }
        return trans;


    },
    setCurrentTrans: function(trans) {
        var flight_num = amplify.store("flight_num") || "";
        var seat_num = amplify.store("seat_num") || "";
        if (flight_num) {
            if (! trans.customer) {
                trans.customer = {};
            }
            trans.customer.flight_number = flight_num;
        }
        if (seat_num) {
            trans.customer.seat_number = seat_num;
        }
        amplify.store("current_trans", trans);
    },
    getProduct: function(prod_id) {
        var prods = amplify.store("products");
        var out_prod = false;
        $.each(prods, function(idx, prod) {
            if (out_prod) {
                return;
            }
            if (prod.prod_id == prod_id) {
                out_prod = prod;
            }
        });
        return out_prod;


    },
    getProductPriceOption: function(prod_id) {
        if (prod_id.indexOf("-") > -1) {
            var parts = prod_id.split("-");
            prod_id = parts[0];
        }
        var prods = amplify.store("products");
        var opt = {price: 0};
        $.each(prods, function(idx, prod) {

            if (prod.prod_id == prod_id) {
                var customer = amplify.store("current_customer");
                if (! customer) {
                    customer = {
                        from: "",
                        to: "",
                        name: "",
                        pnr: "",
                        airline: "PS",
                        flight_number: "",
                        date: "",
                        cabin_class: "",
                        seat_number: "",
                        sequence: "1234",
                        passenger_status: "1"
                    };
                    amplify.store("current_customer", customer);
                }
                $.each(prod.price_options, function(price_idx, price_opt) {
                    var parts = price_opt.price_option_name.split(" / ");
                    if (parts.length > 1) {
                        var from = parts[1];
                        var to = parts[2];
                        if (customer.from.trim() == from.trim() && customer.to.trim() == to.trim()) {
                            opt = price_opt;
                            return;
                        } else if (opt == {} && (from.trim() == "Any" || to.trim() == "Any") ) {
                            opt = price_opt;
                            return;
                        }
                    } else if (price_opt.price_option_name == "Default price") {
                        opt = price_opt;
                        return;
                    }
                });

            }
        });
        return opt;

    },

    getProductPrice: function(prod_id) {
        var opt = ui.getProductPriceOption(prod_id);
        return opt.price;

        /*
        var prods = amplify.store("products");
        var price = 0;
        $.each(prods, function(idx, prod) {

            if (prod.prod_id == prod_id) {
                var customer = amplify.store("current_customer");
                if (! customer) {
                    customer = {
                        from: "LGW",
                        to: "KBP"
                    };
                }
                $.each(prod.price_options, function(price_idx, price_opt) {
                    if (price_opt.price_option_name == "Default price") {
                        return;
                    }
                    var parts = price_opt.price_option_name.split(" / ");
                    var from = parts[1];
                    var to = parts[2];
                    if (customer.from.trim() == from.trim() && customer.to.trim() == to.trim()) {
                        price = price_opt.price;
                    } else if (price == 0 && (from.trim() == "Any" || to.trim() == "Any") ) {
                        price = price_opt.price;
                    }
                });


            }
        });
        return price;
        */
    },
    getTransTotal: function(trans, is_credit_note) {
        if (!trans) {
            if (is_credit_note) {
                trans = amplify.store("current_credit_note");
            } else {
                trans = amplify.store("current_trans");

            }
        }
        var total = 0;
        if (!trans || !trans["products"]) {
            return 0.00;
        }
        $.each(trans["products"], function(prod_id, pobj) {
            var price = ui.getProductPrice(prod_id);
            if (is_credit_note) {
                total-= price * pobj.qty;
            } else {
                total+= price * pobj.qty;
            }
        });
        return total;

    },
    showPaymentPage: function(is_credit_note) {
        var trans = amplify.store("current_trans");
        var total = ui.getTransTotal(trans, is_credit_note);
        if (total == 0) {
            return appNav.showDialog({
                message: "Please add products, current total is " + amplify.store("default_currency_symbol") + "&nbsp;0.00",
                back: appNav.closeDialog
            });
        }

        appNav.showBack();
        appNav.setNavRight('');
        //appNav.setNavRight('<a class="nav_link" href="javascript:ui.startScanner()">Scan</a>');
        var provider_id = amplify.store("provider_id");
        appNav.hideToolbar();
        var change = 0;
        if (is_credit_note) {
            if (total < 0) {
                change = total * -1;
            }
        }

        var args = {
            hide_toolbar: true,
            win_id: "payment_page",
            change: amplify.store("default_currency_symbol") + " "  + change.toFixed(2),
            total_formatted: amplify.store("default_currency_symbol") + " "  + total.toFixed(2),
            total: total.toFixed(2)
        };
        if (is_credit_note) {
            var id = appNav.pushTemplate("credit_note_payment_tpl", args);
        } else {
            var id = appNav.pushTemplate("trans_payment_tpl", args);
        }

        // Show product list.
        var prod_html = "";
        var total = 0;
        var sub_total = 0;
        $.each(trans.products, function(prod_id, pobj) {

            var prod = ui.getProdFromStore(prod_id);
            if (!prod) {
                console.log("Prod not found");
                return;
            }
            price = pobj.price;

            var incl_item_total = (parseFloat(price) * parseFloat(pobj.qty));

            total+= parseFloat(price) * parseFloat(pobj.qty);

            prod_html+= '<tr><td>'+pobj.qty+' x </td><td>'+prod.prod_name+'</td><td align="right">' + amplify.store("default_currency_symbol") + "&nbsp;" +incl_item_total.toFixed(2)+'</td></tr>';


        });
        $('#payment_page_prod_list').html(prod_html)

    },

    showReports: function() {
        var args = {
            hide_toolbar: true,
            win_id: "reports_win"
        };
        appNav.showBack();
        var id = appNav.pushTemplate("reports_tpl", args);
    },

    showTodayReport: function() {
        var args = {
            hide_toolbar: true,
            win_id: "today_report_win"
        };
        var now = moment().format("x");


        appNav.showBack();
        var id = appNav.pushTemplate("today_report_tpl", args);

        var target = $("#today_report_list");
        target.empty();
        var html = "";
        var g_total = 0;
        $.each(amplify.store("completed_transactions"), function(idx, trans) {

            if (moment.unix(now / 1000).format("YYYYMMDD") <= moment.unix(trans.end / 1000).format("YYYYMMDD")) {
                html+= '<hr>';
                var total = 0;
                var num_prods = 0;
                var trans_date = moment.unix(trans.start / 1000).format("YYYY-MM-DD hh:mm:ss");
                html+= '<tr><td align="left"><div><b>Transaction Date:</b> <br>'+trans_date+'</div></td></tr>';
                html+= '<tr><td align="left"><div style="font-size:16px"><b>Products:</b></div></td></tr>';
                $.each(trans.products, function(pidx, prod) {
                    total+= (prod.price * prod.qty);
                    g_total+= (prod.price * prod.qty);
                    num_prods+= 1;
                    var id_parts = pidx.split("-");
                    var prod_id = id_parts[0];
                    var prod_obj = ui.getProduct(prod_id);
                    html+= '<tr><td align="left"><div style="font-size:16px">'+prod.qty+' x '+prod_obj.prod_name+'</div></td></tr>';

                });
                html+= '<tr><td align="left"><div><b>Ref:</b><br> '+trans.trans_ref_num_short+'<br><br><b>Total:</b><br> '+(parseFloat(total).toFixed(2))+'</div></td></tr>';
            }

        });
        html = '<div style="width:100%;text-align:center;padding:5px;font-size:22px">TOTAL: R '+(parseFloat(g_total).toFixed(2))+'</div><br><br>' + html;
        target.html(html);

    },

    showPendingTransactions: function() {

    },

    showDayReports: function() {

        appNav.showBack();
        appNav.hideToolbar();
        var days = amplify.store("trading_days");
        if (!days) {
            days = [];
        }
        var args = {
            hide_toolbar: true,
            win_id: "day_reports_win"
        };
        var id = appNav.pushTemplate("day_reports_tpl", args);

        var target = $("#day_reports_list");
        target.empty();

        /*
        var html = '<div class="nav_btn nav_btn_big" style="min-width:90%" onclick="ui.showTodayReport()">';
        html+= '<table style="color:white" cellpadding="5" width="100%" height="100%">';
        html+= '    <tr>';
        html+= '        <td style="font-size:16px">Today</td>';
        html+= '    </tr>';
        html+= '</table>';
        html+= '</div>';
        target.append(html);
        */


        $.each(days, function(idx, day) {
            var html = '<div class="generic_cell" style="min-width:90%" onclick="ui.showDayReport('+day.day_id+')">';
            html+= '<table style="color:white" cellpadding="5" width="100%" height="100%">';
            html+= '    <tr>';
            html+= '        <td align="center" style="font-size:16px">Day Start: '+( moment.unix((day.day_open / 1000)).format("YYYY-MM-DD HH:mm:ss") )+'</td>';
            html+= '    </tr>';
            html+= '</table>';
            html+= '</div>';
            target.append(html);
        });
    },

    fetchCrewMembers: function() { // Fetch and store a list of crew members.
        var users = amplify.store('crew_members');
        var provider_id = amplify.store("provider_id");
        var args = {
            device_id: ui.getDeviceID(provider_id),
            provider_id: provider_id
        };
        $.getJSON(base_url + "crew/" + mkSessURL()+"?u="+getUnique(), args, function(json) {
            ui.clearCrewMembers();
            amplify.store('crew_members', json.rows);
        })
    },

    getCrewMembers: function() {
        var ret = amplify.store('crew_members');
        if (ret == undefined) {
            return [];
        }
        return ret;
    },

    clearCrewMembers: function() {
        amplify.store('crew_members', null);
    },

    refreshData: function() {
        ui.fetchCrewMembers();
        blacklistManager.syncEntries();
        ShiftManager.syncShiftHistory();
        this.doSyncTransData(false, false);
        this.fetchProducts(amplify.store("provider_id"));
        ui.checkForUpdate();
        ui.closeSettings();
    },

    triggerUpdateDownload: function() {
        $('#update_message').html('Fetching Update File');
        $('#download_btn').hide();
        $('#update_back_btn').hide();
        window.updater.triggerDownload(ui.apkUrl);
    },
    updateDownloadProgress: function(size) {
        var percentage = Math.round(size / ui.apkSize * 100, 2);
        $('#update_message').html('Fetching Update File, progress: ' + percentage + '%');
    },
    updateDownloadFailed: function() {
        $('#update_message').html('The update download failed, please try again.');
        $('#download_btn').show();
    },
    showUpdateScreen: function() {
        if (this.settings_open) { // close side menu, if open.
            ui.showSettings()
        }
        appNav.showLoading();
        var args = {};
        function checkUpdate() {
            if (window.miscReader !== undefined) {
                $('#build_version').html(window.miscReader.getVersionCode());
            }
            $('#device_id').html(ui.getAndroidDeviceID());

            ui.pingBackend(
                function(json) {
                    appNav.hideLoading();
                    if (json.do_upgrade) {
                        $('#update_info').show();
                        $('#update_message').html("An update is available.");
                        $('#download_btn').show();
                        $('#update_back_btn').show();
                        $('#update_version').html(json.upgrade_version_code);
                        ui.apkUrl = json.apk_url;
                        ui.apkSize = json.size;
                    } else {
                        $('#update_info').hide();
                        $('#download_btn').hide();
                        $('#update_message').html('No update required.');
                    }
                },
                function() {
                    appNav.hideLoading();
                }
            );
        };
        var id = appNav.pushTemplate("update_screen_tpl", args, checkUpdate);
    },
    updateTendered: function(e) {
        var total = ui.getTransTotal();
        if (e) {
            var tendered = e.value;
        } else {
            var tendered = $("#tendered_value").val();
        }
        var change = parseFloat(tendered) - parseFloat(total);
        $("#change_value").html("R " + change.toFixed(2));

    },
    showTransTotal: function(trans, is_credit_note) {
        var total = "Total: " + amplify.store("default_currency_symbol") + " "  + ui.getTransTotal(trans, is_credit_note).toFixed(2);
        $("#qty_edit_total").html(total);

    },
    toggleSalesTrolley: function(prod_id, trolley_id) {
        var trolley_sales = amplify.store("trolley_sales");
        if (! trolley_sales) {
            trolley_sales = {};
        }
        var checked = $("#trolley_sales_" + prod_id).attr("checked");
        if (checked == "checked") {
            trolley_sales[prod_id] = trolley_id;
        } else {
            trolley_sales[prod_id] = 0;
        }
        amplify.store("trolley_sales", trolley_sales);
    },
    incQtyEditor: function(prod_id, is_credit_note) {
        if (is_credit_note) {
            var trans = ui.getCurrentCreditNote();
        } else {
            var trans = ui.getCurrentTrans();
        }
        var current_qty = 0;
        var price_opt = ui.getProductPriceOption(prod_id);
        var prod_key = prod_id + "-" + price_opt.price_option_id;


        if (trans["products"][prod_key]) {
            current_qty = trans["products"][prod_key]["qty"];
        }
        current_qty++;



        trans["products"][prod_key] = { qty: current_qty, price: price_opt.price } ;
        if (is_credit_note) {
            ui.setCurrentCreditNote(trans);
        } else {
            ui.setCurrentTrans(trans);
        }
        $("#qty_txt_"+prod_id).val(current_qty);
        ui.updateQtyColours();
        ui.showTransTotal(trans, is_credit_note);
    },
    decQtyEditor: function(prod_id, is_credit_note) {
        if (is_credit_note) {
            var trans = ui.getCurrentCreditNote();
        } else {
            var trans = ui.getCurrentTrans();
        }
        var current_qty = 0;
        var price_opt = ui.getProductPriceOption(prod_id);
        var prod_key = prod_id + "-" + price_opt.price_option_id;

        if (trans["products"][prod_key]) {
            current_qty = trans["products"][prod_key]["qty"];
        }
        current_qty--;
        if (! is_credit_note && current_qty < 0) {
            current_qty = 0;
        }
        trans["products"][prod_key] = {qty: current_qty, price: price_opt.price} ;
        // Remove zero items from products list entirely.
        if (trans["products"][prod_key].qty == 0 ) {
            delete trans["products"][prod_key]
        }
        if (is_credit_note) {
            ui.setCurrentCreditNote(trans);
        } else {
            ui.setCurrentTrans(trans);
        }
        $("#qty_txt_"+prod_id).val(current_qty);
        ui.updateQtyColours();
        ui.showTransTotal(trans, is_credit_note);

    },
    setQtyEditor: function(prod_id, qty, is_credit_note) {
        var price_opt = ui.getProductPriceOption(prod_id);
        var prod_key = prod_id + "-" + price_opt.price_option_id;
        if (is_credit_note) {
            var trans = ui.getCurrentCreditNote();
            trans["products"][prod_key]["qty"] = qty;
            ui.setCurrentCreditNote(trans);
        } else {
            var trans = ui.getCurrentTrans();
            trans["products"][prod_key]["qty"] = qty;
            ui.setCurrentTrans(trans);
        }
        ui.showTransTotal(trans, is_credit_note);
        ui.updateQtyColours();

    },
    showOnboardTransProducts: function(provider_id, cat_id, products, is_credit_note) {
        $("#product_list").empty();
        if (is_credit_note) {
            var trans = ui.getCurrentCreditNote();
        } else {
            var trans = ui.getCurrentTrans();
        }
        var displayed_prods = {};
        var customer = amplify.store("current_customer");
        var location = amplify.store("current_location_type");

        /*
        function SortByName(a, b){
            var aName = a.prod_cat_id.toLowerCase();
            var bName = b.prod_cat_id.toLowerCase();
            return ((aName < bName) ? -1 : ((aName > bName) ? 1 : 0));
        }

        products.sort(SortByName);
        */

        var trolley_sales = amplify.store("trolley_sales") || {};
        $.each(products, function(idx, prod) {
            if (cat_id && prod.prod_cat_id != cat_id) {
                return;
            }
            var id_parts = prod.prod_id.split("-");
            var prod_id = id_parts[0];
            var has_price = false;
            $.each(prod.price_options, function(opt_idx, opt) {
                if (opt.price_option_name == "Default price") {
                    prod.price = opt.price;
                    prod.price_option_id = opt.price_option_id;
                    has_price = true;
                }
            });
            products[idx] = prod;
            if (! has_price) {
                return;
            }

            if (displayed_prods[prod_id] == true) {
                return;
            } else {
                displayed_prods[prod_id] = true;
            }

            prod.thumbnail = ui.getThumbURL(provider_id, prod.thumbnail_url);
            var min_max = ui.getPrettyPrice(prod);
            prod.print_price = min_max.max;
            prod.default_currency_symbol = amplify.store("default_currency_symbol");
            var current_qty = 0;
            var qty_available = "";
            var q = prod["qty_available"];
            if (q) {
                qty_available = "QOH: " + prod["qty_available"];
            }
            prod["qty_available"] = qty_available;
            var prod_key = prod.prod_id + "-" + prod.price_option_id;
            if (trans["products"][ prod_key ]) {
                current_qty = trans["products"][ prod_key ]["qty"];
            }
            prod.qty = current_qty;
            prod.is_credit_note = is_credit_note ? 1 : 0;
            var html = $.loadUITemplate("trans_product_onboard_tpl", prod);
            $("#product_list").append(html);



            if ( trolley_sales[prod_id] && trolley_sales[prod_id] != 0) {
                $("#trolley_sales_"+prod_id).prop("checked", true);
            } else {
                $("#trolley_sales_"+prod_id).prop("checked", false);

            }

        });
        amplify.store("products", products);
        ui.updateQtyColours();
        //$("#qty_edit_total").html("R 0.00");
        if (is_credit_note) {
            ui.showTransTotal(amplify.store("current_credit_note"), is_credit_note);
        } else {
            ui.showTransTotal(amplify.store("current_trans"));
        }

    },

    showNewTransProducts: function(provider_id, products, is_credit_note) {
        $("#product_list").empty();
        if (is_credit_note) {
            var trans = ui.getCurrentCreditNote();
        } else {
            var trans = ui.getCurrentTrans();
        }
        var displayed_prods = {};
        var customer = amplify.store("current_customer");
        var location = amplify.store("current_location_type");

        function SortByName(a, b){
            var aName = a.prod_cat_id.toLowerCase();
            var bName = b.prod_cat_id.toLowerCase();
            return ((aName < bName) ? -1 : ((aName > bName) ? 1 : 0));
        }

        products.sort(SortByName);


        $.each(products, function(idx, prod) {
            var id_parts = prod.prod_id.split("-");
            var prod_id = id_parts[0];

            var has_price = false;
            $.each(prod.price_options, function(opt_idx, opt) {
                var parts = opt.price_option_name.split(" / ");
                var loc = parts[0];
                var from = parts[1];
                var to = parts[2];
                if ((loc !== undefined) && (location !== undefined) &&
                    (loc.toLowerCase() == "any" || loc.toLowerCase() == location.toLowerCase()) &&
                    (customer.from == from && customer.to == to)) {
                    has_price = true;
                }
            });
            if (! has_price) {
                return;
            }

            if (displayed_prods[prod_id] == true) {
                return;
            } else {
                displayed_prods[prod_id] = true;
            }

            prod.thumbnail = ui.getThumbURL(provider_id, prod.thumbnail_url);
            var min_max = ui.getPrettyPrice(prod);
            prod.print_price = min_max.max;
            prod.default_currency_symbol = amplify.store("default_currency_symbol");
            var current_qty = 0;
            var qty_available = "";
            var q = prod["qty_available"];
            if (q) {
                qty_available = "QOH: " + prod["qty_available"];
            }
            prod["qty_available"] = qty_available;
            if (trans["products"][prod.prod_id]) {
                current_qty = trans["products"][prod.prod_id]["qty"];
            }
            prod.qty = current_qty;
            prod.is_credit_note = is_credit_note ? 1 : 0;
            var html = $.loadUITemplate("trans_product_ground_tpl", prod);
            $("#product_list").append(html);
        });
        ui.updateQtyColours();
        //$("#qty_edit_total").html("R 0.00");
        if (is_credit_note) {
            ui.showTransTotal(amplify.store("current_credit_note"), is_credit_note);
        } else {
            ui.showTransTotal(amplify.store("current_trans"));
        }

    },
    getProdFromStore: function(prod_id) {
        var prods = amplify.store("products");
        if (!prods) {
            return null;
        }
        var prod;
        if (prod_id.indexOf("-") > -1) {
            var parts = prod_id.split("-");
            prod_id = parts[0];
        }

        $.each(prods, function(idx, p) {
            if (prod) {
                return;
            }
            if (p.prod_id == prod_id) {
                prod = p;
            }
        });
        return prod;

    },
    /*
    showQtyEdit: function(prod_id) {
        provider_id = amplify.store("provider_id");
        var args = this.getProdFromStore(prod_id);
        args.win_id = "qty_editor";
        args.thumbnail = ui.getThumbURL(provider_id, args.thumbnail_url);
        var min_max = ui.getPrettyPrice(args);
        args.print_price = min_max.max;
        args.hide_toolbar = true;
        args.default_currency_symbol = amplify.store("default_currency_symbol");
        appNav.hideToolbar();
        appNav.showBack();
        appNav.setNavRight("");
        var id = appNav.pushTemplate("qty_editor_tpl", args);

        var trans = ui.getCurrentTrans();
        var current_qty = 0;
        if (trans["products"][prod_id]) {
            current_qty = trans["products"][prod_id];
        }
        $("#qty_txt_"+prod_id).val(current_qty);




    },
    */
    getDeviceID: function(provider_id) {
        var device_id = amplify.store("device_id_" + provider_id);
        if (!device_id) {
            return 0;
        } else {
            return device_id;
        }
    },

    flattenProducts: function(in_products) {
        var out_products = [];
        $.each(in_products, function(idx, prod) {
            $.each(prod.price_options, function(poptid, popt) {
                var obj = {};
                $.each(prod, function(key, value) {
                    if (typeof(value) != "object") {
                        obj[key] = value;
                    }
                });

                $.each(popt, function(key, value) {
                    obj[key] = value;
                });
                if (obj["price_option_name"] != "Default price") {
                    obj["prod_name"] += " " + obj["price_option_name"];
                }
                obj["prod_id"] += "-" + obj["price_option_id"];
                out_products.push(obj);
            })
        });
        return out_products;
    },

    fetchProducts: function(provider_id, callback) {
            appNav.showLoading();

            var args = {
                device_id: ui.getDeviceID(provider_id),
                provider_id: provider_id
            };
            $.getJSON(base_url + "products/" + mkSessURL()+"?u="+getUnique(), args, function(json) {
                appNav.hideLoading();
                if (! session.isValidSessionResponse(json)) {
                    return session.showLogin();
                }
                if (json.success) {
                    amplify.store("device_id_"+provider_id, json.device_id);

                    amplify.store("products", json.products);
                    //amplify.store("products", ui.flattenProducts(json.products));
                    amplify.store("default_currency_symbol", json.default_currency_symbol);
                    if (callback) {
                        callback(provider_id, json.products);

                    }
                    ui.showNewTransProducts(provider_id, json.products);
                } else {
                    appNav.showDialog({
                        message: json.message,
                        back: appNav.closeDialog
                    });
                }
            }).fail(function() {
                appNav.hideLoading();
                appNav.showDialog({
                    message: "There seems to be a problem with your connection",
                    back: function() {
                        appNav.closeDialog();
                    }
                });
            });


    },
    updateQtyColours: function() {
        $(".qty_input").each(function(idx, obj) {
            if ($(obj).val() != "0") {
                $(obj).css("background-color", "#01aef0");
                $(obj).css("color", "white");
            } else {
                $(obj).css("background-color", "white");
                $(obj).css("color", "black");
            }

        });

    },

    showNoScanInit: function() {
        appNav.showBack();
        //appNav.setNavRight('<a class="nav_link" href="javascript:ui.showScanMode()">Scan</a>');
        var args = {
            win_id: "no_scan_init",
            hide_toolbar: true
        };

        var id = appNav.pushTemplate("no_scan_init_tpl", args);
    },

    doNoScanContinue: function() {
        customer = {
            from: $("#no_scan_from").val(),
            to: $("#no_scan_to").val(),
            name: $("#no_scan_name").val(),
            pnr: "",
            airline: "",
            flight_number: "",
            date: "",
            cabin_class: "",
            seat_number: "",
            sequence: "",
            passenger_status: ""
        };
        amplify.store("current_customer", customer);


        ui.showNewTrans();
    },

    showNewCreditNote: function() {
        appNav.showBack();
        console.log("Credit note");
        //appNav.setNavRight('<a class="nav_link" href="javascript:ui.startScanner()">Scan</a>');
        var provider_id = amplify.store("provider_id");
        appNav.showToolbar("credit_note_toolbar_tpl");
        var args = {
            win_id: "credit_note_win",
            onFocusRestored: function() {
                ui.showTransTotal(ui.getCurrentCreditNote(), true);
            },
        };



        var id = appNav.pushTemplate("new_trans_tpl", args);
        if (amplify.store("products")) {
            this.showNewTransProducts(provider_id, amplify.store("products"), true);
        } else {
            ui.fetchProducts(provider_id, function() {
                ui.showNewTransProducts(false, true);
            });
        }

        $("#search_txt").bind("input", ui.doSearch);

    },
    showScanMode: function() {
        appNav.showBack();
        args = {
            win_id: "scan_win"
        };
        var id = appNav.pushTemplate("scan_tpl", args);
        $("#scan_input").focus();
        $("#scan_input").on("change", function() {
            console.log("GOT: " + $("#scan_input").val());
        });
        $("#scan_input").keydown( function() {
            console.log("GOT KEYDOWN: " + $("#scan_input").val());
        });

        /*
        $("#input").click(function(e) {
            e.stopPropagation();
            $("#input").focus()
        });
        */
    },
    showOnboardTrans: function(cat_id) {
        appNav.showBack();
        //appNav.setNavRight('<a class="nav_link" href="javascript:ui.showScanMode()">Scan</a>');
        var provider_id = amplify.store("provider_id");
        appNav.showToolbar("trans_toolbar_tpl");
        var args = {
            win_id: "new_trans",
            onFocusRestored: function() {
                ui.showTransTotal(ui.getCurrentTrans());
            },
        };

        var id = appNav.pushTemplate("new_trans_tpl", args);
        if (amplify.store("products")) {
            this.showOnboardTransProducts(provider_id, cat_id, amplify.store("products"));
        } else {
            ui.fetchProducts(provider_id, function() {
                ui.showOnboardTransProducts(provider_id, cat_id, amplify.store("products"));
            });
        }

        $("#search_txt").bind("input", ui.doSearch);

    },

    showNewTrans: function() {
        appNav.showBack();
        //appNav.setNavRight('<a class="nav_link" href="javascript:ui.showScanMode()">Scan</a>');
        var provider_id = amplify.store("provider_id");
        appNav.showToolbar("trans_toolbar_tpl");
        var args = {
            win_id: "new_trans",
            onFocusRestored: function() {
                ui.showTransTotal(ui.getCurrentTrans());
            },
        };

        var id = appNav.pushTemplate("new_trans_tpl", args);
        if (amplify.store("products")) {
            this.showNewTransProducts(provider_id, amplify.store("products"));
        } else {
            ui.fetchProducts(provider_id, ui.showNewTransProducts);
        }

        $("#search_txt").bind("input", ui.doSearch);

    },
    showStartDay: function() {
        var id = appNav.pushTemplate("start_day_tpl", {hide_toolbar:true, win_id:"start_day_win"});


    },
    showDayEnd: function() {
        appNav.showDialog({
            message: "Are you sure you want to end the current day?",
            ok: function() {
                var day_id = ui.endDay();
                appNav.closeDialog();
                ui.showHome();
                ui.showDayReport(day_id);
            },
            cancel: function() {
                appNav.closeDialog();
            }
        });

    },
    endDay: function() {
        var current_float = amplify.store("current_float");
        var day_open = amplify.store("day_open");
        var day_closed = moment().format("x");
        amplify.store("day_open", false);
        var trading_days = amplify.store("trading_days");
        if (! trading_days) {
            trading_days = [];
        }
        var day_id = moment().format("x");
        trading_days.push({
            start_float: current_float,
            day_open: day_open,
            day_closed: day_closed,
            total: ui.getRangeTotal(day_open, day_closed),
            day_id: day_id,
            day_name: moment().format("YYYY-MM-DD"),
        });
        amplify.store("trading_days", trading_days);
        return day_id;
    },
    getDayData: function(day_id) {
        var days = amplify.store("trading_days");
        if (!days) {
            return {};
        }
        var out_day = false;
        $.each(days, function(idx, day) {
            if (out_day) {
                return;
            }
            if (day.day_id == day_id) {
                out_day = day;
            }
        });
        return out_day;
    },
    showDayReport: function(day_id) {
        var day = ui.getDayData(day_id);
        var transactions = ui.getRangeTransactions(day.day_open, day.day_closed);
        var total_sales = parseFloat(day.total);
        var float_amount = parseFloat(day.start_float);
        var args = {
            hide_toolbar:true,
            win_id:"day_report_win",
            float_amount: float_amount.toFixed(2),
            total_sales: total_sales.toFixed(2),
            total: (total_sales + float_amount).toFixed(2)
        };
        appNav.showBack();
        var id = appNav.pushTemplate("day_report_tpl", args);
        var target = $("#day_report_items");
        target.empty();
        var html = "";
        $.each(transactions, function(idx, trans) {


            var total = 0;
            var num_prods = 0;
            $.each(trans.products, function(pidx, prod) {
                total+= (prod.price * prod.qty);
                num_prods+= 1;

            });
            html+= '<tr><td><div style="height:90px;border-bottom:2px solid black">Ref: '+trans.trans_ref_num_short+'<br>Products: '+num_prods+'<br>Total: '+(parseFloat(total).toFixed(2))+'</div></td></tr>';



        });
        target.html(html);

    },

    showShiftSelector: function() {
        // If we have started an existing shift, navigate to flight select.
        if (ShiftManager.getCurrentShift() != undefined) {
            return ui.showOnboard();
        }

        var args = {
            hide_toolbar:true,
            win_id: "shift_win"
        };
        function showCrewSelect () {
            var $el = $('#crew_select');
            var logged_in_uid = amplify.store('user_data').uid;

            var crew_arr = ui.getCrewMembers().map(
                function(crew) {
                    return {
                        value: crew.name, data: crew.uid
                    }
                }
            );

            $('#start_shift_btn').hide();
            $('#crew_select').autocomplete({
                lookup: crew_arr,
                autoSelectFirst: true,
                showNoSuggestionNotice: true,
                onSelect: function (suggestion) {
                    $('#crew_select').val(suggestion.value);
                    $('#start_shift_btn').show();
                    amplify.store('selected_crew_member', {
                        name: suggestion.value,
                        uid: suggestion.data
                    });
                },
                onInvalidateSelection:function() {
                    amplify.store('selected_crew_member', null);
                    $("#crew_select").val("");
                    $('#start_shift_btn').hide();
                }
            });
        }
        appNav.showBack();
        appNav.pushTemplate("shift_start_tpl", args, showCrewSelect);
    },

    startShift: function() {
        var $el = $('#crew_select');
        var user_data = amplify.store('user_data');
        var selected_member = amplify.store('selected_crew_member');
        var crew = [
            {
                "name": user_data.fname + ", " + user_data.lname,
                "uid": user_data.uid
            },
            {
                "name": selected_member.name,
                "uid": selected_member.uid
            }
        ];
        ShiftManager.startShift(crew, null);
        appNav.popTemplate();
        appNav.showLoading();

        setTimeout(appNav.hideLoading, 200);
        setTimeout(ui.showOnboard, 300);
    },

    showEndShift: function() {
        var pending = ui.getPendingTransData();
        if (pending && pending.length > 0) {
            // if the last trans is blocking the sync lets reset it
            ui.last_trans = null;
            return appNav.showDialog({
                message: "Your current shift has not been processed yet, make sure the device is connected to the internet <br><br>Press OK to try again",
                ok: function() {
                    appNav.closeDialog();
                    appNav.showLoading();
                    ui.showEndShift();
                    setTimeout(appNav.hideLoading, 3000);
                },
                cancel: function() {
                    appNav.closeDialog();
                }

            });

        }
        appNav.showDialog({
            message: "Are you sure you want to end your shift?",
            ok: function() {
                shift = ShiftManager.getCurrentShift();
                ShiftManager.endShift();
                appNav.closeDialog();
                ui.showShiftSummary(shift);
            },
            cancel: function() {
                appNav.closeDialog();
            }

        });

    },

    showOldShiftSummary: function(shift_id) {
        var shifts = ShiftManager.getShiftHistory();
        var found_shift = null;

        $.each(shifts, function(idx, shift) {
            if (shift.id == shift_id) {
                found_shift = shift;
            }
        });

        if (found_shift) {
            ui.showShiftSummary(found_shift);
        }
    },

    showShiftSummary: function(shift) {
        appNav.clearNav();
        if (! shift) {
            shift = ShiftManager.getCurrentShift();
        }

        function getTotals(trans, condition_func) {
            var failed = 0;
            var card = 0;
            var cash = 0;
            $.each(trans.products, function(prod_idx, prod) {
                if (condition_func(prod)) {
                    if (trans.payment_type == "cc") {
                        if (trans.failed) {
                            failed += parseFloat(prod.price) * prod.qty;
                        } else {
                            card += parseFloat(prod.price) * prod.qty;
                        }
                    } else if (trans.payment_type == "cash") {
                        cash += parseFloat(prod.price) * prod.qty;
                    }
                }
            });

            return {"failed": failed, "card": card, "cash": cash};
        }

        var completed = amplify.store("completed_transactions");
        var total_cash = 0;
        var total_card = 0;
        var total_failed = 0;
        var total_bulk_cash = 0;
        var total_bulk_card = 0;
        var total_bulk_failed = 0;

        $.each(completed, function(idx, trans) {
            if (trans.shift_id == shift.id) {

                // Total for normal trolley.
                res = getTotals(trans, function(prod) { console.log(prod.trolley); return prod.trolley != 3});
                total_failed += res.failed;
                total_card += res.card;
                total_cash += res.cash;

                // Total for bulk trolley.
                res = getTotals(trans, function(prod) { return prod.trolley == 3});
                total_bulk_failed += res.failed;
                total_bulk_card += res.card;
                total_bulk_cash += res.cash;
            }
        });

        //appNav.setNavRight('<img src="images/reload.png" class="button" onclick="ui.showShiftSummary()" style="max-height:35px;">');
        var flight_numbers = (shift.flight_numbers) ? shift.flight_numbers : [shift.flight_number];
        var id = appNav.pushTemplate("shift_summary_tpl", {
            hide_toolbar: true,
            win_id:"shift_summary",
            banking_reference: shift.banking_reference,
            shift_id: shift.id,

            total_cash: parseFloat(total_cash).toFixed(2),
            total_card: parseFloat(total_card).toFixed(2),
            total_failed: parseFloat(total_failed).toFixed(2),

            total_bulk_cash: parseFloat(total_bulk_cash).toFixed(2),
            total_bulk_card: parseFloat(total_bulk_card).toFixed(2),
            total_bulk_failed: parseFloat(total_bulk_failed).toFixed(2),

            crew: shift.crew[0].name + " <br /> "+ shift.crew[1].name,
            flight_numbers: flight_numbers.join(),
            start: Date(shift.start),
            end: (shift.end) ? Date(shift.end) : ""
        });

        // setTimeout(function() {
        //     ui.printShiftSummary();
        // }, 1000);
        //ui.showAirHome(true);
    },

    showOnboard: function() {
        // If we have not started a shift, navigate to crew selector.
        if (ShiftManager.getCurrentShift() == undefined) {
            return ui.showShiftSelector();
        }

        var flight_num = amplify.store("flight_num") || "";
        var seat_num = amplify.store("seat_num") || "";
        var args = {
            hide_toolbar:false,
            win_id:"onboard_win",
            seat_num: seat_num,
            flight_num: flight_num
        };
        amplify.store("is_offline_trans", true);
        amplify.store("current_location_type", "onboard");

        var link = '<a class="nav_link button" href="javascript:ui.showAirHome(true)"><img class="back_arrow" src="images/arrow_back.png" style="max-height:35px"></a>';
        appNav.setNavLeft(link);
        //appNav.showBack();
        function showConfigurations() {
            if (window.seat_layouts == undefined) { // no seat layouts, hide the option.
                $('#seat_configuration_type_label').hide();
                $('#seat_configuration_type').hide();
                $('#seat_configuration_type_cell').hide();
                return
            }
            //$('#seat_configuration_type_label').show();
            //$('#seat_configuration_type').show();
            //$('#seat_configuration_type_cell').show();
            var selected_config = amplify.store('seat_config_type');
            $.each(window.seat_layouts, function(index, value) {
                var selected_str = (index == selected_config) ? "selected=\"selected\"": "";
                $('#seat_configuration_type').append(
                        '<option value="' + index + '" ' + selected_str + '>' + index + '</option>'
                );
            });
            ui.loadSeatConfig($('#seat_configuration_type').val());
        }
        appNav.showToolbar("shift_toolbar_tpl", {});
        var id = appNav.pushTemplate("onboard_tpl", args, showConfigurations);
        ui.checkValidFlightNum();

        if (window.cardReader !== undefined) {
            ui.checkCardStillIn();
        }
    },

    setConfigurationType: function(value) {
        amplify.store('seat_config_type', value);
        ui.loadSeatConfig(value);
    },

    loadSeatConfig: function(selected_type) { // render seat layout.
        $('#seat_configuration').html('');
        $.each(window.seat_layouts[selected_type], function(index, value) {

            var row_arr = value;
            if (value[0] == 'exit') {
                console.log('EXIT!!!');
                row_str = "<th>Exit</th>";
            } else {
                var row_str = "<tr><td width='10%'></td>";
                for(var i = 0; i < row_arr.length; ++i) {
                    var s = row_arr[i];
                    if (s == '_') {
                        row_str += "<td class=\"aisle\" width='15px'></td>";
                    } else { // is normal seat.
                        row_str += "<td width='10px' class=\"seat\" id=\"" + s + "\"onclick=\"ui.selectSeat('" + s + "')\">" + s + "</td>";
                    }
                }
                row_str += "<td width='10%'></td></tr>";
            }
            $('#seat_configuration').append(row_str);
        });
    },

    selectSeat: function(seat_name) {
        $('#seat_num').val(seat_name);
        $('.seat').removeClass('selected-seat');
        $('#' + seat_name).addClass('selected-seat');
    },

    getRangeTransactions: function(start_ts, end_ts) {
        start_ts = parseInt(start_ts);
        end_ts = parseInt(end_ts);
        var completed_trans = amplify.store("completed_transactions");
        var result = [];
        if (! completed_trans) {
            return result;
        }
        $.each(completed_trans, function(idx, trans) {
            if (trans.start <= end_ts && trans.end >= start_ts) { // wt... && trans.start >= start_ts) {
                /*
                $.each(trans.products, function(prod_id, pobj) {
                    //var prod = ui.getProduct(prod_id);
                    //prod.qty = pobj.qty;
                    //result.push(prod);
                });
                */
                result.push(trans);
            }
        });
        return result;

    },
    getRangeTotal: function(start_ts, end_ts) {
        var total = 0;
        start_ts = parseInt(start_ts);
        end_ts = parseInt(end_ts);
        var completed_trans = amplify.store("completed_transactions");
        if (! completed_trans) {
            return 0;
        }
        $.each(completed_trans, function(idx, trans) {
            if (trans.start <= end_ts && trans.end >= start_ts) { // wt... && trans.start >= start_ts) {
                $.each(trans.products, function(prod_id, pobj) {
                    var price = ui.getProductPrice(prod_id);
                    total+= price * pobj.qty;
                });
            }
        });
        return total;
    },
    startDay: function() {
        var till_float = $("#float_input").val();
        if (isNaN(till_float)) {
            till_float = 0;
        }
        amplify.store("current_float", till_float);
        amplify.store("day_open", moment().format("x"));
        appNav.popAll();
        ui.showHome();

    },
    printShiftSummary: function() {
        $("[--data-win-id=shift_summary]").css("overflow", "visible");
        $("#banking_ref_print").html( $("#banking_ref").val() );
        $("#banking_ref_print").show();
        $("#banking_ref").hide();

        html2canvas($("#shift_summary")[0]).then(
            function(canvas) {
                var dataURL = canvas.toDataURL("image/png").split(",")[1];
                $("[--data-win-id=shift_summary]").css("overflow", "auto");
                $("#banking_ref_print").hide();
                $("#banking_ref_print").html("");
                $("#banking_ref").show();
                if (window.slipPrinter) {
                    window.slipPrinter.startPrint(dataURL);
                }
            }
        );

    },


    printTest: function() {
        html2canvas($("#air_home")[0]).then(
            function(canvas) {
                var dataURL = canvas.toDataURL("image/png").split(",")[1];
                if (window.slipPrinter) {
                    window.slipPrinter.startPrint(dataURL);
                }
            }
        );
    },

    checkCardStillIn: function() {
        if (window.cardReader.checkCardStillIn()) {
            appNav.showDialog({
                message: "Remember to remove the credit card !",
                back: function() {
                    appNav.closeDialog();
                }
            });
        }

    },

    showAirHome: function(clear_all, check_card) {
        var check = false;
        if (check_card == undefined) {
            check = false;
        } else {
            check = check_card;
        }

        if (check && window.cardReader !== undefined) {
            ui.checkCardStillIn();
        }

        if (clear_all) {
            appNav.popAll();
        }

        appNav.setNavLeft('<img src="images/menu.png" class="button" onclick="ui.showSettings()" style="max-height:35px;">');
        //appNav.setNavRight('<img src="images/reload.png" class="button" onclick="ui.reloadHome()" style="max-height:35px;">');
        var id = appNav.pushTemplate("air_home_tpl", {hide_toolbar:true, win_id:"air_home"});

    },

    checkValidFlightNum: function(e) {
        if(e) {
            var num = e.value;
            num = num.replace(/\D/g, '');
            if (num.length >= 3 && num.length <= 4) {
                $('#category_continue_btn').show();
            } else {
                $('#category_continue_btn').hide();
            }
            e.value = num;
        }
    },

    updateShiftBankingRef: function(e, shift_id) {
        if (e) {
            ShiftManager.setBankingReference(e.value, shift_id);
        }
    },

    showCheckin: function() {
        //appNav.setNavRight('<img src="images/reload.png" class="button" onclick="ui.reloadHome()" style="max-height:35px;">');
        amplify.store("is_offline_trans", false);
        amplify.store("current_location_type", "checkin");
        appNav.showBack();
        var id = appNav.pushTemplate("check_in_home_tpl", {hide_toolbar:true, win_id:"check_in_home"});

    },

    showGate: function() {
        //appNav.setNavRight('<img src="images/reload.png" class="button" onclick="ui.reloadHome()" style="max-height:35px;">');
        amplify.store("is_offline_trans", false);
        amplify.store("current_location_type", "gate");
        appNav.showBack();
        var id = appNav.pushTemplate("check_in_home_tpl", {hide_toolbar:true, win_id:"check_in_home"});

    },

    showHome: function(clear_all) {
        if (clear_all) {
            appNav.popAll();
        }
        //appNav.setNavRight('<a class="nav_link" href="javascript:ui.showStores()">Stores</a>');
        appNav.showBack();
        //appNav.setNavRight('<img src="images/reload.png" class="button" onclick="ui.reloadHome()" style="max-height:35px;">');
        var id = appNav.pushTemplate("home_tpl", {hide_toolbar:true, win_id:"home"});
        if (amplify.store("day_open")) {
            ui.setNavDayOpen();

        } else {

            ui.setNavDayClosed();
        }
        //this.getPersonalItems(this.showPersonalItems, id);
        //this.getTemplates();
    },

    setNavDayOpen: function() {
        $("#btn_start_day").hide();
        $("#btn_new_trans").show();
        $("#btn_credit_note").show();
        $("#btn_day_end").show();
    },
    setNavDayClosed: function() {
        $("#btn_start_day").show();
        $("#btn_new_trans").hide();
        $("#btn_credit_note").hide();
        $("#btn_day_end").hide();

    },

    getThumbURL: function(provider_id, thumb) {
        return base_url + "provider/data/" + provider_id + "/" + escape(thumb);
    },
    showScanMain: function() {
        analytics.add(analytics.TAPSCAN);
        appNav.setNavRight("");
        appNav.showBack();
        appNav.pushTemplate("scan_main_tpl", {hide_toolbar:true});
    },


    startScanner: function(is_ground_scan) {
        amplify.store("is_ground_scan", is_ground_scan);
        if (window.barcodeScanner) {
            window.barcodeScanner.startScanner();
        } else {
            pushURL("scancode:now");
        }
    },

    loadCode: function(code) {
        if (code.length > 30) {
            return ui.loadTicketCode(code);
        } else {
            return ui.loadProductBarcode(code);
        }
    },

    loadTicketCode: function(code) {

        // M1DAWSON JOHN MR              LGWKBPPS 0112 263C002A0001  00
        /*
M1= Ignore
LEOPOLD/EMR= Family Name/Initial/Status
E= Ignore
ZQ7O92= Booking Ref/PNR
GVALHR= Route ( Geneva-Heathrow)
BA= Airline ( British Airways)
00723= Flight No.
319= Date ( 319th day of current year) 14-NOV-2016 C= Cabin Class (Ignore)
002F= Seat No. (Ignore)
00009= Sequence No. (Ignore)
1= Passenger Status (ignore)
00= Ignore

        */
        var ticket = ui.parseTicketCode(code);
        amplify.store("current_customer", ticket);
        ticket["win_id"] = "ticket_info";
        ticket["hide_toolbar"] = true;
        appNav.clearNav();
        appNav.showBack();
        appNav.pushTemplate("ticket_info_tpl", ticket);

    },
    parseTicketCode: function(code) {
//M1DAWSON JOHN MR              LGWKBPPS 0112 263C002A0001  00
        var ticket = {
            name: code.substr(2, 20),
            pnr: code.substr(23, 6),
            from: code.substr(30, 3),
            to: code.substr(33, 3),
            airline: code.substr(36, 2),
            flight_number: code.substr(38, 5),
            date: code.substr(44, 3),
            cabin_class: code.substr(47, 1),
            seat_number: code.substr(48, 4),
            sequence: code.substr(52, 5),
            passenger_status: code.substr(57, 1)
        };
        if (code.length > 160) {
            var offset = 58;

            ticket["to"] = code.substr(163, 3);
        }

        return ticket;
    },

    loadProductBarcode: function(code) {

        var products = amplify.store('products');
        var found_product_id = null;
        var found_product_category_id = null;
        $.each(products, function(idx, product) {
            $.each(product.price_options, function(idx, pricing_option) {
                if (pricing_option.barcode && pricing_option.barcode.indexOf(code) != -1) {
                    found_product_id = pricing_option.prod_id;
                    found_product_category_id = product.prod_cat_id;
                    return false;
                }
            })
            if (found_product_id) {
                return false;
            }
        });

        if (found_product_id) {
            ui.incQtyEditor(found_product_id);
            ui.showOnboardTrans(found_product_category_id);
        } else {
            appNav.showDialog({
                message: "Product with barcode: " + code + " was not found.",
                back: appNav.closeDialog
            });
        }
    },

    showProviderManage: function() {
        appNav.pushTemplate("provider_manage_tpl", {hide_toolbar:true});
        appNav.setNavRight("");
        appNav.showBack();
    },

    closeSettings: function() {
        if (this.settings_open) {
            this.showSettings();
        }
    },

    showSettings: function() {
        if (ui.settings_animating) {
            return;
        }
        analytics.add(analytics.TAPSETTINGSMENU);
        var slide = $(window).width() - 60; // width of icons next to screen
        ui.settings_animating = true;
        if (!this.settings_open) {
            var user_data = amplify.store("user_data");
            if (user_data.allow_push_notification) {
                $("#allow_push_notification").iCheck('check');
            }
            if (user_data.allow_proximity_alert) {
                $("#allow_proximity_alert").iCheck('check');
            }

            $("#allow_push_notification").on('ifChanged', function() {
                session.updateUserSettings();
            });
            $("#allow_proximity_alert").on('ifChanged', function() {
                session.updateUserSettings();
            });



            var settings_div = $("#settings_div");
            settings_div.css("left", (slide * -1) + 'px');
            settings_div.css("width", slide+"px");
            settings_div.css("display", "block");
            $("#body_div").transition({x: slide+'px'}, 500, function() {
                ui.settings_animating = false;
            });
            //$("#body_div").bind("click", function() {
            //    ui.showSettings();
            settings_div.transition({x: slide+'px'}, 500);
            this.settings_open = true;
        } else {
            var settings_div = $("#settings_div");
            $("#body_div").transition({x: '0px'}, 500, function() {
            });
            settings_div.transition({x: '0px'}, 500, function() {
                settings_div.css("width", slide+"px");
                settings_div.css("display", "none");
                ui.settings_animating = false;
            });

            $("#body_div").off();
            this.settings_open = false;

        }
    },


    getTemplates: function(callback) {
        appNav.showLoading();
        $.getJSON(base_url + "templates/" + mkSessURL() + "?u="+getUnique(), function(json) {
            appNav.hideLoading();
            if (! session.isValidSessionResponse(json)) {
                return session.showLogin();
            }
            amplify.store("templates", json);
        }).fail(function() {
            appNav.hideLoading();
            appNav.showDialog({
                message: "There seems to be a problem with your connection",
                back: function() {
                    appNav.closeDialog();
                }
            });
        });
    },

    initTouchSwipe: function() {
        $("#settings_div").touchwipe({
            wipeLeft: function() {
                if (ui.settings_open) {
                    ui.closeSettings();
                }
            },
            min_move_x: 18,
            preventDefaultEvents: false
        });
        $("#search_settings_div").touchwipe({
            wipeRight: function() {
                if (ui.search_settings_open) {
                    ui.closeSearchSettings();
                }
            },
            min_move_x: 18,
            preventDefaultEvents: false
        });

        $("#body_div").touchwipe({
            wipeRight: function() {
                if (ui.search_settings_open) {
                    ui.closeSearchSettings();
                }
            },

            wipeLeft: function() {
                if (ui.settings_open) {
                    ui.closeSettings();
                }
            },
            min_move_x: 18,
            preventDefaultEvents: false
        });

    },
    setAndroidDeviceID: function() {
        var device_id = "not_set";
        if (window.miscReader !== undefined) {
            device_id = window.miscReader.getAndroidId();
        }
        amplify.store('android_device_id', device_id);
    },

    getAndroidDeviceID: function() {
        return amplify.store('android_device_id')
    },

    getBuildVersion: function() {
        if (window.miscReader !== undefined) {
            return window.miscReader.getVersionName() + ' / ' + window.miscReader.getVersionCode();
        }
        return '';
    },

    getLocalStorageSize: function() {
        var total = 0;
        for (var x in window.localStorage) {
            var amount = (window.localStorage[x].length * 2) / 1024 / 1024;
            if (!isNaN(amount)) {
                total += amount;
            }
        }
        return total.toFixed(2);
    },

    pingBackend: function(callback, fail_callback) {  // on each view initalisation, phone home.
        var version_name = 'not_set';
        var version_code = -1;
        if (window.miscReader !== undefined) {
            version_name = window.miscReader.getVersionName();
            version_code = window.miscReader.getVersionCode();
        }

        var args = {
            'device_serial': this.getAndroidDeviceID(),
            'version_code': version_code,
            'version_name': version_name,
            'on_charge':  amplify.store('on_charge'),
            'local_storage_size': ui.getLocalStorageSize()
        }
        $.get(base_url + "reg_pos_device", args, callback).fail(function() {
            if (fail_callback) {
                fail_callback();
            }
        });
    },

    checkForUpdate: function() {
        ui.pingBackend(function(json) {
            if (json.do_upgrade) {
                ui.showUpdateScreen();
            }
            if (json.bin_range_blacklist !== undefined) {
                binRangeBlacklistManager.updateBinRangeBlacklist(json.bin_range_blacklist)
            }
        });
    },

    init: function() {
        amplify.store("default_currency_symbol", "&euro;");
        // Enable card types.
        if (window.cardReader !== undefined) {
            // enableCardType(boolean mag, boolean icc, boolean nfc)
            window.cardReader.enableCardType(false, true, false);
        }

        // Remove expired data.
        ui.clearOldData();

        // set Interface version if possible.
        if (window.miscReader !== undefined) {
            interface_version = 'AviaPay-' + window.miscReader.getVersionCode();
        }

        // Fetch & set Android Device ID.
        this.setAndroidDeviceID();

        $(document).click(function() {
            if ($("#scan_input")) {
                $("#scan_input").focus();
            }
        });

        setInterval(function() {
            ui.doSyncTransData(null, null);
        }, 60 * 1000);
        //Check for updates on init as well as every 2 hours.
        ui.checkForUpdate();
        setInterval(function() {
            ui.checkForUpdate();
        }, 2 * 60 * 60 * 1000);
        // Check for blacklist udpates every 6 hours.
        blacklistManager.syncEntries();
        setInterval(function() {
            blacklistManager.syncEntries();
        }, 6 * 60 * 60 * 1000);
        if (! session.isValidSession()) {
            session.showLogin();
        } else {
            this.showAirHome();
        }
        // Refresh data and batterylevel usage counters every 5 minutes.
        DataUsageTracker.refreshCounters(ui.getAndroidDeviceID());
        BatteryLevelTracker.refreshCounters(ui.getAndroidDeviceID());
        setInterval(function() {
            DataUsageTracker.refreshCounters(ui.getAndroidDeviceID());
            BatteryLevelTracker.refreshCounters(ui.getAndroidDeviceID());
        }, 5 * 60 * 1000);

        this.initTouchSwipe();
        //this.loadSettingsAutoClose()
        this.loaded = true;

    }
}



var analytics = {
    APPLICATIONINIT: 1,
    SIGNIN: 2,
    SIGNOUT: 3,
    TAPRESENDPIN: 4,
    TAPREGISTER: 5,
    CHANGECOUNTRY: 6,
    TAPPRIVATEVOUCHER: 7,
    TAPSETTINGSMENU: 8,
    TAPSEARCH: 9,
    DOSEARCH: 10,
    SHOWADDWISHLIST: 11,
    ADDWISHLIST: 12,
    CANCELADDWISHLIST: 13,
    TAPSAVEDWISHLIST: 14,
    DELETEWISHLIST: 15,
    TAPRELOADHOME: 16,
    TAPSCAN: 17,

    TAPSCANQRCODE: 19,
    TAPSCANAR: 20,
    TAPBACKBUTTON: 21,
    TAPMYSTORES: 22,
    TAPVIEWRETAILERPROFILE: 23,
    TAPSUBSCRIBERETAILER: 24,
    TAPUNSUBSCRIBERETAILER: 25,
    TAPPUBLICVOUCHER: 26,
    SCANVALIDQRCODE: 27,
    SCANVALIDARMARKER: 28,
    TAPMAP: 29,
    TAPCONTACT: 30,
    TAPPRODUCTLIST: 31,

    TAPMANAGE: 32,
    PROVIDERTAPSCANCODE: 33,
    PROVIDERTAPENTERCODE: 34,
    TAPCONTACTMAP: 35,
    TAPCONTACTPHONE: 36,
    TAPPRODUCT: 37,
    TAPCOMPETITION: 38,
    TAPENTERCOMPETITION: 39,
    data: [],
    queue: [],
    is_queued: false,
    queue_time: 0,
    add: function(code, params) {
        var now = new Date().getTime();
        var param_str = "";
        if (params && params.constructor == Object) {
            comma = "";
            $.each(params, function(key, val) {
                param_str+= comma + "{\"" + key + "\":" + val + "}"
                comma = ","
            });
        }
        var log = "[" + code + ",[" + param_str + "]," + now + "]";
        this.data.push(log);
    },
    getQueueString: function() {
        if (!this.is_queued) {
            this.is_queued = true;
            this.queue_time = new Date().getTime();
            this.queue = this.data;
            this.data = [];
        } else if (new Date().getTime() - this.queue_time > 60 * 1000) {
            // break the timeout and restore the data along with any possible new entries, will try again on next sync
            this.rollbackQueue();
            this.is_queued = false;
        }
        var qstr = "";
        var comma = "";
        $.each(this.queue, function(idx, q) {
            qstr+= comma + q;
            comma = ","
        });
        return "["+qstr+"]";
    },
    rollbackQueue: function() {
        this.is_queued = false;
        this.queue_time = 0;
        this.data = this.data.concat(this.queue);
        this.queue = [];

    }
};

var session = {
    last_activity: 0,
    current_longitude: 0,
    current_latitude: 0,
    is_live: true,
    // place_id = Gimbal id, loc_id = provider location id on BlueMarket
    setCountry: function(country_code) {
        if (country_code) {
            domain = domain_list[country_code];
        }
        amplify.store("country_code", country_code);
        $("#country_code").val(country_code);
        $("#reg_country_code").val(country_code);
        this.setBaseURL();
    },

    setBaseURL: function() {
        var country_code = amplify.store("country_code");
        if (!country_code) {
            country_code = "za";
            amplify.store("country_code", country_code);
        }
        domain = domain_list[country_code];
        base_url = domain + "/store/";
        window.base_url = base_url;
    },
    /*
    setIsLive: function() {
        this.is_live = true;
        domain = live_domain;
        base_url = domain + "/store/";
    },
    setIsDev: function() {
        this.is_live = false;
        domain = dev_domain;
        base_url = domain + "/store/";
    },
    */
    updatePosition: function(lng, lat) {
        this.current_longitude = parseFloat(lng);
        this.current_latitude = parseFloat(lat);
    },
    hasGPS: function() {
        return this.current_latitude != 0;
    },
    updateDeviceNum: function(num) {
        $("#device_num_txt").val(num);
        amplify.store("device_num", num);
    },
    isValidSession: function() {
        if (!amplify.store("token") || !amplify.store("device_num")) {
            return false;
        } else {
            return true;
        }
    },
    updateUserSettings: function() {
        var user_data = amplify.store("user_data");
        user_data.allow_proximity_alert = $("#allow_proximity_alert").prop('checked');
        user_data.allow_push_notification = $("#allow_push_notification").prop('checked');
        amplify.store("user_data", user_data);
        this.submitUserData(false);

    },
    updateSearchSettings: function() {
        var user_data = amplify.store("user_data");
        user_data.show_everything = $("#search_show_everything").prop('checked');
        user_data.show_places = $("#search_show_places").prop('checked');
        user_data.show_products = $("#search_show_products").prop('checked');
        user_data.show_specials = $("#search_show_specials").prop('checked');
        user_data.show_competitions = $("#search_show_competitions").prop('checked');
        user_data.show_events = $("#search_show_events").prop('checked');
        amplify.store("user_data", user_data);
        this.submitUserData(false);

    },

    updateUserData: function() {
        var user_data = amplify.store("user_data");
        user_data.fname = $("#about_me_fname").val();
        user_data.email_address = $("#about_me_email_address").val();
        user_data.lname = $("#about_me_lname").val();
        amplify.store("user_data", user_data);
        this.submitUserData(true);
    },
    submitUserData: function(show_success) {
        var user_data = amplify.store("user_data");
        var args = {
            fname: user_data.fname,
            lname: user_data.lname,
            email_address: user_data.email_address,
            allow_proximity_alert: user_data.allow_proximity_alert,
            allow_push_notification: user_data.allow_push_notification
        };
        if (show_success) {
            appNav.showLoading();
        }
        $.post(base_url + "update_user_data/" + mkSessURL(), args, function(json) {
            appNav.hideLoading();
            if (json.success) {
                if (show_success) {
                    appNav.showDialog({
                        message: "Updated successfully",
                        back: function() {
                            appNav.closeDialog();
                            appNav.popTemplate();
                        }
                    });
                }
            } else {
                appNav.showDialog({
                    message: "Unable to update!",
                    back: function() {
                        appNav.closeDialog();
                    }
                });

            }
        }).fail(function() {
            appNav.hideLoading();
            appNav.showDialog({
                message: "Unable to connect!",
                back: function() {
                    appNav.closeDialog();
                }
            });
        });


    },
    isValidSessionResponse: function(json) {
        if (json.code && json.code == "1") {
            return false;
        } else {
            return true;
        }
    },

    registerDevice: function(id) {
        if (window.appHelper) { // Android
            if (!id) {
                id = window.appHelper.getRegID();
            }
            console.log("got device id: " + id);
            if (id != "") {
                $.getJSON(base_url+"reg_android/"+mkSessURL()+"?id="+id+"&u="+getUnique(), function(json) {
                    if (json.success) {
                        amplify.store("android_id", id);
                    }
                });
            }
        }
    },

    showPasswordExpiry: function() {
        var id = appNav.pushTemplate("password_expiry_tpl", {hide_toolbar:true, win_id:"password_expiry"});
    },

    validatePIN: function() {
        //var pin = $("#device_pin_txt").val().replaceAll('  ', '');
        var country_code = $("#country_code").val();
        var num = amplify.store("device_num");
        var password = $('#password').val();
        if (!num) {
            $("#session_message").html("Invalid Username");
            return;
        }
        var args = {
            num: num,
            pin: password
        };
        analytics.add(analytics.SIGNIN);
        appNav.showLoading();
        $.post(base_url + "mlogin", args, function(json) {
            appNav.hideLoading();
            if (json.success) {
                amplify.store("token", json.token);
                var user_data = amplify.store("user_data") || {};
                user_data.fname = json.fname;
                user_data.lname = json.lname;
                user_data.uid = num;
                user_data.employers = json.employers;
                user_data.password_expiry = json.password_expiry;
                amplify.store("user_data", user_data);
                appNav.popTemplate();
                appNav.window_stack = [];
                appNav.title_stack = [];
                $("#window_main").html("");
                amplify.store("employer_list", json.employers);
                if (json.employers.length == 0) {
                    ui.showNoEmployer();

                } else if (json.employers.length > 1) {
                    ui.showEmployerSelector();
                } else {
                    amplify.store("employer", json.employers[0]);
                    amplify.store("provider_id", json.employers[0].provider_id);
                    ui.initTransData(); // Clear any existing transactions.
                    ShiftManager.clearCurrentShift(); // Login Always means a new shift.
                    ui.refreshData();

                    // Check if password is expiring soon.
                    var password_expiry = new Date(user_data.password_expiry);
                    var date_now = new Date();
                    var timeDiff = Math.abs(password_expiry.getTime() - date_now.getTime());
                    var diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
                    ui.showAirHome();
                    if (diffDays <= 10) { // needs to be notified of expiry.
                        setTimeout(session.showPasswordExpiry, 600);
                    }
                }
            } else {
                appNav.showDialog({
                    message: "Unable to log in. " + json.message,
                    back: function() {
                        appNav.closeDialog();
                    }
                });

            }
        }).fail(function() {
            appNav.hideLoading();
            appNav.showDialog({
                message: "Unable to connect!",
                back: function() {
                    appNav.closeDialog();
                }
            });


        });
    },
    getLastStoreTS: function() {
        var ts = amplify.store("last_store_ts");
        if (!ts) {
            ts = "1900-01-01 00:00:00";
        }
        return ts;
    },
    setLastStoreTS: function(ts) {
        amplify.store("last_store_ts", ts);
    },
    showLogin: function() {

        var device_num = amplify.store("device_num");
        if (! device_num) {
            device_num = "";
        }
        appNav.pushTemplate("login_win_tpl", {device_num_txt:device_num, hide_toolbar:true, win_id: "login_win"});
        appNav.setNavRight("");
        appNav.setNavLeft("");
        var country_code = amplify.store("country_code");
        if (country_code) {
            $("#country_code").val(country_code);
        } else {
            $("#country_code").val("");
        }
        $("#login_win input").enterKey(function() {
            $("input").blur();
        });
    },
    logout: function(is_timeout) {
        analytics.add(analytics.SIGNOUT);
        amplify.store("uname", "");
        amplify.store("valid_session", "");
        ui.clearCrewMembers();

        if (ShiftManager.getCurrentShift()) {  // End current shift on logout.
            ShiftManager.endShift();
        }

        // if we are connected. Delete user_date as well.
        ui.pingBackend(function() {
            amplify.store("user_data", null);
            amplify.store("token", null);
            amplify.store("device_num", null);
            amplify.store("flight_num", null);
        });
    },

    setupAjax: function() {
        $.ajaxSetup({
            dataType: 'json',
            beforeSend: function(xhr) {
                xhr.setRequestHeader('X-BlueMarket-Token', amplify.store("token"));
                xhr.setRequestHeader('X-BlueMarket-Analytics', analytics.getQueueString());
            },
            complete: function(xhr, status) {
                if (status == "success") {

                }
                if (status == "error") {
                    analytics.rollbackQueue();
                } else {
                    analytics.is_queued = false;
                }
            }
            //headers: {'X-BlueMarket-Token': }
        });
    },
    init: function() {
        this.setupAjax();
        this.setBaseURL();
        if (!amplify.store("user_data")) {
            amplify.store("user_data", {
                show_places: 1,
                show_products: 1,
                show_specials: 1,
                show_competitions: 1,
                show_events: 1
            });
        }
        console.log("init session");
    }

}

var audit = {
    log: function(message) {
        var date = moment().format("YYYY-MM-DD hh:mm:ss");
        var audit = amplify.store("audit");
        if (! audit) {
            audit = [];
        }
        var device_num = amplify.store("device_num");
        audit.push({
            message: message,
            date: date,
            uid: device_num
        });
        amplify.store("audit", audit);
    },
    init: function() {
        console.log("Audit init");
    }
}
var appNav = {
    id: "appNav",
    name: "App Navigation",
    tpls: {},
    show_toolbar: true,
    show_navbar: true,
    toolbar_height: 60,
    navbar_height: 60,
    loading_timeout: 0,
    window_stack: [],
    title_stack: [],
    z_count: 1,
    update: function(id) {
        this.setBodyScroll("#"+id);
    },
    isRootWindow: function() {
        return this.window_stack.length == 1;
    },
    setTitle: function(title_txt, config) {
        //var show_settings = false;
        var show_settings = config.show_settings == true ? true : false;
        var show_back = config.show_back == true ? true : false;
        var settings_tpl = config.settings_tpl ? config.settings_tpl : "";
        this.title_stack.push({title:title_txt, show_back:show_back, show_settings:show_settings});
        if (!title_txt) {
            title_txt = "";
        }
        var result = "";
        var parts = title_txt.split(" ");

        if (show_back) {
            result+= '<img class="arrow_left button" onclick="appNav.popWindow()" src="images/btn_back_112x76.png">';
            //result+= '<div class="arrow_left" onclick="appNav.popWindow()"></div>';
        }
        $.each(parts, function(idx, part) {
            if (idx == 0) {
                result+= '<font color="#034EA1">' + part + '</font>&nbsp;';
            } else {
                result+= '<font color="#034EA1">' + part + '</font>&nbsp;'; // keeping it the same..

            }
        });
        if (show_settings) {
            result = '<img src="images/tel.png" style="margin-top:12px;height:38px;width:38px;margin-left:0px" class="menu_link button" onclick="ui.showSettings()">' + result;
        }
        result = '<div class="title_wrap">'+result+'</div>';
        $(".title_text").html(result);
    },
    loadTemplates: function() {
        $(".tpl").each(function(idx, el) {
            var id = $(el).attr("id");
            if (!id) {
                return;
            }
            appNav.tpls[id] = $(el).html();
            $(el).remove();
        });
    },
    pushTemplate: function(tpl_name, args, callback) {
        if (!args) {
            args = {};
        }
        var html = $.loadUITemplate(tpl_name, args);
        return this.pushWindow(html, args, callback);
    },
    popAll2: function(callback) {

        if (this.window_stack.length <= 1) {
            if (callback) {
                callback();
            }
        } else {
            appNav.popWindow(function() {
                appNav.popAll2(callback);
            });
        }

    },
    popAll: function(callback) {
        for (var i = 0; i <= this.window_stack.length; i++) {
            this.popWindow();
        }
        this.popWindow();
        if (callback) {
console.log("doing callback");
console.log(callback);
            setTimeout(callback, 200);
        }
    },
    popTemplate: function(cnt, callback) {
        if (cnt && !isNaN(cnt)) {
            for (i = 0; i < cnt; i++) {
                this.popWindow(callback);
            }
        } else {
            this.popWindow(callback);
        }
    },
    showBack: function() {
        this.setNavLeft('<a class="nav_link button" href="javascript:appNav.goBack()"><img class="back_arrow" src="images/arrow_back.png" style="max-height:35px"></a>');
    },
    clearNav: function() {
        this.setNavLeft("");
        this.setNavRight("");
    },
    setNavLeft: function(content, win_id) {
        try {
            //this.window_stack[this.window_stack.length -1].settings.nav_left = content;
        } catch (e) {
            // pass
        }
        if (win_id) {
            $.each(appNav.window_stack, function(idx, win) {
                if (win.win_id == win_id) {
                    win.settings.nav_left = content;
                }
            });
        }
        $("#navbar_left").html(content);
    },
    setNavRight: function(content, win_id) {
        try {
            //:this.window_stack[this.window_stack.length -1].settings.nav_right = content;
        } catch (e) {
            // pass
        }
        if (win_id) {
            $.each(appNav.window_stack, function(idx, win) {
                if (win.win_id == win_id) {
                    win.settings.nav_right = content;
                }
            });
        }

        $("#navbar_right").html(content);
    },
    setToolbarContent: function(content) {
        $("#toolbar_div").html(content);
    },
    getNavLeft: function() {
        return $("#navbar_left").html();
    },
    getNavRight: function() {
        return $("#navbar_right").html();
    },
    getToolbarContent: function() {
        return $("#toolbar_div").html();
    },

    pushWindow: function(content, config, callback) {

        // save previous nav buttons and restore when doing a pop

        try {
            var win_id = config.win_id ? config.win_id : "";
        } catch (e) {
            win_id = "";
        }
        if (win_id && $('[--data-win-id="'+win_id+'"]').length) {
            return this.updateWindow(content, config, callback);
        }

        block_click = true;
        var target = $("#window_main");
        var title = "";
        if (!config) {
            config = {};
        }
        if (config.fullscreen) {
            var target = $("body");
        }

        try {
            var win = this.window_stack[this.window_stack.length-1]
            if (win !== undefined) {
                var prev_id = win.id;
                $("#"+prev_id).css("display", "none");
            }
        } catch(e) {
            console.log(e);
            // never mind
        }
        var id = "win__" + this.window_stack.length;
        //var left = $(window).width() * -1;
        var left = 0;
        this.z_count+= 1;
        var html = '<div id="'+id+'" --data-win-id="'+win_id+'" style="left:'+left+'px;z-index:'+this.z_count+';overflow:auto" class="window_wrap overthrow">';
        html+= '<div class="content_wrap" style="min-height:100%">'+content+'</div></div>';
        var that = this;
        target.append(html);
        //$("#"+id).css("height", $(window).height());
        if (config.hide_toolbar) {
            config.toolbar_content = "";
            this.hideToolbar();
        } else {
            this.showToolbar();
            config.toolbar_content = this.getToolbarContent();
        }
        if (config.show_back) {
            this.showBack();
        }
        //var settings = config.settings ? config.settings : {};
        this.update(id);
        config.nav_right = this.getNavRight();
        config.nav_left = this.getNavLeft();
        this.window_stack.push({id:id, settings:config, win_id:win_id});
        setTimeout(function() {
            //$("#"+id).animate({opacity:1}, 200, function() {
                block_click = false;
                if (callback) {
                    callback();
                }
            //});
            $(".content_wrap").css("height", $(".content_wrap").css("height"));
        }, 30);

        return id;
    },
    updateWindow: function(content, config, callback) {
        $('[--data-win-id="'+config.win_id+'"] .content_wrap').html(content);

    },
    getWindowSettings: function() {
        return this.window_stack[this.window_stack.length - 1].settings;
    },
    popWindow: function(callback) {
        if (appNav.window_stack.length <= 1) {
            return;
        }
        block_click = true;
        var obj = appNav.window_stack.pop();

        var id = obj.id;
        var that = appNav;
        that.title_stack.pop();
        setTimeout(function() {
            var title_obj = that.title_stack[that.title_stack.length - 1];
            that.title_stack.pop();
            var stack = that.window_stack[that.window_stack.length - 1];
            $("#"+stack.id).css("display", "block");
            that.setNavRight(stack.settings.nav_right);
            that.setNavLeft(stack.settings.nav_left);
            that.setToolbarContent(stack.settings.toolbar_content);
            if (stack.settings.hide_toolbar) {
                that.hideToolbar();
            } else if (!stack.settings.hide_toolbar) {
                that.showToolbar();
            }
            try {
                that.setTitle(title_obj.title, title_obj);
            } catch (e) {
                //pass
            }
            if (stack.settings.onFocusRestored) {
                stack.settings.onFocusRestored();
            }
            //$(".title_wrap").animate({opacity: 1}, 200);
            block_click = false;
        }, 20);

        //$(".title_wrap").animate({opacity: 0}, 200);
        block_touch_move = true;
        setTimeout(function() {
            //$("#"+id).animate({left: ($(window).width()*-1) + 'px'}, 300, function() {
            //$("#"+id).animate({opacity: 0}, 200, function() {
                $("#"+id).remove();
                if (callback) {
                    callback();
                }
                block_touch_move = false;
            //});
        }, 10);
    },
    showLoading: function(max_time, callback, message) {
        if (!max_time || max_time == 0) {
            max_time = 10000;
        }

        this.loading_timeout = 0;
        $("#loading_div").remove();
        if (!message) {
            message = "Loading..."
        }
        var html = $.loadUITemplate("loading_tpl", {message: message});
        $("body").append(html);
        $("#loading_div").show();
        setTimeout(function() {
            if (callback) {
                callback();
            }
        }, 200);
        this.loading_timeout = new Date().getTime() + max_time;
    },
    hideLoading: function() {
        setTimeout(function() {
            appNav.loading_timeout = 0;
            $("#loading_div").remove();
        }, 600);
    },
    closeDialog: function() {
        $("#dialog_div").remove();
    },
    showDialog: function(args) {
        this.closeDialog();
        var html = $.loadUITemplate("dialog_tpl", {
            dialog_text:args.message,
        });
        $("body").append(html);
        if (args.ok) {
            $("#dialog_ok_click").bind("click", args.ok);
            $("#dialog_ok_click").show();
        }
        if (args.cancel) {
            $("#dialog_cancel_click").bind("click", args.cancel);
            $("#dialog_cancel_click").show();
        }
        if (args.back) {
            $("#dialog_back_click").bind("click", args.back);
            $("#dialog_back_click").show();
        }
    },
    goBack: function() {
        analytics.add(analytics.TAPBACKBUTTON);
        if (appNav.window_stack.length == 1 && window.navigation) {
            return window.navigation.closeApp();
        }
        return appNav.popTemplate();
    },
    setAutoClearLoader: function() {
        var that = this;
        setInterval(function() {
            if (that.loading_timeout == 0) {
                return;
            }
            if (new Date().getTime() >= that.loading_timeout) {
                that.hideLoading();
                appNav.showDialog({
                    message: "A timeout occurred, please try again...",
                    back: function() {
                        appNav.closeDialog();
                    }
                });
            }
        }, 1000);
    },
    showToolbar: function(tpl_name, args) {
        if (tpl_name) {
            if (!args) {
                args = {};
            }
            var html = $.loadUITemplate(tpl_name, args);
            $("#toolbar_div").html(html);
        }
        this.hide_toolbar = false;
        //this.window_stack[this.window_stack.length].settings.hide_toolbar = false;
        $("#toolbar_div").css("display", "block");
        $("#toolbar_div").animate({bottom:"0px"}, 200, function() {

        });
    },

    hideToolbar: function() {
        this.hide_toolbar = true;
        //$("#toolbar_div").animate({bottom:"-65px"}, 200, function() {
            $("#toolbar_div").css("bottom", "-65px");
            $("#toolbar_div").css("display", "none");
        //});
        this.setBodyScroll();
    },
    getBodyHeight: function() {
        var height = $(window).height();
        if (this.show_navbar) {
            height = height - this.navbar_height;
        }
        if (!this.hide_toolbar) {
            height = height - this.toolbar_height;
        }
        return height;
    },
    setBodyScroll: function(id) {
        if (!id) {
            try {
                id = "#"+appNav.window_stack[appNav.window_stack.length-1].id;
            } catch (e) {
                return;
            }
        }
        $(id).css("height", (this.getBodyHeight() - 15)+'px');
        //setDroidButtons();
        //var scroller = new IScroll(id, {bounce:true, click:false, preventDefault: false});
    },
    init: function() {
        console.log("App Nav init");
        this.setAutoClearLoader();
        this.loadTemplates();
        this.loaded = true;

    }
}


//audioElement.setAttribute('autoplay', 'autoplay');



String.prototype.replaceAll = function (replaceThis, withThis) {
    var re = new RegExp(replaceThis,"g");
    return this.replace(re, withThis);
};

function mkSessURL() {
    // to be replaced by proper OTP
    return amplify.store("device_num") + "/" + interface_version;
}

function showCode(target_id, code, code_type, callback) {
    if (!code_type && code_type != 0) {
        code_type = 1;
    }
    var bw = new BWIPJS;
    bw.bitmap(new Bitmap);
    if (code_type == 0) {
        bw.scale(2,2);
    } else {
        bw.scale(3,3);
    }
    var elt = symdesc[code_type];
    var opts = {};
    opts.inkspread = bw.value(0);
    if (needyoffset[elt.sym] && !opts.textxalign && !opts.textyalign &&
            !opts.alttext && opts.textyoffset === undefined)
        opts.textyoffset = bw.value(-10);
    bw.push(code);
    bw.push(opts);

    bw.call(elt.sym);
    bw.bitmap().show(target_id, "N");
    if (callback) {
        callback();
    }
}



$.loadUITemplate = function(id, args) {
    //var html = $("#"+id).html().replaceAll("<!--","").replaceAll("-->", "");
    var html = appNav.tpls[id];
    if (args) {
        $.each(args, function(key, val) {
            html = html.replaceAll("{"+key+"}", val);
        });
    }
    return html;
}


function _loadClass(cls_id, cls) {
    if (cls.styles) {
        $("style[data-cls="+cls_id+"]").remove();
        var css_str = "<style data-cls=\""+cls_id+"\">\n";
        $.each(cls.styles, function(skey, s) {
            $.each(s, function(okey, c) {
                css_str+= okey + "{ ";
                $.each(c, function(prop, prop_val){
                    css_str+= prop + ":" + prop_val + ";\n";
                });
                css_str+= "}\n ";
            });

        });
        css_str+= "</style>\n";
        $(css_str).appendTo("head");
    }
    if (!cls.loaded) {
        cls.init();
    }
}


var init_list = [
    appNav,
    session,
    ui,
    audit
];

function init() {
    //window.addEventListener('load', function() {
    //    FastClick.attach(document.body);
    //}, false);
    document.body.style.webkitTouchCallout='none';
    document.body.style.KhtmlUserSelect='none';
    $.each(init_list, function(k, cls) {
        if (!cls.loaded) {
            cls.init();
        }
    });


    /*
    document.body.addEventListener("touchmove", function(e) {
        if (block_touch_move){
            e.preventDefault();
        }
    }, false);
    */
}

function getUnique() {
    return ++unique_count;
}


function isValidEmailAddress(emailAddress) {
    var pattern = new RegExp(/^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?$/i);
    return pattern.test(emailAddress);
}


function shuffle(array) {
  var currentIndex = array.length
    , temporaryValue
    , randomIndex
    ;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}


function dateStringToArray(dstring) { // input = 2013-12-25 23:56
    try {
        var dtime = dstring.split(" ");
        var date_parts = dtime[0].split("-");
        var time_parts = dtime[1].split(":");
        var result = [date_parts[0], date_parts[1], date_parts[2], time_parts[0], time_parts[1]];
    } catch (e) {
        var result = [];
    }
    return result;
}
function dateToArray(date_obj) {
    var year = date_obj.getFullYear();
    var month = ("0" + (date_obj.getMonth()+1)).slice(-2);
    var day = ("0" + date_obj.getDate()).slice(-2);
    var hours = ("0" + date_obj.getHours()).slice(-2);
    var minutes = ("0" + date_obj.getMinutes()).slice(-2);
    return [year, month, day, hours, minutes];
}
function dateInRange(target_array, from_array, to_array) {
    var ta = target_array;
    var f = from_array;
    var t = to_array;
    var target = '' + ta[0] + ta[1] + ta[2] + ta[3] + ta[4];
    var from = '' + f[0] + f[1] + f[2] + f[3] + f[4];
    var to = '' + t[0] + t[1] + t[2] + t[3] + t[4];
    if (target <= to && target >= from) {
        return true;
    } else {
        return false;
    }
}

function pushURL(url) {
    $("body").append('<iframe src="'+url+'" id="tmpframe"></iframe>');
    $("#tmpframe").remove();
}

$.fn.enterKey = function (fnc) {
    return this.each(function () {
        $(this).keypress(function (ev) {
            var keycode = (ev.keyCode ? ev.keyCode : ev.which);
            if (keycode == '13') {
                fnc.call(this, ev);
            }
        })
    })
}

$( window ).on( "orientationchange", function( event ) {
    console.log("orentation change");
});



var toImg = function toImg(target) {
    $("#canvas_frame").remove();
    var frame = $('<iframe src="about:blank" style="" id="canvas_frame"></iframe>');
    $("body").append(frame);

    setTimeout(function() {
        $('#canvas_frame').contents().find('body').append(target.html());
        setTimeout(function() {
            html2canvas($('#canvas_frame').contents().find('body')).then(
                function(canvas) {
                    document.body.appendChild(canvas);

                    var dataURL = canvas.toDataURL("image/png").split(",")[1];
                    if (window.slipPrinter) {
                        window.slipPrinter.startPrint(dataURL);
                    }
                }
            );
        }, 200);
    }, 150);

    /*
    tmpNode.style.overflow = 'visible';
    tmpNode.style.height = 'auto';
    tmpNodeContainer.style.transform = 'scale(0)';
    html2canvas(tmpNode).then(function (canvas) {
        document.body.removeChild(tmpNodeContainer);
        var img = document.createElement('img');
        var dataURL = canvas.toDataURL('image/png');
        img.src = dataURL;


        if (window.slipPrinter) {
            window.slipPrinter.startPrint(dataURL);
        }


        $("body").append(img);
    });
    */
};



