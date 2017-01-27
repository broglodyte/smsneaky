var util = require('util');
require('dotenv').config()
const mongodb = require('mongodb')
const MongoClient = mongodb.MongoClient
const ObjectID = mongodb.ObjectID;

MongoClient.connect(process.env.MONGODB_URI, (err, db) => {
	if(err)
		return console.log(`DB connect error: ${err}`);
	
	db.collection('sent').findOne({_id: ObjectID('587ce5fe701ba728f0ad545f')}, (err, doc) => {
		debugger;
		if(err)
			console.log(`DB findOne error: ${err}`);
		
		if(doc) 
			console.log(`Document:         ${util.inspect(doc)}`);
		
		process.exit();
	});
});
