var mongoose = require('mongoose'); mongoose.connect('mongodb://localhost/demo');
var async = require('async');
var transaction = require('./transaction.js')(mongoose,async);

var userSchema = new mongoose.Schema({
  _id: Schema.ObjectId,
  name: String,
  balance: Number,
});
var User = mongoose.model('User', userSchema);


var query_insert = {
	collection: "User",
	act: "insert",
	data: {
		name: "Testing",
		balance: "900",
	}
	mongoose_model: User,
};

var query_update = {
	collection: "User",
	act: "update",
	Id: "55e3cba74ea6565c0d11b48f",
	data: {
		name: "Updated",
		balance: "1290",
	},
	mongoose_model: User,
};

transaction.apply([query_insert,query_update], function(callback){
	console.log(callback);
});