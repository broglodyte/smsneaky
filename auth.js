//auth.js

const getHashFn = require('crypto').createHash;	//.bind(undefined, 'sha1');

module.exports = function(db) {
	
	var authFn = function(req, res, next) {
		
		var authKeyHeader = req.get("Authorization");
		
		if(authKeyHeader && authKeyHeader.startsWith('Basic '))
		{
			var base64_authKey = authKeyHeader.replace(/^Basic\s+/, '');
			var authKey_pair = new Buffer(base64_authKey, 'base64').toString();
			var userPassArray = authKey_pair.split(':', 2);
			var username = userPassArray[0];
			var sha1 = getHashFn('sha1'); //crypto.createHash('sha1');
			var passDigest = sha1.update(userPassArray[1]).update(':bitches').digest('base64');
//			var passDigest = sha1.digest('base64');
			
			db.collection('auth_users')
				.findOne(
				{
					user: username,
					pass: passDigest
				},
				(err, userObj) => {
					if(err)
						return accessDenied(err);
					
					if(!userObj)
						return accessDenied(`Data pair username:password=[${username}:${password}] not found`);
					
					accessGranted(generateAuthToken(username, passDigest));
					next();
				});
		}
		
		function accessDenied(_err) {
			console.log('Access denied!')
			res.status(403).json(_err)
		}
		
		function accessGranted(_authToken) {			
			res.cookie('auth_token', _authToken, {maxAge: 8640000});
		}
		
		function generateAuthToken(_user, _hash) {
			var timestamp = `${_user}_${_hash}_${Date.now().toString(16)}`;
			var authToken = getHashFn('sha512').update(timeStamp).digest(''
		}
	}
	
	
	return authFn;
};