

const routeMessages = true;
const routeContacts = true;

require('dotenv').config();
var util = require('util');
var fs = require('fs');
var path = require('path');
var moment = require('moment-timezone');
const crypto = require('crypto');

var express = require('express');
var jsonParser = require('body-parser').json();

var simpleAuth = require('./auth').simpleAuth;

// var SparkPost = require('sparkpost');
// console.log("API Key: " + process.env.SPARKPOST_API_KEY);
// var sparky = new SparkPost(process.env.SPARKPOST_API_KEY);

var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;

var db;

var app = express();

MongoClient.connect(process.env.MONGODB_URI, (err, database) => {
	if (err) {
		console.log(err);
		process.exit(1);
	}

	// Save database object from the callback for reuse.
	db = database;
	console.log("Database connection ready");

//	var passport = require('passport');
//	var Strategy = require('passport-http').BasicStrategy;
//	
//	passport.use(new Strategy({realm: 'Inbox'},
//		(username, password, callback) => {
//			const sha1 = crypto.createHash('sha1');
//			sha1.update(password);
//			sha1.update(':bitches');
//			var passDigest = sha1.digest('base64');
//			db.collection('auth_users')
//				.findOne(
//				{
//					user: username,
//					pass: passDigest
//				}, (err, userObj) => {
//					if(err) return callback(err);
//					if(!userObj) return callback(null, false);					
//					return callback(null, userObj);					
//				}
//			);
//		}
//	));
	
	app.use(express.static('public'));
	
//	console.log('Password [Basic] authentication enabled');
//	app.use(passport.authenticate('basic', { session: false }));
	
	app.get('/readMsg', (req, res) => {
		fs.readFile('readMessages.html', 'utf8', (err, data) => {
			if (err)
				res.status(500).send(err);
				
			res.send(data);
		});	
	});

	/* /// INBOX REQUESTS /// */
	if(routeMessages) {
		app.all('/inbox/*', simpleAuth);
		
		app.get('/inbox', simpleAuth, (req, res) => {
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
		
		app.get('/inbox/from', simpleAuth, (req, res) => {
			db.collection('inbox')
				.distinct("sender", (err, data) => {
					if(err)
						return res.status(500).json(err);
					else
						return res.status(200).json(data);
				});
			
		});

		app.get('/inbox/from/:number', simpleAuth, (req, res) => {
			db.collection('inbox')
				.find({'fromNumber': req.params.number})
				.map(mapMsg)
				.sort({"timestamp" : -1})
				.toArray( (err, items) => {
					if (err)
						return res.status(500).json(err);

					return res.status(200).json(items);
				}
			);
		});
		
		app.get('/inbox/msg/:msgID', simpleAuth, (req, res) => {
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
		
		app.delete('/inbox/msg/:msgID', simpleAuth, (req, res) => {
			db.collection('inbox')
				.deleteOne({_id: new mongodb.ObjectID(req.params.msgID)},
				(err, r) => {
					if(err) return res.status(500).json(err);
					
					if(!r.acknowledged || r.deletedCount !== 1)
						return res.status(404).json(new Error(`Resource msgID [${req.params.msgID}] not found`));
					
					return res.status(204).json(r);
			});
		});
		
		app.put('/inbox/msg/:msgID', simpleAuth, (req, res) => {
			db.collection('inbox')
				.updateOne(
					{_id	: new mongodb.ObjectID(req.params.msgID)},	//	filter object
					{$set	: { read: true }},
					{upsert: false},
					(err, result) => {
						if(err)
							return res.status(500).json(err);
						
						res.status(202).json(result);					
					}
				);
			
		});
		 
		app.post('/incoming', [jsonParser, formatIncomingMessageJSON], (req, res) => {
			// var pktCollectionResult;
			// var inboxCollectionResult;

		// sparky.transmissions.send({
		// transmissionBody: {
		// content: {
			// from: 'testing@' + process.env.SPARKPOST_SANDBOX_DOMAIN, // 'testing@sparkpostbox.com'
			  // subject: 'DEBUG MSG ',
			  // html:'<html><body><p>Msg Event 0x435asd9</p></body></html>'
			// },
			// recipients: [
			  // {address: 'broginator@icloud.com'}
			// ]
		  // }
		// }, function(err, res) {
		  // if (err) {
			// console.log('Whoops! Something went wrong');
			// console.log(err);
		  // } else {
			// console.log('Email sent!');
		  // }
		// });	
			db.collection('inbox').insertOne(req.incoming, (err, r) => {
				if (err)
					return res.status(500).json(err);

				return res.status(201).json(r);
			});
		});
		
		function mapMsg(m) {
			m.url = `/inbox/msg/${m._id}`;
			m.dateTime = moment(m.timestamp).tz("America/Winnipeg").format("ddd, MMM Do YYYY - hh:mm:ss A");
			
			return m;
		}
	}

	/* /// CONTACTS REQUESTS /// */
	if(routeContacts) {
		
		//	Create new contact entry:
		app.post('/contacts', simpleAuth, [jsonParser, formatContactInfoJSON], (req, res) => {
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

		//	Update existing contact entry:
		app.put('/contacts/:number', simpleAuth, jsonParser, (req, res) => {
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

		//	List all contacts information:
		app.get('/contacts', simpleAuth, (req, res) => {
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

		//	Retrieve contact entry
		app.get('/contacts/:contact', simpleAuth, (req, res) => {
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
		app.delete('/contacts/:contact', simpleAuth, (req, res) => {
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
	var server = app.listen(process.env.PORT || 8080, function () {
		var port = server.address().port;
		console.log(`App running on port [${port}]`);
	});
});

//app.get('/r', (req, res) => {
//	res.redirect(301, '/readMsg');
//});

app.get('/', (req, res) => {
	res.redirect(301, '/inbox');
});



function formatIncomingMessageJSON(req, res, next) {
	if (!req.body)
		return res.status(415).json(new Error('Invalid JSON request body'));

	db.collection('rawPackets').insertOne(req.body, (err, r) => {
		if(err || r.insertedCount !== 1)
			console.log('Error inserting data into [rawPackets]');
		else
			console.log('Inserted into [rawPackets]');
	});

	var jsonTxt = req.body
	var timestamp = Date.now();
	// var fmtDateTime = moment(timestamp).tz("America/Winnipeg").format("ddd, MMM Do YYYY - hh:mm:ss A");
		
	var returnBlob = {
		sender		: jsonTxt.fromNumber.replace(/\D/g, ''),
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
			return res.status(400).json(new Error(`Invalid message type [${jsonTxt.type}]`));
	}
}
function formatContactInfoJSON(req, res, next) {
	if (!req.body)
		return res.status(415).json(new Error('Invalid JSON request body'));

	try {
		var jsonData = {
			number: req.body.number.replace(/\D/g, ''),
			name:   req.body.name.replace(/\W/g, ''),
			fullName: req.body.fullName || req.body.name
		};
		
		req.json = jsonData;
		
		next();
	}
	catch (err) {
		return res.status(400).json(err);
	}
}