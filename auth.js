var authModule = require('http-auth');

var basicAuth = authModule.basic(
	{
		realm: "Inbox",
		file:  __dirname + "/users.htaccess"
	}
);
basicAuth.on('success', function(result, req) {
  console.log("User authenticated: " + result.user);
});
basicAuth.on('fail', function(result, req) {
  console.log("User authentication failed: " + result.user);
});
basicAuth.on('error', function(error, req) {
  console.log("Authentication error: " + error.code + " - " + error.message);
});

module.exports = authModule;
module.exports.basic = basicAuth;
