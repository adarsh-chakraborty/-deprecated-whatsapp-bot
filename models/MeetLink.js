const mongoose = require('mongoose');

const meetLinkSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: true,
      index: true
    },
    link: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('MeetLink', meetLinkSchema, 'MeetLinks');
