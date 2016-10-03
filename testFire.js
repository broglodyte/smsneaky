var https = require('https');

var message = "Bro where's my shit bro";
// var message = "Test";
var toNumber = "19188521049";
// var toNumber = "19186137103";

var data = `{"intent": "message","data":{"toNumber": "+${toNumber}","text": "${message}"}}`;
// console.log(data);
var url = "https://api.burnerapp.com/webhooks/burner/b06553cc-7630-4061-9d75-8e258a741822?token=d1b97152-eeab-1f04-df8d-af2e146096dd"
         //

var reqOptions = {
  protocol: 'https:',
  hostname: 'api.burnerapp.com',
  port: 443,
  path: '/webhooks/burner/b06553cc-7630-4061-9d75-8e258a741822?token=d1b97152-eeab-1f04-df8d-af2e146096dd',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

var intervalTime = setInterval(function () {
	var req = https.request(reqOptions, (res) => {
			console.log(`STATUS: ${res.statusCode}`);
			// if(res.statusCode !== 200)
			// console.log(`DATA: ${res.)
			// console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
			res.setEncoding('utf8');
			res.on('data', (chunk) => {
				console.log(`BODY: ${chunk}`);
			});
			res.on('end', () => {
				// console.log('No more data in response.');
			});
		});

	req.on('error', (e) => {
		console.log(`problem with request: ${e.message}`);
	});

	// write data to request body
	req.write(data);
	req.end();
}, 16000);