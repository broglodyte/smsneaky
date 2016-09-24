
require('dotenv').config();
var util = require('util');
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

app.get('/inbox', (req, res) => {
	db.collection('inbox')
		.find({})
		.sort({"timestamp" : -1})
		.toArray((err, items) => {
			if (err)
				return handleResponse(500, err, res);
			
			return handleResponse(200, items, res);
		}
	);
});

app.get('/inbox/from/:number', (req, res) => {
	db.collection('inbox')
		.find({'fromNumber': req.params.number})
		.sort({"timestamp" : -1})
		.toArray( (err, items) => {
		if (err)
			return handleResponse(500, err, res);

		return handleResponse(200, items, res);
	});
});


 
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
			if (err)
				return handleResponse(500, err, res);

			return handleResponse(201, r, res);
		});
	});
});

//	Create new contact entry:
app.post('/contacts', jsonParser, (req, res) => {
	if (!req.body)
		return handleResponse(415, new Error('Invalid JSON body'), res);

	try {
		var contactObj = {
			fullName: req.body.fullName,
			name	: req.body.name.replace(/\W/g, '').toLowerCase(),	//	filter out anything but [a-z,0-9,_]
			number	: req.body.number.replace(/\D/g, ''),				//	filter out non-digit chars
		};
		
		if(!contactObj.number || contactObj.number.replace(/\D/g, '') === '')
			return handleResponse(400, new Error("Required attribute 'number' missing or invalid"), res);
		
		if(!contactObj.name || !contactObj.name.replace(/W/g, '') === '')
			return handleResponse(400, new Error("Required attribute 'name' missing or invalid"), res);
		
		if(!contactObj.fullName || contactObj.fullName.trim() === '')
			contactObj.fullName = contactObj.name;
		
		db.collection('contacts').insertOne(contactObj, (err, r) => {
			if(err)
				return handleResponse(500, err, res);
		});
	}
	catch (err) {
		return handleResponse(500, err, res);
	}
	
});

//	Update existing contact entry:
app.put('/contacts/number/:number', jsonParser, (req, res) => {
	if (!req.body)
		return handleResponse(415, new Error('Invalid JSON body'), res);

	try {
		var contactObj = {
			fullName: req.body.fullName,
			name	: req.body.name.replace(/\W/g, '').toLowerCase()
//			,number	: req.params.number
		};
		
		db.collection('contacts').updateOne(
			{number:	req.params.number},									//	filter object
			{$set: {
					fullName:	req.body.fullName.trim() || req.body.name,		//	update fields
					name:		req.body.name.replace(/\W/g, '').toLowerCase()
				}
			},
			{upsert: false},
			(err, r) => {
				if(err)
					return handleResponse(418, err, res);
				
				res.status(204).location(`/contacts/number/${req.params.number}`).end();				
			});
				
			if(err)
				return handleResponse(500, err, res);
			
			return handleResponse(201, r.insertedId, res);
		});
	}
	catch (err) {
		return handleResponse(500, err, res);
	}
});

//	List all contacts information:
app.get('/contacts', (req, res) => {
	db.collection('contacts')
		.find({})
		.sort({'number': 1})
		.toArray((err, contactList) => {
			if(err)
				return handleResponse(500, err, res);
			
			handleResponse(200, contactList, res);
		});
});

//	Lookup specific contact information:
app.get('/contacts/:lookupField/:lookupData', (req, res) => {
	var lookupField = req.params['lookupField'].toLowerCase();
	var lookupData = req.params['lookupData'].replace(/\W/g, '').toLowerCase();
	
	switch(lookupField) {
		case 'name': 
		case 'number':
			var findObject={};
			findObject[lookupField] = lookupData;
			var projObject={};
			projObject[lookupField] = 0;

			db.collection('contacts').findOne(findObject, (err, contactData) => {
				if(err)
					return handleResponse(500, err, res);
				
				if(!contactData)
					return handleResponse(404, new Error('Contact information not found'), res);
				
				handleResponse(200, contactData, res);				
			});
			break;
			
		default:
			return handleResponse(400, new Error('Invalid lookup field [${lookupField}]'), res);
	}
});

app.delete('/contacts/:number', (req, res) => {
	var delNumber = req.params.number;
	
	db.collection('contacts').deleteOne({number: delNumber}, (err, r) => {
		
		//	CONTINUE HERE
		
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
					
					try {
						var binData = Buffer.concat(fileData);
						var binData_Base64Str = binData.toString('base64');
						returnBlob.payload = binData_Base64Str;
						returnBlob.payloadSource = payloadURL;
					
						return callback(undefined, returnBlob);
					}
					catch(err) {
						return callback(err);
					}
				});
				
				res.on('error', (err) => {
					return callback(err);
				});
				
			}).on('error', (err) => {
					return callback(err);				
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
