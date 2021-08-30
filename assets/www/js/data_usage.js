var DataUsageTracker = {

    newCounterStruct: function(total_mobile, total_device){
        return {
            'last_mobile_counter': total_mobile,
            'last_total_counter': total_device,
            'mobile_final_usage': 0,
            'device_final_usage': 0,
            'start': new Date().toISOString(),
            'end': new Date().toISOString()
        }
    },

    refreshCounters: function(device_id) {
        if (window.dataUsageReader !== undefined) {
            var total_mobile = window.dataUsageReader.getCombinedMobileTotalUsage();
            var total_device = window.dataUsageReader.getCombinedTotalUsage();

            DataUsageTracker.updateCounters(total_mobile, total_device);
        }

        var last_sync = DataUsageTracker.getLastSyncTimestamp();
        if (last_sync == undefined || moment().diff(last_sync, 'hours') >= 1) {  // Push stats every 1 hours.
            DataUsageTracker.syncDataCounters(device_id);
        }
    },

    finishBucket: function(counter, total_mobile, total_device) {
        return counter;
    },

    incrementBucket: function(counter, total_mobile, total_device) {
        counter.mobile_final_usage += total_mobile - counter.last_mobile_counter;
        counter.device_final_usage += total_device - counter.last_total_counter;
        counter.end = new Date().toISOString();
        counter.last_mobile_counter = total_mobile;
        counter.last_total_counter = total_device;
        return counter;
    },

    updateCounters: function(total_mobile, total_device) {
        var data_counters = amplify.store('data_counters');

        if (!data_counters) {
            data_counters = [];
        }

        if (data_counters.length > 0) {
            // get last counter.
            var last_counter = data_counters.pop();

            // Reboot occured start new counters.
            if (last_counter.last_total_counter > total_device) {
                last_counter.end = new Date().toISOString();
                // TEST FIX 13/3/2018 JW: if reboot occured I suspect the counter that returns is really big.
                // therefore we just start measuring a new instead.
                /* data_counters.push(last_counter); */
                data_counters.push(DataUsageTracker.newCounterStruct(total_mobile, total_device));
            } else { // Normal Operation
                // Increment current bucket as necessary.
                last_counter = DataUsageTracker.incrementBucket(last_counter, total_mobile, total_device);
                if (moment().diff(last_counter.start, 'hours') >= 1) { // new bucket required.
                    data_counters.push(last_counter);
                    // Start a new bucket.
                    data_counters.push(DataUsageTracker.newCounterStruct(total_mobile, total_device));
                } else {  // update current bucket only.
                    data_counters.push(last_counter);
                }
            }
        } else {
            // push latest stats in.
            var first_data_counter = DataUsageTracker.newCounterStruct(total_mobile, total_device);
            data_counters.push(first_data_counter);
        }

        // persist.
        amplify.store('data_counters', data_counters);
    },

    getLastSyncTimestamp: function() {
        return amplify.store('last_data_usage_sync');
    },

    setLastSyncTimestamp: function() {
        amplify.store('last_data_usage_sync', new Date().toISOString())
    },

    syncDataCounters: function(device_id) {
        var last_sync_ts = DataUsageTracker.getLastSyncTimestamp();
        var data_counters = amplify.store('data_counters');
        data_counters = (data_counters == undefined) ? []: data_counters;
        var sync_list = [];
        var last_counter = data_counters.pop(); // don't sync current counter.

        // Only sync new data.
        if (last_sync_ts) {
            $.each(data_counters, function(idx, counter) {
                console.log(counter.start)
                if (moment(counter.start).isAfter(last_sync_ts)) {
                    sync_list.push(counter);
                }
            });
        } else { // sync all data counters.
            sync_list = data_counters;
        }

        if (sync_list.length == 0) {
            return;
        }
        if (sync_list) {
            DataUsageTracker.postCounters(device_id, sync_list, function(json) {
                // If successful only last metric is in data counters.
                if (json.success) {
                    amplify.store('data_counters', [last_counter]);
                    DataUsageTracker.setLastSyncTimestamp();
                }
            });
        }
    },

    postCounters: function(device_id, data_counters, success_callback) { // post current shift.
        var args = {
            'device_serial': device_id,
            'metric_name': 'data_usage',
            'breakdown': 'hourly',
            'rows': data_counters
        };

        $.post(window.base_url + "sync_metrics/", JSON.stringify(args),
            function(json) {
                if (success_callback) {
                    success_callback(json);
                }
            }
        );
    }

}
