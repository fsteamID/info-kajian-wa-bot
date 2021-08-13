const fs = require('fs-extra');
const path = require('path');
const dayjs = require('dayjs');

// Configuring dayjs locale to use Indonesia
require('dayjs/locale/id');
dayjs.locale('id');

const EVENT_PATH = path.join(__dirname, '..', 'data', 'events.json');

const getAllSavedEvents = function() {
  const events = fs.readJsonSync(EVENT_PATH, { throws: false }) ?? [];
  return events;
}

const addNewEvent = function(event) {
  const events = getAllSavedEvents();
  events.push(event);

  try {
    fs.outputFileSync(EVENT_PATH, JSON.stringify(events, null, '\t'));
  } catch (err) {
    console.log('Failed to store event:', err);
  }
}

// Check the date actually exists in the content
const validateTodayEvent = function(content) {
  const date = dayjs();
  const year = date.year();
  const month = date.format('MMMM');
  const day = date.date();

  // Split on any whitespace (including newlines)
  const arr = content.trim().split(/\s+/);

  // Finding the year
  const yearIndex = arr.findIndex(s => s == year);

  if (yearIndex >= 0) {
    try {
      const contentMonth = arr[yearIndex - 1].trim();
      const contentDay = arr[yearIndex - 2].trim();
      if (
        contentMonth.toLowerCase() == month.toLowerCase() &&
        parseInt(contentDay) == day
      ) return true;
    } catch (err) {
      console.log('Failed to validate event date:', err);
    }
  }
  return false;
}

module.exports = {
  getAllSavedEvents,
  addNewEvent,
  validateTodayEvent
}