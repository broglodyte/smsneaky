
require('dotenv').config();

var fs = require('fs');
var path = require('path');
var moment = require('moment-timezone');

var express = require('express');
var bodyParser = require('body-parser');
var jsonParser = bodyParser.json();
var app = express();

var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;

var db;


MongoClient.connect(process.env.MONGODB_URI, function (err, database) {
  if (err) {
    console.log(err);
    process.exit(1);
  }

  // Save database object from the callback for reuse.
  db = database;
  console.log("Database connection ready");

  // Initialize the app.
  var server = app.listen(process.env.PORT || 8080, function () {
    var port = server.address().port;
    console.log(`App now running on port [${port}]`);
  });
});

app.get('/', (req, res) => {
	res.redirect(301, '/readMsg');
});

app.get('/readMsg', (req, res) => {
	fs.readFile('readMessages.html', 'utf8', (err, data) => {
		if (err)
			res.status(500).send(`Unable to load page: ${err.message}\n\n${err.stack}`);
			
		res.send(data);
	});	
});

app.get('/inbox', function (req, res) {
	db.collection('inbox').find({}).toArray((err, items) => {
		if (err)
			return handleResponse(500, err, res);
		
		return handleResponse(200, items, res);
	});
});

app.get('/inbox/from/:number', function(req, res) {
	db.collection('inbox').find(
		{'fromNumber': req.params.number}, 
		{'fromNumber': 1, 'payload': 1, 'timestamp': 1, 'dateTime': 1})
	.toArray( (err, items) => {
		if (err)
			return handleResponse(500, err, res);

		return handleResponse(200, items, res);
	});
});


/* --JSON data formats-- /*

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
"dateTime"   : "[formatted date and time, calculated from 'timestamp']"
}

 */

 
app.post('/incoming', jsonParser, (req, res) => {
	if (!req.body || !req.body.type)
		return handleResponse(415, new Error('Invalid JSON request body'), res);

	var pktCollectionResult;
	var inboxCollectionResult;
	
	db.collection('rawPackets').insertOne(req.body, (err, r) => {
		if(err || r.insertedCount !== 1)
			console.log('Error inserting data into [rawPackets]');
		else
			console.log('Inserted into [rawPackets]');
	});
		
	getBlobFromJSON(req.body, (err, msgBlob) => {
		if(err)
			return handleResponse(500, err, res);

		db.collection('inbox').insertOne(msgBlob, (err, r) => {
			if (err || r.insertedCount !== 1)
				return handleResponse(500, err || new Error(`[insertedCount (${r.insertedCount}) not equal to 1]`), res);

			return handleResponse(201, r.insertedId, res);
		});
	});
});
	

app.put('/contacts/:number', (req, res) => {
	var contactObj = {
		name	: req.body.name,
		number	: req.params.number
	};
	
	db.collection('contacts').insertOne(contactObj, (err, r) => {
		if(err)
			return handleResponse(500, err, res);
		
		return handleResponse(201, r.insertedId, res);
	});
});

function getBlobFromJSON(jsonTxt, callback) {
	var timestamp = Date.now();
	var fmtDateTime = moment(timestamp).tz("America/Winnipeg").format("ddd, MMM Do YYYY - hh:mm:ss.SSS A [[]Z[]]");
		
	var returnBlob = {
		sender		: jsonTxt.fromNumber.replace(/\D/g, ''),
		type		: jsonTxt.type,
		data		: jsonTxt.payload,
		timestamp	: timestamp,
		datetime	: fmtDateTime
	};
	
	switch (jsonTxt.type) {
		case "voiceMail":
		case "inboundMedia":
			var payloadURL = jsonTxt.payload;
			http.get(payloadURL, (res) => {
				var fileData = [];
				res.setEncoding('binary');
				
				res.on('data', (chunk) => {
					fileData.push(chunk);
				});
				
				res.on('end', () => {
					console.log(`Downloaded file [${payloadURL}] (${fileData.length} bytes)`);	
					
					var binData = Buffer.concat(fileData);
					var binData_Base64Str = binData.toString('base64');
					returnBlob.payload = binData_Base64Str;
					returnBlob.payloadSource = payloadURL;
				
					return callback(undefined, returnBlob);
				});
				
				res.on('error', (err) => {
					return callback(err);
				});
				
			});
			break;
		
		case "inboundText":
			return callback(undefined, returnBlob);
			
		default:
			return callback(new Error(`Invalid message type [${jsonTxt.type}]`));
	}
}

function handleResponse(_code, _data, _response) {
	var resBlob = {
		status: _code > 299 ? 'failure' : 'success',
		result: _data
	};
	
	_response.status(_code).json(resBlob);
}
