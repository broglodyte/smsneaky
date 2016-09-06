var fs = require('fs');
var path = require('path');
var express = require('express');
var bodyParser = require('body-parser');
	var app = express();
var jsonParser = bodyParser.json();
app.set('port', (process.env.PORT || 5000));
var filename = 'texts.txt';
var utf8 = 'utf8';
app.set('filename', filename);
app.use(express.static(__dirname + '/public'));

// views is directory for all template files
// app.set('views', __dirname + '/views');
// app.set('view engine', 'ejs');

app.get('/inbox', function (request, response) {
	fs.readFile(filename, utf8, (err, data) => {
		if (err)
			return response.status(500).json({
				error : `Error reading file: ${err}`
			});

		try {
			var jsonData = JSON.parse(data);
			response.json(jsonData);
		} 
		catch (err) {
			response.status(500).json({
				error : `Unknown error: ${err}`
			});
		}
	});
});

/*

Incoming JSON blobs should be all like:
[for now we only care about 'type', 'payload', 'fromNumber', and 'toNumber']	{
"type" : "inboundText",
"payload" : "You are now reading a text message from [xyz]",
"fromNumber" : "+19185559876",
"toNumber" : "+19182152005",
"burnerId" : "b06553cc-7630-4061-9d75-8e258a741822",
"userId" : "0a3d6fb2-9af9-11e4-a7c4-73252e699852-6a68e080"
}


Storage file should be all like:	{
"+[recipientNumber]": [ {msgBlob1}, {msgBlob2}, {...etc...} ],
"+1234567890": [ {another list of msgBlobs} ]
}

msgBlobs should be like so:	{
"fromNumber" : "[whoever sent the text]",
"payload"    : "[whatever the text said]"
"timestamp"  : "[whatever the date/time of arrival is]",
}

 */
app.post('/incoming', jsonParser, (req, resp) => {
		if (!req.body || !req.body.type)
			return resp.status(400).json({error: `error: invalid data`});

		// var msgType = req.body.type;

		if (req.body.type === 'inboundText') {
			var msgRecipient = req.body.toNumber;
			var msgBlob = getBlobFromJSON(req.body);

			fs.readFile(filename, utf8, (err, data) => {
				if(err) 
					return resp.status(500).json({
						error : `Error reading database : ${err}`
					})
				var jsonDB = JSON.parse(data);
				
				if(!jsonDB[msgRecipient])
					jsonDB[msgRecipient] = [];
				
				jsonDB[msgRecipient].push(msgBlob);

				fs.writeFile(filename, JSON.stringify(jsonDB, null, 4), utf8, (err) => {
					if (err)
						return resp.status(500).json({
							error :  `Error writing file : ${err}`
						});

					resp.status(201).json({
						error : undefined,
						status : "success"
					});
				});
			});
		} else {
			return resp.status(401).json({error: `error: invalid data`});
		}

	});

app.listen(app.get('port'), function () {
	console.log('Node app is running on port', app.get('port'));
});

function getBlobFromJSON(jsonTxt) {
	return {
		fromNumber : jsonTxt.fromNumber,
		payload : jsonTxt.payload,
		timestamp : Date.now()
	}
}
