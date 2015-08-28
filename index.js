var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/myappdatabase');

var Schema = mongoose.Schema;

// create a schema
var userSchema = new Schema({
  id: ObjectID,
  name: String,
  balance: Integer,
});

// the schema is useless so far
// we need to create a model using it
var User = mongoose.model('User', userSchema);

var newUser = User({
	id : <>,
	name: "Habibie",
	balance: 1000
});

var newUser2 = User({
	id: <>, 
	name: "WP",
	balance: 2000
});

