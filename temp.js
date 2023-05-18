const mongoose = require('mongoose');
const keys = require('./tokens');
mongoose.set('strictQuery', false);
mongoose.connect(keys.mongouri, { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.log('Error with mongoDB'));

const useridSchema = new mongoose.Schema({
  chatId: {
      type: Number,
      unique: true
    },
});
const UserIds = mongoose.model('UserIds', useridSchema);

const numbersToSave = [
  1131349907,
  726083683,
  2041495192,
  5376384468,
  1179325145,
  1137641466,
  1118545804,
  1710137227,
  1718254224,
  919832522,
  1241391631,
  1287844351
];

UserIds.insertMany(numbersToSave.map(chatId => ({ chatId })))
  .then((savedNumbers) => {
    console.log('Numbers saved successfully:', savedNumbers);
  })
  .catch((error) => {
    console.error('Error saving numbers:', error);
  })
