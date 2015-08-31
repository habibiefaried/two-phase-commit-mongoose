var mongoose = require('mongoose'); mongoose.connect('mongodb://localhost/demo');
var async = require('async');
var randomstring = require('randomstring');
var transaction = require('./transaction.js')(mongoose,async);

var userSchema = new mongoose.Schema({
  _id: mongoose.Schema.ObjectId,
  name: String,
  balance: Number,
});
var User = mongoose.model('User', userSchema);

var query_insert = {
	act: "insert",
	data: {
		_id: mongoose.Types.ObjectId(),
		name: randomstring.generate(10),
		balance: "10000",
	},
	mongoose_model: User,
};

var query_update = {
	act: "update",
	param: {
		name: "qtYEJhA6w4",
	}, //parameter update
	data: {
		name: "Updatedaa1",
		balance: "129001",
	},
	mongoose_model: User,
};

var query_delete = {
	act: "delete",
	param: {
		name: "CPnpIBypXg",
	}, //parameter delete
	mongoose_model: User,
};

transaction.apply([query_delete], function(callback){	
	User.find({}, function(err, users) {
	  if (err) throw err;
	  console.log(users);
	});
});
