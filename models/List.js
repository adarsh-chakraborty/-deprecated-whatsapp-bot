const mongoose = require('mongoose');

//Define a schema
const Schema = mongoose.Schema;

const AuthToken = new Schema({ items: [] }, { timestamps: true });
module.exports = mongoose.model('List', AuthToken, 'List');
