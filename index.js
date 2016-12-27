var https = require('https');

const routeMessages = true;
const routeContacts = true;

require('dotenv').config();
var util = require('util');
var fs = require('fs');
var path = require('path');
var moment = require('moment-timezone');
const crypto = require('crypto');

var express = require('express');
var auth = require('./auth');
var jsonParser = require('body-parser').json();

var SparkPost = require('sparkpost');
// console.log("API Key: " + process.env.SPARKPOST_API_KEY);
var sparky = new SparkPost(process.env.SPARKPOST_API_KEY);
// var sneakyDB = require('./sneakydb');

var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;

var db;

var app = express();
app.set('json spaces', 2);

var alertNewMessages = null;

// sneakyDB.Init(main);

function main(err, db) {
	if (err) {
		console.log(err);
		process.exit(1);
	}
	
}
MongoClient.connect(process.env.MONGODB_URI, (err, database) => {
	if (err) {
		console.log(err);
		process.exit(1);
	}

	// Save database object from the callback for reuse.
	app.locals.db = db = database;
	console.log("Database connection ready");

	app.use(/^\/(inbox|contacts).*$/, auth);
	
	app.use(express.static('public'));
	
	app.get('/readMsg', (req, res) => {
		fs.readFile('readMessages.html', 'utf8', (err, data) => {
			if (err)
				res.status(500).send(err);

			res.send(data);
		});
	});

	/* /// INBOX REQUESTS /// */
	if(routeMessages) {
		app.get('/', (req, res) => {
			res.redirect(301, '/inbox');
		});

		//	Get all messages
		app.get('/inbox',  (req, res) => {
			console.log('/inbox');
			db.collection('inbox')
				.find({})
				.map(mapMsg)
				.sort({"timestamp" : -1})
				.toArray((err, items) => {
					if (err)
						return res.status(500).json(err);
					
					

					return res.json(items);
				}
			);
		});

		//	Get all senders
		app.get('/inbox/from',  (req, res) => {
			console.log('/inbox/from');
			db.collection('inbox')
				.distinct("sender", (err, data) => {
					if(err)
						return res.status(500).json(err);
					else
						return res.status(200).json(data);
				});
		});

		//	Get all messages from :number
		app.get('/inbox/from/:number',  (req, res) => {
			console.log('/inbox/from/:number');
			db.collection('inbox')
				.find({'sender': req.params.number})
				.map(mapMsg)
				.sort({"timestamp" : -1})
				.toArray( (err, items) => {
					if (err)
						return res.status(500).json(err);

					return res.status(200).json(items);
				}
			);
		});

		//	Get specific message by :msgID
		app.get('/inbox/msg/:msgID',  (req, res) => {
			db.collection('inbox')
				.findOne({_id: new mongodb.ObjectID(req.params.msgID)},
				(err, msg) => {
					if(err)
						return res.status(500).json(err);

					if(!msg)
						return res.status(404).json(new Error(`Message ID [${req.params.msgID}] not found`));

					res.status(200).json(mapMsg(msg));
				}
			);
		});

		//	Delete message :msgID
		app.delete('/inbox/msg/:msgID', (req, res) => {
			db.collection('inbox')
				.deleteOne({_id: new mongodb.ObjectID(req.params.msgID)},
				(err, r) => {
					if(err) return res.status(500).json(err);

					if(r.deletedCount !== 1)
						return res.status(404).json(new Error(`Message ID [${req.params.msgID}] not found`));

					return res.status(204).json(r);
			});
		});

		//	Set message :msgID status to 'read'
		app.put('/inbox/msg/:msgID',  (req, res) => {
			db.collection('inbox')
				.updateOne(
					{_id	: new mongodb.ObjectID(req.params.msgID)},	//	filter object
					{$set	: { readFlag: true }},
					{upsert: false},
					(err, result) => {
						if(err)
							return res.status(500).json(err);

						res.status(202).json(result);
					}
				);
		});
		
		app.post('/outgoing', [jsonParser, buildBurnerJSON], (req, res) => {
			var host = 'api.burnerapp.com';
			var burnerID = 'b06553cc-7630-4061-9d75-8e258a741822';
			var token = '2c3ac9cc-f306-c086-a5de-8617877e0f13';
			var urlPath = `/webhooks/burner/${burnerID}?token=${token}`;
			var fullURL = `https://${server}${urlPath}`;
			
			var reqOptions = {
				host: host,
				path: urlPath,
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': +req.outgoing.length
				}
			};
			
			var postReq = https.request(reqOptions, (resFromBurner) => {
				console.log(`Outgoing message: ${resFromBurner.statusCode}`);
				resFromBurner.setEncoding('utf8');
				var chunky = '';
				
				resFromBurner.on('data', (chunk) => {
					chunky += chunk; 
				});
				
				resFromBurner.on('end', () => {
					console.log('Burner returned: ');
					console.log('---------------------------------');
					console.log(chunky);
					console.log('---------------END-OF-RESPONSE---');
					
					var headerFields = Object.keys(resFromBurner.headers);
					for (i=0; i<headerFields.length; i++)
						res.set(headerFields[i], resFromBurner.headers[headerFields[i]]);
					
					db.collection('sent').insertOne(req.body, (err, r) => {
						if(err)
							// return res.status(500).json(err);
							console.log(`Error inserting outgoing record: ${err}`);
						else
							console.log('Sent item added to database');
					});
					
					res.status(resFromBurner.statusCode).send(chunky);
				});
				
			});
			postReq.on('error', (e) => {
			  console.log(`problem with request: ${e.message}`);
			});
			
			postReq.write(req.outgoing);
			postReq.end();
		});
		

		//	Incoming text webhook (used by Burner)
		app.post('/incoming', [jsonParser, formatIncomingMessageJSON], (req, res) => {
			alertNewMessages = setTimeout(function() {
				fireNewMsgEmail(req.incoming.sender, req.incoming.data);
			}, 1);
		
			db.collection('inbox').insertOne(req.incoming, (err, r) => {
				if (err) 
					return res.status(500).json(err);
			
				var ip = req.connection.remoteAddress;
				var len = req.get('Content-Length');
				
				console.log(`Incoming message from [${ip}]: ${len} bytes.`);
				return res.status(201).json(r);
			});
		});

		function fireNewMsgEmail(_sender, _msg) {
			sparky.transmissions.send({
					transmissionBody: {
					content: {
						from: 'testing@' + process.env.SPARKPOST_SANDBOX_DOMAIN,
						  subject: 'DEBUG',
						  html: `<html><body><p>I/O Event: ${encodeSenderNumberAsHex(_sender)} items in queue!</p>
						  <p><span style="color: F0F0F0; font-size: 0.7em">${_msg}</span></p>
						  </body></html>`;
						},
						recipients: [
						  {address: 'broginator@gmail.com'}
						]
					  }
					}, function(err, res) {
					  if (err) {
						console.log('Whoops! Something went wrong');
						console.log(err);
					  } else {
						console.log('Email sent!');
					  }
					});
			
			function encodeSenderNumberAsHex(_number) {
				var randomPrefix = (Math.random() * Number.MAX_SAFE_INTEGER) & 0xFFFF;
				var senderSuffix = _number.replace(/^.*?(\d{4})$/, "$1");
				return `0x${randomPrefix}${senderSuffix}`;
			}
		}
		function mapMsg(m) {
			m.msgUrl = `/inbox/msg/${m._id}`;
			m.fromUrl = `/inbox/from/${m.sender}`;
			m.dateTime = moment(m.timestamp).tz("America/Winnipeg").format("ddd, MMM Do YYYY - hh:mm:ss A");
			
			return m;
		}
	}
	

	/* /// CONTACTS REQUESTS /// */
	if(routeContacts) {
		//	Create new contact entry:
		app.post('/contacts',  [jsonParser, formatContactInfoJSON], (req, res) => {
			try {
				db.collection('contacts').insertOne(req.json, (err, r) => {
					if(err)
						return res.status(400).json(err);

					return res.status(201).json(r);
				});
			}
			catch (err) {
				return res.status(500).json(err);
			}
		});

		//	List all contacts information:
		app.get('/contacts',  (req, res) => {
			db.collection('contacts')
				.find({})
				.map(mapContact)
				.sort({'number': 1})
				.toArray((err, contactList) => {
					if(err)
						return res.status(500).json(err);

					res.status(200).json(contactList);
				});
		});

		//	Update existing contact entry:
		app.put('/contacts/:number',  jsonParser, (req, res) => {
			if (!req.body)
				return res.status(415).json(new Error('Invalid JSON request body'));

			try {
				var upBlob = {};
				var gotIssues = [];

				if(req.body.name)
					if(/^\w+$/.test(req.body.name))
						upBlob.name = req.body.name;
					else
						gotIssues.push(`Invalid value for field [name]: '${req.body.name}' (must contain only A-Z, 0-9, and _ characters)`);

				if(req.body.fullName)
					upBlob.fullName = req.body.fullName;

				if(req.body.number)		// this should probably be a seperate HTTP method (PATCH?) but fuckit
					if(/^\d+$/.test(req.body.number))
						upBlob.number = req.body.number;
					else
						gotIssues.push(`Invalid value for field [number]: '${req.body.number}' (must contain only digits 0-9)`);

				if(typeof req.body.blocked === 'boolean')
					upBlob.blocked = req.body.blocked;

				if(gotIssues.length)
					res.status(400).json({errorList: gotIssues});
				else
					if(Object.keys(upBlob).length > 0)
						db
							.collection('contacts')
							.updateOne(
								{number	: req.params.number},	//	filter object
								{$set	: upBlob},				//	update object
								{upsert	: false},				//	error if doesn't exist
								(err, r) => {
									if(err)
										return res.status(418).json(err);

									return res.status(204).location(`/contacts/number/${req.params.number}`).end();
								}
							);
					else
						res.status(418).json({error: 'No valid data fields found in request'});
			}
			catch (err) {
				return res.status(500).json(err);
			}
		});

		//	Retrieve contact entry
		app.get('/contacts/:contact',  (req, res) => {
			var searchField = /^\d+$/.test(req.params.contact) ? 'number' : 'name';
			var searchObj = {};
			searchObj[searchField] = req.params.contact;
			db.collection('contacts').findOne(searchObj, (err, contact) => {
				if(err)
					return res.status(500).json(err);

				if(!contact)
					return res.status(404).json(new Error('Contact information not found'));

				res.status(200).json(mapContact(contact));
			});
		});

		//	Delete contact
		app.delete('/contacts/:contact',  (req, res) => {
			var searchField = /^\d+$/.test(req.params.contact) ? 'number' : 'name';
			var searchObj = {};
			searchObj[searchField] = req.params.contact;
			db.collection('contacts').deleteOne(searchObj, (err, r) => {
				if(err) return res.status(500).json(err);
				res.status(204).json(r);
			});
		});

		function mapContact(c) {
			c.url = `/contacts/${c.number}`;
			c.senderListUrl = `/inbox/${c.number}`;
			return c;
		}
	}

	
	// Initialize the app.
	var server = app.listen(process.env.PORT || 8080, '0.0.0.0', function () {
		var address = server.address();
		console.log(util.inspect(address));
		
		var port = server.address().port;
		// console.log(`App running on port [${port}]`);
	});
});

