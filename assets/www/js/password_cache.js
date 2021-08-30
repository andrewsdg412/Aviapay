/*
	Successful passwords get stored in a password cache,
	As seeded SHA1, this is very secure on the device, but allows off-line
	verification if the crew members details have been cached.
 */

var PasswordCache = {
	savePassword(username, password) {
		var seed = Math.random().toString() + Date.now().toString();
		var hash = hex_sha1(password + seed).toLowerCase();
		amplify.store('password_cache_' + username, {
			'hash': hash,
			'seed': seed
		});
	},
	validate: function(username, password) {
		hash_data = amplify.store('password_cache_' + username);
		if (hash_data) {
			if (hex_sha1(password + hash_data.seed) == hash_data.hash) {
				return true;
			}
		}
		return false;
	}
}
