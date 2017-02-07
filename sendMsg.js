// sendMessage.js

var https = require("https");

module.exports = function(txtMessage, txtNumber, callback) {

	//	TODO: make this configurable, maybe by having module.exports 
	//	function take Burner ID/token info and return a function based on that...
	var options = JSON.parse(
					Buffer.from(
						'eyJtZXRob2QiOiJQT1NUIiwiaG9zdG5hbWUiOiJhcGkuYnVybmVyYXBwLmNvbSIs' + 
						'InBvcnQiOm51bGwsInBhdGgiOiIvd2ViaG9va3MvYnVybmVyL2IwNjU1M2NjLTc2' +
						'MzAtNDA2MS05ZDc1LThlMjU4YTc0MTgyMj90b2tlbj1BOTBDNEMzRS1ENzUwLTRE' +
						'NTgtQUZGNC1FQTY4MDYzNDc1RTgiLCJoZWFkZXJzIjp7ImNvbnRlbnQtdHlwZSI6' +
						'ImFwcGxpY2F0aW9uL2pzb24iLCJjYWNoZS1jb250cm9sIjoibm8tY2FjaGUifX0=' ,
						'base64'
					)
				);

	var req = https.request(options, function (res) {
		var statusCode = res.statusCode;
		var errorObj;
		var chunks = [];

		res.on("data", chunks.push);

		res.on("end", () => {
			try {
				var response = JSON.parse(Buffer.concat(chunks));
				if(!response.success)	//	if response indicates failure
					return callback(response);	//	return response as error
				
				return callback(null, response);	//	otherwise return response as success indicator
			}
			catch (ex) {
				return callback(ex);
			}
		});
	}).on("error", (err) => {
		debug(`Error occurred in sendMsg.js: ${err.message}. POST to Burner outgoing text webhook failed`);
		return callback(err);
	});

	req.write(JSON.stringify({
		intent : 'message',
		data : {
			toNumber	: txtNumber,
			text		: txtMessage
		}
	}));
	
	req.end();
}