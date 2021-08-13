const fs = require('fs-extra');
const path = require('path');

const SUBSCRIBER_PATH = path.join(__dirname, '..', 'data', 'subscribers.json');

const getAllSubscribers = function() {
  const subscribers = fs.readJsonSync(SUBSCRIBER_PATH, { throws: false }) ?? [];
  return subscribers;
}

const addNewSubscriber = function(subscriber) {
  const subscribers = getAllSubscribers();
  subscribers.push(subscriber);

  try {
    fs.outputFileSync(SUBSCRIBER_PATH, JSON.stringify(subscribers, null, '\t'));
  } catch (err) {
    console.log('Failed to store subscriber:', err);
  }
}

module.exports = {
  getAllSubscribers,
  addNewSubscriber
}