
var blacklistManager = {
    add: function(hash) {
        if (window.blacklistStore !== undefined) {
            window.blacklistStore.addEntry(hash);
        }
    },

    delete: function(hash) {
        if (window.blacklistStore !== undefined) {
            window.blacklistStore.deleteEntry(hash);
        }
    },

    addNumber: function(number) {  // needs to be hashed before.
        var hash = sha256(number);
        this.add(hash);
    },

    exists: function(hash) {
        if (window.blacklistStore !== undefined) {
            return window.blacklistStore.entryExists(hash);
        } else {
            return false;
        }
    },

    checkNumberExists: function(number) {
        var hash = sha256(number);
        return this.exists(hash);
    },

    getLastSyncTimestamp: function() {
        return amplify.store('last_blacklist_sync');
    },

    setLastSyncTimestamp: function() {
        amplify.store('last_blacklist_sync', new Date().toISOString())
    },

    loopSyncEntries: function(entries) { // loop over returned entries and delete / add as necessary.
        var _this = this;
        $.each(entries, function(index, entry) {
            if (entry.deleted) {
                console.log('deleting: ' + entry.hash);
                _this.delete(entry.hash);
            } else {
                console.log('adding: ' + entry.hash);
                _this.add(entry.hash);
            }
        });
    },

    syncEntries: function() {
        var _this = this;
        var timestamp = this.getLastSyncTimestamp();
        if (!timestamp) {
            timestamp = '';
        }
        var args = {
            'timestamp': timestamp
        }

        $.get(window.base_url + "get_blacklist/" + mkSessURL(), args,
            function(json) {
                _this.setLastSyncTimestamp();
                _this.loopSyncEntries(json.entries);
            }
        );
    },

};


var binRangeBlacklistManager = {
    updateBinRangeBlacklist: function(binranges) {
        amplify.store('bin_range_blacklist', binranges)
    },

    checkBinRangeValid: function(card_num) {
        var bin_ranges = amplify.store('bin_range_blacklist');
        if (!bin_ranges) {
            bin_ranges = [];
        }
        var cc_num = card_num.trim();

        var failed = false;
        var description = "";
        $.each(bin_ranges, function(idx, binrange_info) {
            description = binrange_info.description;
            $.each(binrange_info.bin_ranges, function(idx, binrange) {
                var binlen = binrange.length;
                if (
                    cc_num.length >= binlen &&
                    cc_num.slice(0, binlen) == binrange
                ) {
                    failed = true;
                    return false;
                }
            })
            if (failed) {
                return false;
            }
        })
        if (failed) {
            return [false, description]
        }
        return [true, ""];
    }
}
