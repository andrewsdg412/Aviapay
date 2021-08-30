
var ShiftManager = {
    _key: 'shifts_',

    getCurrentShift: function() {
        return amplify.store(this._key + 'current_shift');
    },

    generateShiftID: function() {
        // generate 24 character Shift ID.
        return Date.now().toString() + Math.random().toString().replace('.', '').slice(7);
    },

    getCurrentShiftID: function() {
        return this.getCurrentShift().id
    },

    startShift: function(crew, flight_number) {
        var flight_numbers = (flight_number) ? [flight_number] : [];
        var shift = {
            id: this.generateShiftID(),
            crew: crew,
            flight_number: flight_number, // current flight number.
            flight_numbers: flight_numbers,
            shift_start: new Date().toISOString(),
            shift_end: null,
            device_serial: ui.getAndroidDeviceID(),
            banking_reference: ''
        };
        amplify.store(this._key + 'current_shift', shift);
        this.postShifts(shift);
        return
    },

    setFlightNumber: function(flight_number) { // Set flight on the current shift.
        var shift = this.getCurrentShift();
        shift.flight_number = flight_number;
        if (!shift.flight_numbers) {
            shift.flight_numbers = [];
        }
        if (flight_number && !(shift.flight_numbers.indexOf(flight_number) > -1)) {
            shift.flight_numbers.push(flight_number);
        }
        amplify.store(this._key + 'current_shift', shift);
    },

    setBankingReference: function(ref, shift_id) {
        var shift_history = this.getShiftHistory();
        var shift = null;
        $.each(shift_history, function(index, s) {
            shift_id
            if (s.id == shift_id) {
                shift = s;
                s.synced = false;
                s.banking_reference = ref;
                shift_history[index] = s;
                return false; // break
            }
        })
        amplify.store(this._key + 'shift_history', shift_history)
    },

    endShift: function() {
        var shift = this.getCurrentShift();
        shift.shift_end = new Date().toISOString();
        amplify.store(this._key + 'current_shift', shift);
        this.clearCurrentShift(false);
    },

	postShifts: function(shift, success_callback) { // post current shift.
		var shifts = [];
		if (shift == undefined) {
			shifts = [this.getCurrentShift()];
		} else if (Array.isArray(shift)) {
			shifts = shift;
		} else if (typeof(ShiftManager.getCurrentShift()) == "object") {
            shifts = [shift];
        }
		if (shifts) {
			args = {
				'shifts': shifts
			}
			$.post(window.base_url + "sync_shifts/" + mkSessURL(), JSON.stringify(args),
				function(json) {
					if (success_callback) {
						success_callback(json);
					}
				}
			);
		}
	},

    syncCurrentShift: function() {
        var shift = ShiftManager.getCurrentShift();
        if (shift) {
            ShiftManager.postShifts(shift);
        }
    },

    syncShiftHistory: function() {
        // get all shifts that have not been synced yet, and save them.
        var _this = this;
        var shift_history = this.getShiftHistory();
        if (shift_history == undefined) {
            shift_history = [];
        }
        var shifts_to_sync = [];
        var idx_to_sync = [];

        $.each(shift_history, function(index, shift) {
            if (shift.synced == false) {
                shifts_to_sync.push(shift);
                idx_to_sync.push(index);
            }
        })
        if (shifts_to_sync.length > 0) {
            this.postShifts(shifts_to_sync, function() {
                idx_to_sync.forEach(function(i) {
                    shift_history[i].synced = true;
                });
                amplify.store(_this._key + 'shift_history', shift_history);
            });
        }
    },

    saveShiftToHistory: function() {
        var shift = this.getCurrentShift();
        if (shift) {
            var shift_history = amplify.store(this._key + 'shift_history');
            if (!shift_history) {
                shift_history = [];
            }
            shift.synced = false;
            shift_history.push(shift);
            amplify.store(this._key + 'shift_history', shift_history);
        }
    },

    getShiftHistory: function() {
        return amplify.store(this._key + 'shift_history');
    },

    clearCurrentShift: function(doSync) {
        this.saveShiftToHistory();
        amplify.store(this._key + 'current_shift', null);
        if (doSync == true) {
            this.syncShiftHistory();
        }
    },

    clearOldShifts: function(cut_off_days) {
        var _this = this;
        var shift_history = this.getShiftHistory();
        if (shift_history) {
            var new_shift_history = [];
            var now_ts = new Date().getTime();
            $.each(shift_history, function(idx, shift) {
                var shift_start_ts = new Date(shift.shift_start).getTime();
                var timeDiff = now_ts - shift_start_ts;
                var timeDiffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
                if (timeDiffDays < cut_off_days) {
                    new_shift_history.push(shift);
                }
            });
            amplify.store(_this._key + 'shift_history', new_shift_history);
         }
    }
};
