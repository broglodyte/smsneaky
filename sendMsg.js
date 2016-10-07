// sendMessage.js

var http = require("https");

var options = {
	"method" : "POST",
	"hostname" : "api.burnerapp.com",
	"port" : null,
	"path" : "/webhooks/burner/b06553cc-7630-4061-9d75-8e258a741822?token=A90C4C3E-D750-4D58-AFF4-EA68063475E8",
	"headers" : {
		"content-type" : "application/json",
		"cache-control" : "no-cache"
	}
};

var req = http.request(options, function (res) {
		var chunks = [];

		res.on("data", function (chunk) {
			chunks.push(chunk);
		});

		res.on("end", function () {
			var body = Buffer.concat(chunks);
			console.log(body.toString());
		});
	});

req.write(JSON.stringify({
		intent : 'message',
		data : {
			toNumber : '+19182827760',
			text : 'Have you talked to Syd lately? any news on her situation? (this is brian, use this # from now on instead of the -7103 one)'
		}
	}));
req.end();