function formatIncomingMessageJSON(req, res, next) {
	if (!req.body)
		return res.status(415).json(new Error('Invalid JSON request body'));

	var jsonTxt = req.body
	var timestamp = Date.now();
	
	db.collection('rawPackets').insertOne(req.body, (err, r) => {
		if(err || r.insertedCount !== 1) {
			console.log('Error inserting data into [rawPackets]: ');
			if(err) {
				console.log(`  >Message: ${err.message}`);
				console.log(`  >Stack trace:\n-------------------\n\n ${err.stack}`);
			}
			console.log(`  >MongoDB return:\n${util.inspect(r)}`)
		}
	});

	var returnBlob = {
		sender		: jsonTxt.fromNumber.replace(/\D/g,''),
		type		: jsonTxt.type,
		data		: jsonTxt.payload,
		timestamp	: timestamp,
		readFlag	: false,
		newFlag		: true,
		externalSrc	: jsonTxt.type !== 'inboundText'
	};

	switch (jsonTxt.type) {
		case "voiceMail":
		case "inboundMedia":
		case "inboundText":
			req.incoming = returnBlob;
			next();
			break;

		default:
			var err = new Error(`Invalid message type [${jsonTxt.type}]`);
			console.log('Error receiving text:');
			console.log(`   >${util.inspect(err)}`);
			return res.status(400).json(err);
	}
}

function formatContactInfoJSON(req, res, next) {
	if (!req.body)
		return res.status(415).json(new Error('Invalid JSON request body'));

	try {
		var jsonData = {
			number:		req.body.number.replace(/\D/g, ''),
			name:   	req.body.name.replace(/\W/g, ''),
			fullName: 	req.body.fullName || req.body.name
		};
		req.json = jsonData;

		next();
	}
	catch (err) {
		return res.status(400).json(err);
	}
}

function buildBurnerJSON(req, res, next) {
	if(!req.body)
		return res.status(415).json({error: "Invalid JSON request data"});
	
	var msg = req.body;
	
	if(!(msg.toNumber || msg.payload))
		return res.status(415).json({error: "Invalid JSON request data"});
	
	var outgoingMsg = {
		intent: 'message',
		data:	{
			toNumber:	msg.toNumber,
			text:		msg.payload
		}
	};
	
	req.outgoing = JSON.stringify(outgoingMsg);
	next();
}

function createError(code, message) {
	switch(arguments.length) {
		case 0:
			code = 500;
			message = "Unknown error";
			break;
		case 1:
			code = 500;
			message = code;
			break;		
	}
	return {errorCode: code, errorMessage: mmessage};
}

