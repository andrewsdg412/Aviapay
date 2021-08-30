navigator.getBattery().then(function(battery) {
  function updateAllBatteryInfo(){
    updateLevelInfo();
  }
  updateAllBatteryInfo();

  battery.addEventListener('chargingchange', function(){
    updateChargeInfo();
  });
  function updateChargeInfo(){
    console.log("Battery charging? "
                + (battery.charging ? "Yes" : "No"));
    amplify.store('on_charge', battery.charging);
  }

  battery.addEventListener('levelchange', function(){
    updateLevelInfo();
  });

  function updateLevelInfo(){
    console.log("Battery level: "
                + battery.level * 100 + "%");
    amplify.store('battery_level', battery.level * 100);
  }

});


var BatteryLevelTracker = {

    newCounterStruct: function(level){
        return {
            'battery_level_percentage': level,
            'start': new Date().toISOString(),
            'end': new Date().toISOString()
        }
    },

    refreshCounters: function(device_id) {
        var level =  amplify.store('battery_level');

        BatteryLevelTracker.updateCounters(level);

        var last_sync = BatteryLevelTracker.getLastSyncTimestamp();
        if (last_sync == undefined || moment().diff(last_sync, 'hours') >= 1) {  // Push stats every 1 hours.
            BatteryLevelTracker.syncDataCounters(device_id);
        }
    },

   updateCounters: function(level) {
        var level_counters = amplify.store('battery_level_counters');

        if (!level_counters) {
            level_counters = [];
            var first_data_counter = BatteryLevelTracker.newCounterStruct(level);
            level_counters.push(first_data_counter);
        } else {

            // get last counter.
            var last_counter = level_counters.pop();

            // Battery level did not change since last time, just update end.
            last_counter.end = new Date().toISOString();
            level_counters.push(last_counter);

            // Battery level changed, so start a new counter.
            if (last_counter.battery_level_percentage != level) {
                var first_data_counter = BatteryLevelTracker.newCounterStruct(level);
                level_counters.push(first_data_counter);
            }
        }
        // persist.
        amplify.store('battery_level_counters', level_counters);
    },

    getLastSyncTimestamp: function() {
        return amplify.store('last_battery_level_sync');
    },

    setLastSyncTimestamp: function() {
        amplify.store('last_battery_level_sync', new Date().toISOString())
    },

    syncDataCounters: function(device_id) {
        var last_sync_ts = BatteryLevelTracker.getLastSyncTimestamp();
        var level_counters = amplify.store('battery_level_counters');
        level_counters = (level_counters == undefined) ? []: level_counters;
        var last_counter = level_counters.pop(); // don't sync current counter.
        var sync_list = level_counters;

        /*
         // Only sync new data.
        if (last_sync_ts) {
            $.each(level_counters, function(idx, counter) {
                console.log(counter.start)
                if (moment(counter.start).isAfter(last_sync_ts)) {
                    sync_list.push(counter);
                }
            });
        } else { // sync all data counters.
            sync_list = level_counters;
        }
        */

        if (sync_list.length == 0) {
            return;
        }
        if (sync_list) {
            BatteryLevelTracker.postCounters(device_id, sync_list, function(json) {
                // If successful only last metric is in data counters.
                if (json.success) {
                    amplify.store('battery_level_counters', [last_counter]);
                    BatteryLevelTracker.setLastSyncTimestamp();
                }
            });
        }
    },

    postCounters: function(device_id, level_counters, success_callback) { // post current shift.
        var args = {
            'device_serial': device_id,
            'metric_name': 'battery_level',
            'breakdown': 'delta',
            'rows': level_counters
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
