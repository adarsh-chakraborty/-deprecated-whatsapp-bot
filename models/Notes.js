const mongoose = require('mongoose');

//Define a schema
const Schema = mongoose.Schema;

const AuthToken = new Schema({ text: String }, { timestamps: true });
module.exports = mongoose.model('Notes', AuthToken, 'Notes');
