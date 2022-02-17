const mongoose = require('mongoose');

//Define a schema
const Schema = mongoose.Schema;

const AuthToken = new Schema({}, { strict: false, timestamps: true });
module.exports = mongoose.model('WAtoken', AuthToken, 'WhatsappAuthToken');
