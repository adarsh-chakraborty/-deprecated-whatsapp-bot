var mongoose = require('mongoose');

//Define a schema
var Schema = mongoose.Schema;

var AuthToken = new Schema({}, { strict: false, timestamps: true });
module.exports = mongoose.model('WAtoken', AuthToken, 'WhatsappAuthToken');
